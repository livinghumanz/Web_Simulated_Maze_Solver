/*
 * RatRocket Werkstatt - the motor, PID and calibration workshop
 * (curriculum module 6: lessons 11 and 12, plus lesson P3).
 *
 * Three workshops, one per firmware mode (docs/firmware.md):
 *   Motoren & Pulse  motor-test mode (DIP SW2)    PWM, ENC, ENC0, JOG, SWEEP
 *   PID              PID-test mode (SW1 + SW2)    KP KI KD KFF KS, GAINS, TEL, FWD
 *   Kalibrieren      maze mode (SW3)              FWD, TURN, CALDIST, TRIM, TRACK,
 *                                                 CALSPIN, CENTER, CELL, KC, SAVE, CFG
 *
 * Every command waits first for the robot's echo ("> CMD": every console in
 * Core/Src/app_*.c prints it before it acts) and then for its own reply line,
 * each with a timeout; a silent robot gives the "antwortet nicht" message.
 * STOP is never locked and is sent again if its echo does not come back: the
 * firmware keeps only one unread line (bt_log.c, feed_rx_char), so a line can
 * be lost when two arrive within ~10 ms.
 *
 * The firmware prints "Mode: ..." only at boot, so after connecting the page
 * sends HELP and recognises the mode by the first help line; a boot banner
 * that arrives later (reset while Bluetooth stays connected) updates it.
 *
 * ?selftest=1          self-test with a stand-in robot (never a serial port)
 * ?demo=motor|pid|cal  fills one workshop from the stand-in robot (screenshots)
 * ?lang=en  ?motion=reduce
 *
 * Plain ASCII: umlauts in strings are \u escapes (texts: werkstatt-data.js).
 */
