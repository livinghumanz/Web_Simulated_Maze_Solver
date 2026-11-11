/*
 * RatRocket Fernsteuerung - drive the robot with a big cross of buttons.
 * Curriculum lesson 4 (ages 8-10). The robot must be in maze mode (DIP SW3).
 *
 * One button, one console command, and the page waits for the robot's reply
 * before the next one, like RatRocket Code does (console: docs/firmware.md,
 * replies checked against Core/Src/app_maze.c):
 *
 *   up     FWD <step>    -> "FWD done (event n)" / "FWD rejected"
 *   down   FWD -<step>   (backwards; the firmware drives it when both wheels
 *                         can reverse, older builds answer "FWD rejected")
 *   left   TURN -90      -> "TURN done (event n)" / "TURN rejected ..."
 *   right  TURN 90
 *   speed  VRUN <mm/s>   -> the CFG block, with a "v_run <v>" line
 *   STOP   STOP          (never locked; during a move the robot stops and
 *                         still answers "FWD done")
 *
 * ?selftest=1 runs a smoke test with a stand-in robot instead of the serial
 * link; the result goes to document.title (SELFTEST PASS / FAIL).
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORE = 'ratrocket.code';             /* language shared with RatRocket Code */
  const SELFTEST = /[?&]selftest/.test(location.search);

  const TEXT = {
    de: {
      title: 'RatRocket Fernsteuerung',
      tagline: 'Fahr den Roboter mit den Pfeilen',
      lang: 'English',
      editor: 'RatRocket Code',
      connect: 'Roboter verbinden',
      disconnect: 'Roboter trennen',
      connecting: 'Verbinde\u2026',
      notConnected: 'Nicht verbunden',
      modeHint: 'Der Roboter muss im Labyrinth-Modus sein.',
      up: 'Vorw\u00e4rts', down: 'R\u00fcckw\u00e4rts', left: 'Links', right: 'Rechts', stop: 'STOPP',
      step: 'Schritt', half: '\u00bd Feld', full: '1 Feld',
      speed: 'Tempo', slow: 'langsam', mid: 'mittel', fast: 'schnell',
      needBot: 'Verbinde zuerst den Roboter.',
      ready: 'Bereit. Dr\u00fcck einen Pfeil.',
      driving: 'Der Roboter f\u00e4hrt \u2026',
      done: 'Fertig.',
      speedSet: 'Tempo eingestellt: {v} mm/s.',
      stopped: 'Angehalten.',
      rejected: 'Der Roboter hat das abgelehnt.',
      backNo: 'R\u00fcckw\u00e4rts kann dieser Roboter nicht \u2013 nimm \u201eLinks" zweimal.',
      silent: 'Der Roboter antwortet nicht \u2013 Verbindung pr\u00fcfen.',
      noSerial: 'Dieser Browser kann keine Ger\u00e4te anschlie\u00dfen. Nimm Chrome oder Edge.',
      i_connect: 'Verbinde den Roboter per USB-C-Kabel oder Bluetooth.',
      i_mode: 'DIP-Schalter 3 an, 1 und 2 aus, dann Reset. Nur in diesem Modus versteht der Roboter die Fahrbefehle.',
      i_step: 'Wie weit ein Pfeil f\u00e4hrt: ein halbes Feld (8 cm) oder ein ganzes Feld (16 cm). Drehen ist immer eine Vierteldrehung.',
      i_speed: 'Wie schnell der Roboter geradeaus f\u00e4hrt: 50, 80 oder 120 Millimeter pro Sekunde.',
    },
    en: {
      title: 'RatRocket Remote',
      tagline: 'Drive the robot with the arrows',
      lang: 'Deutsch',
      editor: 'RatRocket Code',
      connect: 'Connect robot',
      disconnect: 'Disconnect robot',
      connecting: 'Connecting\u2026',
      notConnected: 'Not connected',
      modeHint: 'The robot must be in maze mode.',
      up: 'Forward', down: 'Back', left: 'Left', right: 'Right', stop: 'STOP',
      step: 'Step', half: '\u00bd cell', full: '1 cell',
      speed: 'Speed', slow: 'slow', mid: 'medium', fast: 'fast',
      needBot: 'Connect the robot first.',
      ready: 'Ready. Press an arrow.',
      driving: 'The robot is driving \u2026',
      done: 'Done.',
      speedSet: 'Speed set: {v} mm/s.',
      stopped: 'Stopped.',
      rejected: 'The robot refused that.',
      backNo: 'This robot cannot drive backwards \u2013 press "Left" twice.',
      silent: 'The robot does not answer \u2013 check the connection.',
      noSerial: 'This browser cannot connect devices. Use Chrome or Edge.',
      i_connect: 'Connect the robot with a USB-C cable or Bluetooth.',
      i_mode: 'DIP switch 3 on, 1 and 2 off, then reset. Only in this mode does the robot understand the drive commands.',
      i_step: 'How far an arrow drives: half a cell (8 cm) or a whole cell (16 cm). Turning is always a quarter turn.',
      i_speed: 'How fast the robot drives straight: 50, 80 or 120 millimetres per second.',
    },
  };

  let lang = 'de';
  let step = 160;                              /* mm: 80 = half a cell, 160 = one cell */
  let speed = 80;                              /* mm/s, sent as VRUN */
  let pending = null;                          /* the command waiting for its reply */
  let stopHit = false;                         /* STOP pressed during that command */

  const t = (key, vars) => {
    let s = (TEXT[lang] && TEXT[lang][key]) || TEXT.de[key] || key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  };

  /* ---------------- the link: Web Serial, or a stand-in for the self-test ---------------- */
  let port = null, writer = null, reader = null, mock = null;
  let rxWaiters = [];
  let timeScale = 1;
  const ready = () => !!(mock || port);

  function send(line) {
    if (mock) mock(line);
    else if (writer) writer.write(line + '\r\n');
  }
  function feed(line) { rxWaiters = rxWaiters.filter((w) => !w.try(line)); }
  function expect(re, ms) {
    return new Promise((resolve) => {
      const w = {
        try(line) { const m = line.match(re); if (m) { clearTimeout(w.to); resolve(m); return true; } return false; },
      };
      w.to = setTimeout(() => { rxWaiters = rxWaiters.filter((x) => x !== w); resolve(null); }, ms);
      rxWaiters.push(w);
    });
  }

  async function connect() {
    if (port) { await disconnect(); return; }
    if (!('serial' in navigator)) { status(t('noSerial'), true); return; }
    let p;
    try {
      p = await navigator.serial.requestPort();
      setLink('busy', t('connecting'));
      await p.open({ baudRate: 9600 });
    } catch (e) { setLink('', t('notConnected')); return; }
    port = p;
    const enc = new TextEncoderStream();
    enc.readable.pipeTo(port.writable).catch(() => {});
    writer = enc.writable.getWriter();
    const dec = new TextDecoderStream();
    port.readable.pipeTo(dec.writable).catch(() => {});
    reader = dec.readable.getReader();
    setLink('on', 'RatRocket');
    $('connectBtn').textContent = t('disconnect');
    readLoop();
    syncUi();
    await command('VRUN ' + speed);            /* the robot drives at the speed shown */
  }

  async function disconnect() {
    try { if (reader) await reader.cancel(); } catch (e) { /* gone */ }
    try { if (writer) await writer.close(); } catch (e) { /* gone */ }
    try { if (port) await port.close(); } catch (e) { /* gone */ }
    port = writer = reader = null;
    rxWaiters = [];
    pending = null;
    setLink('', t('notConnected'));
    $('connectBtn').textContent = t('connect');
    syncUi();
    status(t('needBot'));
  }

  async function readLoop() {
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, '');
          buf = buf.slice(i + 1);
          if (line) feed(line);
        }
      }
    } catch (e) { /* link lost */ }
    if (port) disconnect();
  }

  /* ---------------- commands ---------------- */
  const REPLY = {
    FWD: /^FWD (done|rejected)|^usage: FWD/,
    TURN: /^TURN (done|rejected)|^usage: TURN/,
    VRUN: /^\s*v_run (\S+)/,
  };
  const WAIT = { FWD: 15000, TURN: 12000, VRUN: 4000 };

  const MOVES = {
    up: () => 'FWD ' + step,
    down: () => 'FWD -' + step,
    left: () => 'TURN -90',
    right: () => 'TURN 90',
  };

  /* Send one command and wait for its answer; everything but STOP is locked
     meanwhile. */
  async function command(line) {
    if (pending) return;
    if (!ready()) { status(t('needBot'), true); return; }
    const verb = line.split(' ')[0];
    pending = line;
    stopHit = false;
    syncUi();
    if (verb !== 'VRUN') status(t('driving'));
    send(line);
    const m = await expect(REPLY[verb], WAIT[verb] * timeScale);
    pending = null;
    syncUi();
    if (!m) status(t('silent'), true);
    else if (stopHit) status(t('stopped'));
    else if (/rejected|usage/.test(m[0])) status(/^FWD -/.test(line) ? t('backNo') : t('rejected'), true);
    else if (verb === 'VRUN') status(t('speedSet', { v: Math.round(parseFloat(m[1])) }));
    else status(t('done'));
  }

  function stop() {
    if (!ready()) { status(t('needBot'), true); return; }
    send('STOP');
    if (pending) stopHit = true;
    else status(t('stopped'));
  }

  function setStep(v) {
    if (pending) return;
    step = v;
    syncUi();
  }

  function setSpeed(v) {
    if (pending) return;
    speed = v;
    syncUi();
    if (ready()) command('VRUN ' + v);
  }

  /* ---------------- page ---------------- */
  function status(msg, bad) {
    const s = $('status');
    s.textContent = msg;
    s.classList.toggle('bad', !!bad);
  }

  function setLink(cls, text) {
    $('linkState').className = 'link-state' + (cls ? ' ' + cls : '');
    $('linkText').textContent = text;
  }

  function syncUi() {
    const lock = !!pending;
    for (const id of ['btnUp', 'btnDown', 'btnLeft', 'btnRight']) $(id).disabled = lock;
    document.querySelectorAll('#stepSeg .seg-btn, #speedSeg .seg-btn').forEach((b) => {
      b.disabled = lock;
      const on = b.dataset.step ? +b.dataset.step === step : +b.dataset.speed === speed;
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.title = SELFTEST ? document.title : t('title');
    const map = {
      't-title': 'title', 't-tagline': 'tagline', 't-modeHint': 'modeHint',
      't-up': 'up', 't-down': 'down', 't-left': 'left', 't-right': 'right', 't-stop': 'stop',
      't-step': 'step', 'stepHalf': 'half', 'stepFull': 'full',
      't-speed': 'speed', 'speedSlow': 'slow', 'speedMid': 'mid', 'speedFast': 'fast',
      'editorLink': 'editor', 'langBtn': 'lang',
    };
    for (const id in map) { const n = $(id); if (n) n.textContent = t(map[id]); }
    $('connectBtn').textContent = port ? t('disconnect') : t('connect');
    if (!port) $('linkText').textContent = t('notConnected');
    status(ready() ? t('ready') : t('needBot'));
  }

  function loadLang() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && (s.lang === 'de' || s.lang === 'en')) lang = s.lang;
    } catch (e) { /* private mode */ }
  }
  function saveLang() {
    if (SELFTEST) return;
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null') || {};
      s.lang = lang;
      localStorage.setItem(STORE, JSON.stringify(s));
    } catch (e) { /* private mode */ }
  }

  /* ---------------- info tips (as in RatRocket Code) ---------------- */
  let tipFor = null;
  function showTip(btn) {
    const txt = t(btn.dataset.tipKey || '');
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
  const hideTip = () => { $('tip').hidden = true; tipFor = null; };

  function init() {
    loadLang();
    $('connectBtn').addEventListener('click', connect);
    $('langBtn').addEventListener('click', () => { lang = lang === 'de' ? 'en' : 'de'; saveLang(); applyLang(); });
    $('btnUp').addEventListener('click', () => command(MOVES.up()));
    $('btnDown').addEventListener('click', () => command(MOVES.down()));
    $('btnLeft').addEventListener('click', () => command(MOVES.left()));
    $('btnRight').addEventListener('click', () => command(MOVES.right()));
    $('btnStop').addEventListener('click', stop);
    document.querySelectorAll('#stepSeg .seg-btn').forEach((b) => b.addEventListener('click', () => setStep(+b.dataset.step)));
    document.querySelectorAll('#speedSeg .seg-btn').forEach((b) => b.addEventListener('click', () => setSpeed(+b.dataset.speed)));

    /* keyboard: arrows drive, space or Escape stops */
    document.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[e.key];
      if (k) { e.preventDefault(); if (!pending) command(MOVES[k]()); }
      else if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); hideTip(); stop(); }
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

    syncUi();
    applyLang();
    if (SELFTEST) selftest();
  }

  /* ---------------- smoke self-test ---------------- */
  async function selftest() {
    const sent = [];
    let delay = 20, silent = false, refuseBack = false;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    mock = (line) => {
      sent.push(line);
      if (silent) return;
      const v = line.split(' ');
      let out = [];
      if (v[0] === 'FWD') out = [refuseBack && +v[1] < 0 ? 'FWD rejected' : 'FWD done (event 0)'];
      else if (v[0] === 'TURN') out = ['TURN done (event 0)'];
      else if (v[0] === 'VRUN') out = ['CFG: size 3 goal (1,1) home 1 pitch 160.00 track 96.00',
        '     distance scale 100.00 trim 0.00%  escape entry 0', '     v_run ' + v[1] + '.00 a_run 400.00 v_turn 50.00 a_turn 400.00'];
      else if (v[0] === 'STOP') out = ['> STOP', 'stopped'];
      setTimeout(() => out.forEach(feed), delay);
    };
    timeScale = 0.02;
    const results = [];
    const check = (name, ok, extra) => results.push((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : ''));
    const last = () => sent[sent.length - 1];
    const press = async (id) => { $(id).click(); await sleep(60); };

    try {
      syncUi();
      /* every button, exactly its command */
      await press('btnUp');      check('up, 1 cell = FWD 160', last() === 'FWD 160', last());
      await press('btnDown');    check('down = FWD -160', last() === 'FWD -160', last());
      await press('btnLeft');    check('left = TURN -90', last() === 'TURN -90', last());
      await press('btnRight');   check('right = TURN 90', last() === 'TURN 90', last());
      await press('stepHalf');
      await press('btnUp');      check('up, half a cell = FWD 80', last() === 'FWD 80', last());
      await press('btnDown');    check('down, half a cell = FWD -80', last() === 'FWD -80', last());
      await press('stepFull');
      await press('speedSlow');  check('slow = VRUN 50', last() === 'VRUN 50', last());
      await press('speedFast');  check('fast = VRUN 120', last() === 'VRUN 120', last());
      await press('speedMid');   check('medium = VRUN 80', last() === 'VRUN 80', last());
      await press('btnStop');    check('STOP = STOP', last() === 'STOP', last());
      check('a done reply ends the command', !pending && $('status').textContent === t('stopped'));

      /* lockout while a command waits for its reply */
      delay = 200;
      const before = sent.length;
      $('btnUp').click();
      await sleep(20);
      const locked = ['btnUp', 'btnDown', 'btnLeft', 'btnRight', 'stepHalf', 'speedFast'].every((id) => $(id).disabled);
      check('pending: arrows, step and speed locked', locked && !!pending);
      $('btnRight').click(); $('btnDown').click(); $('speedSlow').click();
      await sleep(20);
      check('pending: other buttons send nothing', sent.length === before + 1, sent.slice(before).join(' | '));
      check('pending: STOP stays usable', !$('btnStop').disabled);
      $('btnStop').click();
      check('pending: STOP is sent at once', last() === 'STOP', last());
      await sleep(260);
      check('after the reply: unlocked, status says stopped', !pending && !$('btnUp').disabled && $('status').textContent === t('stopped'));

      /* no answer: unlocked again, own message */
      delay = 20;
      silent = true;
      await press('btnLeft');
      await sleep(12000 * timeScale + 80);
      check('no answer: "does not answer" message, unlocked', !pending && !$('btnLeft').disabled && $('status').textContent === t('silent'), $('status').textContent);
      silent = false;

      /* an old firmware refusing backwards */
      refuseBack = true;
      await press('btnDown');
      check('FWD rejected: tells the pupil it cannot drive backwards', $('status').textContent === t('backNo'), $('status').textContent);
      refuseBack = false;
    } catch (e) {
      results.push('FAIL threw: ' + e.message);
    }
    mock = null;
    timeScale = 1;

    const bad = results.filter((r) => r.startsWith('FAIL'));
    const pre = document.createElement('pre');
    pre.id = 'selftest';
    pre.style.cssText = 'position:fixed;inset:0;z-index:999;margin:0;padding:24px;' +
      'background:#141a24;color:#dfe6f0;font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap';
    pre.textContent = (bad.length ? bad.length + ' CHECK(S) FAILED' : 'ALL PASS') +
      ' (' + results.length + ' checks)\n\n' + results.join('\n');
    document.body.append(pre);
    document.title = bad.length ? 'SELFTEST FAIL' : 'SELFTEST PASS';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
