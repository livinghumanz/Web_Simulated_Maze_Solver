/*
 * KAVWV round display (GC9A01 + ESP32, BLE) - minimal sender for the browser.
 *
 * Speaks the display's own protocol (W:/FreelanceProjects/GC9A01-Display-turnByTurn,
 * main/protocol.h) so the maze page can show the robot's moves as turn-by-turn
 * navigation: big arrow, distance text, progress arc, finish flag.
 *
 * Frame: [0] ver 0x01 | [1] type | [2] seq | [3] frag = (idx << 4) | total | body
 * Little-endian, no CRC, no handshake. Bodies are split into <= 16-byte pieces,
 * which is valid at any BLE MTU (Web Bluetooth does not expose the MTU).
 *
 * Works in the browser (window.KavwvDisplay) and in Node (module.exports) so the
 * encoders can be checked against the firmware's golden vectors.
 */
(function (root) {
  'use strict';

  const SVC = '2f5a0001-9c4e-4d3b-8a1f-5e6b7c8d9e01';
  const RX  = '2f5a0002-9c4e-4d3b-8a1f-5e6b7c8d9e01';   // central writes frames here

  const TYPE = { SET_CONFIG: 0x03, NAV_CORE: 0x11, ROUTE_SNIPPET: 0x13, HEARTBEAT: 0x14, SESSION: 0x15 };
  const CONFIG = { THEME: 5 };
  const THEME = { AUTO: 0, DAY: 1, NIGHT: 2 };   // AUTO = night from 20:00 to 06:00
  /* Heading in the display's 2-degree units for a maze direction. */
  const HEADING = { N: 0, E: 45, S: 90, W: 135 };
  const RIDER = { x: 120, y: 168 };     // where the display draws the chevron
  const MAX_ROUTE_POINTS = 64;
  const MODE = { IDLE: 0, NAVIGATING: 1 };
  const MANEUVER = { NONE: 0, DEPART: 1, ARRIVE: 2, STRAIGHT: 5, LEFT: 8, UTURN: 14, RIGHT: 12 };
  const MAX_BODY_PER_FRAME = 16;

  /* NavCore body, 21 bytes (protocol.h NavCore). Missing fields = "unknown". */
  function navCoreBody(f) {
    const b = new Uint8Array(21);
    const v = new DataView(b.buffer);
    v.setUint8(0, f.maneuver ?? 0);
    v.setUint8(1, f.exit ?? 0);
    v.setUint16(2, f.dist ?? 0xFFFF, true);          // to the maneuver, metres
    v.setUint32(4, f.remaining ?? 0, true);          // to destination, metres
    v.setUint16(8, f.remainingS ?? 0xFFFF, true);
    v.setUint16(10, f.eta ?? 0xFFFF, true);
    v.setUint16(12, f.speed ?? 0xFFFF, true);        // 0.1 km/h
    v.setUint8(14, f.heading ?? 0xFF);               // 2-degree units
    v.setUint8(15, f.flags ?? 0);
    v.setUint8(16, f.then ?? 0);
    v.setUint16(17, f.thenDist ?? 0, true);
    v.setUint8(19, f.progress ?? 0);                 // 0..100
    v.setUint8(20, f.speedLimit ?? 0);
    return b;
  }

  /* RouteSnippet body: points are absolute screen pixels (240x240 face),
   * heading-up, the rider fixed at RIDER. Segments before tailIdx are drawn
   * grey (trail), the rest dark (route ahead). One continuous polyline. */
  function routeSnippetBody(r) {
    const pts = (r.points || []).slice(0, MAX_ROUTE_POINTS);
    const b = new Uint8Array(5 + 2 * pts.length);
    b[0] = r.mppX10 ?? 30;
    b[1] = r.flags ?? 0;
    b[2] = pts.length;
    b[3] = r.manIdx ?? 0xFF;
    b[4] = r.tailIdx ?? 0;
    pts.forEach(([x, y], i) => {
      b[5 + 2 * i] = Math.max(0, Math.min(255, Math.round(x)));
      b[6 + 2 * i] = Math.max(0, Math.min(255, Math.round(y)));
    });
    return b;
  }

  /* Maze cells -> RouteSnippet, heading-up around the robot like a navigation
   * app. trail: cells driven (oldest first), pose: {x, y, d in N/E/S/W},
   * ahead: planned cells. cellM: metres per cell, mpp: metres per pixel. */
  const STEP = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };   // x east, y north
  const RIGHT_OF = { N: 'E', E: 'S', S: 'W', W: 'N' };
  function mazeRoute(trail, pose, ahead, cellM, mpp) {
    const f = STEP[pose.d], r = STEP[RIGHT_OF[pose.d]];
    const project = c => {
      const dx = (c.x - pose.x) * cellM, dy = (c.y - pose.y) * cellM;
      const forward = dx * f[0] + dy * f[1], right = dx * r[0] + dy * r[1];
      return [RIDER.x + right / mpp, RIDER.y - forward / mpp];
    };
    const t = trail.slice(-40);
    const pts = [...t.map(project), [RIDER.x, RIDER.y], ...ahead.slice(0, 20).map(project)];
    return { mppX10: Math.round(mpp * 10), points: pts.length >= 2 ? pts : [], tailIdx: t.length };
  }

  function heartbeatBody(mode, minutesOfDay, flags, battery) {
    const b = new Uint8Array(5);
    const v = new DataView(b.buffer);
    v.setUint8(0, mode);
    v.setUint16(1, minutesOfDay, true);
    v.setUint8(3, flags ?? 0);
    v.setUint8(4, battery ?? 0xFF);
    return b;
  }

  function setConfigBody(key, value) {
    return Uint8Array.of(key, value);
  }

  function sessionBody(mode, flags, lang) {
    return Uint8Array.of(mode, flags ?? 0, lang ?? 1, 0);
  }

  /* Split a message into frames. Same seq on every fragment. */
  function frames(type, seq, body, maxBody) {
    const per = maxBody ?? MAX_BODY_PER_FRAME;
    const total = Math.max(1, Math.ceil(body.length / per));
    if (total > 15) throw new Error('message too long');
    const out = [];
    for (let i = 0; i < total; i++) {
      const part = body.subarray(i * per, Math.min(body.length, (i + 1) * per));
      const f = new Uint8Array(4 + part.length);
      f[0] = 0x01; f[1] = type; f[2] = seq & 0xFF; f[3] = (i << 4) | total;
      f.set(part, 4);
      out.push(f);
    }
    return out;
  }

  const toHex = u8 => Array.from(u8, x => x.toString(16).padStart(2, '0')).join('');

  /* ---------------- browser link ---------------- */
  class Link {
    constructor(onStatus, options) {
      this.onStatus = onStatus || (() => {});
      /* The display resets its theme to AUTO on every power cycle: assert it on
       * each connect. Dark (night) palette always, as wanted for the demo. */
      this.theme = (options && options.theme !== undefined) ? options.theme : THEME.NIGHT;
      this.device = null;
      this.rx = null;
      this.seq = 0;
      this.queue = Promise.resolve();
      this.timer = null;
      this.nav = { maneuver: MANEUVER.DEPART };
      this.route = null;
    }

    get connected() { return !!(this.device && this.device.gatt.connected && this.rx); }

    async connect() {
      if (!('bluetooth' in navigator)) throw new Error('This browser has no Web Bluetooth (use Chrome or Edge)');
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'KAVWV-' }, { services: [SVC] }],
        optionalServices: [SVC],
      });
      this.device.addEventListener('gattserverdisconnected', () => {
        this.rx = null;
        this.stopTimer();
        this.onStatus('disconnected');
      });
      this.onStatus('connecting');
      const server = await this.device.gatt.connect();
      const svc = await server.getPrimaryService(SVC);
      this.rx = await svc.getCharacteristic(RX);
      /* Session first: mode/flags survive between connections on the display. */
      this.send(TYPE.SESSION, sessionBody(MODE.NAVIGATING, 0, 1));
      this.send(TYPE.SET_CONFIG, setConfigBody(CONFIG.THEME, this.theme));
      this.sendNav();
      this.sendRoute();                       // after a NavCore, as the display requires
      this.startTimer();
      this.onStatus('connected', this.device.name);
    }

    disconnect() {
      this.stopTimer();
      if (this.device && this.device.gatt.connected) this.device.gatt.disconnect();
      this.rx = null;
    }

    /* Show something: fields as in navCoreBody(). Re-sent every second. */
    setNav(fields) {
      this.nav = Object.assign({}, fields);
      this.sendNav();
    }

    sendNav() { this.send(TYPE.NAV_CORE, navCoreBody(this.nav)); }

    /* Heading only (2-degree units); the display rotates the last route by
     * (heading - heading at the time that route arrived). */
    setHeading(h) {
      this.nav = Object.assign({}, this.nav, { heading: h });
      this.sendNav();
    }

    /* Route line; held by the display until the next one (no re-send needed). */
    setRoute(route) {
      this.route = route;
      this.sendRoute();
    }

    sendRoute() { if (this.route) this.send(TYPE.ROUTE_SNIPPET, routeSnippetBody(this.route)); }

    send(type, body) {
      if (!this.rx) return;
      const seq = this.seq;
      this.seq = (this.seq + 1) & 0xFF;
      for (const f of frames(type, seq, body)) {
        /* GATT operations must not overlap: chain them. */
        this.queue = this.queue
          .then(() => this.rx.writeValueWithoutResponse(f))
          .catch(e => this.onStatus('error', e.message));
      }
    }

    startTimer() {
      this.stopTimer();
      /* Keep the display awake (dims after 2 s, "phone lost" after 5 s). */
      this.timer = setInterval(() => {
        const d = new Date();
        this.send(TYPE.HEARTBEAT, heartbeatBody(MODE.NAVIGATING, d.getHours() * 60 + d.getMinutes(), 0, 0xFF));
        this.sendNav();
      }, 1000);
    }

    stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  }

  const api = { SVC, RX, TYPE, MODE, MANEUVER, RIDER, CONFIG, THEME, HEADING, navCoreBody, routeSnippetBody,
                mazeRoute, heartbeatBody, sessionBody, setConfigBody, frames, toHex, Link };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KavwvDisplay = api;
})(typeof window !== 'undefined' ? window : globalThis);