(function () {
  'use strict';

  const { TEXT } = window.WSData;
  const Q = location.search;
  const SELFTEST = /[?&]selftest=1\b/.test(Q);
  const DEMO = (/[?&]demo=(motor|pid|cal)\b/.exec(Q) || [])[1] || '';
  const LANGQ = (/[?&]lang=(de|en)\b/.exec(Q) || [])[1] || '';
  const RM = /[?&]motion=reduce\b/.test(Q) ||
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (RM) document.documentElement.classList.add('rm');

  const STORE = 'ratrocket.code';               /* language shared with RatRocket Code */
  const NS = 'http://www.w3.org/2000/svg';
  const CPR = 2874;                             /* encoder counts per wheel turn (motion.h) */
  const CPM = CPR / (Math.PI * 34);             /* counts per mm, wheel 34 mm */
  const PANES = ['motor', 'pid', 'cal'];
  const PANE_MODE = { motor: 'motor', pid: 'pid', cal: 'maze' };
  const SWITCHES = { motor: [0, 1, 0], pid: [1, 1, 0], maze: [0, 0, 1] };
  const BANNER_MODE = { MOTOR_TEST: 'motor', PID_TEST: 'pid', MAZE: 'maze', BT_TEST: 'bt', WEB_SIM: 'websim' };
  const HELP_MODE = { 'Motor test commands': 'motor', 'PID test commands': 'pid', 'Maze mode commands': 'maze', 'Commands:': 'bt' };

  /* reply lines, as printed by Core/Src/app_motor_test.c, app_pid_test.c, app_maze.c */
  const RE = {
    help: /^(Motor test commands|PID test commands|Maze mode commands|Commands:)/,
    banner: /^==== RatRocket/,
    mode: /^Mode: ([A-Z_]+)/,
    enc: /^ENC: L=(-?\d+) R=(-?\d+)/,
    encReset: /^ENC: reset/,
    tel: /^\[T\] t=(\d+) pwm=(-?\d+),(-?\d+) pos=(-?\d+),(-?\d+) cps=(-?\d+),(-?\d+)/,
    hb: /^\[HB\] t=\d+s sup=\d+mV pos=(-?\d+),(-?\d+)/,
    pwmEnd: /^PWM (done|aborted): moved L=(-?\d+) R=(-?\d+) counts/,
    pwmFail: /^usage: PWM|^ms must be/,
    jogEnd: /^JOG result: L moved (-?\d+), R moved (-?\d+) counts/,
    sweepHead: /^SWEEP @ (\d+) Hz/,
    sweepRow: /^\s*(\d+)\s+(-?\d+)\s+(-?\d+)\s*$/,
    sweepEnd: /^SWEEP (done|aborted)/,
    gains: /^GAINS: KP=(-?[\d.]+) KI=(-?[\d.]+) KD=(-?[\d.]+) KFF=(-?[\d.]+) KS=(-?[\d.]+)/,
    tele: /^telemetry every (\d+) ms/,
    p: /^\[P\] t=(\d+) vt=(-?\d+),(-?\d+) v=(-?\d+),(-?\d+) e=(-?\d+),(-?\d+) d=(-?\d+),(-?\d+)/,
    evEnd: /^\[EV\] (DONE|STOPPED|ABORT)/,
    evDone: /^\[EV\] DONE t=(\d+)ms dist=(-?\d+\.\d+)mm final err L=(-?\d+) R=(-?\d+) counts/,
    cfg0: /^CFG: size \d+ goal/,
    cfgEnd: /^\s+centring KC p=(-?[\d.]+) d=(-?[\d.]+)/,
    fwdMaze: /^FWD done \(event (\d+)\)/,
    turnMaze: /^TURN done \(event (\d+)\)/,
  };

  let lang = 'de';
  let tab = 'motor';
  let titleLock = false;

  /* ---------------- helpers ---------------- */
  const $ = (id) => document.getElementById(id);
  const qa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function t(key, vars) {
    let s = TEXT[lang] && TEXT[lang][key];
    if (s == null) s = TEXT.de[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (typeof vars[k] === 'function' ? vars[k]() : vars[k]) : m));
    return s;
  }
  const loc = () => (lang === 'en' ? 'en-GB' : 'de-DE');
  const nf = (x, d) => Number(x).toLocaleString(loc(), { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const nfx = (x, d) => Number(x).toLocaleString(loc(), { maximumFractionDigits: d == null ? 3 : d });
  /* big counter digits: narrow spaces, a real minus sign */
  const big = (n) => (n < 0 ? '\u2212' : '') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  /* numbers inside commands: dot, no trailing zeros, no exponent */
  const num = (v, d) => String(Number(Number(v).toFixed(d)));
  const r2 = (v) => Math.round(v * 100) / 100;
  function parseNum(s) {
    s = String(s == null ? '' : s).trim().replace(',', '.');
    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
    return Number(s);
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const B1 = '\u0001', B2 = '\u0002';
  const bold = (s) => B1 + s + B2;
  const html = (s) => esc(s).replace(/\u0001/g, '<b>').replace(/\u0002/g, '</b>');
  function sv(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ======================================================================
   * The link: Web Serial, or the stand-in robot (self-test, demo)
   * ==================================================================== */
  const link = { port: null, writer: null, reader: null, fake: null };
  let timeScale = 1;                            /* the self-test shortens every timeout */
  const connected = () => !!(link.port || link.fake);
  const listeners = new Set();
  let pending = null;                           /* the command waiting for its reply */

  function rawSend(line, quiet) {
    if (!quiet) logPush('\u2192 ' + line);
    if (link.fake) link.fake.rx(line);
    else if (link.writer) link.writer.write(line + '\r\n').catch(() => {});
  }

  function deliver(raw) {
    const line = String(raw).replace(/\r$/, '');
    if (!line.trim()) return;
    const quiet = pending && pending.poll && (/^> ENC\s*$/.test(line) || RE.enc.test(line));
    if (!quiet) logPush(line);
    /* a page bug must never stop the read loop (that would drop the robot) */
    try { passive(line); } catch (e) { console.error(e); }
    for (const f of Array.from(listeners)) { try { f(line); } catch (e) { console.error(e); } }
  }

  async function connectClick() {
    if (connected()) { await disconnect(); return; }
    if (!('serial' in navigator)) { say(tab, 'noSerial', null, 'bad'); return; }
    let p;
    try {
      p = await navigator.serial.requestPort();
      setLink('busy', t('connecting'));
      await p.open({ baudRate: 9600 });
    } catch (e) { renderLink(); return; }
    link.port = p;
    const enc = new TextEncoderStream();
    enc.readable.pipeTo(p.writable).catch(() => {});
    link.writer = enc.writable.getWriter();
    const dec = new TextDecoderStream();
    p.readable.pipeTo(dec.writable).catch(() => {});
    link.reader = dec.readable.getReader();
    readLoop();
    await afterConnect();
  }

  async function readLoop() {
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await link.reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          deliver(buf.slice(0, i));
          buf = buf.slice(i + 1);
        }
      }
    } catch (e) { /* link lost */ }
    if (link.port) disconnect();
  }

  async function disconnect() {
    if (hold) holdUp();
    try { if (link.reader) await link.reader.cancel(); } catch (e) { /* gone */ }
    try { if (link.writer) await link.writer.close(); } catch (e) { /* gone */ }
    try { if (link.port) await link.port.close(); } catch (e) { /* gone */ }
    if (link.fake) link.fake.out = null;
    link.port = link.writer = link.reader = link.fake = null;
    if (pending && pending.finish) pending.finish({ ok: false, reason: 'gone' });
    robotMode = null; modeState = 'none';
    renderLink(); renderModes(); syncLocks();
  }

  function useFake(bot) {
    link.fake = bot;
    bot.out = deliver;
  }

  async function afterConnect() {
    renderLink(); syncLocks(); renderModes();
    await detectMode();
  }

  /* ---------------- one command, its echo, its reply ----------------
   * o.done / o.fail: reply patterns that end the command
   * o.ms: time for the reply after the echo; o.ackMs: time for the echo
   * o.noEcho: the reply itself is awaited (HELP; the BT-test console echoes nothing)
   * o.poll: background ENC read: never blocks a user command, not logged */
  async function cmd(line, o) {
    o = o || {};
    if (!connected()) return { ok: false, reason: 'gone', cmd: line, lines: [] };
    while (pending && pending.poll && !o.poll) await pending.promise;
    if (pending) return { ok: false, reason: 'locked', cmd: line, lines: [] };
    const job = { line, poll: !!o.poll };
    pending = job;
    syncLocks();
    job.promise = new Promise((resolve) => {
      const up = line.toUpperCase();
      const lines = [];
      let acked = !!o.noEcho, timer = 0, ended = false;
      const finish = (r) => {
        if (ended) return;
        ended = true;
        listeners.delete(fn);
        clearTimeout(timer);
        r.lines = lines; r.cmd = line;
        resolve(r);
      };
      job.finish = finish;
      const arm = (ms) => { clearTimeout(timer); timer = setTimeout(() => finish({ ok: false, reason: 'silent' }), ms * timeScale); };
      const fn = (l) => {
        if (!acked) {
          const e = /^> (.*)$/.exec(l);
          if (e && e[1].trim().toUpperCase() === up) {
            acked = true;
            job.acked = true;
            arm(o.ms || 3000);
            if (o.onAck) o.onAck();
            return;
          }
          const b = /^(?:busy - ignored|\[BUSY\] ignored) '(.*)'/.exec(l);
          if (b && b[1].trim() === up) finish({ ok: false, reason: 'busy', line: l });
          return;
        }
        lines.push(l);
        if (/^\? unknown '/.test(l)) { finish({ ok: false, reason: 'unknown', line: l }); return; }
        if (o.onLine) o.onLine(l);
        let m;
        if (o.fail && (m = o.fail.exec(l))) { finish({ ok: false, reason: 'rejected', m, line: l }); return; }
        if (o.done && (m = o.done.exec(l))) finish({ ok: true, m, line: l });
      };
      listeners.add(fn);
      arm(o.noEcho ? (o.ackMs || 3000) : (o.ackMs || 2500));
      if (o.onSend) o.onSend();
      rawSend(line, o.poll);
    });
    const r = await job.promise;
    if (pending === job) pending = null;
    syncLocks();
    return r;
  }

  function waitLine(re, ms) {
    return new Promise((resolve) => {
      const fn = (l) => { const m = re.exec(l); if (m) { listeners.delete(fn); clearTimeout(to); resolve(m); } };
      const to = setTimeout(() => { listeners.delete(fn); resolve(null); }, ms * timeScale);
      listeners.add(fn);
    });
  }

  /* run fn once no command is waiting */
  function afterIdle(fn) {
    const go = () => { if (pending) setTimeout(go, 60); else fn(); };
    setTimeout(go, 0);
  }

  /* ---------------- STOP: never locked, re-sent until echoed ---------------- */
  async function stopAll(quiet) {
    if (hold && !hold.released) { hold.released = true; hold.stopSent = true; holdUi(false); }
    if (!connected()) { if (!quiet) say(tab, 'needBot', null, 'bad'); return false; }
    const btn = $('stopBtn');
    btn.classList.add('is-hit');
    for (let i = 0; i < 3; i++) {
      const w = waitLine(/^> STOP\s*$/i, 700);
      rawSend('STOP');
      if (await w) {
        btn.classList.remove('is-hit');
        if (!quiet) say(tab, 'stopped');
        /* a command that ends silently after STOP (e.g. CENTER) is released */
        const job = pending;
        if (job && !job.poll) setTimeout(() => { if (pending === job && job.finish) job.finish({ ok: false, reason: 'stopped' }); }, 2000 * timeScale);
        return true;
      }
    }
    btn.classList.remove('is-hit');
    say(tab, 'stopSilent', null, 'bad');
    return false;
  }

  /* ======================================================================
   * Robot mode (DIP switches)
   * ==================================================================== */
  let robotMode = null;                         /* motor | pid | maze | bt | websim | other */
  let modeState = 'none';                       /* none | checking | known | silent | stale */

  async function detectMode() {
    if (!connected()) return null;
    const prev = modeState;
    modeState = 'checking';
    renderModes();
    const r = await cmd('HELP', { noEcho: true, done: RE.help, ackMs: 3000 });
    if (r.ok) setMode(HELP_MODE[r.m[1]]);
    else if (r.reason === 'locked') { modeState = prev; renderModes(); }
    else if (modeState === 'checking') { robotMode = null; modeState = 'silent'; renderModes(); }
    return robotMode;
  }

  function setMode(m) {
    const changed = m !== robotMode || modeState !== 'known';
    robotMode = m;
    modeState = 'known';
    renderModes();
    if (changed) afterIdle(syncForMode);
  }

  function onBanner() {
    gains = null; cfg = null;
    if (pending && !pending.poll && pending.finish) pending.finish({ ok: false, reason: 'reset' });
    renderKnobs(); renderCfg(); renderWiz();
  }

  async function syncForMode() {
    if (!connected() || modeState !== 'known') return;
    if (robotMode === 'pid' && !gains) await cmd('GAINS', { done: RE.gains });
    if (robotMode === 'maze' && !cfg) await readCfg(true);
  }

  const modeVars = (pane) => ({
    have: () => t('mode_' + (robotMode || 'other')),
    sw: () => t('sw_' + PANE_MODE[pane]),
  });

  async function ensureMode(pane) {
    if (!connected()) { say(pane, 'needBot', null, 'bad'); return false; }
    if (modeState !== 'known') await detectMode();
    if (modeState === 'known' && robotMode === PANE_MODE[pane]) return true;
    if (modeState === 'silent') say(pane, 'silentMode', { sw: () => t('sw_' + PANE_MODE[pane]) }, 'bad');
    else say(pane, 'wrongMode', modeVars(pane), 'bad');
    flashStrip(pane);
    return false;
  }

  function modeStripHtml(pane) {
    const sw = SWITCHES[PANE_MODE[pane]];
    let dip = '<div class="w-dip" aria-hidden="true"><span class="w-dip-on">ON</span>';
    for (let i = 0; i < 4; i++) {
      dip += '<span class="w-sw' + (i === 3 ? ' is-na' : sw[i] ? ' is-on' : '') + '"><i></i><b>' + (i + 1) + '</b></span>';
    }
    dip += '</div>';
    return dip +
      '<div class="w-mode-txt"><span class="w-mode-k" data-t="modeLbl"></span>' +
      '<b class="w-mode-name" data-t="mode_' + PANE_MODE[pane] + '"></b>' +
      '<span class="w-mode-sw" data-t="sw_' + PANE_MODE[pane] + '"></span></div>' +
      '<div class="w-mode-end"><span class="w-chip" data-state="none"></span>' +
      '<button class="btn btn-sm w-act w-check" type="button" data-t="checkBtn"></button>' +
      '<button class="info" type="button" data-tip="i_mode" aria-label="Info">i</button>' +
      (pane !== 'cal' ? '<span class="w-safety"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg><span data-t="wheelsUp"></span>' +
        '<button class="info" type="button" data-tip="i_wheelsUp" aria-label="Info">i</button></span>' : '') +
      '</div>';
  }

  function renderModes() {
    qa('.w-mode').forEach((el) => {
      const want = PANE_MODE[el.dataset.pane];
      let st = 'none', txt = t('chipNone');
      if (connected()) {
        if (modeState === 'known') {
          if (robotMode === want) { st = 'ok'; txt = t('chipOk'); }
          else { st = 'bad'; txt = t('chipWrong', { have: t('mode_' + (robotMode || 'other')) }); }
        } else if (modeState === 'silent') { st = 'bad'; txt = t('chipSilent'); }
        else { st = 'checking'; txt = t('chipChecking'); }
      }
      el.dataset.state = st;
      const chip = el.querySelector('.w-chip');
      chip.dataset.state = st;
      chip.textContent = txt;
    });
    qa('.w-tab').forEach((b) => b.classList.toggle('is-live',
      connected() && modeState === 'known' && robotMode === PANE_MODE[b.dataset.tab]));
  }

  function flashStrip(pane) {
    const el = $('mode-' + pane);
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  /* ---------------- status lines ---------------- */
  const status = { motor: null, pid: null, cal: null };
  function say(pane, key, vars, kind) {
    status[pane] = { key, vars, kind: kind || '' };
    renderStatus(pane);
  }
  function renderStatus(pane) {
    const s = status[pane], el = $('st-' + pane);
    el.textContent = s ? t(s.key, s.vars) : '';
    el.className = 'w-status' + (s && s.kind ? ' is-' + s.kind : '');
  }
  function report(pane, r) {
    const map = {
      silent: ['silent', { cmd: r.cmd }], busy: ['busy'], locked: ['locked'], gone: ['needBot'],
      reset: ['reset'], stopped: ['stopped'], rejected: ['rejected', { why: r.line || '' }], unknown: ['unknownCmd'],
    };
    const w = map[r.reason] || map.silent;
    say(pane, w[0], w[1], r.reason === 'stopped' ? '' : 'bad');
    if (r.reason === 'unknown') {
      modeState = 'stale';
      afterIdle(async () => {
        await detectMode();
        if (modeState === 'known' && robotMode !== PANE_MODE[pane]) { say(pane, 'wrongMode', modeVars(pane), 'bad'); flashStrip(pane); }
      });
    }
  }

  /* ---------------- the robot's lines, whoever asked ---------------- */
  let cfgBlock = null, cfgTail = false;
  function passive(l) {
    let m;
    if (RE.banner.test(l)) { onBanner(); return; }
    if ((m = RE.mode.exec(l))) { setMode(BANNER_MODE[m[1]] || 'other'); return; }
    if ((m = RE.tel.exec(l))) { counts(+m[4], +m[5], +m[6], +m[7]); return; }
    if ((m = RE.hb.exec(l)) || (m = RE.enc.exec(l))) { counts(+m[1], +m[2]); return; }
    if (RE.encReset.test(l)) { counts(0, 0, 0, 0); return; }
    if ((m = RE.gains.exec(l))) { setGains(m); return; }
    if (RE.cfg0.test(l)) { cfgBlock = [l]; cfgTail = false; }
    else if (cfgBlock && /^\s{3,}\S/.test(l)) cfgBlock.push(l);
    else if (cfgTail && cfg && /^\s{3,}\S/.test(l)) { cfg.lines.push(l); renderCfg(); return; }  /* newer firmware: more lines (imu ...) */
    else { cfgBlock = null; cfgTail = false; }
    if (cfgBlock && RE.cfgEnd.test(l)) { parseCfg(cfgBlock); cfgBlock = null; cfgTail = true; }
  }

  /* ---------------- locks ---------------- */
  function syncLocks() {
    const busy = !!(pending && !pending.poll);
    qa('.w-act').forEach((b) => { b.disabled = busy || b.dataset.gate === '0'; });
    qa('.w-gain').forEach((i) => { i.disabled = busy; });
    $('holdBtn').disabled = busy && !hold;
    $('stopBtn').disabled = false;
  }
  const gate = (el, open) => { el.dataset.gate = open ? '1' : '0'; };

  /* ======================================================================
   * 1  Motoren & Pulse
   * ==================================================================== */
  const duty = { L: 0, R: 0 };
  const view = { L: 0, R: 0, cpsL: 0, cpsR: 0, last: null };
  let hold = null;
  let pollOn = true, pollFails = 0, pollPause = 0;

  function wheelHtml(w) {
    let spokes = '';
    for (let i = 0; i < 5; i++) {
      const a = i * 72 * Math.PI / 180;
      spokes += '<line class="w-spoke" x1="' + (8 * Math.sin(a)).toFixed(1) + '" y1="' + (-8 * Math.cos(a)).toFixed(1) +
        '" x2="' + (27 * Math.sin(a)).toFixed(1) + '" y2="' + (-27 * Math.cos(a)).toFixed(1) + '"/>';
    }
    return '<div class="w-wheel-head"><b data-t="wheel' + w + '"></b><small data-t="fromOutside"></small></div>' +
      '<svg class="w-wsvg" viewBox="-64 -64 128 128" aria-hidden="true">' +
      '<g class="w-arc" id="arc' + w + '"><path class="w-arc-line" d="M -38.2 -38.2 A 54 54 0 0 1 38.2 -38.2"/>' +
      '<path class="w-arc-head" d="M 44.6 -31.8 L 41.2 -45.4 L 31.6 -35.8 Z"/></g>' +
      '<circle class="w-tyre" r="41"/>' +
      '<g class="w-rot" id="rot' + w + '"><circle class="w-rim" r="29"/>' + spokes +
      '<path class="w-flag" d="M -2 -40 L -2 -56 L 12 -50 L 2 -46 L 2 -40 Z"/></g>' +
      '<circle class="w-hub" r="7"/></svg>' +
      '<div class="w-count"><output class="w-big" id="cnt' + w + '">0</output><span class="w-unit" data-t="pulses"></span></div>' +
      '<div class="w-speed"><span id="cps' + w + '">0</span> <span data-t="perSec"></span></div>' +
      '<div class="w-dir" id="dir' + w + '" data-dir="none"><span class="w-dir-ico" aria-hidden="true"></span><span class="w-dir-txt"></span></div>' +
      '<div class="w-duty"><div class="w-duty-head"><label for="duty' + w + '" data-t="duty"></label>' +
      '<output id="duty' + w + 'v">0</output><button class="info" type="button" data-tip="i_duty" aria-label="Info">i</button></div>' +
      '<div class="w-duty-track"><span class="w-dead" id="dead' + w + '" hidden></span>' +
      '<input type="range" id="duty' + w + '" min="-1010" max="1010" step="10" value="0"></div>' +
      '<div class="w-duty-scale"><span>\u22121010</span><button class="w-zero" type="button" data-zero="' + w + '" aria-label="0">0</button><span>1010</span></div></div>';
  }

  function counts(L, R, cl, cr) {
    const now = performance.now();
    if (cl == null) {                            /* speed from two readings (turned by hand) */
      cl = 0; cr = 0;
      if (view.last) {
        const dt = (now - view.last.t) / 1000;
        if (dt > 0.05 && dt < 3) { cl = (L - view.last.L) / dt; cr = (R - view.last.R) / dt; }
      }
    }
    view.last = { t: now, L, R };
    view.L = L; view.R = R; view.cpsL = cl; view.cpsR = cr;
    renderCounts();
  }

  function renderCounts() {
    for (const w of ['L', 'R']) {
      $('cnt' + w).textContent = big(view[w]);
      $('cps' + w).textContent = big(view['cps' + w]);
      /* seen from outside, forward is anticlockwise on the left wheel and clockwise on the right */
      const a = (w === 'L' ? -1 : 1) * view[w] / CPR * 360;
      $('rot' + w).style.transform = 'rotate(' + a.toFixed(1) + 'deg)';
    }
  }

  function dirOf(w, d) {
    if (!d) return 'none';
    const fwd = d > 0;
    return (w === 'L') === fwd ? 'ccw' : 'cw';
  }
  function renderDirs() {
    for (const w of ['L', 'R']) {
      const d = duty[w], dir = dirOf(w, d), el = $('dir' + w);
      el.dataset.dir = dir;
      el.querySelector('.w-dir-ico').textContent = dir === 'cw' ? '\u21bb' : dir === 'ccw' ? '\u21ba' : '\u2022';
      el.querySelector('.w-dir-txt').textContent = dir === 'none' ? t('dirStill')
        : t(d > 0 ? 'dirFwd' : 'dirBack') + ' \u00b7 ' + t(dir === 'cw' ? 'dirCw' : 'dirCcw');
      const arc = $('arc' + w);
      arc.setAttribute('visibility', dir === 'none' ? 'hidden' : 'visible');
      arc.setAttribute('transform', dir === 'ccw' ? 'scale(-1 1)' : '');
      $('duty' + w + 'v').textContent = (d < 0 ? '\u2212' : '') + Math.abs(d);
      $('duty' + w).value = d;
      $('dead' + w).title = t('deadHint');
    }
  }
  function setDuty(w, v) {
    duty[w] = Math.max(-1010, Math.min(1010, Math.round(v / 10) * 10));
    renderDirs();
  }

  function holdUi(on) {
    const b = $('holdBtn');
    b.classList.toggle('is-on', on);
    b.querySelector('b').textContent = t(on ? 'holdRun' : 'hold');
  }

  async function holdDown() {
    if (hold) return;
    const h = hold = { released: false, acked: false, stopSent: false, sentAt: 0, t0: performance.now(), tUp: 0 };
    holdUi(true);
    const ok = await ensureMode('motor');
    if (!ok || h.released || (!duty.L && !duty.R)) {
      if (ok && h.released) say('motor', 'holdShort');
      else if (ok) say('motor', 'setDuty', null, 'bad');
      hold = null; holdUi(false); syncLocks();
      return;
    }
    say('motor', 'pwmRunning');
    const r = await cmd('PWM ' + duty.L + ' ' + duty.R + ' 10000', {
      done: RE.pwmEnd, fail: RE.pwmFail, ms: 13000,
      onSend: () => { h.sentAt = performance.now(); armStop(h); },
      onAck: () => { h.acked = true; armStop(h); },
    });
    const quick = h.released && h.tUp - h.t0 < 350 * timeScale;
    hold = null;
    holdUi(false);
    syncLocks();
    pwmResult(r, quick);
  }
  function holdUp() {
    const h = hold;
    if (!h || h.released) return;
    h.released = true;
    h.tUp = performance.now();
    holdUi(false);
    armStop(h);
  }
  /* After release: STOP right after the robot's echo of PWM, or at the latest
     150 ms after PWM went out (echo lost). Never sooner: a STOP arriving in the
     same ~10 ms as the PWM line would be dropped by the one-line buffer. */
  function armStop(h) {
    if (!h.released || h.stopSent || !h.sentAt) return;
    if (h.acked) { stopFor(h); return; }
    const wait = Math.max(0, h.sentAt + 150 * timeScale - performance.now());
    setTimeout(() => { if (!h.stopSent && hold === h) stopFor(h); }, wait);
  }
  function stopFor(h) { if (h.stopSent) return; h.stopSent = true; stopAll(true); }

  function pwmResult(r, quick) {
    if (r.ok) {
      if (quick) say('motor', 'holdShort');
      else say('motor', r.m[1] === 'done' ? 'pwmDone' : 'pwmAborted', { l: big(+r.m[2]), r: big(+r.m[3]) }, 'ok');
    } else report('motor', r);
  }

  async function pwm2() {
    if (!(await ensureMode('motor'))) return;
    if (!duty.L && !duty.R) { say('motor', 'setDuty', null, 'bad'); return; }
    say('motor', 'pwmRunning');
    const r = await cmd('PWM ' + duty.L + ' ' + duty.R + ' 2000', { done: RE.pwmEnd, fail: RE.pwmFail, ms: 5000 });
    pwmResult(r, false);
  }

  async function enc0() {
    if (!(await ensureMode('motor'))) return;
    const r = await cmd('ENC0', { done: RE.encReset });
    if (r.ok) say('motor', 'encZero', null, 'ok'); else report('motor', r);
  }

  /* live counter: ENC while nothing runs (a running PWM reports [T] lines instead;
     the firmware ignores everything but STOP while the wheels turn) */
  async function pollTick() {
    if (!pollOn || tab !== 'motor' || !connected() || modeState !== 'known' || robotMode !== 'motor' ||
        pending || hold || document.hidden || Date.now() < pollPause) return;
    const r = await cmd('ENC', { poll: true, done: RE.enc, ms: 1500, ackMs: 1500 });
    if (r.ok) pollFails = 0;
    else if (r.reason === 'silent' && ++pollFails >= 2) {
      pollFails = 0;
      pollPause = Date.now() + 5000;
      say('motor', 'silent', { cmd: 'ENC' }, 'bad');
    }
  }

  /* ---------------- pulses per turn (JOG) ---------------- */
  const ppr = { wheel: 'L', n: 3000, frac: 0, moved: null, jw: 'L', res: null, rows: [] };

  function pprTurns() {
    const whole = parseNum($('pprTurns').value);
    const w = whole == null ? ($('pprTurns').value.trim() === '' ? 0 : null) : whole;
    if (w == null || w < 0 || Math.floor(w) !== w) return null;
    const tt = w + ppr.frac;
    return tt > 0 ? tt : null;
  }

  async function jog() {
    if (!(await ensureMode('motor'))) return;
    const w = ppr.wheel, n = ppr.n;
    ppr.moved = null; ppr.jw = w;
    ppr.res = { k: 'jogRun', v: { n: big(n) } };
    renderPpr();
    say('motor', 'jogRun', { n: big(n) });
    const r = await cmd('JOG ' + w + ' ' + n, { done: RE.jogEnd, fail: /^usage: JOG/, ms: 25000 });
    if (!r.ok) { ppr.res = null; renderPpr(); report('motor', r); return; }
    ppr.moved = Math.abs(+(w === 'L' ? r.m[1] : r.m[2]));
    ppr.res = { k: 'jogRes', v: { n: big(ppr.moved) }, ok: true };
    $('pprTurns').value = '';
    ppr.frac = 0;
    segSet('pprFrac', '0');
    say('motor', 'jogRes', { n: big(ppr.moved) }, 'ok');
    renderPpr();
  }

  function addPpr() {
    const tt = pprTurns();
    if (ppr.moved == null || tt == null) return;
    ppr.rows.push({ w: ppr.jw, p: ppr.moved, t: tt, r: ppr.moved / tt });
    ppr.moved = null; ppr.res = null;
    $('pprTurns').value = '';
    renderPpr();
  }

  function renderPpr() {
    segSet('pprWheel', ppr.wheel);
    segSet('pprN', String(ppr.n));
    segSet('pprFrac', String(ppr.frac));
    const res = $('jogRes');
    res.textContent = ppr.res ? t(ppr.res.k, ppr.res.v) : '';
    res.className = 'w-res' + (ppr.res && ppr.res.ok ? ' is-ok' : '');
    const tt = pprTurns();
    const can = ppr.moved != null && tt != null;
    $('pprCalc').innerHTML = can ? '<span>' + html(t('pprCalc', { p: big(ppr.moved), t: nfx(tt, 2), r: bold(big(ppr.moved / tt)) })) + '</span>' : '';
    $('pprAdd').disabled = !can;
    $('ppr-s2').classList.toggle('is-done', ppr.moved != null);
    $('ppr-s3').classList.toggle('is-cur', ppr.moved != null);
    $('pprBody').innerHTML = ppr.rows.map((row, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(t('w' + row.w)) + '</td><td>' +
      esc(big(row.p)) + '</td><td>' + esc(nfx(row.t, 2)) + '</td><td><b>' + esc(big(row.r)) + '</b></td></tr>').join('');
    if (ppr.rows.length) {
      const rs = ppr.rows.map((x) => x.r);
      $('pprMean').textContent = big(rs.reduce((a, b) => a + b, 0) / rs.length);
      $('pprSpread').textContent = rs.length > 1 ? big(Math.max.apply(null, rs) - Math.min.apply(null, rs)) : '\u2013';
    } else { $('pprMean').textContent = '\u2013'; $('pprSpread').textContent = '\u2013'; }
  }

  /* ---------------- SWEEP: duty against pulses per second ---------------- */
  const sweepS = { data: [], prev: null, freq: 0, draws: [] };

  async function sweep() {
    if (!(await ensureMode('motor'))) return;
    if (sweepS.data.length) sweepS.prev = sweepS.data;
    sweepS.data = [];
    drawSweep();
    say('motor', 'sweepRun', { n: 0 });
    const r = await cmd('SWEEP', {
      done: RE.sweepEnd, ms: 20000,
      onLine: (l) => {
        let m = RE.sweepHead.exec(l);
        if (m) { sweepS.freq = +m[1]; renderSweepExtras(); return; }
        m = RE.sweepRow.exec(l);
        if (m) {
          sweepS.data.push({ d: +m[1], l: +m[2], r: +m[3] });
          drawSweep(true);
          renderSweepExtras();
          say('motor', 'sweepRun', { n: sweepS.data.length });
        }
      },
    });
    if (!r.ok) { report('motor', r); return; }
    if (r.m[1] === 'aborted') say('motor', 'sweepAborted', null, 'bad');
    else say('motor', 'sweepDone', null, 'ok');
    renderSweepExtras();
  }

  /* the last duty at which each wheel still stood (null: it turned already at the first step) */
  function deadZones(data) {
    if (!data.length) return null;
    const out = {};
    for (const k of ['l', 'r']) {
      const mx = Math.max.apply(null, data.map((x) => Math.abs(x[k])));
      const thr = Math.max(50, 0.05 * mx);
      const i = data.findIndex((x) => Math.abs(x[k]) > thr);
      out[k] = i < 0 ? data[data.length - 1].d : i === 0 ? null : data[i - 1].d;
    }
    return out;
  }

  function drawSweep(fresh) {
    const data = sweepS.data, prev = sweepS.prev;
    const all = data.concat(prev || []);
    const vals = all.map((x) => x.l).concat(all.map((x) => x.r));
    const top = niceMax(Math.max(1000, Math.max.apply(null, vals.concat([0])) * 1.08));
    const low = Math.min(0, Math.min.apply(null, vals.concat([0])) * 1.08);
    const dz = deadZones(data);
    const bands = [];
    const edge = dz ? Math.max(dz.l || 0, dz.r || 0) : 0;
    if (edge > 0) bands.push({ x0: 0, x1: edge, label: t('deadZone') });
    const series = [];
    if (prev) {
      series.push({ pts: prev.map((x) => [x.d, x.l]), cls: 'ch-ghost' });
      series.push({ pts: prev.map((x) => [x.d, x.r]), cls: 'ch-ghost' });
    }
    series.push({ pts: data.map((x) => [x.d, x.l]), cls: 'ch-l', dots: 'ch-dot-l', end: t('wL'), tip: t('wheelL'), fresh });
    series.push({ pts: data.map((x) => [x.d, x.r]), cls: 'ch-r', dots: 'ch-dot-r', end: t('wR'), tip: t('wheelR'), fresh });
    drawChart($('sweepChart'), {
      x: [0, 1010], y: [low, top], xn: 5, series, bands,
      xLabel: t('xDuty'), yLabel: t('yCps'),
      empty: data.length || prev ? '' : t('sweepEmpty'),
      aria: t('sweepH'),
    });
    sweepS.draws.push(data.length);
  }

  function renderSweepExtras() {
    const data = sweepS.data;
    $('sweepFreq').textContent = sweepS.freq ? t('freq', { f: sweepS.freq }) : '';
    $('sweepLgPrev').hidden = !sweepS.prev;
    $('sweepBody').innerHTML = data.map((x) => '<tr><td>' + x.d + '</td><td>' + esc(big(x.l)) + '</td><td>' + esc(big(x.r)) + '</td></tr>').join('');
    const dz = deadZones(data);
    const done = data.length >= 9;
    $('sweepNote').textContent = dz && done ? t('deadNote', {
      l: dz.l == null ? t('deadNone') : dz.l,
      r: dz.r == null ? t('deadNone') : dz.r,
    }) : '';
    for (const w of ['L', 'R']) {
      const v = dz && done ? dz[w.toLowerCase()] : null;
      const el = $('dead' + w);
      el.hidden = !v;
      if (v) { el.style.left = '50%'; el.style.width = (v / 2020 * 100).toFixed(2) + '%'; }
    }
  }

  /* ======================================================================
   * 2  PID
   * ==================================================================== */
  const KNOBS = [
    { g: 'KP', badge: 'A', letter: 'P', min: 0, max: 12, step: 0.5 },
    { g: 'KI', badge: 'B', letter: 'I', min: 0, max: 24, step: 1 },
    { g: 'KD', badge: 'C', letter: 'D', min: 0, max: 0.5, step: 0.01 },
    { g: 'KFF', letter: 'FF', min: 0, max: 0.4, step: 0.01, more: true },
    { g: 'KS', letter: 'S', min: 0, max: 300, step: 5, more: true },
  ];
  const PRESETS = {
    soft: [['KP', 1], ['KI', 0], ['KD', 0]],
    sharp: [['KP', 9], ['KI', 18], ['KD', 0.3]],
    factory: [['KP', 3], ['KI', 6], ['KD', 0.05], ['KFF', 0.14], ['KS', 130]],
  };
  const PRESET_NAME = { soft: 'pSoft', sharp: 'pSharp', factory: 'pFactory' };
  let gains = null;
  const pid = { revealed: false, view: 'v', cur: null, prev: null, runs: [], count: 0 };

  function knobHtml(k) {
    return '<div class="w-knob" data-g="' + k.g + '">' +
      '<div class="w-knob-head"><span class="w-badge"></span><label class="w-knob-name" for="g' + k.g + '"></label>' +
      '<output class="w-knob-val" id="g' + k.g + 'v">\u2013</output></div>' +
      '<input class="w-gain" type="range" id="g' + k.g + '" data-g="' + k.g + '" min="' + k.min + '" max="' + k.max + '" step="' + k.step + '" value="' + k.min + '">' +
      '<div class="w-knob-scale"><span class="w-knob-min"></span><span class="w-knob-max"></span></div>' +
      '<p class="w-knob-hint" hidden></p></div>';
  }

  function setGains(m) {
    gains = { KP: +m[1], KI: +m[2], KD: +m[3], KFF: +m[4], KS: +m[5] };
    renderKnobs();
  }

  function renderKnobs() {
    KNOBS.forEach((k) => {
      const box = document.querySelector('.w-knob[data-g="' + k.g + '"]');
      const inp = $('g' + k.g);
      const dirty = inp.dataset.dirty === '1';
      if (gains && !dirty) inp.value = gains[k.g];
      $('g' + k.g + 'v').textContent = dirty ? nfx(+inp.value) : gains ? nfx(gains[k.g]) : '\u2013';
      box.querySelector('.w-knob-name').textContent = pid.revealed || k.more ? t('name' + k.g) : t('knob' + k.badge);
      box.querySelector('.w-badge').textContent = pid.revealed || k.more ? k.letter : k.badge;
      const hint = box.querySelector('.w-knob-hint');
      hint.textContent = pid.revealed ? t('hint' + k.g) : '';
      hint.hidden = !pid.revealed;
      box.querySelector('.w-knob-min').textContent = nfx(k.min);
      box.querySelector('.w-knob-max').textContent = nfx(k.max);
    });
    $('knobs').classList.toggle('is-revealed', pid.revealed);
    $('moreKnobs').hidden = !pid.revealed;
    $('revealBtn').textContent = t(pid.revealed ? 'hide' : 'reveal');
    $('phase1').classList.toggle('is-on', !pid.revealed);
    $('phase2').classList.toggle('is-on', pid.revealed);
    qa('.w-kh').forEach((th) => {
      th.textContent = pid.revealed ? { KP: 'Kp', KI: 'Ki', KD: 'Kd' }[th.dataset.k] : { KP: 'A', KI: 'B', KD: 'C' }[th.dataset.k];
    });
    renderRuns();
  }

  async function setGain(g, v) {
    const inp = $('g' + g);
    if (!(await ensureMode('pid'))) { inp.dataset.dirty = ''; renderKnobs(); return false; }
    const r = await cmd(g + ' ' + num(v, 3), { done: RE.gains, fail: /^usage: /, ms: 3000 });
    inp.dataset.dirty = '';
    renderKnobs();
    if (!r.ok) { report('pid', r); return false; }
    return true;
  }

  async function preset(name) {
    if (!(await ensureMode('pid'))) return;
    for (const [g, v] of PRESETS[name]) {
      if (!(await setGain(g, v))) return;
    }
    say('pid', 'presetSet', { p: () => t(PRESET_NAME[name]) }, 'ok');
  }

  function reveal(on) {
    pid.revealed = on;
    renderKnobs();
  }

  async function pidDrive() {
    if (!(await ensureMode('pid'))) return;
    say('pid', 'pidRunning');
    const tel = await cmd('TEL 100', { done: RE.tele, ms: 3000 });
    if (!tel.ok) { report('pid', tel); return; }
    if (pid.cur && pid.cur.s.length) pid.prev = pid.cur;
    const run = pid.cur = { s: [], gains: gains ? Object.assign({}, gains) : null, end: null, n: ++pid.count };
    let posT = 0, last = { t: 0, vt: 0 };
    drawPid(); renderPidResult();
    const r = await cmd('FWD 300', {
      done: RE.evEnd, fail: /^FWD rejected|^usage: FWD/, ms: 15000,
      onLine: (l) => {
        const m = RE.p.exec(l);
        if (m) {
          const s = { t: +m[1], vtL: +m[2], vtR: +m[3], vL: +m[4], vR: +m[5], eL: +m[6], eR: +m[7], dL: +m[8], dR: +m[9] };
          const vt = (s.vtL + s.vtR) / 2;
          posT += (last.vt + vt) / 2 * (s.t - last.t) / 1000;
          last = { t: s.t, vt };
          s.posT = posT; s.pL = posT - s.eL / CPM; s.pR = posT - s.eR / CPM;
          run.s.push(s);
          drawPid(true);
        }
        const d = RE.evDone.exec(l);
        if (d) run.end = { t: +d[1], dist: parseFloat(d[2]), eL: +d[3], eR: +d[4] };
      },
    });
    if (!r.ok) { report('pid', r); renderPidResult(); return; }
    run.max = run.s.reduce((a, s) => Math.max(a, Math.abs(s.eL), Math.abs(s.eR)), 0);
    if (r.m[1] === 'DONE' && run.end) {
      say('pid', 'pidDone', { l: big(run.end.eL), r: big(run.end.eR) }, 'ok');
      pid.runs.unshift(run);
      pid.runs = pid.runs.slice(0, 6);
    } else if (r.m[1] === 'STOPPED') say('pid', 'pidStopped');
    else say('pid', 'pidAbort', null, 'bad');
    drawPid(); renderPidResult(); renderRuns();
  }

  function renderPidResult() {
    const run = pid.cur;
    $('errL').textContent = run && run.end ? big(run.end.eL) : '\u2013';
    $('errR').textContent = run && run.end ? big(run.end.eR) : '\u2013';
    $('maxErr').textContent = run && run.s.length ? big(run.s.reduce((a, s) => Math.max(a, Math.abs(s.eL), Math.abs(s.eR)), 0)) + ' ' + t('pulsesShort') : '\u2013';
  }

  function renderRuns() {
    const g = (run, k) => (run.gains ? nfx(run.gains[k]) : '\u2013');
    $('runBody').innerHTML = pid.runs.map((run) => '<tr><td>' + run.n + '</td><td>' + esc(g(run, 'KP')) + '</td><td>' +
      esc(g(run, 'KI')) + '</td><td>' + esc(g(run, 'KD')) + '</td><td>' + esc(big(run.end.eL)) + '</td><td>' +
      esc(big(run.end.eR)) + '</td><td>' + esc(big(run.max)) + '</td></tr>').join('');
  }

  function drawPid(fresh) {
    const run = pid.cur, prev = pid.prev, v = pid.view;
    const S = run ? run.s : [];
    const P = prev ? prev.s : [];
    const tmax = Math.max(3.6, ...S.concat(P).map((s) => s.t / 1000 + 0.15));
    const pick = { v: (s) => [s.vL, s.vR, (s.vtL + s.vtR) / 2], p: (s) => [s.pL, s.pR, s.posT], e: (s) => [s.eL, s.eR, null] }[v];
    const ser = (arr, i) => [[0, 0]].concat(arr.map((s) => [s.t / 1000, pick(s)[i]]));
    const vals = S.concat(P).map(pick).flat().filter((x) => x != null);
    let y;
    if (v === 'v') y = [Math.min(0, ...vals), niceMax(Math.max(120, ...vals.map((x) => x * 1.1)))];
    else if (v === 'p') y = [Math.min(0, ...vals), niceMax(Math.max(320, ...vals.map((x) => x * 1.05)))];
    else { const m = niceMax(Math.max(20, ...vals.map((x) => Math.abs(x) * 1.15))); y = [-m, m]; }
    const series = [];
    if (P.length) { series.push({ pts: ser(P, 0), cls: 'ch-ghost' }); series.push({ pts: ser(P, 1), cls: 'ch-ghost' }); }
    if (v !== 'e' && S.length) series.push({ pts: ser(S, 2), cls: 'ch-soll', tip: t('lgSoll') });
    if (S.length) {
      series.push({ pts: ser(S, 0), cls: 'ch-l', end: t('wL'), tip: t('wheelL'), fresh });
      series.push({ pts: ser(S, 1), cls: 'ch-r', end: t('wR'), tip: t('wheelR'), fresh });
    }
    drawChart($('pidChart'), {
      x: [0, tmax], y, series, xLabel: t('xT'), yLabel: t({ v: 'yV', p: 'yP', e: 'yE' }[v]),
      xTipD: 1, empty: S.length || P.length ? '' : t('pidEmpty'), aria: t('pidRunH'),
    });
    $('pidLgSoll').hidden = v === 'e';
    $('pidLgPrev').hidden = !P.length;
  }

  /* ======================================================================
   * 3  Kalibrieren
   * ==================================================================== */
  let cfg = null;

  /* the arithmetic of the four wizards (checked by the self-test) */
  const CALC = {
    /* CALDIST <cmd> <act>: scale x cmd / act (app_maze.c), here in percent as CFG prints it */
    distScale(oldPct, cmdMm, actMm) {
      if (!(oldPct > 0 && cmdMm > 0 && actMm > 0)) return null;
      const v = oldPct * cmdMm / actMm;
      return v >= 50 && v <= 200 ? r2(v) : null;
    },
    /* docs/firmware.md: about 200 x sideways offset x track / distance^2, in %; + when it curves left */
    trimDelta(offMm, side, track, dist) { return (side === 'L' ? 1 : -1) * 200 * offMm * track / (dist * dist); },
    trimNew(old, delta) { const v = r2(old + delta); return Math.abs(v) <= 15 ? v : null; },
    turnOver(deg, dir) { return dir === 'far' ? deg : dir === 'short' ? -deg : 0; },
    /* new track = old x 360 / turned angle (curriculum P3), mean of both directions */
    track(old, overR, overL) {
      const a = 360 + (overR + overL) / 2;
      if (a < 180 || a > 720) return null;
      const v = Math.round(old * 360 / a * 10) / 10;
      return v > 20 && v < 300 ? v : null;
    },
    /* docs/firmware.md: weaves -> lower p, raise d; drifts -> raise p */
    kc(p, d, obs) {
      if (obs === 'weave') return { p: r2(p * 0.8), d: r2(d * 1.25) };
      if (obs === 'drift') return { p: r2(p * 1.25), d: r2(d) };
      return null;
    },
  };

  const W = {
    cur: 'dist',
    dist: { len: 300, drove: false, applied: false, saved: false, ask: false, goRes: null, applyRes: null, savedLines: null },
    trim: { len: 500, side: 'L', drove: false, applied: false, saved: false, ask: false, goRes: null, applyRes: null, savedLines: null },
    turn: { R: { done: false, dir: 'far', res: null }, L: { done: false, dir: 'far', res: null }, applied: false, saved: false, ask: false, applyRes: null, savedLines: null },
    kc: { learned: false, centred: false, celled: false, obs: '', applied: false, saved: false, ask: false, learnRes: null, centerRes: null, cellRes: null, applyRes: null, savedLines: null },
  };
  const SAVE_MARK = { dist: /distance scale/, trim: /distance scale/, turn: /track/, kc: /centring KC/ };

  function parseCfg(lines) {
    const all = lines.join('\n');
    const g = (re) => { const m = re.exec(all); return m ? m.slice(1).map(Number) : null; };
    const tr = g(/track (-?[\d.]+)/), sc = g(/distance scale (-?[\d.]+) trim (-?[\d.]+)%/), kc = g(/centring KC p=(-?[\d.]+) d=(-?[\d.]+)/);
    cfg = {
      lines: lines.slice(),
      track: tr ? tr[0] : null, scale: sc ? sc[0] : null, trim: sc ? sc[1] : null,
      kcP: kc ? kc[0] : null, kcD: kc ? kc[1] : null,
    };
    renderCfg(); renderWiz();
  }

  async function readCfg(quiet) {
    const r = await cmd('CFG', { done: RE.cfgEnd, ms: 3000 });
    if (!r.ok && !quiet) report('cal', r);
    return r.ok;
  }
  const ensureCfg = async () => (cfg ? true : readCfg());

  function renderCfg() {
    $('kvScale').textContent = cfg && cfg.scale != null ? nf(cfg.scale, 2) + ' %' : '\u2013';
    $('kvTrim').textContent = cfg && cfg.trim != null ? nf(cfg.trim, 2) + ' %' : '\u2013';
    $('kvTrack').textContent = cfg && cfg.track != null ? nf(cfg.track, 1) + ' mm' : '\u2013';
    $('kvKc').textContent = cfg && cfg.kcP != null ? nf(cfg.kcP, 2) + ' / ' + nf(cfg.kcD, 2) : '\u2013';
    $('cfgPre').textContent = cfg ? cfg.lines.join('\n') : '';
  }

  function res(id, o) {
    const el = $(id);
    el.textContent = o ? t(o.k, o.v) : '';
    el.className = 'w-res' + (o && o.ok ? ' is-ok' : '') + (o && o.bad ? ' is-bad' : '');
  }
  function steps(wiz, states) {
    qa('#wiz-' + wiz + ' .w-step').forEach((li) => {
      const s = states[li.dataset.s] || '';
      li.classList.toggle('is-done', s === 'done');
      li.classList.toggle('is-cur', s === 'cur');
    });
  }
  const cfgReady = () => !!(cfg && cfg.scale != null);

  function renderDist() {
    const w = W.dist, meas = parseNum($('distMeas').value);
    segSet('distLen', String(w.len));
    res('distGoRes', w.goRes); res('distApplyRes', w.applyRes);
    let h = '', can = false;
    if (w.drove && meas != null && meas > 0 && cfgReady()) {
      const nv = CALC.distScale(cfg.scale, w.len, meas);
      h = '<span>' + html(t('calcDistWhy', { act: nfx(meas, 1), cmd: w.len })) + '</span>';
      if (nv == null) h += '<span class="is-bad">' + esc(t('distRange')) + '</span>';
      else h += '<span>' + html(t('calcDist', { old: nf(cfg.scale, 2), cmd: w.len, act: nfx(meas, 1), new: bold(nf(nv, 2)) })) + '</span>';
      can = nv != null;
    }
    $('distCalc').innerHTML = h;
    gate($('distApply'), can);
    steps('dist', { 1: w.drove || w.applied ? 'done' : 'cur', 2: w.drove ? 'done' : 'cur', 3: w.applied ? 'done' : w.drove ? 'cur' : '', 4: w.saved ? 'done' : w.applied ? 'cur' : '' });
  }

  function renderTrim() {
    const w = W.trim, off = parseNum($('trimOff').value);
    segSet('trimLen', String(w.len)); segSet('trimSide', w.side);
    res('trimGoRes', w.goRes); res('trimApplyRes', w.applyRes);
    let h = '', can = false;
    if (w.drove && off != null && off >= 0 && cfgReady()) {
      if (off === 0) h = '<span>' + esc(t('trimOk')) + '</span>';
      else {
        const delta = CALC.trimDelta(off, w.side, cfg.track, w.len);
        const nv = CALC.trimNew(cfg.trim, delta);
        h = '<span>' + html(t('calcTrim', { s: nfx(off, 1), track: nfx(cfg.track, 1), d: w.len, delta: nf(Math.abs(delta), 2) })) + '</span>';
        if (nv == null) h += '<span class="is-bad">' + esc(t('trimRange')) + '</span>';
        else h += '<span>' + html(t('calcTrimNew', { old: nf(cfg.trim, 2), op: delta >= 0 ? '+' : '\u2212', abs: nf(Math.abs(delta), 2), new: bold(nf(nv, 2)) })) + '</span>';
        can = nv != null;
      }
    }
    $('trimCalc').innerHTML = h;
    gate($('trimApply'), can);
    steps('trim', { 1: w.drove || w.applied ? 'done' : 'cur', 2: w.drove ? 'done' : 'cur', 3: w.applied ? 'done' : w.drove ? 'cur' : '', 4: w.saved ? 'done' : w.applied ? 'cur' : '' });
  }

  function turnOver(side) {
    const s = W.turn[side];
    if (!s.done) return null;
    if (s.dir === 'exact') return 0;
    const d = parseNum($('turn' + side + 'Deg').value);
    if (d == null || d < 0 || d > 90) return null;
    return CALC.turnOver(d, s.dir);
  }

  function renderTurn() {
    const w = W.turn;
    segSet('turnRDir', w.R.dir); segSet('turnLDir', w.L.dir);
    res('turnRRes', w.R.res); res('turnLRes', w.L.res); res('turnApplyRes', w.applyRes);
    const oR = turnOver('R'), oL = turnOver('L');
    let h = '', can = false;
    if (oR != null && oL != null && cfgReady()) {
      const mean = (oR + oL) / 2;
      if (mean === 0) h = '<span>' + esc(t('turnExact')) + '</span>';
      else {
        const a = 360 + mean;
        const nv = CALC.track(cfg.track, oR, oL);
        const how = t(mean > 0 ? 'degFar' : 'degShort', { d: nfx(Math.abs(mean), 1) });
        h = '<span>' + html(t('calcTurnMean', { how, a: nfx(a, 1) })) + '</span>';
        if (nv != null) h += '<span>' + html(t('calcTurn', { old: nfx(cfg.track, 2), a: nfx(a, 1), new: bold(nfx(nv, 1)) })) + '</span>';
        can = nv != null;
      }
      if (Math.abs(oR - oL) >= 5) h += '<span class="w-asym">' + esc(t('turnAsym', { d: nfx(Math.abs(oR - oL), 1) })) + '</span>';
    }
    $('turnCalc').innerHTML = h;
    gate($('turnApply'), can);
    const both = w.R.done && w.L.done;
    steps('turn', { 1: w.R.done || w.applied ? 'done' : 'cur', 2: w.R.done ? 'done' : 'cur', 3: w.L.done ? 'done' : w.R.done ? 'cur' : '', 4: w.applied ? 'done' : both ? 'cur' : '', 5: w.saved ? 'done' : w.applied ? 'cur' : '' });
  }

  function renderKc() {
    const k = W.kc;
    segSet('kcObs', k.obs);
    res('kcLearnRes', k.learnRes); res('kcCenterRes', k.centerRes); res('kcCellRes', k.cellRes); res('kcApplyRes', k.applyRes);
    gate($('kcCenter'), k.learned);
    gate($('kcCell'), k.learned);
    let h = '', can = false;
    if (k.celled && k.obs && cfg && cfg.kcP != null) {
      const nv = CALC.kc(cfg.kcP, cfg.kcD, k.obs);
      if (!nv) h = '<span>' + esc(t('calcKcGood')) + '</span>';
      else if (k.obs === 'weave') h = '<span>' + html(t('calcKcWeave', { p0: nf(cfg.kcP, 2), p1: bold(nf(nv.p, 2)), d0: nf(cfg.kcD, 2), d1: bold(nf(nv.d, 2)) })) + '</span>';
      else h = '<span>' + html(t('calcKcDrift', { p0: nf(cfg.kcP, 2), p1: bold(nf(nv.p, 2)) })) + '</span>';
      can = !!nv;
    }
    $('kcCalc').innerHTML = h;
    gate($('kcApply'), can);
    qa('#kcObs .seg-btn').forEach((b) => { b.disabled = !k.celled; });
    steps('kc', { 1: k.learned ? 'done' : 'cur', 2: k.centred ? 'done' : k.learned ? 'cur' : '', 3: k.applied ? 'done' : k.centred || k.celled ? 'cur' : '', 4: k.saved ? 'done' : k.applied ? 'cur' : '' });
  }

  function saveHtml() {
    return '<div class="w-row"><button class="btn btn-primary w-act w-save-btn" type="button" data-t="save"></button>' +
      '<button class="info" type="button" data-tip="i_save" aria-label="Info">i</button></div>' +
      '<div class="w-ask" hidden><p data-t="saveAsk"></p><div class="w-row">' +
      '<button class="btn btn-go w-act w-save-yes" type="button" data-t="saveYes"></button>' +
      '<button class="btn btn-ghost w-save-no" type="button" data-t="saveNo"></button></div></div>' +
      '<div class="w-saved" hidden><p class="w-saved-msg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' +
      '<span data-t="saved"></span></p><pre class="w-cfgpre"></pre></div>';
  }

  function renderSaves() {
    qa('.w-save').forEach((box) => {
      const key = box.dataset.save, w = W[key];
      gate(box.querySelector('.w-save-btn'), w.applied && !w.saved);
      box.querySelector('.w-ask').hidden = !w.ask;
      box.querySelector('.w-saved').hidden = !w.saved;
      const pre = box.querySelector('.w-cfgpre');
      pre.innerHTML = (w.savedLines || []).map((l) => (SAVE_MARK[key].test(l) ? '<mark>' + esc(l) + '</mark>' : esc(l))).join('\n');
    });
  }

  function renderWiz() {
    qa('.w-wizcard').forEach((b) => {
      const w = W[b.dataset.wiz];
      b.setAttribute('aria-pressed', String(b.dataset.wiz === W.cur));
      const st = b.querySelector('.w-wizstate');
      st.textContent = w.saved ? t('wsSaved') : w.applied ? t('wsApplied') : '';
      st.dataset.state = w.saved ? 'saved' : w.applied ? 'applied' : '';
    });
    qa('.w-wiz').forEach((s) => { s.hidden = s.dataset.wiz !== W.cur; });
    renderDist(); renderTrim(); renderTurn(); renderKc(); renderSaves();
    syncLocks();
  }

  /* FWD <len> along a ruler (dist) or a tape line (trim) */
  async function wizDrive(key) {
    const w = W[key];
    if (!(await ensureMode('cal'))) return;
    w.drove = false;
    w.goRes = { k: 'driving' };
    $(key === 'dist' ? 'distMeas' : 'trimOff').value = '';
    renderWiz();
    say('cal', 'driving');
    const r = await cmd('FWD ' + w.len, { done: RE.fwdMaze, fail: /^FWD rejected|^usage: FWD/, ms: 25000 });
    if (!r.ok) { w.goRes = null; renderWiz(); report('cal', r); return; }
    const ev = +r.m[1];
    if (ev === 2) { w.drove = true; w.goRes = { k: 'driveDone', ok: true }; say('cal', 'driveDone', null, 'ok'); }
    else if (ev === 3) { w.goRes = { k: 'driveStopped' }; say('cal', 'driveStopped'); }
    else { w.goRes = { k: 'driveAbort', bad: true }; say('cal', 'driveAbort', null, 'bad'); }
    renderWiz();
    ensureCfg();
  }

  function finishApply(key, r, check, okRes) {
    const w = W[key];
    if (!r.ok || !check()) {
      w.applyRes = { k: 'notApplied', bad: true };
      if (!r.ok && r.reason !== 'rejected') report('cal', r); else say('cal', 'notApplied', null, 'bad');
      renderWiz();
      return false;
    }
    w.applied = true; w.saved = false; w.savedLines = null;
    w.applyRes = Object.assign({ ok: true }, okRes);
    /* the measurement is used up: the next one needs a new drive with the new value */
    if (key === 'dist' || key === 'trim') { w.drove = false; w.goRes = null; $(key === 'dist' ? 'distMeas' : 'trimOff').value = ''; }
    if (key === 'turn') {
      for (const s of ['R', 'L']) { w[s].done = false; w[s].res = null; $('turn' + s + 'Deg').value = ''; }
    }
    if (key === 'kc') { w.celled = false; w.obs = ''; w.cellRes = null; }
    say('cal', okRes.k, okRes.v, 'ok');
    renderWiz();
    return true;
  }

  async function distApply() {
    const w = W.dist, meas = parseNum($('distMeas').value);
    if (!(await ensureMode('cal')) || !(await ensureCfg())) return;
    const act = Number(num(meas, 1));
    const want = CALC.distScale(cfg.scale, w.len, act);
    if (want == null) { renderWiz(); return; }
    const r = await cmd('CALDIST ' + w.len + ' ' + num(act, 1), { done: RE.cfgEnd, fail: /^usage: CALDIST/, ms: 4000 });
    finishApply('dist', r, () => !!cfg && Math.abs(cfg.scale - want) <= 0.021,
      { k: 'applied', v: { what: () => t('whatScale', { v: nf(want, 2) }) } });
  }

  async function trimApply() {
    const w = W.trim, off = parseNum($('trimOff').value);
    if (!(await ensureMode('cal')) || !(await ensureCfg())) return;
    const want = CALC.trimNew(cfg.trim, CALC.trimDelta(off, w.side, cfg.track, w.len));
    if (want == null) { renderWiz(); return; }
    const r = await cmd('TRIM ' + num(want, 2), { done: RE.cfgEnd, fail: /^usage: TRIM/, ms: 4000 });
    finishApply('trim', r, () => !!cfg && Math.abs(cfg.trim - want) <= 0.011,
      { k: 'applied', v: { what: () => t('whatTrim', { v: nf(want, 2) }) } });
  }

  async function turnGo(side) {
    const s = W.turn[side];
    if (!(await ensureMode('cal'))) return;
    s.done = false;
    s.res = { k: 'turning' };
    $('turn' + side + 'Deg').value = '';
    renderWiz();
    say('cal', 'turning');
    const r = await cmd(side === 'R' ? 'TURN 360' : 'TURN -360', { done: RE.turnMaze, fail: /^TURN rejected|^usage: TURN/, ms: 30000 });
    if (!r.ok) { s.res = null; renderWiz(); report('cal', r); return; }
    const ev = +r.m[1];
    if (ev === 2) { s.done = true; s.res = { k: 'turnDone', ok: true }; say('cal', 'turnDone', null, 'ok'); }
    else if (ev === 3) { s.res = { k: 'driveStopped' }; say('cal', 'driveStopped'); }
    else { s.res = { k: 'driveAbort', bad: true }; say('cal', 'driveAbort', null, 'bad'); }
    renderWiz();
    ensureCfg();
  }

  async function turnApply() {
    if (!(await ensureMode('cal')) || !(await ensureCfg())) return;
    const oR = turnOver('R'), oL = turnOver('L');
    const want = oR == null || oL == null ? null : CALC.track(cfg.track, oR, oL);
    if (want == null) { renderWiz(); return; }
    const r = await cmd('TRACK ' + num(want, 1), { done: RE.cfgEnd, ms: 4000 });
    finishApply('turn', r, () => !!cfg && Math.abs(cfg.track - want) <= 0.051,
      { k: 'applied', v: { what: () => t('whatTrack', { v: nfx(want, 1) }) } });
  }

  async function kcLearn() {
    const k = W.kc;
    if (!(await ensureMode('cal'))) return;
    k.learnRes = { k: 'turning' };
    renderWiz();
    let got = null;
    const r = await cmd('CALSPIN', {
      done: /^CALSPIN: robot is \d+ mm (LEFT|RIGHT)|^CALSPIN failed/, ms: 30000,
      onLine: (l) => { const m = /^CALSPIN ok: centred L=(\d+) R=(\d+)/.exec(l); if (m) got = { l: m[1], r: m[2] }; },
    });
    if (!r.ok) { k.learnRes = null; renderWiz(); report('cal', r); return; }
    if (got && !/^CALSPIN failed/.test(r.line)) {
      k.learned = true;
      k.learnRes = { k: 'k1Res', v: got, ok: true };
      say('cal', 'k1Res', got, 'ok');
    } else {
      k.learnRes = { k: 'k1Fail', bad: true };
      say('cal', 'k1Fail', null, 'bad');
    }
    renderWiz();
  }

  async function kcCenter() {
    const k = W.kc;
    if (!(await ensureMode('cal'))) return;
    k.centerRes = { k: 'turning' };
    renderWiz();
    const r = await cmd('CENTER', {
      done: /^CENTER(?: done: L=\d+ R=\d+|: (already centred|no side wall|offset too large))/,
      fail: /^\[MAZE\] turn -?\d+ rejected/, ms: 30000,
    });
    if (!r.ok) { k.centerRes = null; renderWiz(); report('cal', r); return; }
    const why = r.m[1];
    if (!why || why === 'already centred') {
      k.centred = true;
      k.centerRes = { k: why ? 'k2Already' : 'k2Res', ok: true };
    } else k.centerRes = { k: 'k2Fail', bad: true };
    say('cal', k.centerRes.k, null, k.centerRes.ok ? 'ok' : 'bad');
    renderWiz();
  }

  async function kcCell() {
    const k = W.kc;
    if (!(await ensureMode('cal'))) return;
    k.cellRes = { k: 'driving' };
    k.obs = '';
    renderWiz();
    const r = await cmd('CELL', { done: /^CELL (done|failed)/, ms: 30000 });
    if (!r.ok) { k.cellRes = null; renderWiz(); report('cal', r); return; }
    k.celled = r.m[1] === 'done';
    k.cellRes = k.celled ? { k: 'cellDone', ok: true } : { k: 'cellFail', bad: true };
    say('cal', k.cellRes.k, null, k.celled ? 'ok' : 'bad');
    renderWiz();
    ensureCfg();
  }

  async function kcApply() {
    const k = W.kc;
    if (!(await ensureMode('cal')) || !(await ensureCfg())) return;
    const nv = CALC.kc(cfg.kcP, cfg.kcD, k.obs);
    if (!nv) return;
    const r = await cmd('KC ' + num(nv.p, 2) + ' ' + num(nv.d, 2), { done: RE.cfgEnd, ms: 4000 });
    finishApply('kc', r, () => !!cfg && Math.abs(cfg.kcP - nv.p) <= 0.011 && Math.abs(cfg.kcD - nv.d) <= 0.011,
      { k: 'applied', v: { what: () => t('whatKc', { p: nf(nv.p, 2), d: nf(nv.d, 2) }) } });
  }

  async function saveWiz(key) {
    const w = W[key];
    w.ask = false;
    renderWiz();
    if (!(await ensureMode('cal'))) return;
    say('cal', 'saving');
    const r = await cmd('SAVE', { done: /^SAVE (ok|FAILED)/, fail: /^SAVE: robot is moving/, ms: 8000 });
    if (!r.ok) { report('cal', r); return; }
    if (r.m[1] !== 'ok') { say('cal', 'saveFail', null, 'bad'); return; }
    await readCfg(true);
    w.saved = true;
    w.savedLines = cfg ? cfg.lines.slice() : [];
    say('cal', 'saved', null, 'ok');
    renderWiz();
  }

  /* ======================================================================
   * Charts (inline SVG on the dark stage)
   * ==================================================================== */
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw - 1e-12);
  }
  function niceMax(v) { const st = niceStep(v / 5); return Math.ceil(v / st - 1e-9) * st; }
  function ticks(a, b, n) {
    const st = niceStep((b - a) / n), out = [];
    for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10));
    return { v: out, d: st < 0.1 ? 2 : st < 1 ? 1 : 0 };
  }

  /* One SVG unit = one CSS pixel: the viewBox follows the rendered width, so
     the labels keep their size from a phone to a wide screen. A hidden pane
     measures 0 and draws at 640; showing the pane draws it again. */
  function drawChart(svg, o) {
    const Wd = Math.max(300, Math.round(svg.getBoundingClientRect().width) || 640);
    const H = Wd < 520 ? 250 : 300, ML = 54, MR = 34, MT = 28, MB = 40;
    svg.setAttribute('viewBox', '0 0 ' + Wd + ' ' + H);
    const pw = Wd - ML - MR, ph = H - MT - MB;
    const xn = Math.max(3, Math.min(o.xn || 6, Math.round(pw / 90)));
    const x0 = o.x[0], x1 = o.x[1], y0 = o.y[0], y1 = o.y[1];
    const sx = (x) => ML + (x - x0) / (x1 - x0) * pw;
    const sy = (y) => MT + ph - (y - y0) / (y1 - y0) * ph;
    svg.textContent = '';
    (o.bands || []).forEach((b) => {
      const xa = sx(b.x0), xb = sx(b.x1);
      sv('rect', { x: xa, y: MT, width: Math.max(0, xb - xa), height: ph, class: 'ch-band' }, svg);
      if (b.label) { const tx = sv('text', { x: xa + 7, y: MT + 16, class: 'ch-band-t' }, svg); tx.textContent = b.label; }
    });
    const yt = ticks(y0, y1, o.yn || 5), xt = ticks(x0, x1, xn);
    yt.v.forEach((v) => {
      const y = sy(v);
      sv('line', { x1: ML, x2: ML + pw, y1: y, y2: y, class: v === 0 && y0 < 0 ? 'ch-zero' : 'ch-grid' }, svg);
      const tx = sv('text', { x: ML - 8, y: y + 4, class: 'ch-tick', 'text-anchor': 'end' }, svg);
      tx.textContent = nf(v, yt.d);
    });
    xt.v.forEach((v) => {
      const x = sx(v);
      sv('line', { x1: x, x2: x, y1: MT + ph, y2: MT + ph + 5, class: 'ch-axis' }, svg);
      const tx = sv('text', { x, y: MT + ph + 19, class: 'ch-tick', 'text-anchor': 'middle' }, svg);
      tx.textContent = nf(v, xt.d);
    });
    sv('line', { x1: ML, x2: ML + pw, y1: MT + ph, y2: MT + ph, class: 'ch-axis' }, svg);
    sv('line', { x1: ML, x2: ML, y1: MT, y2: MT + ph, class: 'ch-axis' }, svg);
    const yl = sv('text', { x: ML - 8, y: 16, class: 'ch-lab' }, svg); yl.textContent = o.yLabel;
    const xl = sv('text', { x: ML + pw, y: H - 5, class: 'ch-lab', 'text-anchor': 'end' }, svg); xl.textContent = o.xLabel;
    const ends = [];
    o.series.forEach((s) => {
      if (!s.pts.length) return;
      sv('polyline', { points: s.pts.map((p) => sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1)).join(' '), class: s.cls }, svg);
      if (s.dots) {
        s.pts.forEach((p, i) => sv('circle', {
          cx: sx(p[0]).toFixed(1), cy: sy(p[1]).toFixed(1), r: 4.5,
          class: s.dots + (s.fresh && i === s.pts.length - 1 ? ' w-new' : ''),
        }, svg));
      }
      if (s.end) { const p = s.pts[s.pts.length - 1]; ends.push({ x: sx(p[0]), y: sy(p[1]), text: s.end }); }
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach((e) => { const tx = sv('text', { x: Math.min(e.x + 9, Wd - 14), y: e.y + 4, class: 'ch-end' }, svg); tx.textContent = e.text; });
    if (o.empty) {
      const tx = sv('text', { x: ML + pw / 2, y: MT + ph / 2, class: 'ch-empty', 'text-anchor': 'middle' }, svg);
      tx.textContent = o.empty;
    }
    const cur = sv('line', { x1: 0, x2: 0, y1: MT, y2: MT + ph, class: 'ch-cursor', visibility: 'hidden' }, svg);
    svg._ch = { o, sx, sy, ML, pw, x0, x1, cur, Wd };
    svg.setAttribute('aria-label', o.aria || '');
  }

  /* hover: a cursor line and the values of every named series at that time */
  function hoverInit(svg) {
    const tt = svg.parentNode.querySelector('.w-tt');
    const hide = () => { tt.hidden = true; if (svg._ch) svg._ch.cur.setAttribute('visibility', 'hidden'); };
    svg.addEventListener('pointermove', (e) => {
      const c = svg._ch;
      if (!c) return;
      const r = svg.getBoundingClientRect(), k = c.Wd / r.width;
      const px = (e.clientX - r.left) * k;
      if (px < c.ML || px > c.ML + c.pw) { hide(); return; }
      const xv = c.x0 + (px - c.ML) / c.pw * (c.x1 - c.x0);
      let snap = null;
      const rows = [];
      c.o.series.forEach((s) => {
        if (!s.tip || !s.pts.length) return;
        let best = s.pts[0];
        s.pts.forEach((p) => { if (Math.abs(p[0] - xv) < Math.abs(best[0] - xv)) best = p; });
        if (snap == null) snap = best[0];
        rows.push(esc(s.tip) + ': <b>' + esc(nf(best[1], 0)) + '</b>');
      });
      if (!rows.length) { hide(); return; }
      const x = c.sx(snap);
      c.cur.setAttribute('x1', x); c.cur.setAttribute('x2', x); c.cur.setAttribute('visibility', 'visible');
      tt.innerHTML = '<span>' + esc(c.o.xLabel) + ' ' + esc(nf(snap, c.o.xTipD || 0)) + '</span>' + rows.map((s) => '<span>' + s + '</span>').join('');
      tt.hidden = false;
      const left = x / k, w = tt.offsetWidth;
      let L = left + 12;
      if (L + w > r.width - 6) L = left - 12 - w;
      tt.style.left = Math.max(4, L) + 'px';
    });
    svg.addEventListener('pointerleave', hide);
  }

  /* ======================================================================
   * Page: tabs, segmented buttons, tips, language
   * ==================================================================== */
  function segSet(id, v) {
    qa('#' + id + ' .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  }
  function segInit(id, fn) {
    qa('#' + id + ' .seg-btn').forEach((b) => b.addEventListener('click', () => { segSet(id, b.dataset.v); fn(b.dataset.v); }));
  }

  function selectTab(name, focus) {
    tab = name;
    qa('.w-tab').forEach((b) => {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    qa('.w-pane').forEach((p) => { p.hidden = p.id !== 'pane-' + name; });
    if (!SELFTEST && !DEMO) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// */ } }
    hideTip();
    if (name === 'motor') drawSweep();
    if (name === 'pid') drawPid();
    afterIdle(syncForMode);
  }

  function setLink(cls, text) {
    $('linkState').className = 'link-state' + (cls ? ' ' + cls : '');
    $('linkText').textContent = text;
  }
  function renderLink() {
    if (link.fake) setLink('on', t('demoBot'));
    else if (link.port) setLink('on', t('robot'));
    else setLink('', t('notConnected'));
    $('connectBtn').textContent = link.port ? t('disconnect') : t('connect');
  }

  const logLines = [];
  let logT = 0;
  function logPush(s) {
    logLines.push(s);
    if (logLines.length > 400) logLines.splice(0, logLines.length - 400);
    if ($('logBox').open) scheduleLog();
  }
  function scheduleLog() {
    if (logT) return;
    logT = setTimeout(() => {
      logT = 0;
      const p = $('logPre');
      p.textContent = logLines.join('\n');
      p.scrollTop = p.scrollHeight;
    }, 120);
  }

  let tipFor = null;
  function showTip(btn) {
    const txt = t(btn.dataset.tip || '');
    if (!txt) return;
    const tip = $('tip');
    tip.textContent = txt;
    tip.hidden = false;
    const r = btn.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
    let top = r.bottom + 8;
    if (top + tr.height > window.innerHeight - 8) top = r.top - tr.height - 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tipFor = btn;
  }
  function hideTip() { $('tip').hidden = true; tipFor = null; }

  function applyLang() {
    document.documentElement.lang = lang;
    if (!titleLock) document.title = t('title');
    qa('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    qa('[data-al]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.al)));
    $('langBtn').textContent = t('lang');
    renderLink();
    PANES.forEach(renderStatus);
    renderModes(); renderDirs(); renderCounts(); renderPpr(); drawSweep(); renderSweepExtras();
    renderKnobs(); drawPid(); renderPidResult(); renderRuns(); renderWiz(); renderCfg();
    holdUi(!!(hold && !hold.released));
  }
  function loadLang() {
    if (LANGQ) { lang = LANGQ; return; }
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && (s.lang === 'de' || s.lang === 'en')) lang = s.lang;
    } catch (e) { /* private mode */ }
  }
  function saveLang() {
    if (SELFTEST || DEMO || LANGQ) return;
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null') || {};
      s.lang = lang;
      localStorage.setItem(STORE, JSON.stringify(s));
    } catch (e) { /* private mode */ }
  }

  /* ---------------- start ---------------- */
  function init() {
    loadLang();
    $('wheelL').innerHTML = wheelHtml('L');
    $('wheelR').innerHTML = wheelHtml('R');
    $('knobList').innerHTML = KNOBS.filter((k) => !k.more).map(knobHtml).join('');
    $('moreList').innerHTML = KNOBS.filter((k) => k.more).map(knobHtml).join('');
    PANES.forEach((p) => { $('mode-' + p).innerHTML = modeStripHtml(p); });
    qa('.w-save').forEach((b) => { b.innerHTML = saveHtml(); });

    $('connectBtn').addEventListener('click', connectClick);
    $('langBtn').addEventListener('click', () => { lang = lang === 'de' ? 'en' : 'de'; saveLang(); applyLang(); });
    $('stopBtn').addEventListener('click', () => stopAll(false));
    qa('.w-check').forEach((b) => b.addEventListener('click', async () => {
      const pane = b.closest('.w-mode').dataset.pane;
      if (!connected()) { say(pane, 'needBot', null, 'bad'); return; }
      await detectMode();
      if (modeState === 'known' && robotMode !== PANE_MODE[pane]) say(pane, 'wrongMode', modeVars(pane), 'bad');
      else if (modeState === 'silent') say(pane, 'silentMode', { sw: () => t('sw_' + PANE_MODE[pane]) }, 'bad');
      else if (modeState === 'known') say(pane, 'chipOk', null, 'ok');
    }));

    /* tabs, with arrow keys */
    qa('.w-tab').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));
    document.querySelector('.w-tabs').addEventListener('keydown', (e) => {
      const i = PANES.indexOf(tab);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); selectTab(PANES[(i + 1) % 3], true); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); selectTab(PANES[(i + 2) % 3], true); }
    });

    /* motor */
    for (const w of ['L', 'R']) $('duty' + w).addEventListener('input', (e) => setDuty(w, +e.target.value));
    qa('.w-zero').forEach((b) => b.addEventListener('click', () => setDuty(b.dataset.zero, 0)));
    const hb = $('holdBtn');
    hb.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      try { hb.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointer */ }
      holdDown();
    });
    hb.addEventListener('pointerup', holdUp);
    hb.addEventListener('pointercancel', holdUp);
    hb.addEventListener('lostpointercapture', holdUp);
    hb.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); holdDown(); } });
    hb.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); holdUp(); } });
    hb.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', holdUp);
    document.addEventListener('visibilitychange', () => { if (document.hidden) holdUp(); });
    $('pwm2Btn').addEventListener('click', pwm2);
    $('enc0Btn').addEventListener('click', enc0);
    segInit('pprWheel', (v) => { ppr.wheel = v; });
    segInit('pprN', (v) => { ppr.n = +v; });
    segInit('pprFrac', (v) => { ppr.frac = +v; renderPpr(); });
    $('pprTurns').addEventListener('input', renderPpr);
    $('jogBtn').addEventListener('click', jog);
    $('pprAdd').addEventListener('click', addPpr);
    $('sweepBtn').addEventListener('click', sweep);

    /* PID */
    qa('.w-gain').forEach((inp) => {
      inp.addEventListener('input', () => { inp.dataset.dirty = '1'; $(inp.id + 'v').textContent = nfx(+inp.value); });
      inp.addEventListener('change', async () => { if (await setGain(inp.dataset.g, +inp.value)) say('pid', 'gainSet', null, 'ok'); });
    });
    qa('[data-preset]').forEach((b) => b.addEventListener('click', () => preset(b.dataset.preset)));
    $('revealBtn').addEventListener('click', () => reveal(!pid.revealed));
    $('fwdBtn').addEventListener('click', pidDrive);
    segInit('pidView', (v) => { pid.view = v; drawPid(); });

    /* calibration */
    qa('.w-wizcard').forEach((b) => b.addEventListener('click', () => { W.cur = b.dataset.wiz; renderWiz(); }));
    segInit('distLen', (v) => { W.dist.len = +v; W.dist.drove = false; W.dist.goRes = null; renderWiz(); });
    segInit('trimLen', (v) => { W.trim.len = +v; W.trim.drove = false; W.trim.goRes = null; renderWiz(); });
    segInit('trimSide', (v) => { W.trim.side = v; renderWiz(); });
    segInit('turnRDir', (v) => { W.turn.R.dir = v; renderWiz(); });
    segInit('turnLDir', (v) => { W.turn.L.dir = v; renderWiz(); });
    segInit('kcObs', (v) => { W.kc.obs = v; renderWiz(); });
    ['distMeas', 'trimOff', 'turnRDeg', 'turnLDeg'].forEach((id) => $(id).addEventListener('input', renderWiz));
    $('distGo').addEventListener('click', () => wizDrive('dist'));
    $('trimGo').addEventListener('click', () => wizDrive('trim'));
    $('distApply').addEventListener('click', distApply);
    $('trimApply').addEventListener('click', trimApply);
    $('turnRGo').addEventListener('click', () => turnGo('R'));
    $('turnLGo').addEventListener('click', () => turnGo('L'));
    $('turnApply').addEventListener('click', turnApply);
    $('kcLearn').addEventListener('click', kcLearn);
    $('kcCenter').addEventListener('click', kcCenter);
    $('kcCell').addEventListener('click', kcCell);
    $('kcApply').addEventListener('click', kcApply);
    $('cfgBtn').addEventListener('click', async () => { if (await ensureMode('cal')) await readCfg(); });
    qa('.w-save').forEach((box) => {
      const key = box.dataset.save;
      box.querySelector('.w-save-btn').addEventListener('click', () => { W[key].ask = true; renderWiz(); });
      box.querySelector('.w-save-no').addEventListener('click', () => { W[key].ask = false; renderWiz(); });
      box.querySelector('.w-save-yes').addEventListener('click', () => saveWiz(key));
    });

    hoverInit($('sweepChart'));
    hoverInit($('pidChart'));
    let rsT = 0;
    window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { drawSweep(); drawPid(); }, 120); });
    $('logBox').addEventListener('toggle', scheduleLog);

    /* Escape stops everywhere; space too, unless a control has the focus */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { hideTip(); stopAll(false); return; }
      if (e.key === ' ' && !(e.target.closest && e.target.closest('input, select, textarea, button, summary, a'))) { e.preventDefault(); stopAll(false); }
    });
    document.addEventListener('pointerover', (e) => {
      const b = e.target.closest && e.target.closest('.info');
      if (b) showTip(b); else if (tipFor) hideTip();
    });
    document.addEventListener('focusin', (e) => { const b = e.target.closest && e.target.closest('.info'); if (b) showTip(b); });
    document.addEventListener('focusout', hideTip);
    window.addEventListener('scroll', hideTip, true);
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.info');
      if (b) { e.preventDefault(); if (tipFor === b) hideTip(); else showTip(b); }
    });

    const h = location.hash.replace('#', '');
    selectTab(PANES.indexOf(h) >= 0 ? h : 'motor');
    applyLang();
    syncLocks();
    setInterval(pollTick, 300);
    if (SELFTEST) setTimeout(selftest, 60);
    else if (DEMO) setTimeout(() => demo(DEMO), 30);
  }

  /* ======================================================================
   * Stand-in robot: answers like Core/Src/app_*.c (self-test and demo only)
   * ==================================================================== */
  function FakeBot(mode) {
    this.mode = mode || 'motor';
    this.sent = []; this.out = null;
    this.silent = false; this.muteAfterAck = ''; this.dropNextStop = false; this.slow = 1;
    this.lat = 12; this.tail = 0;
    this.tHist = []; this.pCount = 0; this.lastDone = null; this.lastPwm = null; this.sweeps = 0; this.jogs = 0;
    this.dropped = 0; this.lastRx = -1e9;
    this.reset();
  }
  const FB = FakeBot.prototype;
  FB.reset = function () {
    this.enc = { L: 0, R: 0 }; this.run = null; this.moving = null;
    this.gains = { KP: 3, KI: 6, KD: 0.05, KFF: 0.14, KS: 130 }; this.tel = 100;
    this.cfg = { scale: 1, trim: 0, track: 96, kcP: 1.5, kcD: 0.5, cl: 48, cr: 48 };
  };
  FB.at = function (ms, fn) { return setTimeout(fn, ms * timeScale); };
  /* lines leave in order, like the robot's single output ring */
  FB.say = function (lines, ms, after) {
    const now = performance.now();
    const due = Math.max(now + (ms == null ? this.lat : ms) * timeScale, this.tail);
    this.tail = due;
    const L = [].concat(lines);
    setTimeout(() => { L.forEach((l) => { if (this.out) this.out(l); }); if (after) after(); }, Math.max(0, due - now));
  };
  FB.echo = function (line) { this.say('> ' + line); };
  FB.boot = function (mode) {
    if (this.run) this.run.kill();
    if (this.moving) this.moving.kill();
    this.mode = mode;
    this.reset();
    const names = {
      motor: ['MOTOR_TEST (open-loop motor/encoder checks, wheels lifted)', 2],
      pid: ['PID_TEST (closed-loop wheel PID, tuning over BT)', 3],
      maze: ['MAZE (standalone: ultrasonic + PID + flood-fill)', 4],
    }[mode];
    const lines = ['', '==== RatRocket Micromouse ====', 'FW build: Nov 11 2026 09:00:00', 'Mode: ' + names[0] + ' (DIP 0x' + names[1] + ')'];
    if (mode === 'motor') lines.push('Supply: 4980 mV, PWM 1000 Hz', 'Keep the wheels OFF the ground. Type HELP for commands.');
    if (mode === 'pid') lines.push('Supply: 4980 mV, PWM 1000 Hz, left reverse enabled', this.gainsLine(), 'Type HELP for commands.');
    if (mode === 'maze') lines.push('Settings: loaded from flash', 'Left reverse enabled; turns are spins', ...this.cfgLines(), 'Type HELP for commands.');
    this.say(lines, 40);
  };
  FB.rx = function (line) {
    this.sent.push(line);
    if (this.silent) return;
    /* the firmware keeps one unread line: a STOP right on the heels of the
       previous line is lost (modelled with a 5 ms window) */
    const now = performance.now(), close = now - this.lastRx < 5 * timeScale;
    this.lastRx = now;
    if (line === 'STOP' && (close || this.dropNextStop)) { this.dropNextStop = false; this.dropped++; return; }
    const up = line.trim().toUpperCase(), v = up.split(/\s+/);
    if (this.muteAfterAck && v[0] === this.muteAfterAck) { this.echo(line); return; }
    const f = { motor: this.motor, pid: this.pid, maze: this.maze, bt: this.bt }[this.mode];
    if (f) f.call(this, line, up, v);
  };
  const fint = (s) => (/^-?\d+$/.test(s || '') ? parseInt(s, 10) : null);
  const fflt = (s) => (/^-?(\d+\.?\d*|\.\d+)$/.test(s || '') ? parseFloat(s) : null);
  const pad = (x, n) => String(x).padStart(n, ' ');

  FB.bt = function (line, up) {
    if (up === 'HELP') this.say(['Commands:', '  PING        -> PONG', '  DIP         switch state (live)']);
    else if (up === 'PING') this.say('PONG');
  };

  /* motor test: open loop, the wheels have a start threshold (left 300, right 200) */
  FB.cps = function (w, d) {
    const dead = w === 'L' ? 300 : 200, k = w === 'L' ? 510 : 442;
    const a = Math.abs(d);
    if (a <= dead) return 0;
    return Math.sign(d) * Math.round(4600 * (1 + 0.04 * this.sweeps) * (1 - Math.exp(-(a - dead) / k)));
  };
  FB.motor = function (line, up, v) {
    if (this.run) {
      if (up === 'STOP') { this.say('> STOP'); this.run.stop(); }
      else this.say("busy - ignored '" + up + "' (send STOP to abort)");
      return;
    }
    this.echo(line);
    const c = v[0];
    if (c === 'HELP') this.say(['Motor test commands (wheels OFF the ground):', '  SWEEP            both wheels fwd at rising duty, prints counts/s', '  PWM <l> <r> [ms] open-loop duty -1010..1010 (default 2000ms)']);
    else if (c === 'PING') this.say('PONG');
    else if (c === 'STOP') this.say('stopped', 300);
    else if (c === 'ENC') this.say('ENC: L=' + this.enc.L + ' R=' + this.enc.R);
    else if (c === 'ENC0') { this.enc = { L: 0, R: 0 }; this.say('ENC: reset'); }
    else if (c === 'BAT') this.say('BAT: 4980 mV');
    else if (c === 'PWM') {
      const l = fint(v[1]), r = fint(v[2]), ms = v[3] == null ? 2000 : fint(v[3]);
      if (l == null || r == null || Math.abs(l) > 1010 || Math.abs(r) > 1010) { this.say('usage: PWM <l> <r> [ms], duty -1010..1010'); return; }
      if (ms == null || ms <= 0 || ms > 10000) { this.say('ms must be 1..10000'); return; }
      this.say('PWM L=' + l + ' R=' + r + ' for ' + ms + 'ms');
      this.startPwm(l, r, ms);
    } else if (c === 'JOG') {
      const n = fint(v[2]);
      if (!v[1] || v[1].length !== 1 || 'LRB'.indexOf(v[1]) < 0 || n == null || n <= 0 || n > 200000) { this.say('usage: JOG <L|R|B> <counts 1..200000>'); return; }
      this.startJog(v[1], n);
    } else if (c === 'SWEEP') this.startSweep();
    else this.say("? unknown '" + c + "' (type HELP)");
  };
  FB.startPwm = function (l, r, ms) {
    const b = this, l0 = { L: b.enc.L, R: b.enc.R };
    let tt = 0, fin = false;
    const end = (aborted) => {
      if (fin) return;
      fin = true;
      clearInterval(iv);
      b.lastPwm = { l: b.enc.L - l0.L, r: b.enc.R - l0.R, aborted };
      b.say('PWM ' + (aborted ? 'aborted' : 'done') + ': moved L=' + b.lastPwm.l + ' R=' + b.lastPwm.r + ' counts', 300, () => { b.run = null; });
    };
    const iv = setInterval(() => {
      tt += 200;
      const cl = b.cps('L', l), cr = b.cps('R', r);
      b.enc.L += Math.round(cl * 0.2); b.enc.R += Math.round(cr * 0.2);
      b.tHist.push({ L: b.enc.L, R: b.enc.R });
      b.say('[T] t=' + tt + ' pwm=' + l + ',' + r + ' pos=' + b.enc.L + ',' + b.enc.R + ' cps=' + cl + ',' + cr, 0);
      if (tt >= ms) end(false);
    }, 200 * timeScale);
    b.run = { stop: () => end(true), kill: () => { fin = true; clearInterval(iv); b.run = null; } };
  };
  FB.startJog = function (w, n) {
    const b = this, l0 = { L: b.enc.L, R: b.enc.R };
    const over = [37, 52, 29][b.jogs++ % 3];
    let fin = false;
    b.say('JOG ' + w + ' by ' + n + ' counts at duty 800');
    const finish = (aborted) => {
      if (fin) return;
      fin = true;
      clearTimeout(to);
      const k = aborted ? 0.4 : 1;
      if (w !== 'R') b.enc.L += Math.round(n * k) + over;
      if (w !== 'L') b.enc.R += Math.round(n * k) + over;
      const out = aborted ? ['JOG aborted'] : [];
      out.push('JOG result: L moved ' + (b.enc.L - l0.L) + ', R moved ' + (b.enc.R - l0.R) + ' counts (target ' + n + ', incl. overshoot)');
      b.say(out, 300, () => { b.run = null; });
    };
    const to = b.at((n / 3000 * 1000 + 300) * b.slow, () => finish(false));
    b.run = { stop: () => finish(true), kill: () => { fin = true; clearTimeout(to); b.run = null; } };
  };
  FB.startSweep = function () {
    const b = this, duties = [200, 300, 400, 500, 600, 700, 800, 900, 1010];
    let i = 0, fin = false, to = 0;
    b.say(['SWEEP @ 1000 Hz: both wheels forward at rising duty. STOP aborts.', ' duty    L cps    R cps']);
    const step = () => {
      if (fin) return;
      const d = duties[i++];
      b.say(pad(d, 5) + '  ' + pad(b.cps('L', d), 7) + '  ' + pad(b.cps('R', d), 7), 0);
      if (i < duties.length) to = b.at(1100, step);
      else { fin = true; b.sweeps++; b.say('SWEEP done (positive duty should give positive cps on both wheels).', 300, () => { b.run = null; }); }
    };
    to = b.at(1100, step);
    b.run = {
      stop: () => { if (fin) return; fin = true; clearTimeout(to); b.say('SWEEP aborted', 300, () => { b.run = null; }); },
      kill: () => { fin = true; clearTimeout(to); b.run = null; },
    };
  };

  /* PID test: a move that lags behind its profile more with a small Kp,
     rings with a big Ki and twitches with a big Kd */
  FB.gainsLine = function () {
    const g = this.gains, f = (x) => x.toFixed(3);
    return 'GAINS: KP=' + f(g.KP) + ' KI=' + f(g.KI) + ' KD=' + f(g.KD) + ' KFF=' + f(g.KFF) + ' KS=' + f(g.KS);
  };
  FB.pid = function (line, up, v) {
    this.echo(line);
    const c = v[0];
    if (c === 'STOP') { if (this.moving) this.moving.stop(); }
    else if (c === 'HELP') this.say(['PID test commands (wheels OFF the ground for now):', '  FWD <mm> [v] [a]     straight move, v mm/s (100), a mm/s^2 (300)']);
    else if (c === 'PING') this.say('PONG');
    else if (c === 'GAINS') this.say(this.gainsLine());
    else if (['KP', 'KI', 'KD', 'KFF', 'KS'].indexOf(c) >= 0) {
      const x = fflt(v[1]);
      if (x == null || x < 0) this.say('usage: ' + c + ' <value >= 0>');
      else { this.gains[c] = x; this.say(this.gainsLine()); }
    } else if (c === 'TEL') {
      const x = fflt(v[1]);
      if (x == null || x < 0 || x > 10000) this.say('usage: TEL <ms, 0 = off>');
      else { this.tel = Math.floor(x); this.say('telemetry every ' + this.tel + ' ms'); }
    } else if (c === 'FWD') {
      const mm = fflt(v[1]);
      if (mm == null || Math.abs(mm) > 2000) this.say('usage: FWD <mm |<=2000> [v 1..160] [a>0]');
      else if (this.moving) this.say('FWD rejected (busy, or backwards needs the left reverse fix)');
      else this.pidMove(mm);
    } else if (c === 'ENC') this.say('ENC: L=' + this.enc.L + ' R=' + this.enc.R);
    else if (c === 'BAT') this.say('BAT: 4980 mV');
    else this.say("? unknown '" + c + "' (type HELP)");
  };
  FB.pidMove = function (mm) {
    const b = this, g = b.gains, V = 100, A = 300;
    const ta = V / A, T = mm / V + ta;
    const vt = (s) => (s <= 0 ? 0 : s < ta ? A * s : s < T - ta ? V : s < T ? A * (T - s) : 0);
    const pos = (s) => { if (s <= 0) return 0; let p = 0; const n = 60; for (let i = 0; i < n; i++) p += vt((i + 0.5) * s / n) * s / n; return p; };
    const tau = 0.3 / (1 + g.KP), ring = Math.min(1.6, g.KI / 12), jit = g.KD * 30;
    let tt = 0, fin = false;
    b.say('[EV] START', 20);
    const per = Math.max(10, b.tel || 100);
    const iv = setInterval(() => {
      tt += per;
      const s = tt / 1000;
      if (s >= T + 0.2) { done(); return; }
      if (!b.tel) return;
      const osc = Math.exp(-s / 0.9) * Math.sin(2 * Math.PI * s / 0.45);
      const vL = Math.round(vt(s - tau * 1.2) + ring * 12 * osc + jit * Math.sin(s * 70));
      const vR = Math.round(vt(s - tau) + ring * 10 * osc + jit * Math.sin(s * 63 + 1));
      const off = g.KI === 0 ? 9 * Math.min(1, s / 0.5) : 0;
      const eL = Math.round((pos(s) - pos(s - tau * 1.2)) * CPM + off * 1.2 + ring * 15 * osc);
      const eR = Math.round((pos(s) - pos(s - tau)) * CPM + off + ring * 12 * osc);
      const ff = g.KFF * vt(s) * CPM + (vt(s) > 0 ? g.KS : 0);
      b.pCount++;
      b.say('[P] t=' + tt + ' vt=' + Math.round(vt(s)) + ',' + Math.round(vt(s)) + ' v=' + vL + ',' + vR + ' e=' + eL + ',' + eR +
        ' d=' + Math.round(ff + 110 + g.KP * eL) + ',' + Math.round(ff + g.KP * eR), 0);
    }, per * timeScale * b.slow);
    const done = () => {
      if (fin) return;
      fin = true; clearInterval(iv);
      const kp = Math.max(0.5, g.KP);
      const L = g.KI === 0 ? Math.round(14 / kp) : Math.round(2 / kp), R = -(g.KI === 0 ? Math.round(9 / kp) : Math.round(1 / kp));
      b.lastDone = { L, R };
      b.say('[EV] DONE t=' + Math.round(T * 1000 + 200) + 'ms dist=' + mm.toFixed(3) + 'mm final err L=' + L + ' R=' + R + ' counts', 0, () => { b.moving = null; });
    };
    b.moving = {
      stop: () => { if (fin) return; fin = true; clearInterval(iv); b.say('[EV] STOPPED t=' + tt + 'ms', 0, () => { b.moving = null; }); },
      kill: () => { fin = true; clearInterval(iv); b.moving = null; },
    };
  };

  /* maze mode: blocking moves, CFG block after every setting */
  FB.cfgLines = function () {
    const c = this.cfg, f2 = (x) => x.toFixed(2);
    return ['CFG: size 3 goal (1,1) home 1 pitch 160.00 track ' + f2(c.track),
      '     distance scale ' + f2(c.scale * 100) + ' trim ' + f2(c.trim) + '%  escape entry 0',
      '     v_run 80.00 a_run 300.00 v_turn 50.00 a_turn 300.00',
      '     sensors F=US1 L=US2 R=US3',
      '     centred F=33 L=' + c.cl + ' R=' + c.cr + '  wall thr F<113 side<128  align 1',
      '     centring KC p=' + f2(c.kcP) + ' d=' + f2(c.kcD) + ' max 25.00 mm/s  sense 1  wallupd 1  pivots 0',
      '     imu none  gyro bias 0.00 deg/s (not calibrated; saved no)  gyroturn 0 (off)'];
  };
  FB.mazeMove = function (secs, doneLines, stopLines, onDone) {
    const b = this;
    let fin = false;
    const to = b.at(secs * 1000 * b.slow, () => { fin = true; if (onDone) onDone(); b.say(doneLines, 0, () => { b.moving = null; }); });
    b.moving = {
      stop: () => { if (fin) return; fin = true; clearTimeout(to); b.say(stopLines, 50, () => { b.moving = null; }); },
      kill: () => { fin = true; clearTimeout(to); b.moving = null; },
    };
  };
  FB.maze = function (line, up, v) {
    if (this.moving) {
      if (up === 'STOP') { this.say('> STOP'); this.moving.stop(); }
      else this.say("[BUSY] ignored '" + up + "' (send STOP)");
      return;
    }
    this.echo(line);
    const c = v[0], cf = this.cfg;
    const a = fflt(v[1]), b2 = fflt(v[2]);
    if (c === 'HELP') this.say(['Maze mode commands:', ' Sensors : US | USW <ms> stream | USMAP <f> <l> <r> (1-3, 0=none) | WALLS']);
    else if (c === 'PING') this.say('PONG');
    else if (c === 'CFG') this.say(this.cfgLines());
    else if (c === 'STOP') this.say('stopped');
    else if (c === 'FWD') {
      if (a == null || Math.abs(a) > 1000) this.say('usage: FWD <mm> [v]');
      else this.mazeMove(Math.abs(a) / 80, 'FWD done (event 2)', 'FWD done (event 3)');
    } else if (c === 'TURN') {
      if (a == null || Math.abs(a) > 1080) this.say('usage: TURN <deg> [v]  (+ = right/clockwise)');
      else this.mazeMove(Math.abs(a) / 360 * Math.PI * cf.track / 50, 'TURN done (event 2)', 'TURN done (event 3)');
    } else if (c === 'CALDIST') {
      const ns = a > 0 && b2 > 0 ? cf.scale * a / b2 : 0;
      if (ns < 0.5 || ns > 2) this.say('usage: CALDIST <commanded mm> <actual mm> (robot idle, ratio 0.5..2)');
      else cf.scale = ns;
      this.say(this.cfgLines());
    } else if (c === 'TRIM') {
      if (a == null || Math.abs(a) > 15) this.say('usage: TRIM <-15..15 %>  (+ = robot curves left; robot idle)');
      else cf.trim = a;
      this.say(this.cfgLines());
    } else if (c === 'TRACK') {
      if (a != null && a > 20 && a < 300) cf.track = a;
      this.say(this.cfgLines());
    } else if (c === 'KC') {
      if (a != null && b2 != null && a >= 0 && b2 >= 0) { cf.kcP = a; cf.kcD = b2; }
      this.say(this.cfgLines());
    } else if (c === 'CALSPIN') {
      this.say('CALSPIN before: L=46 R=52');
      this.mazeMove(6, ['CALSPIN after 180: L=50 R=48', 'CALSPIN ok: centred L=48 R=50 (sensor difference 2 mm), wall if side<130',
        'CALSPIN: robot is 2 mm LEFT of centre'], ['CALSPIN failed: turn aborted'], () => { cf.cl = 48; cf.cr = 50; });
    } else if (c === 'CENTER') {
      this.say('CENTER: L=46 R=52 -> 3 mm left of centre');
      this.mazeMove(4, 'CENTER done: L=48 R=50', []);
    } else if (c === 'CELL') this.mazeMove(2, 'CELL done', 'CELL failed');
    else if (c === 'SAVE') {
      this.say('SAVE: writing flash (the robot freezes ~2 s)...');
      this.mazeMove(2, 'SAVE ok - kept across power-off', 'SAVE ok - kept across power-off');
    } else if (c === 'ENC') this.say('ENC: L=' + this.enc.L + ' R=' + this.enc.R);
    else if (c === 'BAT') this.say('BAT: 4980 mV');
    else this.say("? unknown '" + c + "' (type HELP)");
  };

  /* ======================================================================
   * Demo (?demo=motor|pid|cal): fills a workshop for screenshots
   * ==================================================================== */
  async function waitIdle() { await sleep(5); while (pending) await sleep(20); await sleep(5); }
  async function demo(which) {
    const bot = new FakeBot(PANE_MODE[which]);
    timeScale = 0.25;
    useFake(bot);
    selectTab(which);
    await afterConnect();
    await waitIdle();
    if (which === 'motor') {
      setDuty('L', 450); setDuty('R', -300);
      await pwm2(); await waitIdle();
      for (const [w, n, whole, frac] of [['L', 3000, 1, 0.25], ['L', 3000, 1, 0.25], ['R', 6000, 2, 0.5]]) {
        ppr.wheel = w; ppr.n = n;
        await jog();
        $('pprTurns').value = String(whole); ppr.frac = frac; renderPpr();
        addPpr();
      }
      ppr.wheel = 'L'; ppr.n = 3000;
      await jog();
      $('pprTurns').value = '1'; ppr.frac = 0.25; renderPpr();
      await sweep();
      await waitIdle();
    } else if (which === 'pid') {
      await preset('soft'); await pidDrive();
      await preset('factory'); await pidDrive();
      reveal(true);
    } else {
      W.cur = 'dist';
      await wizDrive('dist');
      $('distMeas').value = '262';
      renderWiz();
      await distApply();
      await saveWiz('dist');
    }
    timeScale = 1;
    document.title = t('title') + ' \u00b7 demo ' + which;
  }

  /* ======================================================================
   * Self-test (?selftest=1)
   * ==================================================================== */
  async function selftest() {
    titleLock = true;
    document.title = 'SELFTEST RUNNING';
    const out = $('selftest');
    out.hidden = false;
    const res = [];
    const ok = (id, cond, msg) => {
      res.push({ id, ok: !!cond, msg: msg || '' });
      out.textContent = res.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.id + (r.msg ? '  ' + r.msg : '')).join('\n');
    };
    const bot = new FakeBot('pid');
    const S = bot.sent;
    const mark = () => S.length;
    const since = (i) => S.slice(i).filter((l) => l !== 'ENC');
    const until = async (fn, ms) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > (ms || 4000)) return false; await sleep(4); } return true; };
    const idle = async () => { await sleep(3); await until(() => !pending, 6000); await sleep(3); };
    const st = (p) => $('st-' + p).textContent;
    const click = async (el) => { (typeof el === 'string' ? $(el) : el).click(); await sleep(2); };
    const setRange = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const typeIn = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    const pick = (id, v) => $(id).querySelector('[data-v="' + v + '"]').click();
    const pev = (type) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, button: 0, isPrimary: true });
    const hb = $('holdBtn');
    const chip = (p) => document.querySelector('#mode-' + p + ' .w-chip');
    const count = (sel) => document.querySelectorAll(sel).length;
    const vis = (el) => !!el && !el.closest('[hidden]');
    timeScale = 0.05;
    pollOn = false;

    try {
      /* ---- not connected ---- */
      selectTab('motor');
      hb.dispatchEvent(pev('pointerdown')); await sleep(5); hb.dispatchEvent(pev('pointerup')); await sleep(5);
      ok('link.needBot', S.length === 0 && st('motor') === t('needBot'), st('motor'));

      /* ---- connect: HELP finds the mode ---- */
      useFake(bot);
      await afterConnect();
      await idle(); await sleep(30); await idle();
      ok('mode.helpProbe', S[0] === 'HELP' && robotMode === 'pid' && modeState === 'known', S.slice(0, 3).join(' | ') + ' -> ' + robotMode);
      ok('mode.strips', chip('pid').dataset.state === 'ok' && chip('motor').dataset.state === 'bad' && chip('cal').dataset.state === 'bad' &&
        chip('motor').textContent.indexOf(t('mode_pid')) >= 0 && $('tab-pid').classList.contains('is-live'), chip('motor').textContent);
      ok('pid.gainsSync', S.indexOf('GAINS') > 0 && gains && gains.KP === 3 && gains.KD === 0.05, JSON.stringify(gains));

      /* ---- mode gating ---- */
      let i0 = mark();
      setDuty('L', 300);
      hb.dispatchEvent(pev('pointerdown')); await sleep(10); hb.dispatchEvent(pev('pointerup')); await idle();
      ok('gate.motorHold', !since(i0).some((l) => /^PWM/.test(l)) && st('motor') === t('wrongMode', modeVars('motor')) &&
        st('motor').indexOf(t('sw_motor')) >= 0, st('motor'));
      i0 = mark();
      for (const id of ['pwm2Btn', 'enc0Btn', 'jogBtn', 'sweepBtn']) { await click(id); await idle(); }
      ok('gate.motorButtons', since(i0).length === 0, since(i0).join(' | '));
      selectTab('cal');
      i0 = mark();
      await click('distGo'); await idle();
      ok('gate.cal', since(i0).length === 0 && st('cal').indexOf(t('sw_maze')) >= 0 && $('mode-cal').classList.contains('flash'), st('cal'));

      /* ---- boot banner (reset while connected) switches the mode ---- */
      i0 = mark();
      bot.boot('motor');
      await until(() => robotMode === 'motor'); await idle();
      ok('mode.banner', robotMode === 'motor' && since(i0).indexOf('HELP') < 0 && chip('motor').dataset.state === 'ok', robotMode);

      /* ---- motor: sliders, arrows, hold to spin ---- */
      selectTab('motor'); await idle();
      setRange($('dutyL'), 500); setRange($('dutyR'), -450);
      ok('motor.arrows', $('dirL').dataset.dir === 'ccw' && $('dirR').dataset.dir === 'ccw' &&
        $('dirL').textContent.indexOf(t('dirFwd')) >= 0 && $('dirR').textContent.indexOf(t('dirBack')) >= 0 &&
        $('arcL').getAttribute('transform') === 'scale(-1 1)' && $('dutyLv').textContent === '500', $('dirL').textContent + ' / ' + $('dirR').textContent);
      setRange($('dutyR'), 450);
      const cwR = $('dirR').dataset.dir === 'cw' && $('arcR').getAttribute('transform') === '';
      setRange($('dutyR'), 0);
      const stillR = $('dirR').dataset.dir === 'none' && $('arcR').getAttribute('visibility') === 'hidden';
      setRange($('dutyR'), -450);
      ok('motor.arrowsFlip', cwR && stillR && $('dutyRv').textContent === '\u2212450');
      i0 = mark();
      hb.dispatchEvent(pev('pointerdown'));
      await until(() => S.lastIndexOf('PWM 500 -450 10000') >= i0);
      ok('motor.holdCmd', since(i0)[0] === 'PWM 500 -450 10000' && !hb.disabled && $('pwm2Btn').disabled, since(i0).join(' | '));
      await until(() => bot.tHist.length >= 4); await sleep(10);
      const shown = view.L;
      ok('motor.liveCounter', shown > 0 && bot.tHist.some((p) => p.L === shown) && $('cntL').textContent === big(shown) &&
        $('cntR').textContent === big(view.R) && view.R < 0 && /rotate\(-/.test($('rotL').style.transform), 'L ' + shown + ', R ' + view.R);
      hb.dispatchEvent(pev('pointerup'));
      await idle();
      ok('motor.releaseStop', since(i0).join('|') === 'PWM 500 -450 10000|STOP' && bot.lastPwm && bot.lastPwm.aborted &&
        st('motor') === t('pwmAborted', { l: big(bot.lastPwm.l), r: big(bot.lastPwm.r) }), st('motor'));
      i0 = mark();
      await click('pwm2Btn'); await idle();
      ok('motor.pwm2s', since(i0).join('|') === 'PWM 500 -450 2000' && st('motor') === t('pwmDone', { l: big(bot.lastPwm.l), r: big(bot.lastPwm.r) }), st('motor'));
      /* the stand-in drops a STOP that follows the previous line at once, like the firmware */
      const d0 = bot.dropped;
      rawSend('PWM 500 -450 200'); rawSend('STOP');
      await until(() => !bot.run && bot.lastPwm && !bot.lastPwm.aborted); await sleep(20);
      ok('fake.dropModel', bot.dropped === d0 + 1, 'dropped ' + (bot.dropped - d0));
      /* released before the echo: STOP still gets through (not in the same instant as PWM) */
      bot.lat = 200;
      const d1 = bot.dropped;
      i0 = mark();
      hb.dispatchEvent(pev('pointerdown'));
      await until(() => S.lastIndexOf('PWM 500 -450 10000') >= i0);
      hb.dispatchEvent(pev('pointerup'));
      await idle();
      bot.lat = 12;
      ok('motor.quickRelease', since(i0).join('|') === 'PWM 500 -450 10000|STOP' && bot.dropped === d1 && bot.lastPwm.aborted &&
        st('motor') === t('holdShort'), since(i0).join(' | ') + ' / ' + st('motor'));
      i0 = mark();
      await click('enc0Btn'); await idle();
      ok('motor.enc0', since(i0).join('|') === 'ENC0' && $('cntL').textContent === '0' && $('cntR').textContent === '0' && st('motor') === t('encZero'));

      /* ---- pulses per turn ---- */
      pick('pprWheel', 'R'); pick('pprN', '3000');
      i0 = mark();
      await click('jogBtn'); await idle();
      ok('ppr.jogCmd', since(i0).join('|') === 'JOG R 3000' && ppr.moved === 3037 && $('jogRes').textContent === t('jogRes', { n: big(3037) }), $('jogRes').textContent);
      typeIn($('pprTurns'), '1'); pick('pprFrac', '0.25');
      ok('ppr.calc', $('pprCalc').textContent.indexOf(big(3037 / 1.25)) >= 0 && !$('pprAdd').disabled, $('pprCalc').textContent);
      await click('pprAdd');
      pick('pprWheel', 'L'); pick('pprN', '6000');
      i0 = mark();
      await click('jogBtn'); await idle();
      typeIn($('pprTurns'), '2'); pick('pprFrac', '0.5');
      await click('pprAdd');
      const want = [3037 / 1.25, 6052 / 2.5];
      ok('ppr.meanSpread', since(i0).join('|') === 'JOG L 6000' && count('#pprBody tr') === 2 &&
        $('pprMean').textContent === big((want[0] + want[1]) / 2) && $('pprSpread').textContent === big(Math.abs(want[0] - want[1])),
        $('pprMean').textContent + ' / ' + $('pprSpread').textContent);

      /* ---- SWEEP: live chart ---- */
      sweepS.draws = [];
      i0 = mark();
      await click('sweepBtn'); await idle();
      const grew = sweepS.draws.filter((n, i, a) => n > 0 && n !== a[i - 1]);
      ok('sweep.cmd', since(i0).join('|') === 'SWEEP' && st('motor') === t('sweepDone'), since(i0).join(' | '));
      ok('sweep.liveChart', grew.length === 9 && grew.join(',') === '1,2,3,4,5,6,7,8,9', sweepS.draws.join(','));
      ok('sweep.points', count('#sweepChart .ch-dot-l') === 9 && count('#sweepChart .ch-dot-r') === 9 && count('#sweepChart polyline.ch-l') === 1);
      const band = document.querySelector('#sweepChart .ch-band');
      const c = $('sweepChart')._ch;
      ok('sweep.deadband', band && Math.abs(+band.getAttribute('width') - (c.sx(300) - c.sx(0))) < 0.5 &&
        $('sweepNote').textContent === t('deadNote', { l: 300, r: 200 }) && $('sweepFreq').textContent === t('freq', { f: 1000 }), $('sweepNote').textContent);
      ok('sweep.sliderDead', vis($('deadL')) && vis($('deadR')) && parseFloat($('deadL').style.width) > parseFloat($('deadR').style.width));
      ok('sweep.table', count('#sweepBody tr') === 9 && document.querySelector('#sweepBody tr td').textContent === '200');
      await click('sweepBtn'); await idle();
      ok('sweep.ghost', count('#sweepChart polyline.ch-ghost') === 2 && !$('sweepLgPrev').hidden);

      /* ---- live counter by ENC while idle ---- */
      bot.enc = { L: 1234, R: -56 };
      pollOn = true;
      const polled = await until(() => $('cntL').textContent === big(1234) && $('cntR').textContent === big(-56), 3000);
      pollOn = false;
      await idle();
      ok('motor.encPoll', polled && S.indexOf('ENC') >= 0 && logLines.indexOf('\u2192 ENC') < 0, $('cntL').textContent);

      /* ---- timeouts ---- */
      bot.silent = true;
      await click('enc0Btn'); await idle();
      ok('timeout.silent', st('motor') === t('silent', { cmd: 'ENC0' }) && !pending && !$('enc0Btn').disabled, st('motor'));
      bot.silent = false;
      bot.muteAfterAck = 'JOG';
      await click('jogBtn'); await idle();
      ok('timeout.afterEcho', st('motor') === t('silent', { cmd: 'JOG L 6000' }) && !pending && !$('jogBtn').disabled, st('motor'));
      bot.muteAfterAck = '';

      /* ---- STOP is always live ---- */
      bot.slow = 40;
      await click('jogBtn');
      await until(() => pending && pending.acked);
      ok('stop.alwaysLive', !$('stopBtn').disabled && $('jogBtn').disabled && $('sweepBtn').disabled && $('enc0Btn').disabled);
      i0 = mark();
      await click('stopBtn');
      ok('stop.sentAtOnce', since(i0)[0] === 'STOP');
      await idle();
      ok('stop.endsCommand', !pending && ppr.moved != null && !$('jogBtn').disabled, st('motor'));
      bot.slow = 1;
      bot.dropNextStop = true;
      i0 = mark();
      await click('stopBtn');
      await until(() => since(i0).length >= 2, 3000); await sleep(20);
      ok('stop.resent', since(i0).join('|') === 'STOP|STOP' && st('motor') === t('stopped'), since(i0).join(' | '));

      /* ---- a command the robot does not know: the mode is checked again ---- */
      bot.mode = 'maze';
      i0 = mark();
      await click('enc0Btn');
      await until(() => robotMode === 'maze'); await idle(); await sleep(20); await idle();
      ok('mode.unknownRecheck', since(i0)[0] === 'ENC0' && since(i0).indexOf('HELP') > 0 && robotMode === 'maze' &&
        st('motor') === t('wrongMode', modeVars('motor')), since(i0).join(' | ') + ' / ' + st('motor'));

      /* ---- calibration ---- */
      selectTab('cal');
      await until(() => cfg); await idle();
      ok('cal.cfgRead', cfg && cfg.track === 96 && cfg.scale === 100 && cfg.kcP === 1.5 && $('kvTrack').textContent.indexOf('96') >= 0 &&
        /gyro bias/.test($('cfgPre').textContent), cfg && cfg.lines[0]);
      pick('distLen', '300');
      i0 = mark();
      await click('distGo'); await idle();
      ok('cal.distDrive', since(i0).join('|') === 'FWD 300' && W.dist.drove && $('distGoRes').textContent === t('driveDone'), $('distGoRes').textContent);
      typeIn($('distMeas'), '262');
      ok('cal.distCalc', $('distCalc').textContent.indexOf(nf(114.5, 2)) >= 0 && !$('distApply').disabled, $('distCalc').textContent);
      typeIn($('distMeas'), '100');
      ok('cal.distRange', $('distApply').disabled && $('distCalc').textContent.indexOf(t('distRange')) >= 0);
      typeIn($('distMeas'), '262');
      i0 = mark();
      await click('distApply'); await idle();
      ok('cal.distApply', since(i0).join('|') === 'CALDIST 300 262' && cfg.scale === 114.5 && W.dist.applied &&
        $('distApplyRes').textContent === t('applied', { what: t('whatScale', { v: nf(114.5, 2) }) }), $('distApplyRes').textContent);
      /* the measurement is used once: no second CALDIST from the same drive */
      i0 = mark();
      typeIn($('distMeas'), '262');
      await click('distApply'); await idle();
      ok('cal.measureUsedOnce', since(i0).length === 0 && $('distApply').disabled && $('distCalc').textContent === '' && !W.dist.drove);
      const saveBox = document.querySelector('.w-save[data-save="dist"]');
      i0 = mark();
      await click(saveBox.querySelector('.w-save-btn'));
      ok('cal.saveAsks', since(i0).length === 0 && !saveBox.querySelector('.w-ask').hidden);
      await click(saveBox.querySelector('.w-save-yes')); await idle();
      ok('cal.saved', since(i0).join('|') === 'SAVE|CFG' && W.dist.saved && !saveBox.querySelector('.w-saved').hidden &&
        saveBox.querySelector('mark') && saveBox.querySelector('mark').textContent.indexOf('distance scale 114.50') >= 0 &&
        document.querySelector('.w-wizcard[data-wiz="dist"] .w-wizstate').textContent === t('wsSaved') && st('cal') === t('saved'), st('cal'));

      await click(document.querySelector('.w-wizcard[data-wiz="trim"]'));
      pick('trimLen', '500');
      i0 = mark();
      await click('trimGo'); await idle();
      typeIn($('trimOff'), '10'); pick('trimSide', 'R');
      const rightTxt = $('trimCalc').textContent;
      ok('cal.trimRight', /\u2212/.test(rightTxt) && rightTxt.indexOf('= ' + nf(-0.77, 2) + ' %') >= 0, rightTxt);
      pick('trimSide', 'L');
      const trimTxt = $('trimCalc').textContent;
      await click('trimApply'); await idle();
      ok('cal.trim', vis($('trimGo')) && since(i0).join('|') === 'FWD 500|TRIM 0.77' && trimTxt.indexOf(nf(0.77, 2)) >= 0 && cfg.trim === 0.77 && W.trim.applied, trimTxt);

      await click(document.querySelector('.w-wizcard[data-wiz="turn"]'));
      i0 = mark();
      await click('turnRGo'); await idle();
      typeIn($('turnRDeg'), '10'); pick('turnRDir', 'far');
      await click('turnLGo'); await idle();
      typeIn($('turnLDeg'), '6'); pick('turnLDir', 'short');
      ok('cal.turnAsym', !!document.querySelector('#turnCalc .w-asym') && $('turnCalc').textContent.indexOf(t('turnAsym', { d: nfx(16, 1) })) >= 0);
      pick('turnLDir', 'far');
      const turnTxt = $('turnCalc').textContent;
      const noAsym = !document.querySelector('#turnCalc .w-asym');
      await click('turnApply'); await idle();
      ok('cal.turn', since(i0).join('|') === 'TURN 360|TURN -360|TRACK 93.9' && turnTxt.indexOf(nfx(93.9, 1)) >= 0 &&
        turnTxt.indexOf(nfx(368, 1)) >= 0 && noAsym && cfg.track === 93.9 && !W.turn.R.done && !W.turn.L.done, turnTxt);

      await click(document.querySelector('.w-wizcard[data-wiz="kc"]'));
      const gated = $('kcCenter').disabled && $('kcCell').disabled;
      i0 = mark();
      await click('kcLearn'); await idle();
      const learnTxt = $('kcLearnRes').textContent;
      await click('kcCenter'); await idle();
      await click('kcCell'); await idle();
      pick('kcObs', 'weave');
      const kcTxt = $('kcCalc').textContent;
      await click('kcApply'); await idle();
      ok('cal.kc', gated && since(i0).join('|') === 'CALSPIN|CENTER|CELL|KC 1.2 0.63' && learnTxt === t('k1Res', { l: 48, r: 50 }) &&
        $('kcCenterRes').textContent === t('k2Res') && kcTxt.indexOf(nf(1.2, 2)) >= 0 && kcTxt.indexOf(nf(0.63, 2)) >= 0 &&
        cfg.kcP === 1.2 && cfg.kcD === 0.63, since(i0).join(' | '));

      /* ---- wizard arithmetic ---- */
      ok('calc.distScale', CALC.distScale(100, 300, 262) === 114.5 && CALC.distScale(114.5, 300, 310) === 110.81 &&
        CALC.distScale(100, 300, 100) === null && CALC.distScale(100, 300, 0) === null);
      ok('calc.trim', Math.abs(CALC.trimDelta(10, 'L', 96, 500) - 0.768) < 1e-9 && CALC.trimDelta(10, 'R', 96, 500) < 0 &&
        CALC.trimNew(0, 0.768) === 0.77 && CALC.trimNew(14.5, 0.768) === null);
      ok('calc.track', CALC.track(96, 10, 6) === 93.9 && CALC.track(96, -10, -10) === 98.7 && CALC.track(96, 0, 0) === 96 &&
        CALC.turnOver(10, 'short') === -10 && CALC.turnOver(10, 'exact') === 0);
      const kw = CALC.kc(1.5, 0.5, 'weave'), kd = CALC.kc(1.5, 0.5, 'drift');
      ok('calc.kc', kw.p === 1.2 && kw.d === 0.63 && kd.p === 1.88 && kd.d === 0.5 && CALC.kc(1.5, 0.5, 'good') === null);

      /* ---- PID ---- */
      bot.boot('pid');
      await until(() => robotMode === 'pid' && gains); await idle();
      selectTab('pid'); await idle();
      const names = () => qa('#knobList .w-knob-name').map((n) => n.textContent).join('|');
      ok('pid.namesHidden', names() === [t('knobA'), t('knobB'), t('knobC')].join('|') && $('moreKnobs').hidden &&
        !/\bK[pP]\b|\bK[iI]\b|\bK[dD]\b/.test($('pane-pid').innerText), names());
      ok('pid.gainsShown', +$('gKP').value === 3 && $('gKIv').textContent === '6' && $('gKDv').textContent === nfx(0.05),
        'mode ' + robotMode + '/' + modeState + ', gains ' + JSON.stringify(gains) + ', KP ' + $('gKP').value + ', KI ' + $('gKIv').textContent +
        ', pending ' + (pending && pending.line) + ', connected ' + connected());
      i0 = mark();
      setRange($('gKP'), 4.5); await idle();
      setRange($('gKI'), 12); await idle();
      setRange($('gKD'), 0.1); await idle();
      ok('pid.knobCmds', since(i0).join('|') === 'KP 4.5|KI 12|KD 0.1' && gains.KP === 4.5 && gains.KI === 12 && gains.KD === 0.1, since(i0).join(' | '));
      const presetCmds = {};
      for (const p of ['soft', 'sharp', 'factory']) {
        i0 = mark();
        await click(document.querySelector('[data-preset="' + p + '"]')); await idle();
        presetCmds[p] = since(i0).join('|');
      }
      ok('pid.presets', presetCmds.soft === 'KP 1|KI 0|KD 0' && presetCmds.sharp === 'KP 9|KI 18|KD 0.3' &&
        presetCmds.factory === 'KP 3|KI 6|KD 0.05|KFF 0.14|KS 130' && +$('gKP').value === 3 && st('pid') === t('presetSet', { p: t('pFactory') }),
        JSON.stringify(presetCmds));
      bot.pCount = 0;
      i0 = mark();
      await click('fwdBtn'); await idle();
      const lineL = document.querySelector('#pidChart polyline.ch-l');
      ok('pid.driveCmds', since(i0).join('|') === 'TEL 100|FWD 300', since(i0).join(' | '));
      ok('pid.chartFromTel', pid.cur.s.length === bot.pCount && bot.pCount >= 30 && lineL &&
        lineL.getAttribute('points').split(' ').length === pid.cur.s.length + 1 && !!document.querySelector('#pidChart polyline.ch-soll'),
        bot.pCount + ' samples');
      ok('pid.result', $('errL').textContent === big(bot.lastDone.L) && $('errR').textContent === big(bot.lastDone.R) &&
        count('#runBody tr') === 1 && st('pid') === t('pidDone', { l: big(bot.lastDone.L), r: big(bot.lastDone.R) }), st('pid'));
      pick('pidView', 'p');
      const last = pid.cur.s[pid.cur.s.length - 1];
      ok('pid.viewDistance', Math.abs(last.posT - 300) < 12 && $('pidChart').textContent.indexOf(t('yP')) >= 0, 'end ' + last.posT.toFixed(1) + ' mm');
      pick('pidView', 'e');
      ok('pid.viewError', !!document.querySelector('#pidChart .ch-zero') && !document.querySelector('#pidChart .ch-soll') && $('pidLgSoll').hidden);
      pick('pidView', 'v');
      await click(document.querySelector('[data-preset="soft"]')); await idle();
      await click('fwdBtn'); await idle();
      ok('pid.ghost', count('#pidChart polyline.ch-ghost') === 2 && !$('pidLgPrev').hidden && count('#runBody tr') === 2 &&
        Math.abs(pid.cur.end.eL) > Math.abs(pid.prev.end.eL), 'soft ' + pid.cur.end.eL + ' vs factory ' + pid.prev.end.eL);
      await click('revealBtn');
      ok('pid.reveal', names() === [t('nameKP'), t('nameKI'), t('nameKD')].join('|') && vis(document.querySelector('.w-knob-hint')) &&
        !$('moreKnobs').hidden && $('phase2').classList.contains('is-on') && document.querySelector('.w-kh').textContent === 'Kp');
      i0 = mark();
      setRange($('gKFF'), 0.2); await idle();
      ok('pid.moreKnobs', since(i0).join('|') === 'KFF 0.2' && gains.KFF === 0.2);
      bot.slow = 30;
      await click('fwdBtn');
      await until(() => pid.cur && pid.cur.s.length >= 2);
      i0 = mark();
      await click('stopBtn'); await idle();
      bot.slow = 1;
      ok('pid.stop', since(i0)[0] === 'STOP' && st('pid') === t('pidStopped') && !pending, st('pid'));

      /* ---- tabs, language, offline ---- */
      await click('tab-cal');
      ok('tabs.select', !$('pane-cal').hidden && $('pane-motor').hidden && $('pane-pid').hidden &&
        $('tab-cal').getAttribute('aria-selected') === 'true' && $('tab-motor').getAttribute('aria-selected') === 'false');
      const l0 = lang;
      $('langBtn').click();
      const l1 = lang;
      const flipped = document.documentElement.lang === l1 && $('tab-motor').textContent.indexOf(TEXT[l1].tabMotor) >= 0 &&
        $('st-cal').textContent === t(status.cal.key, status.cal.vars) && chip('cal').textContent === TEXT[l1].chipWrong.replace('{have}', TEXT[l1].mode_pid);
      $('langBtn').click();
      ok('lang.toggle', l1 !== l0 && flipped && lang === l0, l0 + ' -> ' + l1);
      const missing = Object.keys(TEXT.de).filter((k) => !(k in TEXT.en)).concat(Object.keys(TEXT.en).filter((k) => !(k in TEXT.de)));
      const raw = qa('[data-t]').filter((n) => !(n.dataset.t in TEXT.de)).map((n) => n.dataset.t);
      const tips = qa('[data-tip]').filter((n) => !(n.dataset.tip in TEXT.de)).map((n) => n.dataset.tip);
      ok('lang.keys', !missing.length && !raw.length && !tips.length, missing.concat(raw, tips).join(','));
      try { await document.fonts.load('600 16px Fredoka'); } catch (e) { /* */ }
      const fred = Array.from(document.fonts).some((f) => /Fredoka/.test(f.family) && f.status === 'loaded');
      const ext = qa('script[src],link[href]').filter((n) => /^(https?:)?\/\//.test(n.getAttribute('src') || n.getAttribute('href')));
      ok('offline', fred && !ext.length, (fred ? 'Fredoka loaded' : 'Fredoka missing') + ', external ' + ext.length);
      if (RM) ok('motion.reduce', document.documentElement.classList.contains('rm') && parseFloat(getComputedStyle($('rotL')).transitionDuration) < 0.01);
    } catch (err) {
      ok('exception', false, String(err && err.stack || err));
    }
    await disconnect();
    timeScale = 1;
    const fails = res.filter((r) => !r.ok).map((r) => r.id);
    document.title = fails.length ? 'SELFTEST FAIL ' + fails.join(' ') : 'SELFTEST PASS (' + res.length + ' checks)';
    out.textContent = document.title + '\n\n' + out.textContent;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
