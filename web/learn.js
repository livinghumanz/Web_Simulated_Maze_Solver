/*
 * RatRocket Lernen - concept explainers and the Lexikon.
 *
 * One page, three kinds of view, chosen by the URL hash:
 *   #              home: topic cards
 *   #pid #encoder #pwm #ultraschall #floodfill   one explainer each
 *   #lexikon  #lexikon/<id>                       the dictionary
 *
 * Every explainer runs a small, honest simulation at a fixed time step (no
 * canned clips): what you see is what the numbers do. learn-data.js holds all
 * texts and the Lexikon entries. ?selftest=1 checks the page and writes PASS or
 * FAIL into document.title; ?motion=reduce shows the reduced-motion version;
 * ?demo=<s> fast-forwards an explainer (for screenshots).
 *
 * Plain ASCII: umlauts in strings are \u escapes.
 */
(function () {
  'use strict';

  const { TEXT, TOPICS, CATS, LEX } = window.RLData;
  const STORE = 'ratrocket.learn';
  const Q = location.search;
  const SELFTEST = /[?&]selftest=1\b/.test(Q);
  const DEMO = (/[?&]demo=([\d.]+)/.exec(Q) || [])[1];
  const RM = /[?&]motion=reduce\b/.test(Q) ||
    !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (RM) document.documentElement.classList.add('rm');
  const NS = 'http://www.w3.org/2000/svg';

  let lang = 'de';

  /* ---------------- helpers ---------------- */
  const $ = (id) => document.getElementById(id);
  function t(key, vars) {
    let s = TEXT[lang] && TEXT[lang][key];
    if (s == null) s = TEXT.de[key];
    if (s == null) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  }
  const L = (o) => (o ? (o[lang] != null ? o[lang] : o.de) : '');
  const other = (o) => (o ? (lang === 'de' ? o.en : o.de) : '');
  const nf = (x, d) => Number(x).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE',
    { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const code = (s) => '<code>' + esc(s) + '</code>';
  const soon = (k) => '<span class="soon">' + esc(t('soon')) + '</span> ' + esc(t('inEditor')) + ' ' + esc(t(k));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let titleLock = false;                       /* the self-test's verdict stays in the title */
  const setTitle = (s) => { if (!titleLock) document.title = s; };
  function sv(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function relabelDom(root) {
    root.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
    root.querySelectorAll('[data-tp]').forEach((n) => { n.setAttribute('placeholder', t(n.dataset.tp)); });
    root.querySelectorAll('[data-ta]').forEach((n) => { n.setAttribute('aria-label', t(n.dataset.ta)); });
  }
  const ICO = {
    back: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>',
    again: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5"/></svg>',
    play: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7-4.5z"/></svg>',
    pause: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg>',
    step: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3.5v9l6-4.5zM12 3.5v9"/></svg>',
    push: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h8M7.5 4.5 11 8l-3.5 3.5M13.5 3v10"/></svg>',
    search: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3.5 3.5"/></svg>',
    zero: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5"/><path d="M2.5 3v5h5"/></svg>',
  };

  /* ---------------- tooltips (as in the editor) ---------------- */
  let tipFor = null;
  function showTip(btn) {
    const k = btn.dataset.tipKey || '';
    const txt = btn.dataset.tip || (k.indexOf('ed:') === 0 ? E(k.slice(3)) : t(k));
    if (!txt) return;
    const tip = $('tip');
    tip.textContent = txt;
    tip.hidden = false;
    const r = btn.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
    let top = r.bottom + 8;
    if (top + tr.height > window.innerHeight - 8) top = r.top - tr.height - 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tipFor = btn;
  }
  const hideTip = () => { $('tip').hidden = true; tipFor = null; };
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest && e.target.closest('.info, [data-tip-key]');
    if (b) showTip(b); else if (tipFor) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const b = e.target.closest && e.target.closest('.info');
    if (b) showTip(b);
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('scroll', hideTip, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.info');
    if (b) { e.preventDefault(); if (tipFor === b) hideTip(); else showTip(b); }
  });
  const info = (key, dark) => '<button class="info' + (dark ? ' info-dk' : '') + '" type="button" data-tip-key="' + key + '" aria-label="Info">i</button>';

  /* The editor's own words and block glyphs (code-data.js, RRData), so the
     blocks here read exactly like in RatRocket Code. A copy if it is missing. */
  const ED = window.RRData || null;
  const ED_FALL = {
    de: { b_move: 'fahre 1 Feld', b_setVar: 'setze {v} auf {n}', b_changeVar: '\u00e4ndere {v} um {n}', b_showVar: 'zeige {v}',
      b_repeatUntil: 'wiederhole bis {c}', watch: 'Variablen', shown: 'Gezeigt', run: 'Los!', step: 'Schritt', reset: 'Zur\u00fcck',
      program: 'Dein Programm', numLabel: 'Zahl', varSuggest: ['Schritte'],
      failedWall: 'Autsch \u2013 da ist eine Wand. Schau dir den Weg noch einmal an.',
      failedLong: 'Das Programm l\u00e4uft zu lange. Fehlt eine Abbruchbedingung?',
      i_watch: 'Was gerade auf jedem Zettel steht. Gold umrandet: was sich zuletzt ge\u00e4ndert hat. Darunter: was \u201ezeige\u201c gezeigt hat.' },
    en: { b_move: 'move 1 cell', b_setVar: 'set {v} to {n}', b_changeVar: 'change {v} by {n}', b_showVar: 'show {v}',
      b_repeatUntil: 'repeat until {c}', watch: 'Variables', shown: 'Shown', run: 'Go!', step: 'Step', reset: 'Reset',
      program: 'Your program', numLabel: 'Number', varSuggest: ['Steps'],
      failedWall: 'Ouch \u2013 there is a wall. Look at the path again.',
      failedLong: 'The program runs too long. Is a stop condition missing?',
      i_watch: 'What each note says right now. Gold outline: what changed last. Below: what "show" showed.' },
  };
  function E(k) {
    const T = ED && ED.TEXT && ED.TEXT[lang];
    const v = T && T[k] != null ? T[k] : ED_FALL[lang][k];
    return v != null ? v : k;
  }
  const edText = (k) => E(k);                 /* the self-test has its own E */
  const BLK = (ED && ED.BLOCKS) || { move: { glyph: '\u25b2' }, repeatUntil: { glyph: '\u27f3' },
    setVar: { glyph: '=' }, changeVar: { glyph: '\u00b1' }, showVar: { glyph: '\u25c9' } };

  /* ---------------- shared topic frame ---------------- */
  /* o: { lead, main, side, merk, tryItems(), bridge() } -> refs */
  function topicShell(main, tp, o) {
    const idx = TOPICS.indexOf(tp);
    const next = TOPICS[(idx + 1) % TOPICS.length];
    main.innerHTML =
      '<section class="topic" data-topic="' + tp.id + '">' +
        '<div class="topic-head">' +
          '<a class="back" href="#">' + ICO.back + '<span data-t="back"></span></a>' +
          '<div class="topic-title"><span class="num">' + (idx + 1) + '</span><span class="tag tp-tag"></span><h1 class="tp-title"></h1></div>' +
          '<p class="lead" data-t="' + o.lead + '"></p>' +
        '</div>' +
        '<div class="tgrid">' +
          '<div class="tmain">' + o.main + (o.bridge ? '<div class="bridge tp-bridge"></div>' : '') + '</div>' +
          '<aside class="side">' + (RM ? '<p class="rm-note" data-t="rmNote"></p>' : '') + o.side +
            '<div class="merk"><h3>\u2605 <span data-t="merk"></span></h3><p data-t="' + o.merk + '"></p></div>' +
            '<section class="panel try"><h2 class="panel-h"><img class="try-bot" src="img/robot-maze.png" alt=""><span data-t="tryTitle"></span></h2><ul class="tp-try"></ul></section>' +
            '<div class="lexrow tp-lex"></div>' +
          '</aside>' +
        '</div>' +
        '<div class="topic-foot"><a class="next" href="#' + next.id + '"><span><small data-t="next"></small><strong class="tp-next"></strong></span><span class="arrow">\u2192</span></a></div>' +
      '</section>';
    const root = main.firstElementChild;
    const q = (sel) => root.querySelector(sel);
    function relabel() {
      relabelDom(root);
      q('.tp-tag').textContent = L(tp.tag);
      q('.tp-title').textContent = L(tp.title);
      q('.tp-next').textContent = L(next.title);
      q('.tp-try').innerHTML = o.tryItems().map((s) => '<li>' + s + '</li>').join('');
      if (o.bridge) q('.tp-bridge').innerHTML = o.bridge();
      q('.tp-lex').innerHTML = '<span class="lexrow-l">' + esc(t('inLex')) + ':</span>' +
        tp.lex.map((id) => {
          const e = LEX.find((x) => x.id === id);
          return e ? '<a class="chip" href="#lexikon/' + id + '">' + esc(L(e.term)) + '</a>' : '';
        }).join('');
      setTitle(L(tp.title) + ' \u2013 ' + t('title'));
    }
    return { root, q, relabel };
  }

  /* ======================================================================
   * 1. PID - lane keeping in a corridor
   *
   * Real units, the firmware's own control law (maze_run.c): every sensor
   * sample (50 ms) e = offset from the centre line (mm, + = right),
   * de filtered like the firmware, steer = -(Kp e + Kd de + Ki sum e),
   * clamped to 25 mm/s. Each wheel follows its speed with a 0.12 s lag; the
   * heading turns with (left - right) / track; the left motor is 6 mm/s
   * "stronger" (a real robot is never perfectly matched). The behaviours
   * (drift, zigzag, settle) are consequences of these numbers.
   * ==================================================================== */
  const PC = { v: 80, track: 96, clear: 30, half: 80, steerMax: 25, bias: 6, tau: 0.12, ts: 0.05, dt: 0.002, y0: -18, scale: 1.5, T: 15 };
  const PRESETS = { weak: { kp: 0.1, kd: 0, ki: 0 }, zig: { kp: 3, kd: 0, ki: 0 }, good: { kp: 1.5, kd: 1, ki: 0 } };

  function pidNew() {
    return { t: 0, y: PC.y0, th: 0, u: 0, cmd: 0, ePrev: PC.y0, deF: 0, iS: 0, next: 0, nextRec: 0.05,
      bumps: 0, onWall: 0, bumpLog: [], hist: [[0, PC.y0]], trail: [[0, PC.y0, 0]], newBump: null };
  }
  function pidStep(s, g) {
    const dt = PC.dt;
    if (s.t >= s.next - 1e-9) {
      const e = s.y;
      const de = (e - s.ePrev) / PC.ts;
      s.deF += 0.5 * (de - s.deF);
      s.ePrev = e;
      s.iS = clamp(s.iS + e * PC.ts, -40, 40);
      const lim = Math.min(PC.steerMax, 0.4 * PC.v);
      s.cmd = clamp(-(g.kp * e + g.kd * s.deF + g.ki * s.iS), -lim, lim);
      s.next += PC.ts;
    }
    s.u += (s.cmd - s.u) * dt / PC.tau;
    s.th += (2 * s.u + PC.bias) / PC.track * dt;
    s.y += PC.v * Math.sin(s.th) * dt;
    if (Math.abs(s.y) >= PC.clear) {
      const sg = Math.sign(s.y);
      s.y = sg * PC.clear;
      if (Math.sign(s.th) === sg) s.th = 0;
      if (!s.onWall) { s.bumps++; s.bumpLog.push([s.t, sg]); s.newBump = sg; }
      s.onWall = sg;
    } else {
      s.onWall = 0;
    }
    s.t += dt;
    if (s.t >= s.nextRec - 1e-9) {
      s.hist.push([s.t, s.y]);
      s.trail.push([s.t * PC.v, s.y, s.th]);
      s.nextRec += 0.05;
      if (s.hist.length > 900) { s.hist.splice(0, 300); s.trail.splice(0, 300); }
    }
  }
  function pidAdvance(s, g, sec) {
    const n = Math.round(sec / PC.dt);
    for (let i = 0; i < n; i++) pidStep(s, g);
  }
  function pidJudge(s) {
    if (s.t < 2.4) return 'start';
    const from = s.t - 4;
    const ys = [];
    for (let i = s.hist.length - 1; i >= 0 && s.hist[i][0] >= from; i--) ys.push(s.hist[i][1]);
    const max = Math.max.apply(null, ys), min = Math.min.apply(null, ys);
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    let zc = 0, sg = 0;
    for (let i = ys.length - 1; i >= 0; i--) {
      const v = ys[i];
      if (Math.abs(v) > 2) { const n = Math.sign(v); if (sg && n !== sg) zc++; sg = n; }
    }
    const sides = new Set(s.bumpLog.filter((b) => b[0] > from).map((b) => b[1]));
    if (sides.size > 1 || (zc >= 2 && max - min > 12)) return 'zig';
    if (sides.size || s.onWall) return 'wall';
    if (max - min < 3 && Math.abs(mean) <= 3.5) return 'good';
    if (max - min < 4) return 'off';
    return 'settle';
  }

  function viewPid(main, tp) {
    const K = 1.4, CY = 150, RX = 640, WALLY = PC.half * K;      /* 112 px from the centre line */
    const g = Object.assign({}, PRESETS.good);
    let s = pidNew(), prev = null, paused = false, ouchT = 0, judgeT = 0, verdict = 'start';

    const sh = topicShell(main, tp, {
      lead: 'pid_lead', merk: 'pid_merk',
      main:
        '<div class="stagebox"><div class="stage-cap">' + info('pid_tipStage', true) + '</div><span class="stage-badge pid-time"></span>' +
          '<svg class="pid-stage" viewBox="0 0 900 300" role="img"></svg></div>' +
        '<div class="stage-tools">' +
          '<button class="btn btn-sm pid-again" type="button">' + ICO.again + '<span data-t="again"></span></button>' +
          '<button class="btn btn-sm pid-push" type="button">' + ICO.push + '<span data-t="pid_push"></span></button>' +
          '<button class="btn btn-sm pid-pause" type="button"' + (RM ? ' disabled data-tip-key="rmTip"' : '') + '>' + ICO.pause + '<span class="pid-pause-l"></span></button>' +
        '</div>' +
        '<div class="scope"><div class="stage-cap"><span data-t="pid_curve"></span>' + info('pid_tipCurve', true) + '</div>' +
          '<svg class="pid-curve" viewBox="0 0 900 196" role="img"></svg></div>',
      side:
        '<section class="panel">' +
          '<div class="ctl ctl-p"><div class="ctl-head"><span data-t="pid_p"></span><output class="ctl-val pid-kp-v"></output></div>' +
            '<input type="range" class="pid-kp" min="0" max="4" step="0.1" data-ta="pid_p"><p class="ctl-hint" data-t="pid_pHint"></p></div>' +
          '<div class="ctl ctl-d"><div class="ctl-head"><span data-t="pid_d"></span><output class="ctl-val pid-kd-v"></output></div>' +
            '<input type="range" class="pid-kd" min="0" max="2" step="0.1" data-ta="pid_d"><p class="ctl-hint" data-t="pid_dHint"></p></div>' +
          '<details class="pro"><summary data-t="pid_iOpen"></summary>' +
            '<div class="ctl ctl-i"><div class="ctl-head"><span data-t="pid_i"></span><output class="ctl-val pid-ki-v"></output></div>' +
            '<input type="range" class="pid-ki" min="0" max="1" step="0.05" data-ta="pid_i"><p class="ctl-hint" data-t="pid_iHint"></p></div>' +
          '</details>' +
          '<div class="presets"><span class="presets-l" data-t="pid_presets"></span><div class="pills">' +
            '<button class="pill" type="button" data-p="weak"><span class="dotc" style="background:#9aa4b3"></span><span data-t="pid_weak"></span></button>' +
            '<button class="pill" type="button" data-p="zig"><span class="dotc" style="background:var(--board)"></span><span data-t="pid_zig"></span></button>' +
            '<button class="pill" type="button" data-p="good"><span class="dotc" style="background:#17935c"></span><span data-t="pid_good"></span></button>' +
          '</div></div>' +
        '</section>' +
        '<div class="status pid-status"></div>' +
        '<div class="readouts"><div class="ro"><span data-t="pid_err"></span><b class="pid-err"></b></div>' +
          '<div class="ro"><span data-t="pid_bumps"></span><b class="pid-bumps"></b></div></div>',
      tryItems: () => [
        t('pid_try1', { cmd: code('KC ' + g.kp.toFixed(1) + ' ' + g.kd.toFixed(1)), cell: code('CELL') }),
        t('pid_try2', { def: code('KC 1.5 0.5') }),
        soon('pid_trySoon'),
      ],
      bridge: () => '<span>' + esc(t('pid_bridge')) + '</span>' + code('KC ' + g.kp.toFixed(1) + ' ' + g.kd.toFixed(1)),
    });
    const q = sh.q;

    /* ---- stage drawing ---- */
    const st = q('.pid-stage');
    sv('rect', { width: 900, height: 300, class: 'st-floor' }, st);
    const gridG = sv('g', {}, st);
    const cellLines = [];
    for (let i = 0; i < 9; i++) cellLines.push(sv('line', { y1: CY - WALLY, y2: CY + WALLY, class: 'st-grid' }, gridG));
    sv('rect', { x: 0, y: CY - WALLY - 18, width: 900, height: 18, class: 'st-wall pid-wall-l' }, st);
    sv('rect', { x: 0, y: CY + WALLY, width: 900, height: 18, class: 'st-wall pid-wall-r' }, st);
    const posts = [];
    for (let i = 0; i < 9; i++) {
      posts.push([sv('rect', { y: CY - WALLY - 18, width: 10, height: 18, class: 'st-post' }, st),
        sv('rect', { y: CY + WALLY, width: 10, height: 18, class: 'st-post' }, st)]);
    }
    const mid = sv('line', { x1: -40, x2: 940, y1: CY, y2: CY, class: 'st-mid' }, st);
    const midLbl = sv('text', { x: 14, y: CY - 8, class: 'st-txt-s' }, st);
    const ghost = sv('polyline', { class: 'st-ghost' }, st);
    const trail = sv('polyline', { class: 'st-trail' }, st);
    const beamL = sv('line', { class: 'st-beam' }, st), beamR = sv('line', { class: 'st-beam' }, st);
    const beamLt = sv('text', { class: 'st-txt-s', 'text-anchor': 'middle' }, st);
    const beamRt = sv('text', { class: 'st-txt-s', 'text-anchor': 'middle' }, st);
    const errLine = sv('line', { class: 'st-err' }, st);
    const errTxt = sv('text', { class: 'st-txt' }, st);
    const robot = sv('use', { href: '#bot' }, st);
    const ouch = sv('text', { class: 'st-ouch', 'text-anchor': 'middle' }, st);

    /* ---- curve ---- */
    const cv = q('.pid-curve');
    const X0 = 58, X1 = 884, CYc = 104, KY = 1.85;
    sv('rect', { width: 900, height: 196, class: 'st-floor' }, cv);
    const ticksG = sv('g', {}, cv);
    sv('line', { x1: X0, x2: X1, y1: CYc - PC.clear * KY, y2: CYc - PC.clear * KY, class: 'sc-wall' }, cv);
    sv('line', { x1: X0, x2: X1, y1: CYc + PC.clear * KY, y2: CYc + PC.clear * KY, class: 'sc-wall' }, cv);
    sv('line', { x1: X0, x2: X1, y1: CYc, y2: CYc, class: 'sc-zero' }, cv);
    const lblWallL = sv('text', { x: X0 - 6, y: CYc - PC.clear * KY + 4, class: 'sc-lbl-w', 'text-anchor': 'end' }, cv);
    const lblWallR = sv('text', { x: X0 - 6, y: CYc + PC.clear * KY + 4, class: 'sc-lbl-w', 'text-anchor': 'end' }, cv);
    const lblMid = sv('text', { x: X0 - 6, y: CYc + 4, class: 'sc-lbl', 'text-anchor': 'end' }, cv);
    const cGhost = sv('polyline', { class: 'sc-ghost' }, cv);
    const cLine = sv('polyline', { class: 'sc-line' }, cv);
    const cDot = sv('circle', { r: 4.5, fill: 'var(--pad)' }, cv);
    const lblPrev = sv('text', { class: 'sc-lbl', x: X1, y: 22, 'text-anchor': 'end' }, cv);

    function drawStage(full) {
      let xr = s.t * PC.v, kx = K, rx = RX;
      if (full) { kx = 760 / (PC.T * PC.v); rx = 40 + xr * kx; }
      const off = rx - xr * kx;
      /* cells and wall posts every 160 mm */
      const i0 = Math.floor((xr - rx / kx) / 160) - 1;
      for (let i = 0; i < cellLines.length; i++) {
        const x = off + (i0 + i) * 160 * kx;
        cellLines[i].setAttribute('x1', x); cellLines[i].setAttribute('x2', x);
        posts[i][0].setAttribute('x', x - 5); posts[i][1].setAttribute('x', x - 5);
      }
      mid.style.strokeDashoffset = String((xr * kx) % 26);
      const pts = (arr) => {
        let out = '';
        const xmin = xr - rx / kx - 40;
        for (let i = 0; i < arr.length; i++) {
          const p = arr[i];
          if (p[0] < xmin || p[0] > xr + 1) continue;
          out += (off + p[0] * kx).toFixed(1) + ',' + (CY + p[1] * K).toFixed(1) + ' ';
        }
        return out;
      };
      trail.setAttribute('points', pts(s.trail) + rx + ',' + (CY + s.y * K).toFixed(1));
      ghost.setAttribute('points', prev ? pts(prev.trail) : '');
      const ry = CY + s.y * K;
      const sc = full ? 0.9 : K;
      robot.setAttribute('transform', 'translate(' + rx.toFixed(1) + ' ' + ry.toFixed(1) + ') rotate(' + (90 + s.th * 180 / Math.PI).toFixed(2) + ') scale(' + sc + ')');
      /* side "sensor" distances: body edge to wall */
      const bx = rx - 12;
      const yl = ry - 50 * sc, yr = ry + 50 * sc;
      beamL.setAttribute('x1', bx); beamL.setAttribute('x2', bx); beamL.setAttribute('y1', yl); beamL.setAttribute('y2', CY - WALLY);
      beamR.setAttribute('x1', bx); beamR.setAttribute('x2', bx); beamR.setAttribute('y1', yr); beamR.setAttribute('y2', CY + WALLY);
      beamLt.setAttribute('x', bx - 38); beamLt.setAttribute('y', CY - WALLY + 15);
      beamRt.setAttribute('x', bx - 38); beamRt.setAttribute('y', CY + WALLY - 7);
      /* the body covers a label when it is close to that wall */
      beamLt.textContent = PC.clear + s.y >= 14 ? t('pid_left') + ' ' + nf(PC.clear + s.y, 0) + ' mm' : '';
      beamRt.textContent = PC.clear - s.y >= 14 ? t('pid_right') + ' ' + nf(PC.clear - s.y, 0) + ' mm' : '';
      const ex = rx + (full ? 30 : 128);
      errLine.setAttribute('x1', ex); errLine.setAttribute('x2', ex); errLine.setAttribute('y1', CY); errLine.setAttribute('y2', ry);
      errTxt.setAttribute('x', ex + 8); errTxt.setAttribute('y', (CY + ry) / 2 + 5);
      errTxt.textContent = Math.abs(s.y) >= 1 ? nf(Math.abs(s.y), 0) + ' mm' : '';
      midLbl.textContent = t('pid_mid');
      if (ouchT > 0) {
        ouch.setAttribute('x', rx + 190); ouch.setAttribute('y', s.onWall > 0 ? CY + WALLY - 16 : CY - WALLY + 32);
        ouch.textContent = t('pid_ouch');
      } else {
        ouch.textContent = '';
      }
      q('.pid-time').textContent = 't = ' + nf(s.t, 1) + ' s';
    }

    function drawCurve() {
      const t0 = Math.max(0, s.t - PC.T);
      const xs = (tt) => X0 + (tt - t0) / PC.T * (X1 - X0);
      const ys = (y) => CYc + clamp(y, -45, 45) * KY;
      const line = (hist) => {
        let out = '';
        for (let i = 0; i < hist.length; i++) {
          const p = hist[i];
          if (p[0] < t0) continue;
          if (p[0] > s.t + 1e-6 && hist !== (prev && prev.hist)) break;
          if (p[0] > t0 + PC.T) break;
          out += xs(p[0]).toFixed(1) + ',' + ys(p[1]).toFixed(1) + ' ';
        }
        return out;
      };
      cLine.setAttribute('points', line(s.hist) + xs(s.t).toFixed(1) + ',' + ys(s.y).toFixed(1));
      cDot.setAttribute('cx', xs(s.t)); cDot.setAttribute('cy', ys(s.y));
      cGhost.setAttribute('points', prev ? line(prev.hist) : '');
      lblPrev.textContent = prev ? '- - ' + t('pid_prev') : '';
      let tk = '';
      for (let k = Math.ceil(t0); k <= t0 + PC.T + 1e-6; k++) {
        const x = xs(k).toFixed(1);
        tk += '<line class="sc-grid" x1="' + x + '" x2="' + x + '" y1="30" y2="176"/>';
        if (k % 3 === 0) tk += '<text class="sc-lbl" x="' + x + '" y="191" text-anchor="middle">' + k + ' s</text>';
      }
      ticksG.innerHTML = tk;
      lblWallL.textContent = t('pid_wall'); lblWallR.textContent = t('pid_wall'); lblMid.textContent = t('pid_mid');
    }

    function drawPanel() {
      q('.pid-kp-v').textContent = 'Kp = ' + nf(g.kp, 1);
      q('.pid-kd-v').textContent = 'Kd = ' + nf(g.kd, 1);
      q('.pid-ki-v').textContent = 'Ki = ' + nf(g.ki, 2);
      q('.pid-err').textContent = nf(Math.abs(s.y), 0) + ' mm' + (Math.abs(s.y) >= 1 ? ' ' + (s.y < 0 ? t('pid_left') : t('pid_right')) : '');
      q('.pid-bumps').textContent = s.bumps + '\u00d7';
      const map = { start: ['', 'pid_st_start'], wall: ['bad', 'pid_st_wall'], zig: ['bad', 'pid_st_zig'],
        off: ['', 'pid_st_off'], settle: ['', 'pid_st_settle'], good: ['ok', 'pid_st_good'] };
      const m = map[verdict];
      const stEl = q('.pid-status');
      stEl.className = 'status pid-status' + (m[0] ? ' ' + m[0] : '');
      stEl.textContent = t(m[1]);
      stEl.dataset.state = verdict;
      q('.pid-pause-l').textContent = paused ? t('resume') : t('pause');
      main.querySelectorAll('.pill[data-p]').forEach((b) => {
        const p = PRESETS[b.dataset.p];
        b.setAttribute('aria-pressed', String(p.kp === g.kp && p.kd === g.kd && p.ki === g.ki));
      });
      const br = q('.tp-bridge code');
      if (br) br.textContent = 'KC ' + g.kp.toFixed(1) + ' ' + g.kd.toFixed(1);
    }
    function syncSliders() {
      q('.pid-kp').value = g.kp; q('.pid-kd').value = g.kd; q('.pid-ki').value = g.ki;
    }
    function restart() {
      if (s.t > 1) prev = s;
      s = pidNew(); ouchT = 0; verdict = 'start';
      if (RM) staticRun();
      draw();
    }
    function staticRun() {
      s = pidNew();
      pidAdvance(s, g, PC.T);
      verdict = pidJudge(s);
    }
    function draw() { drawStage(RM); drawCurve(); drawPanel(); }

    q('.pid-kp').addEventListener('input', (e) => { g.kp = +e.target.value; if (RM) staticRun(); draw(); });
    q('.pid-kd').addEventListener('input', (e) => { g.kd = +e.target.value; if (RM) staticRun(); draw(); });
    q('.pid-ki').addEventListener('input', (e) => { g.ki = +e.target.value; if (RM) staticRun(); draw(); });
    main.querySelectorAll('.pill[data-p]').forEach((b) => b.addEventListener('click', () => {
      Object.assign(g, PRESETS[b.dataset.p]);
      if (g.ki) q('details.pro').open = true;
      syncSliders(); restart(); sh.relabel(); drawPanel();
    }));
    q('.pid-again').addEventListener('click', restart);
    let pushDir = 1;
    function push() {
      pushDir = -pushDir;
      s.th += 0.24 * pushDir;
      if (RM) { pidAdvance(s, g, 4); verdict = pidJudge(s); }
      draw();
    }
    q('.pid-push').addEventListener('click', push);
    q('.pid-pause').addEventListener('click', () => { paused = !paused; drawPanel(); });

    /* worksheet links: learn.html?kp=3&kd=0#pid opens with these numbers */
    const qp = (k, max) => { const m = new RegExp('[?&]' + k + '=([\\d.]+)').exec(Q); return m ? clamp(+m[1], 0, max) : null; };
    if (qp('kp', 4) != null || qp('kd', 2) != null || qp('ki', 1) != null) {
      g.kp = qp('kp', 4) != null ? Math.round(qp('kp', 4) * 10) / 10 : g.kp;
      g.kd = qp('kd', 2) != null ? Math.round(qp('kd', 2) * 10) / 10 : g.kd;
      g.ki = qp('ki', 1) != null ? Math.round(qp('ki', 1) * 20) / 20 : 0;
      if (g.ki) q('details.pro').open = true;
    }
    syncSliders();
    sh.relabel();
    if (RM) staticRun();
    draw();

    function frame(dt) {
      if (paused) return;
      pidAdvance(s, g, dt * PC.scale);
      if (s.newBump) { ouchT = 0.8; s.newBump = null; }
      ouchT = Math.max(0, ouchT - dt);
      judgeT -= dt;
      if (judgeT <= 0) { verdict = pidJudge(s); judgeT = 0.25; }
      drawStage(false); drawCurve(); drawPanel();
    }
    return {
      kind: 'topic', id: 'pid', frame,
      relabel: () => { sh.relabel(); draw(); },
      demo: (sec) => { pidAdvance(s, g, sec); verdict = pidJudge(s); draw(); },
      api: {
        g, get s() { return s; }, get prev() { return prev; },
        preset: (name) => main.querySelector('.pill[data-p="' + name + '"]').click(),
        setGains: (kp, kd, ki) => { g.kp = kp; g.kd = kd; g.ki = ki || 0; syncSliders(); draw(); },
        restart,
        advance: (sec) => { pidAdvance(s, g, sec); verdict = pidJudge(s); draw(); },
        verdict: () => verdict,
        curve: () => cLine.getAttribute('points'),
        push,
      },
    };
  }

  /* ======================================================================
   * 2. Encoder - counting pulses
   * Real numbers: 2874 counts per wheel turn, wheel 34 mm (firmware.md).
   * ==================================================================== */
  const ENC = { ppr: 2874, dia: 34 };
  ENC.circ = Math.PI * ENC.dia;                       /* 106.8 mm */
  ENC.ppmm = ENC.ppr / ENC.circ;                      /* 26.9 pulses per mm */
  ENC.cell = Math.round(160 * ENC.ppmm);              /* 4305 */
  const encRate = (v) => (v <= 0 ? 0 : 0.004 * Math.pow(250, (v - 1) / 99));   /* slider -> turns/s */

  function viewEncoder(main, tp) {
    const WX = 205, WY = 186, RT = 102, LX = 450, LY = 104, LR = 68, ZOOM = 20;
    const st = { p: 0, v: 30, target: null, done: null, lastShown: -1 };
    const sh = topicShell(main, tp, {
      lead: 'enc_lead', merk: 'enc_merk',
      main:
        '<div class="stagebox"><div class="stage-cap">' + info('enc_tipTicks', true) + '</div>' +
          '<svg class="enc-stage" viewBox="0 0 900 380" role="img"></svg></div>' +
        '<div class="stage-tools">' +
          '<button class="btn btn-sm enc-zero" type="button">' + ICO.zero + '<span data-t="enc_zero"></span></button>' +
          '<button class="btn btn-sm enc-turn" type="button">' + ICO.play + '<span data-t="enc_turn"></span></button>' +
          '<button class="btn btn-sm btn-primary enc-cell" type="button">' + ICO.play + '<span data-t="enc_cell"></span></button>' +
          (RM ? '<button class="btn btn-sm enc-step" type="button">+100 <span data-t="enc_pulses"></span></button>' : '') +
        '</div>' +
        '<section class="panel"><h2 class="panel-h"><span data-t="enc_calc"></span>' + info('enc_tipStory') + '</h2><ol class="calc calc-2 enc-calc"></ol></section>',
      side:
        '<section class="panel">' +
          '<div class="ctl"><div class="ctl-head"><span data-t="enc_speed"></span></div>' +
            '<input type="range" class="enc-speed" min="0" max="100" step="1" data-ta="enc_speed"' + (RM ? ' disabled' : '') + '>' +
            '<p class="ctl-hint enc-rate"></p></div>' +
        '</section>' +
        '<div class="status enc-status"></div>' +
        '<div class="readouts">' +
          '<div class="ro"><span data-t="enc_pulses"></span><b class="enc-p"></b></div>' +
          '<div class="ro"><span data-t="enc_turns"></span><b class="enc-u"></b></div>' +
          '<div class="ro ro-wide"><span data-t="enc_dist"></span><b class="enc-d"></b></div>' +
        '</div>',
      tryItems: () => [
        t('enc_try1', { enc0: code('ENC0'), enc: code('ENC') }),
        t('enc_try2', { cell: code('CELL') }),
        soon('enc_trySoon'),
      ],
    });
    const q = sh.q;
    const svg = q('.enc-stage');
    sv('rect', { width: 900, height: 380, class: 'st-floor' }, svg);

    /* the floor the wheel rolls on, marks every 10 mm (scale: 150 px = 17 mm) */
    const KW = 150 / 17;
    const groundG = sv('g', {}, svg);
    sv('line', { x1: 20, x2: 420, y1: WY + 150, y2: WY + 150, stroke: '#3a465b', 'stroke-width': 2 }, svg);
    const marks = [];
    for (let i = 0; i < 5; i++) marks.push(sv('line', { y1: WY + 150, y2: WY + 162, stroke: '#5a6577', 'stroke-width': 2 }, groundG));

    /* wheel */
    const wheel = sv('g', {}, svg);
    sv('circle', { cx: WX, cy: WY, r: 150, fill: '#1d2127' }, wheel);
    sv('circle', { cx: WX, cy: WY, r: 141, fill: 'none', stroke: '#2c323b', 'stroke-width': 16, 'stroke-dasharray': '13 9' }, wheel);
    sv('circle', { cx: WX, cy: WY, r: 118, fill: '#cfd5de' }, wheel);
    sv('circle', { cx: WX, cy: WY, r: 103, fill: 'none', stroke: '#8f98a8', 'stroke-width': 14 }, wheel);
    /* 2874 tick marks, one per pulse (so dense they read as the grey band) */
    let d = '';
    for (let i = 0; i < ENC.ppr; i++) {
      const a = i / ENC.ppr * Math.PI * 2;
      const c = Math.cos(a), sn = Math.sin(a);
      d += 'M' + (WX + sn * 96).toFixed(2) + ' ' + (WY - c * 96).toFixed(2) + 'L' + (WX + sn * 110).toFixed(2) + ' ' + (WY - c * 110).toFixed(2);
    }
    sv('path', { id: 'encTicks', d, stroke: '#4a5262', 'stroke-width': 0.1, fill: 'none' }, wheel);
    sv('circle', { cx: WX, cy: WY, r: 92, fill: '#e6e9ee' }, wheel);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      sv('line', { x1: WX, y1: WY, x2: WX + Math.sin(a) * 88, y2: WY - Math.cos(a) * 88, stroke: '#aab2bf', 'stroke-width': 9, 'stroke-linecap': 'round' }, wheel);
    }
    sv('circle', { cx: WX, cy: WY, r: 30, fill: '#c9a046' }, wheel);
    sv('circle', { cx: WX, cy: WY, r: 9, fill: '#7a5a1c' }, wheel);
    /* the little flag, as on the classroom robots */
    sv('path', { d: 'M' + WX + ' ' + (WY - 92) + 'V' + (WY - 140) + 'l26 8 -26 9', fill: 'var(--board)', stroke: 'var(--board-dk)', 'stroke-width': 2 }, wheel);

    /* sensor at 12 o'clock, and its blinking LED */
    sv('rect', { x: WX - 13, y: WY - RT - 30, width: 26, height: 18, rx: 4, fill: '#2b3445', stroke: '#5a6577' }, svg);
    const led = sv('circle', { cx: WX, cy: WY - RT - 21, r: 5, fill: 'var(--pad)' }, svg);
    sv('line', { x1: WX, x2: WX, y1: WY - RT - 12, y2: WY - RT + 8, stroke: 'var(--board)', 'stroke-width': 1.6 }, svg);
    const sensLbl = sv('text', { x: WX - 22, y: WY - RT - 36, class: 'st-txt-s' }, svg);

    /* magnifier */
    sv('line', { x1: WX + 8, y1: WY - RT, x2: LX - LR + 4, y2: LY + 10, stroke: '#5a6577', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, svg);
    const clip = sv('clipPath', { id: 'encLensClip' }, svg);
    sv('circle', { cx: LX, cy: LY, r: LR }, clip);
    const lensG = sv('g', { 'clip-path': 'url(#encLensClip)' }, svg);
    sv('circle', { cx: LX, cy: LY, r: LR, fill: '#cfd5de' }, lensG);
    const lensZoom = sv('g', { transform: 'translate(' + LX + ' ' + LY + ') scale(' + ZOOM + ') translate(' + (-WX) + ' ' + (-(WY - RT)) + ')' }, lensG);
    const lensRot = sv('g', {}, lensZoom);
    sv('use', { href: '#encTicks' }, lensRot);
    sv('line', { x1: LX, x2: LX, y1: LY - LR, y2: LY + LR, stroke: 'var(--board)', 'stroke-width': 3 }, lensG);
    sv('circle', { cx: LX, cy: LY, r: LR, fill: 'none', stroke: '#e7ecf3', 'stroke-width': 5 }, svg);
    const lensLbl = sv('text', { x: LX, y: LY + LR + 22, class: 'st-txt-s', 'text-anchor': 'middle' }, svg);

    /* counter */
    const cntLbl = sv('text', { x: 600, y: 64, class: 'st-txt' }, svg);
    const cnt = sv('text', { x: 600, y: 128, class: 'st-big', style: 'font-size:64px;font-variant-numeric:tabular-nums' }, svg);
    const cntU = sv('text', { x: 602, y: 164, class: 'st-txt' }, svg);
    const cntD = sv('text', { x: 602, y: 190, class: 'st-txt' }, svg);

    /* two cells on the floor, robot on top */
    const TX0 = 560, TX1 = 880, TY = 300, KT = (TX1 - TX0) / 320;
    const wayLbl = sv('text', { x: TX0, y: TY - 52, class: 'st-txt-s' }, svg);
    sv('rect', { x: TX0, y: TY - 34, width: TX1 - TX0, height: 68, fill: '#1b2330' }, svg);
    const fill = sv('rect', { x: TX0, y: TY - 34, height: 68, fill: 'rgba(227,162,51,.22)' }, svg);
    const cellLbls = [];
    for (let i = 0; i <= 2; i++) {
      sv('rect', { x: TX0 + i * 160 * KT - 4, y: TY - 34, width: 8, height: 68, class: 'st-wall' }, svg);
      if (i < 2) cellLbls.push(sv('text', { x: TX0 + (i + 0.5) * 160 * KT, y: TY + 54, class: 'st-txt-s', 'text-anchor': 'middle' }, svg));
    }
    const miniBot = sv('use', { href: '#bot' }, svg);

    function rateNow() {
      let r = encRate(st.v);
      if (st.target != null) {
        r = Math.max(r, 0.25);
        const rem = st.target - st.p;
        r = Math.min(r, Math.max(0.006, rem / ENC.ppr * 1.6));
      }
      return r;
    }
    function draw() {
      const p = st.p;
      const ang = p / ENC.ppr * 360;
      wheel.setAttribute('transform', 'rotate(' + ang.toFixed(3) + ' ' + WX + ' ' + WY + ')');
      lensRot.setAttribute('transform', 'rotate(' + ang.toFixed(3) + ' ' + WX + ' ' + WY + ')');
      const pi = Math.floor(p + 1e-6);
      const rate = rateNow() * ENC.ppr;
      led.setAttribute('opacity', rate > 40 ? 0.55 : (pi % 2 ? 1 : 0.15));
      const mm = p / ENC.ppmm;
      for (let i = 0; i < marks.length; i++) {
        const x = 20 + (((i * 10 - mm) % 50) + 50) % 50 * KW;
        marks[i].setAttribute('x1', x); marks[i].setAttribute('x2', x);
        marks[i].setAttribute('opacity', x > 420 ? 0 : 1);
      }
      cnt.textContent = nf(pi, 0);
      cntLbl.textContent = t('enc_pulses');
      cntU.textContent = '= ' + nf(p / ENC.ppr, 2) + ' ' + t('enc_turns');
      cntD.textContent = '= ' + nf(mm, 1) + ' mm';
      const inTrack = ((mm % 320) + 320) % 320;
      fill.setAttribute('width', (inTrack * KT).toFixed(1));
      miniBot.setAttribute('transform', 'translate(' + (TX0 + inTrack * KT).toFixed(1) + ' ' + TY + ') rotate(90) scale(.56)');
      cellLbls.forEach((n, i) => { n.textContent = t('enc_cellN', { n: i + 1 }); });
      wayLbl.textContent = t('enc_way');
      sensLbl.textContent = t('enc_sensor');
      lensLbl.textContent = t('enc_lens', {});
      q('.enc-p').textContent = nf(pi, 0);
      q('.enc-u').textContent = nf(p / ENC.ppr, 2);
      q('.enc-d').textContent = nf(mm, 1) + ' mm = ' + nf(mm / 10, 2) + ' cm';
      q('.enc-rate').textContent = st.v > 0 ? t('enc_perSec', { n: nf(encRate(st.v) * ENC.ppr, 0) }) : t('enc_stopped');
      const s = q('.enc-status');
      if (st.done) { s.className = 'status enc-status ok'; s.textContent = st.done; }
      else { s.className = 'status enc-status'; s.textContent = t('enc_hint'); }
      q('.enc-calc').innerHTML = [
        t('enc_c1', { ppr: nf(ENC.ppr, 0) }),
        t('enc_c2', { circ: nf(ENC.circ, 1) }),
        t('enc_c3', { ppr: nf(ENC.ppr, 0), circ: nf(ENC.circ, 1), ppmm: nf(ENC.ppmm, 1) }),
        t('enc_c4', { ppmm: nf(ENC.ppmm, 1), cell: nf(ENC.cell, 0) }),
      ].map((x, i) => '<li data-n="' + (i + 1) + '"' + (i === 3 && st.doneKind === 'cell' ? ' class="hot"' : i === 0 && st.doneKind === 'turn' ? ' class="hot"' : '') + '>' + esc(x) + '</li>').join('');
    }
    function step(dt) {
      const r = rateNow();
      if (r <= 0) return;
      st.p += r * ENC.ppr * dt;
      if (st.target != null && st.p >= st.target - 1e-6) {
        st.p = st.target;
        st.done = st.doneKind === 'cell' ? t('enc_doneCell', { n: nf(ENC.cell, 0) }) : t('enc_doneTurn', { n: nf(ENC.ppr, 0) });
        st.target = null;
        st.v = 0; q('.enc-speed').value = 0;
      }
    }
    function go(kind) {
      const base = Math.round(st.p);
      st.p = base;
      st.doneKind = kind; st.done = null;
      st.target = base + (kind === 'cell' ? ENC.cell : ENC.ppr);
      if (RM) {                                       /* no motion: jump to the result */
        st.p = st.target; st.target = null;
        st.done = kind === 'cell' ? t('enc_doneCell', { n: nf(ENC.cell, 0) }) : t('enc_doneTurn', { n: nf(ENC.ppr, 0) });
      }
      draw();
    }
    q('.enc-speed').value = RM ? 0 : st.v;
    if (RM) st.v = 0;
    q('.enc-speed').addEventListener('input', (e) => { st.v = +e.target.value; st.target = null; st.done = null; st.doneKind = null; draw(); });
    q('.enc-zero').addEventListener('click', () => { st.p = 0; st.target = null; st.done = null; st.doneKind = null; draw(); });
    q('.enc-turn').addEventListener('click', () => go('turn'));
    q('.enc-cell').addEventListener('click', () => go('cell'));
    if (RM) q('.enc-step').addEventListener('click', () => { st.p = Math.round(st.p) + 100; st.done = null; draw(); });
    sh.relabel();
    draw();
    return {
      kind: 'topic', id: 'encoder',
      frame: (dt) => { step(dt); draw(); },
      relabel: () => { sh.relabel(); draw(); },
      demo: () => { st.p = 3120; draw(); },
      api: {
        st, draw,
        setSpeed: (v) => { const el = q('.enc-speed'); el.value = v; el.dispatchEvent(new Event('input')); },
        advance: (sec) => { for (let i = 0; i < sec * 120; i++) step(1 / 120); draw(); },
        click: (cls) => q(cls).click(),
        text: (cls) => q(cls).textContent,
      },
    };
  }

  /* ======================================================================
   * 3. PWM - on and off, fast
   * Toy motor: winding current lags the switch (2 ms), the wheel has inertia
   * (0.12 s) and Coulomb friction, which gives the real dead band (~25 %,
   * firmware.md: ~250 of 1010 at 1 kHz). Integrated at 20 us (fast switching)
   * or 1 ms (slow switching), so the smoothing is a real consequence.
   * ==================================================================== */
  const PW = { tauE: 0.002, J: 0.09, B: 0.75, F: 0.25, Fs: 0.27, maxTurns: 1.4 };
  function pwmNew() { return { t: 0, i: 0, w: 0, ang: 0, hist: [], lastRec: 0 }; }
  function pwmStep(m, cfg, dt) {
    const f = cfg.fast ? 1000 : 1;
    const ph = (m.t * f) % 1;
    const on = cfg.duty >= 1 || (cfg.duty > 0 && ph < cfg.duty);
    const u = on ? cfg.dir : 0;
    m.on = on;
    m.i += (u - m.i) * dt / PW.tauE;
    if (m.w === 0 && Math.abs(m.i) < PW.Fs) {
      /* stuck: friction holds it */
    } else {
      const fr = m.w !== 0 ? PW.F * Math.sign(m.w) : PW.F * Math.sign(m.i);
      let nw = m.w + (m.i - fr - PW.B * m.w) * dt / PW.J;
      if (m.w !== 0 && Math.sign(nw) !== Math.sign(m.w) && Math.abs(m.i) < PW.Fs) nw = 0;
      m.w = nw;
    }
    m.ang += m.w * PW.maxTurns * 360 * dt;
    m.t += dt;
  }

  function viewPwm(main, tp) {
    const cfg = { duty: 0.5, dir: 1, fast: true, zoom: 2 };
    const ZOOMS = { fast: [1, 2, 5, 10, 20], slow: [2, 4, 8] };     /* ms / s */
    let m = pwmNew();
    let wAvg = 0;
    const sh = topicShell(main, tp, {
      lead: 'pwm_lead', merk: 'pwm_merk',
      main:
        '<div class="stagebox"><svg class="pwm-stage" viewBox="0 0 900 300" role="img"></svg></div>' +
        '<div class="scope"><div class="stage-cap"><span data-t="pwm_scope"></span>' + info('pwm_tipScope', true) + '</div>' +
          '<div class="stage-badge" style="pointer-events:auto;display:flex;gap:6px;align-items:center;padding:2px 4px">' +
            '<button class="btn btn-sm btn-ghost pwm-zo" type="button" style="color:#fff;border-color:#3a465b;padding:1px 9px" aria-label="Zoom out">\u2212</button>' +
            '<span class="pwm-win"></span>' +
            '<button class="btn btn-sm btn-ghost pwm-zi" type="button" style="color:#fff;border-color:#3a465b;padding:1px 9px" aria-label="Zoom in">+</button></div>' +
          '<svg class="pwm-scope" viewBox="0 0 900 214" role="img"></svg></div>' +
        '<div class="readouts readouts-3">' +
          '<div class="ro"><span data-t="pwm_cycle"></span><b class="pwm-cyc"></b></div>' +
          '<div class="ro"><span><span data-t="pwm_wheel"></span> ' + info('pwm_tipWheel') + '</span><b class="pwm-w"></b></div>' +
          '<div class="ro"><span data-t="pwm_cmdL"></span><b class="pwm-cmd" style="font-family:var(--mono);font-size:18px"></b></div>' +
        '</div>',
      side:
        '<section class="panel">' +
          '<div class="ctl"><div class="ctl-head"><span data-t="pwm_duty"></span><output class="ctl-val pwm-duty-v"></output></div>' +
            '<input type="range" class="pwm-duty" min="0" max="100" step="1" data-ta="pwm_duty"><p class="ctl-hint" data-t="pwm_dutyHint"></p></div>' +
          '<div class="ctl"><div class="ctl-head"><span data-t="pwm_rate"></span></div>' +
            '<div class="seg seg-full"><button class="seg-btn pwm-slow" type="button" data-t="pwm_slow"></button><button class="seg-btn pwm-fast" type="button" data-t="pwm_fast"></button></div></div>' +
          '<div class="ctl"><div class="ctl-head"><span data-t="pwm_dir"></span></div>' +
            '<div class="seg seg-full"><button class="seg-btn pwm-cw" type="button">\u21bb <span data-t="pwm_cw"></span></button><button class="seg-btn pwm-ccw" type="button">\u21ba <span data-t="pwm_ccw"></span></button></div>' +
            '<p class="ctl-hint" data-t="pwm_pins"></p></div>' +
        '</section>' +
        '<div class="status pwm-status"></div>',
      tryItems: () => {
        const v = Math.round(cfg.duty * 1010) * cfg.dir;
        return [
          t('pwm_try1', { cmd: code('PWM ' + v + ' 0 2000'), pct: nf(cfg.duty * 100, 0) + ' %' }),
          t('pwm_try2', { neg: code('PWM ' + (-v || -505) + ' 0 2000') }),
          soon('pwm_trySoon'),
        ];
      },
    });
    const q = sh.q;
    const svg = q('.pwm-stage');
    sv('rect', { width: 900, height: 300, class: 'st-floor' }, svg);
    /* battery */
    sv('rect', { x: 40, y: 104, width: 64, height: 96, rx: 9, fill: '#2b3445', stroke: '#5a6577', 'stroke-width': 2 }, svg);
    sv('rect', { x: 60, y: 94, width: 24, height: 10, rx: 2, fill: '#5a6577' }, svg);
    sv('text', { x: 72, y: 158, class: 'st-txt', 'text-anchor': 'middle' }, svg).textContent = '+';
    /* wires: battery -> switch -> motor */
    sv('path', { d: 'M72 94 V50 H190 M262 50 H470 V110 M470 190 V250 H72 V200', fill: 'none', stroke: '#5a6577', 'stroke-width': 5, 'stroke-linejoin': 'round' }, svg);
    const wireHot = sv('path', { d: 'M72 94 V50 H190 M262 50 H470 V110 M470 190 V250 H72 V200', fill: 'none', stroke: 'var(--pad)', 'stroke-width': 5, 'stroke-linejoin': 'round', 'stroke-dasharray': '6 10' }, svg);
    /* the switch: pivot at 190,50, contact at 262,50 */
    sv('circle', { cx: 190, cy: 50, r: 8, fill: '#e7ecf3' }, svg);
    sv('circle', { cx: 262, cy: 50, r: 7, fill: '#e7ecf3' }, svg);
    const leverOn = sv('line', { x1: 190, y1: 50, x2: 262, y2: 50, stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);
    const leverOff = sv('line', { x1: 190, y1: 50, x2: 250, y2: 12, stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);
    const swLbl = sv('text', { x: 226, y: 84, class: 'st-txt', 'text-anchor': 'middle' }, svg);
    const blurLbl = sv('text', { x: 226, y: 104, class: 'st-txt-s', 'text-anchor': 'middle' }, svg);
    /* pins */
    const pinTxt = [], pinLed = [];
    for (let k = 0; k < 2; k++) {
      sv('rect', { x: 150, y: 140 + k * 46, width: 160, height: 34, rx: 8, fill: '#1f2735', stroke: '#3a465b' }, svg);
      pinLed.push(sv('circle', { cx: 172, cy: 157 + k * 46, r: 8 }, svg));
      pinTxt.push(sv('text', { x: 190, y: 162 + k * 46, class: 'st-txt' }, svg));
    }
    /* motor */
    sv('rect', { x: 430, y: 110, width: 120, height: 80, rx: 14, fill: '#cfd5de' }, svg);
    sv('rect', { x: 420, y: 124, width: 14, height: 52, rx: 4, fill: '#2b3445' }, svg);
    sv('text', { x: 490, y: 157, class: 'st-txt', 'text-anchor': 'middle', style: 'fill:#19212e;font-weight:600' }, svg).textContent = 'N20';
    sv('rect', { x: 550, y: 144, width: 60, height: 12, fill: '#b9a46a' }, svg);
    /* wheel */
    const WX = 718, WY = 150;
    const wheel = sv('g', {}, svg);
    sv('circle', { cx: WX, cy: WY, r: 112, fill: '#1d2127' }, wheel);
    sv('circle', { cx: WX, cy: WY, r: 104, fill: 'none', stroke: '#2c323b', 'stroke-width': 14, 'stroke-dasharray': '12 8' }, wheel);
    sv('circle', { cx: WX, cy: WY, r: 82, fill: '#e6e9ee' }, wheel);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      sv('line', { x1: WX, y1: WY, x2: WX + Math.sin(a) * 76, y2: WY - Math.cos(a) * 76, stroke: '#aab2bf', 'stroke-width': 10, 'stroke-linecap': 'round' }, wheel);
    }
    sv('circle', { cx: WX, cy: WY, r: 24, fill: '#c9a046' }, wheel);
    sv('path', { d: 'M' + WX + ' ' + (WY - 82) + 'V' + (WY - 120) + 'l22 7 -22 8', fill: 'var(--board)' }, wheel);
    const arrow = sv('path', { fill: 'none', stroke: 'var(--pad)', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    const arrowHead = sv('path', { fill: 'var(--pad)' }, svg);
    const wLbl = sv('text', { x: WX, y: 292, class: 'st-txt', 'text-anchor': 'middle' }, svg);

    /* scope */
    const sc = q('.pwm-scope');
    const SX0 = 64, SX1 = 884;
    sv('rect', { width: 900, height: 214, class: 'st-floor' }, sc);
    const scGrid = sv('g', {}, sc);
    const tr1 = sv('polyline', { class: 'sc-line' }, sc);
    const tr2 = sv('polyline', { class: 'sc-line2' }, sc);
    const avg = sv('line', { class: 'sc-avg' }, sc);
    const avgLbl = sv('text', { class: 'sc-lbl sc-halo', 'text-anchor': 'end' }, sc);
    sv('text', { x: 12, y: 74, class: 'sc-lbl-g' }, sc).textContent = 'IN1';
    sv('text', { x: 12, y: 160, class: 'sc-lbl-b' }, sc).textContent = 'IN2';
    const hiLo = [];
    [[46, 'HIGH'], [92, 'LOW'], [132, 'HIGH'], [178, 'LOW']].forEach((a) => {
      const n = sv('text', { x: SX0 - 6, y: a[0] + 4, class: 'sc-lbl', 'text-anchor': 'end', style: 'font-size:9.5px' }, sc);
      n.textContent = a[1]; hiLo.push(n);
    });
    const cursor = sv('line', { y1: 34, y2: 186, class: 'sc-cursor' }, sc);

    function winSec() { const z = ZOOMS[cfg.fast ? 'fast' : 'slow']; return cfg.fast ? z[cfg.zoom] / 1000 : z[clamp(cfg.zoom, 0, z.length - 1)]; }
    function drawScope() {
      const W = winSec();
      const f = cfg.fast ? 1000 : 1;
      const hiY = [46, 132], loY = [92, 178];
      const active = cfg.dir > 0 ? 0 : 1;
      const xs = (tt) => SX0 + tt / W * (SX1 - SX0);
      /* a triggered, still picture (fast) or the last W seconds scrolling past (slow) */
      const tEnd = cfg.fast ? W : m.t;
      const tStart = tEnd - W;
      let pts = '';
      const per = 1 / f;
      const k0 = Math.floor(tStart / per) - 1, k1 = Math.ceil(tEnd / per) + 1;
      const yAt = (on) => (on ? hiY[active] : loY[active]);
      let first = true;
      for (let k = k0; k <= k1; k++) {
        const a = k * per, b = a + cfg.duty * per;
        const segs = cfg.duty >= 1 ? [[a, a + per, true]] : cfg.duty <= 0 ? [[a, a + per, false]] : [[a, b, true], [b, a + per, false]];
        for (const sg of segs) {
          const x0 = xs(clamp(sg[0], tStart, tEnd) - tStart), x1 = xs(clamp(sg[1], tStart, tEnd) - tStart);
          if (x1 <= x0) continue;
          const y = yAt(sg[2]);
          if (!cfg.fast && sg[0] > m.t) continue;
          pts += (first ? '' : '') + x0.toFixed(1) + ',' + y + ' ' + x1.toFixed(1) + ',' + y + ' ';
          first = false;
        }
      }
      const flat = SX0 + ',' + loY[1 - active] + ' ' + SX1 + ',' + loY[1 - active];
      (active === 0 ? tr1 : tr2).setAttribute('points', pts);
      (active === 0 ? tr2 : tr1).setAttribute('points', flat);
      const ay = loY[active] - (loY[active] - hiY[active]) * cfg.duty;
      avg.setAttribute('x1', SX0); avg.setAttribute('x2', SX1); avg.setAttribute('y1', ay); avg.setAttribute('y2', ay);
      avgLbl.setAttribute('x', SX1); avgLbl.setAttribute('y', ay - 6);
      avgLbl.textContent = t('pwm_avg') + ' ' + nf(cfg.duty * 100, 0) + ' %';
      let g = '';
      for (let i = 0; i <= 10; i++) { const x = (SX0 + i * (SX1 - SX0) / 10).toFixed(1); g += '<line class="sc-grid" x1="' + x + '" x2="' + x + '" y1="34" y2="186"/>'; }
      g += '<text class="sc-lbl" x="' + SX0 + '" y="206">0</text><text class="sc-lbl" x="' + SX1 + '" y="206" text-anchor="end">' +
        (cfg.fast ? nf(W * 1000, 0) + ' ms' : nf(W, 0) + ' s') + '</text>';
      scGrid.innerHTML = g;
      cursor.setAttribute('x1', SX1); cursor.setAttribute('x2', SX1);
      cursor.style.display = cfg.fast ? 'none' : '';
      q('.pwm-win').textContent = cfg.fast ? nf(W * 1000, 0) + ' ms' : nf(W, 0) + ' s';
    }
    function drawStage() {
      const active = cfg.dir > 0 ? 0 : 1;
      const blur = cfg.fast && cfg.duty > 0 && cfg.duty < 1;
      const on = cfg.fast ? cfg.duty >= 1 : !!m.on;
      leverOn.setAttribute('opacity', blur ? 0.25 + 0.6 * cfg.duty : on ? 1 : 0);
      leverOff.setAttribute('opacity', blur ? 0.25 + 0.6 * (1 - cfg.duty) : on ? 0 : 1);
      swLbl.textContent = blur ? t('pwm_on') + ' / ' + t('pwm_off') : on ? t('pwm_on') : t('pwm_off');
      blurLbl.textContent = blur ? '1000\u00d7/s \u2013 ' + t('pwm_blur') : '';
      wireHot.setAttribute('opacity', blur ? cfg.duty : on ? 1 : 0);
      wireHot.style.strokeDashoffset = String(-(m.t * 60) % 16 * cfg.dir);
      for (let k = 0; k < 2; k++) {
        const isOn = k === active && (blur ? true : on);
        pinLed[k].setAttribute('fill', isOn ? (k === 0 ? 'var(--pad)' : '#6aa7ec') : '#3a465b');
        pinLed[k].setAttribute('opacity', k === active && blur ? 0.4 + 0.6 * cfg.duty : 1);
        pinTxt[k].textContent = 'IN' + (k + 1) + ': ' + (k === active ? (blur ? 'PWM ' + nf(cfg.duty * 100, 0) + ' %' : on ? 'HIGH' : 'LOW') : 'LOW');
      }
      wheel.setAttribute('transform', 'rotate(' + (m.ang % 360).toFixed(2) + ' ' + WX + ' ' + WY + ')');
      /* direction arrow on the wheel's rim */
      const r = 128, a0 = -150, a1 = -40;
      const pt = (a) => [WX + r * Math.cos(a * Math.PI / 180), WY + r * Math.sin(a * Math.PI / 180)];
      const p0 = pt(a0), p1 = pt(a1);
      arrow.setAttribute('d', 'M' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 0 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1));
      const tip = cfg.dir > 0 ? p1 : p0, ta = (cfg.dir > 0 ? a1 + 90 : a0 - 90) * Math.PI / 180;
      const h = (dx, dy) => (tip[0] + dx * Math.cos(ta) - dy * Math.sin(ta)).toFixed(1) + ' ' + (tip[1] + dx * Math.sin(ta) + dy * Math.cos(ta)).toFixed(1);
      arrowHead.setAttribute('d', 'M' + h(10, 0) + ' L' + h(-6, -9) + ' L' + h(-6, 9) + ' Z');
      const sp = Math.abs(m.w);
      arrow.setAttribute('opacity', sp > 0.01 ? 1 : 0.25); arrowHead.setAttribute('opacity', sp > 0.01 ? 1 : 0.25);
      wLbl.textContent = t('pwm_wheel') + ': ' + nf(wAvg * 100, 0) + ' %';
      q('.pwm-w').textContent = nf(wAvg * 100, 0) + ' %';
    }
    function drawPanel() {
      q('.pwm-duty-v').textContent = nf(cfg.duty * 100, 0) + ' %';
      q('.pwm-slow').setAttribute('aria-pressed', String(!cfg.fast));
      q('.pwm-fast').setAttribute('aria-pressed', String(cfg.fast));
      q('.pwm-cw').setAttribute('aria-pressed', String(cfg.dir > 0));
      q('.pwm-ccw').setAttribute('aria-pressed', String(cfg.dir < 0));
      const per = cfg.fast ? 0.001 : 1;
      const fmt = (s) => (cfg.fast ? nf(s * 1000, 2) + ' ms' : nf(s, 2) + ' s');
      q('.pwm-cyc').textContent = fmt(per) + ' \u2192 ' + t('pwm_on') + ' ' + fmt(per * cfg.duty);
      const v = Math.round(cfg.duty * 1010) * cfg.dir;
      q('.pwm-cmd').textContent = 'PWM ' + v + ' 0 2000';
      let k, cls = '';
      if (cfg.duty <= 0) k = 'pwm_st_off';
      else if (cfg.duty >= 1) { k = 'pwm_st_full'; cls = 'ok'; }
      else if (!cfg.fast) { k = 'pwm_st_jerk'; cls = 'bad'; }
      else if (Math.abs(m.w) < 0.005 && m.t > 0.3) { k = 'pwm_st_dead'; cls = 'bad'; }
      else { k = 'pwm_st_smooth'; cls = 'ok'; }
      const s = q('.pwm-status');
      s.className = 'status pwm-status' + (cls ? ' ' + cls : '');
      s.textContent = t(k, { d: nf(cfg.duty * 100, 0) + ' %' });
      s.dataset.state = k;
    }
    function advance(sec) {
      const dt = cfg.fast ? 2e-5 : 1e-3;
      const n = Math.round(sec / dt);
      for (let i = 0; i < n; i++) pwmStep(m, cfg, dt);
      wAvg += (Math.abs(m.w) - wAvg) * clamp(sec / 0.3, 0, 1);
    }
    function settle() { if (RM) { m = pwmNew(); advance(2); wAvg = Math.abs(m.w); } }
    function draw() { drawStage(); drawScope(); drawPanel(); }
    function changed() { settle(); sh.relabel(); draw(); }
    q('.pwm-duty').value = cfg.duty * 100;
    q('.pwm-duty').addEventListener('input', (e) => { cfg.duty = +e.target.value / 100; changed(); });
    q('.pwm-slow').addEventListener('click', () => { cfg.fast = false; cfg.zoom = 1; m.t = 0; changed(); });
    q('.pwm-fast').addEventListener('click', () => { cfg.fast = true; cfg.zoom = 2; changed(); });
    q('.pwm-cw').addEventListener('click', () => { cfg.dir = 1; changed(); });
    q('.pwm-ccw').addEventListener('click', () => { cfg.dir = -1; changed(); });
    q('.pwm-zi').addEventListener('click', () => { cfg.zoom = Math.max(0, cfg.zoom - 1); draw(); });
    q('.pwm-zo').addEventListener('click', () => { cfg.zoom = Math.min(ZOOMS[cfg.fast ? 'fast' : 'slow'].length - 1, cfg.zoom + 1); draw(); });
    settle();
    sh.relabel();
    draw();
    return {
      kind: 'topic', id: 'pwm',
      frame: (dt) => { advance(Math.min(dt, 0.05)); draw(); },
      relabel: () => { sh.relabel(); draw(); },
      demo: (sec) => { advance(+sec); wAvg = Math.abs(m.w); draw(); },
      api: {
        cfg, get m() { return m; },
        set: (o) => { Object.assign(cfg, o); m = pwmNew(); wAvg = 0; q('.pwm-duty').value = cfg.duty * 100; changed(); },
        advance: (sec) => { advance(sec); draw(); },
        scope: () => tr1.getAttribute('points') + '|' + tr2.getAttribute('points'),
        status: () => q('.pwm-status').dataset.state,
      },
    };
  }

  /* ======================================================================
   * 4. Ultrasound - an echo in slow motion
   * 343 m/s, half the round trip; the firmware waits 30 ms for an echo and
   * ignores anything beyond 2000 mm (ultrasonic.c). The beam is +-15 deg.
   * ==================================================================== */
  const US = { c: 34.3, slow: 250, timeout: 30, max: 200, beam: 15 };     /* cm per ms */
  function viewUltra(main, tp) {
    const SX = 128, CY = 140, KX = 3.0, X_END = SX + 250 * KX;
    const st = { d: 60, wall: 'straight', auto: false, ping: null, res: null, autoT: 0 };
    const sh = topicShell(main, tp, {
      lead: 'us_lead', merk: 'us_merk',
      main:
        '<div class="stagebox"><div class="stage-cap">' + info('us_tipSlow', true) + '<span data-t="us_slowmo"></span></div><span class="stage-badge us-clock"></span>' +
          '<svg class="us-stage" viewBox="0 0 900 300" role="img"></svg></div>' +
        '<div class="stage-tools">' +
          '<button class="btn btn-go us-ping" type="button">' + ICO.play + '<span data-t="us_ping"></span></button>' +
          '<label class="switch"><input type="checkbox" class="us-auto"' + (RM ? ' disabled' : '') + '><span class="switch-track"><span class="switch-knob"></span></span><span data-t="us_auto"></span></label>' +
        '</div>' +
        '<section class="panel eq">' +
          '<div class="eq-box"><b class="us-t"></b><span data-t="us_time"></span></div><span class="eq-op">\u00d7</span>' +
          '<div class="eq-box"><b>343 m/s</b><span data-t="us_speed"></span></div><span class="eq-op">=</span>' +
          '<div class="eq-box"><b class="us-w"></b><span data-t="us_way"></span></div><span class="eq-op">\u00f7 2 =</span>' +
          '<div class="eq-box eq-res"><b class="us-r"></b><span data-t="us_res"></span></div>' +
        '</section>',
      side:
        '<section class="panel">' +
          '<div class="ctl"><div class="ctl-head"><span data-t="us_dist"></span><output class="ctl-val us-d-v"></output></div>' +
            '<input type="range" class="us-d" min="3" max="250" step="1" data-ta="us_dist"></div>' +
          '<div class="ctl"><div class="ctl-head"><span data-t="us_wall"></span></div>' +
            '<div class="seg seg-full"><button class="seg-btn" type="button" data-w="straight" data-t="us_straight"></button>' +
            '<button class="seg-btn" type="button" data-w="slant" data-t="us_slant"></button>' +
            '<button class="seg-btn" type="button" data-w="gone" data-t="us_gone"></button></div></div>' +
        '</section>' +
        '<div class="status us-status"></div>',
      tryItems: () => [
        t('us_try1', { us: code('US'), usw: code('USW 250'), usw0: code('USW 0') }),
        t('us_try2', { walls: code('WALLS') }),
        soon('us_trySoon'),
      ],
    });
    const q = sh.q;
    const svg = q('.us-stage');
    sv('rect', { width: 900, height: 300, class: 'st-floor' }, svg);
    sv('rect', { x: SX + US.max * KX, y: 0, width: 900, height: 300, fill: 'rgba(210,43,30,.10)' }, svg);
    const farLbl = sv('text', { x: SX + US.max * KX + 10, y: 52, class: 'sc-lbl-w' }, svg);
    /* ruler */
    let rl = '';
    for (let cm = 0; cm <= 250; cm += 10) {
      const x = SX + cm * KX;
      rl += '<line x1="' + x + '" x2="' + x + '" y1="270" y2="' + (cm % 50 ? 278 : 284) + '" stroke="#5a6577" stroke-width="1.5"/>';
      if (cm % 50 === 0) rl += '<text class="sc-lbl" x="' + x + '" y="297" text-anchor="middle">' + cm + ' cm</text>';
    }
    sv('g', {}, svg).innerHTML = '<line x1="' + SX + '" x2="' + X_END + '" y1="270" y2="270" stroke="#5a6577" stroke-width="1.5"/>' + rl;
    sv('use', { href: '#bot', transform: 'translate(' + (SX - 79.1 * 0.62) + ' ' + CY + ') rotate(90) scale(.62)' }, svg);
    sv('rect', { x: SX - 5, y: CY - 16, width: 8, height: 32, rx: 3, fill: '#c8cdd6' }, svg);
    const wavesG = sv('g', {}, svg);
    const wallG = sv('g', { style: 'cursor:ew-resize' }, svg);
    sv('rect', { x: -40, y: -110, width: 80, height: 220, fill: 'transparent' }, wallG);
    const wallR = sv('rect', { x: -7, y: -100, width: 14, height: 200, rx: 3, class: 'st-wall' }, wallG);
    const dragLbl = sv('text', { x: 14, y: -86, class: 'st-txt-s' }, wallG);
    const distLine = sv('line', { y1: 232, y2: 232, stroke: '#6aa7ec', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, svg);
    const distTxt = sv('text', { y: 252, class: 'st-txt', 'text-anchor': 'middle' }, svg);

    const wallX = () => SX + st.d * KX;
    const slantA = 35 * Math.PI / 180;
    /* geometry in px; returns where the sound hits and where the echo goes */
    function geom() {
      const xw = wallX();
      if (st.wall === 'gone') return { hit: null };
      const Dw = xw - SX;
      if (st.wall === 'straight') return { hit: Dw, M: [SX + 2 * Dw, CY], dir: Math.PI, heard: true, back: 2 * Dw };
      /* slanted mirror through (xw, CY), tilted by slantA from vertical */
      const u = [Math.sin(slantA), Math.cos(slantA)];
      const v = [SX - xw, 0];
      const dot = v[0] * u[0] + v[1] * u[1];
      const proj = [u[0] * dot, u[1] * dot];
      const M = [xw + 2 * proj[0] - v[0], CY + 2 * proj[1] - v[1]];
      const rd = [2 * Math.sin(slantA) * u[0] - 1, 2 * Math.sin(slantA) * u[1]];
      return { hit: Dw, M, dir: Math.atan2(rd[1], rd[0]), heard: false };
    }
    function arc(cx, cy, r, mid, spread) {
      const a0 = mid - spread, a1 = mid + spread;
      const p = (a) => (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1);
      return 'M' + p(a0) + ' A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + p(a1);
    }
    function draw() {
      const xw = wallX();
      wallG.setAttribute('transform', 'translate(' + xw + ' ' + CY + ')');
      wallG.style.display = st.wall === 'gone' ? 'none' : '';
      wallR.setAttribute('transform', st.wall === 'slant' ? 'rotate(' + (-35) + ')' : '');
      dragLbl.textContent = '\u2194 ' + t('us_drag');
      dragLbl.style.display = st.wall === 'slant' ? 'none' : '';
      distLine.setAttribute('x1', SX); distLine.setAttribute('x2', st.wall === 'gone' ? SX : xw);
      distTxt.setAttribute('x', (SX + xw) / 2);
      distTxt.textContent = st.wall === 'gone' ? '' : nf(st.d, 0) + ' cm';
      farLbl.textContent = t('us_tooFar');
      /* waves */
      let html = '';
      const pg = st.ping;
      if (pg) {
        const G = geom();
        const rNow = pg.ms * US.c * KX;                 /* px travelled by the sound */
        const spread = US.beam * Math.PI / 180;
        for (let k = 0; k < 3; k++) {
          const r = rNow - k * 14;
          if (r <= 2) continue;
          if (G.hit == null || r < G.hit) {
            if (SX + r < 920) html += '<path d="' + arc(SX, CY, r, 0, spread) + '" fill="none" stroke="#6aa7ec" stroke-width="' + (4 - k) + '" stroke-linecap="round" opacity="' + (1 - k * 0.25) + '"/>';
          } else if (!G.heard || r <= G.back + 1) {
            html += '<path d="' + arc(G.M[0], G.M[1], r, G.dir, spread) + '" fill="none" stroke="var(--pad)" stroke-width="' + (4 - k) + '" stroke-linecap="round" opacity="' + (1 - k * 0.25) + '"/>';
          }
        }
      }
      if (st.res && st.res.kind === 'echo' && RM) {
        /* static: the whole path at once */
        html += '<line x1="' + SX + '" x2="' + xw + '" y1="' + (CY - 6) + '" y2="' + (CY - 6) + '" stroke="#6aa7ec" stroke-width="3"/>' +
          '<line x1="' + xw + '" x2="' + SX + '" y1="' + (CY + 6) + '" y2="' + (CY + 6) + '" stroke="var(--pad)" stroke-width="3"/>';
      }
      wavesG.innerHTML = html;
      /* readouts */
      const ms = pg ? pg.ms : st.res ? st.res.ms : 0;
      q('.us-clock').textContent = t('us_clock') + ': ' + nf(ms, 2) + ' ms';
      q('.us-d-v').textContent = nf(st.d, 0) + ' cm';
      main.querySelectorAll('.seg-btn[data-w]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.w === st.wall)));
      const s = q('.us-status');
      let cls = '', txt = t('us_ready'), state = 'ready';
      if (pg) { txt = t('us_wait'); state = 'wait'; }
      else if (st.res) {
        state = st.res.kind;
        if (st.res.kind === 'echo') { cls = 'ok'; txt = t('us_echo', { d: nf(st.res.d, 1) + ' cm' }); }
        else if (st.res.kind === 'far') { cls = 'bad'; txt = t('us_far'); }
        else { cls = 'bad'; txt = st.wall === 'slant' ? t('us_noneSlant') : st.wall === 'gone' ? t('us_noneGone') : t('us_none'); }
      }
      s.className = 'status us-status' + (cls ? ' ' + cls : '');
      s.textContent = txt;
      s.dataset.state = state;
      const r = st.res;
      q('.us-t').textContent = r ? (r.kind === 'none' ? '> 30 ms' : nf(r.ms, 2) + ' ms') : pg ? nf(pg.ms, 2) + ' ms' : '\u2013';
      q('.us-w').textContent = r && r.kind !== 'none' ? nf(r.ms * US.c, 1) + ' cm' : r ? '?' : '\u2013';
      q('.us-r').textContent = r ? (r.kind === 'echo' ? nf(r.d, 1) + ' cm' : '?') : '\u2013';
      q('.eq').classList.toggle('eq-bad', !!r && r.kind !== 'echo');
    }
    function finish(kind, ms) {
      st.ping = null;
      st.res = { kind, ms, d: ms * US.c / 2 };
      st.autoT = 0.7;
    }
    function step(realDt) {
      const pg = st.ping;
      if (!pg) {
        if (st.auto && !RM) { st.autoT -= realDt; if (st.autoT <= 0) ping(); }
        return;
      }
      const G = geom();
      const rNow = pg.ms * US.c * KX;
      /* once nothing can come back and the waves are off screen, hurry up */
      const lost = !G.heard && rNow > 1100;
      pg.ms += realDt * 1000 / US.slow * (lost ? 14 : 1);
      if (G.heard) {
        const back = G.back / (US.c * KX);              /* ms for the round trip */
        if (pg.ms >= back) { finish(back / 2 * US.c > US.max ? 'far' : 'echo', back); }
      }
      if (st.ping && pg.ms >= US.timeout) finish('none', US.timeout);
    }
    function ping() {
      st.res = null;
      st.ping = { ms: 0 };
      if (RM) { for (let i = 0; i < 4000 && st.ping; i++) step(0.05); }
      draw();
    }
    q('.us-ping').addEventListener('click', ping);
    q('.us-auto').addEventListener('change', (e) => { st.auto = e.target.checked; if (st.auto && !st.ping) ping(); });
    q('.us-d').value = st.d;
    q('.us-d').addEventListener('input', (e) => { st.d = +e.target.value; st.res = null; draw(); });
    main.querySelectorAll('.seg-btn[data-w]').forEach((b) => b.addEventListener('click', () => { st.wall = b.dataset.w; st.res = null; st.ping = null; draw(); if (RM) ping(); }));
    /* drag the wall */
    let dragging = false;
    const toCm = (ev) => {
      const r = svg.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width * 900;
      return clamp(Math.round((x - SX) / KX), 3, 250);
    };
    wallG.addEventListener('pointerdown', (ev) => { dragging = true; wallG.setPointerCapture(ev.pointerId); });
    wallG.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      st.d = toCm(ev); q('.us-d').value = st.d; st.res = null; draw();
    });
    wallG.addEventListener('pointerup', () => { dragging = false; if (RM) ping(); });
    sh.relabel();
    if (RM) ping(); else draw();
    return {
      kind: 'topic', id: 'ultraschall',
      frame: (dt) => { step(dt); draw(); },
      relabel: () => { sh.relabel(); draw(); },
      demo: (sec) => { ping(); step(+sec); draw(); },
      api: {
        st,
        setDist: (cm) => { st.d = cm; q('.us-d').value = cm; st.res = null; draw(); },
        setWall: (w) => main.querySelector('.seg-btn[data-w="' + w + '"]').click(),
        ping: () => { st.res = null; st.ping = { ms: 0 }; draw(); },
        advance: (sec) => { for (let i = 0; i < sec * 60; i++) step(1 / 60); draw(); },
        status: () => q('.us-status').dataset.state,
      },
    };
  }

  /* ======================================================================
   * 5. Flood fill - the water wave
   * Same coordinates as the robot: (0,0) bottom-left, y grows north. Walls
   * are bits per cell like MAZEDEF: N=1 E=2 S=4 W=8.
   * ==================================================================== */
  const FF = {
    n: 5, goal: [2, 2], start: [0, 0],
    walls: ['2,2,W', '2,2,S', '2,2,E', '1,0,N', '1,1,E', '1,2,N', '0,3,E', '2,3,E', '3,1,N', '3,2,N', '3,0,N', '4,3,W', '1,3,N', '0,1,E', '4,1,W'],
  };
  const DIRS = { N: [0, 1, 1, 'S'], E: [1, 0, 2, 'W'], S: [0, -1, 4, 'N'], W: [-1, 0, 8, 'E'] };
  function ffMaze(list) {
    const n = FF.n, w = [];
    for (let x = 0; x < n; x++) { w.push([]); for (let y = 0; y < n; y++) w[x].push(0); }
    for (let i = 0; i < n; i++) { w[i][0] |= 4; w[i][n - 1] |= 1; w[0][i] |= 8; w[n - 1][i] |= 2; }
    for (const s of list) { const p = s.split(','); ffSet(w, +p[0], +p[1], p[2], true); }
    return w;
  }
  function ffSet(w, x, y, d, on) {
    const D = DIRS[d], nx = x + D[0], ny = y + D[1];
    const op = DIRS[D[3]][2];
    if (on) { w[x][y] |= D[2]; if (w[nx]) w[nx][ny] |= op; }
    else { w[x][y] &= ~D[2]; if (w[nx]) w[nx][ny] &= ~op; }
  }
  function ffFlood(w) {
    const n = FF.n, dist = [];
    for (let x = 0; x < n; x++) { dist.push([]); for (let y = 0; y < n; y++) dist[x].push(-1); }
    const qq = [FF.goal.slice()];
    dist[FF.goal[0]][FF.goal[1]] = 0;
    while (qq.length) {
      const [x, y] = qq.shift();
      for (const d in DIRS) {
        if (w[x][y] & DIRS[d][2]) continue;
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || dist[nx][ny] >= 0) continue;
        dist[nx][ny] = dist[x][y] + 1;
        qq.push([nx, ny]);
      }
    }
    return dist;
  }
  /* downhill path from a cell, as the robot would drive it (N, E, S, W order) */
  function ffPath(w, dist, x, y) {
    const path = [[x, y]];
    let guard = 0;
    while (dist[x][y] > 0 && guard++ < 100) {
      let moved = false;
      for (const d of ['N', 'E', 'S', 'W']) {
        if (w[x][y] & DIRS[d][2]) continue;
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (dist[nx] && dist[nx][ny] === dist[x][y] - 1) { x = nx; y = ny; path.push([x, y, d]); moved = true; break; }
      }
      if (!moved) break;
    }
    return path;
  }

  function viewFlood(main, tp) {
    const C = 78, OX = 34, OY = 18, N = FF.n;
    const st = { w: ffMaze(FF.walls), dist: null, level: -1, playing: false, walking: false, t: 0,
      bot: { x: FF.start[0], y: FF.start[1], d: 'N', ang: 0 }, steps: 0, msg: 'ff_st_ready', newEdge: null };
    const sh = topicShell(main, tp, {
      lead: 'ff_lead', merk: 'ff_merk',
      main:
        '<div class="stagebox"><svg class="ff-stage" viewBox="0 0 900 430" role="img"></svg></div>' +
        '<div class="stage-tools">' +
          '<button class="btn btn-sm btn-primary ff-play" type="button"' + (RM ? ' disabled data-tip-key="rmTip"' : '') + '>' + ICO.play + '<span class="ff-play-l"></span></button>' +
          '<button class="btn btn-sm ff-step" type="button">' + ICO.step + '<span data-t="step"></span></button>' +
          '<button class="btn btn-sm btn-go ff-walk" type="button">' + ICO.play + '<span data-t="ff_walk"></span></button>' +
          '<button class="btn btn-sm ff-wall" type="button"><svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 12.5V3.5h10" style="stroke-width:2.6"/></svg><span data-t="ff_wall"></span></button>' +
          '<span class="spacer"></span>' +
          '<button class="btn btn-sm btn-ghost ff-reset" type="button">' + ICO.again + '<span data-t="ff_reset"></span></button>' +
        '</div>',
      side:
        '<div class="status ff-status"></div>' +
        '<div class="readouts">' +
          '<div class="ro"><span data-t="ff_waveL"></span><b class="ff-wave"></b></div>' +
          '<div class="ro"><span data-t="ff_stepsL"></span><b class="ff-len"></b></div>' +
        '</div>' +
        '<p class="ctl-hint" data-t="ff_hint"></p>',
      tryItems: () => [
        t('ff_try1', { go: code('GO'), map: code('MAP') }),
        t('ff_try2', { goto: code('GOTO x y') }),
        soon('ff_trySoon'),
      ],
      bridge: () => '<span>' + t('ff_bridge', { go: code('GO') }) + '</span>',
    });
    const q = sh.q;
    const svg = q('.ff-stage');
    sv('rect', { width: 900, height: 430, class: 'st-floor' }, svg);
    const cx = (x) => OX + x * C, cy = (y) => OY + (N - 1 - y) * C;
    const cells = [], nums = [];
    for (let x = 0; x < N; x++) {
      cells.push([]); nums.push([]);
      for (let y = 0; y < N; y++) {
        cells[x].push(sv('rect', { x: cx(x), y: cy(y), width: C, height: C, class: 'ff-cell ff-dry' }, svg));
      }
    }
    sv('path', { d: 'M' + (cx(2) + C / 2) + ' ' + (cy(2) + 10) + ' l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2z', class: 'ff-star', opacity: 0.35 }, svg);
    const lines = sv('g', {}, svg);
    for (let i = 1; i < N; i++) {
      sv('line', { x1: cx(i), x2: cx(i), y1: OY, y2: OY + N * C, class: 'ff-line' }, lines);
      sv('line', { y1: OY + i * C, y2: OY + i * C, x1: OX, x2: OX + N * C, class: 'ff-line' }, lines);
    }
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      nums[x].push(sv('text', { x: cx(x) + C / 2, y: cy(y) + C / 2, class: 'ff-num' }, svg));
    }
    const frontG = sv('g', {}, svg);
    const pathL = sv('polyline', { class: 'ff-path' }, svg);
    const wallsG = sv('g', {}, svg);
    const hitG = sv('g', {}, svg);
    const bot = sv('use', { href: '#bot', style: 'transition:transform .42s cubic-bezier(.4,0,.25,1)' }, svg);
    /* right side: the plan */
    const PX = 470;
    const planT = sv('text', { x: PX, y: 52, class: 'st-txt' }, svg);
    const planBig = sv('text', { x: PX, y: 104, class: 'st-big', style: 'font-size:46px' }, svg);
    const planArrows = sv('text', { x: PX, y: 160, class: 'st-big', style: 'font-size:26px;letter-spacing:3px' }, svg);
    const legend = sv('g', {}, svg);
    const rules = sv('g', {}, svg);
    const goalLbl = sv('text', { x: cx(2) + C - 6, y: cy(2) + C - 8, class: 'st-txt-s', 'text-anchor': 'end' }, svg);

    /* interior edges you can click */
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
      if (x < N - 1) {
        const l = sv('line', { x1: cx(x + 1), x2: cx(x + 1), y1: cy(y) + 6, y2: cy(y) + C - 6, class: 'ff-hit' }, hitG);
        l.addEventListener('click', () => toggle(x, y, 'E'));
      }
      if (y < N - 1) {
        const l = sv('line', { y1: cy(y), y2: cy(y), x1: cx(x) + 6, x2: cx(x) + C - 6, class: 'ff-hit' }, hitG);
        l.addEventListener('click', () => toggle(x, y, 'N'));
      }
    }
    const maxD = () => { let m = 0; for (const c of st.dist) for (const v of c) m = Math.max(m, v); return m; };
    const shade = (v, M) => 'hsl(208 72% ' + (30 + (M ? v / M : 0) * 34).toFixed(0) + '%)';
    function drawWalls() {
      let h = '';
      const w = st.w;
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const isNew = (k) => st.newEdge === x + ',' + y + ',' + k;
        if (w[x][y] & 1) h += '<line class="ff-wall' + (isNew('N') ? ' new' : '') + '" x1="' + cx(x) + '" x2="' + (cx(x) + C) + '" y1="' + cy(y) + '" y2="' + cy(y) + '"/>';
        if (w[x][y] & 2) h += '<line class="ff-wall' + (isNew('E') ? ' new' : '') + '" x1="' + (cx(x) + C) + '" x2="' + (cx(x) + C) + '" y1="' + cy(y) + '" y2="' + (cy(y) + C) + '"/>';
        if (y === 0 && (w[x][y] & 4)) h += '<line class="ff-wall" x1="' + cx(x) + '" x2="' + (cx(x) + C) + '" y1="' + (cy(y) + C) + '" y2="' + (cy(y) + C) + '"/>';
        if (x === 0 && (w[x][y] & 8)) h += '<line class="ff-wall" x1="' + cx(x) + '" x2="' + cx(x) + '" y1="' + cy(y) + '" y2="' + (cy(y) + C) + '"/>';
      }
      wallsG.innerHTML = h;
    }
    const done = () => st.level >= maxD();
    function plan() { return done() && st.dist[st.bot.x][st.bot.y] >= 0 ? ffPath(st.w, st.dist, st.bot.x, st.bot.y) : null; }
    function draw() {
      const M = maxD();
      let front = '';
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const v = st.dist[x][y];
        const wet = v >= 0 && v <= st.level;
        cells[x][y].setAttribute('class', 'ff-cell' + (wet ? '' : ' ff-dry'));
        cells[x][y].style.fill = wet ? shade(v, M) : '';
        nums[x][y].textContent = wet ? v : (v < 0 && done() ? '\u2013' : '');
        nums[x][y].setAttribute('class', 'ff-num' + (v < 0 ? ' dim' : ''));
        if (wet && v === st.level && !done()) front += '<rect class="ff-front" x="' + (cx(x) + 3) + '" y="' + (cy(y) + 3) + '" width="' + (C - 6) + '" height="' + (C - 6) + '" rx="6"/>';
      }
      frontG.innerHTML = front;
      const p = plan();
      pathL.setAttribute('points', p ? p.map((c) => (cx(c[0]) + C / 2) + ',' + (cy(c[1]) + C / 2)).join(' ') : '');
      const b = st.bot;
      bot.style.transform = 'translate(' + (cx(b.x) + C / 2) + 'px,' + (cy(b.y) + C / 2) + 'px) rotate(' + b.ang + 'deg) scale(.52)';
      drawWalls();
      /* plan panel */
      planT.textContent = t('ff_path', { n: p ? p.length - 1 : '?' }).replace(/:.*/, ':');
      planBig.textContent = p ? String(p.length - 1) : '?';
      const AR = { N: '\u2191', E: '\u2192', S: '\u2193', W: '\u2190' };
      planArrows.textContent = p ? p.slice(1).map((c) => AR[c[2]]).join('') : '';
      let lg = '<text class="st-txt-s" x="' + PX + '" y="214">' + esc(t('ff_wave', { k: Math.max(0, st.level), n: M })) + '</text>';
      for (let i = 0; i <= M; i++) {
        const x = PX + i * (400 / (M + 1));
        const wet = i <= st.level;
        lg += '<rect x="' + x.toFixed(1) + '" y="226" width="' + (400 / (M + 1) - 3).toFixed(1) + '" height="30" rx="4" style="fill:' + (wet ? shade(i, M) : '#1b2330') + '"/>' +
          '<text class="ff-num" style="font-size:14px" x="' + (x + 400 / (M + 1) / 2 - 1.5).toFixed(1) + '" y="241">' + i + '</text>';
      }
      legend.innerHTML = lg;
      rules.innerHTML = ['ff_r1', 'ff_r2', 'ff_r3'].map((k, i) => {
        const y = 300 + i * 38;
        return '<circle cx="' + (PX + 13) + '" cy="' + (y - 5) + '" r="13" fill="' + (i === 2 ? '#17935c' : '#2f6fd0') + '"/>' +
          '<text x="' + (PX + 13) + '" y="' + y + '" text-anchor="middle" class="st-txt" style="fill:#fff;font-weight:600">' + (i + 1) + '</text>' +
          '<text x="' + (PX + 36) + '" y="' + y + '" class="st-txt" style="font-size:15px">' + esc(t(k)) + '</text>';
      }).join('');
      goalLbl.textContent = t('ff_goal');
      q('.ff-wave').textContent = Math.max(0, st.level) + ' / ' + M;
      q('.ff-len').textContent = p ? (p.length - 1) + ' \u00d7' : '\u2013';
      q('.ff-play-l').textContent = st.playing ? t('pause') : t('ff_flood');
      const s = q('.ff-status');
      const good = st.msg === 'ff_st_arrived' || st.msg === 'ff_st_done';
      const bad = st.msg === 'ff_st_noWall' || st.msg === 'ff_st_dry' || st.msg === 'ff_st_newWall';
      s.className = 'status ff-status' + (good ? ' ok' : bad ? ' bad' : '');
      s.textContent = t(st.msg, { n: st.steps });
      s.dataset.state = st.msg;
    }
    function reflood(msg) {
      st.dist = ffFlood(st.w);
      st.level = -1;
      st.msg = msg || 'ff_st_ready';
      if (RM) { st.level = maxD(); afterFlood(); }
      else { st.playing = true; st.t = 0; }
      draw();
    }
    function afterFlood() {
      let dry = false;
      for (const c of st.dist) for (const v of c) if (v < 0) dry = true;
      if (st.msg !== 'ff_st_newWall' || !st.walking) st.msg = dry ? 'ff_st_dry' : 'ff_st_done';
    }
    function floodStep() {
      if (done()) return false;
      st.level++;
      if (done()) { st.playing = false; afterFlood(); }
      else st.msg = 'ff_st_flooding';
      return true;
    }
    function walkStep() {
      const p = plan();
      if (!p || p.length < 2) { st.walking = false; return false; }
      const nx = p[1];
      const want = { N: 0, E: 90, S: 180, W: 270 }[nx[2]];
      let delta = ((want - st.bot.ang) % 360 + 540) % 360 - 180;
      st.bot.ang += delta;
      st.bot.x = nx[0]; st.bot.y = nx[1]; st.bot.d = nx[2];
      st.steps++;
      if (st.dist[st.bot.x][st.bot.y] === 0) { st.walking = false; st.msg = 'ff_st_arrived'; }
      else st.msg = 'ff_st_walk';
      return true;
    }
    function connectedWith(x, y, d) {
      const w2 = st.w.map((c) => c.slice());
      ffSet(w2, x, y, d, true);
      const dd = ffFlood(w2);
      for (const c of dd) for (const v of c) if (v < 0) return false;
      return true;
    }
    /* a new wall on the robot's planned way that cuts no cell off */
    function newWall() {
      if (!st.dist) st.dist = ffFlood(st.w);
      const full = ffFlood(st.w);
      const p = ffPath(st.w, full, st.bot.x, st.bot.y);
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1], d = p[i][2];
        if (connectedWith(a[0], a[1], d)) {
          ffSet(st.w, a[0], a[1], d, true);
          const k = d === 'S' ? [a[0], a[1] - 1, 'N'] : d === 'W' ? [a[0] - 1, a[1], 'E'] : [a[0], a[1], d];
          st.newEdge = k.join(',');
          reflood('ff_st_newWall');
          return true;
        }
      }
      st.msg = 'ff_st_noWall';
      draw();
      return false;
    }
    function toggle(x, y, d) {
      const on = !(st.w[x][y] & DIRS[d][2]);
      ffSet(st.w, x, y, d, on);
      st.newEdge = on ? x + ',' + y + ',' + d : null;
      reflood('ff_st_edit');
    }
    function reset() {
      st.w = ffMaze(FF.walls); st.bot = { x: FF.start[0], y: FF.start[1], d: 'N', ang: 0 };
      st.steps = 0; st.walking = false; st.playing = false; st.newEdge = null;
      st.dist = ffFlood(st.w); st.level = -1; st.msg = 'ff_st_ready';
      if (RM) { st.level = maxD(); afterFlood(); }
      draw();
    }
    q('.ff-play').addEventListener('click', () => {
      if (done()) { st.level = -1; }
      st.playing = !st.playing; st.t = 0; if (st.playing) st.msg = 'ff_st_flooding'; draw();
    });
    q('.ff-step').addEventListener('click', () => {
      st.playing = false;
      if (!floodStep()) walkStep();
      draw();
    });
    q('.ff-walk').addEventListener('click', () => {
      if (st.dist[st.bot.x][st.bot.y] === 0) { st.bot = { x: FF.start[0], y: FF.start[1], d: 'N', ang: 0 }; st.steps = 0; }
      if (!done()) { st.level = maxD(); afterFlood(); }
      if (RM) { walkStep(); draw(); return; }
      st.walking = true; st.t = 0; st.msg = 'ff_st_walk'; draw();
    });
    q('.ff-wall').addEventListener('click', newWall);
    q('.ff-reset').addEventListener('click', reset);
    sh.relabel();
    reset();
    function frame(dt) {
      st.t += dt;
      if (st.playing && st.t >= 0.34) { st.t = 0; floodStep(); draw(); }
      else if (st.walking && !st.playing && done() && st.t >= 0.5) { st.t = 0; walkStep(); draw(); }
    }
    return {
      kind: 'topic', id: 'floodfill', frame,
      relabel: () => { sh.relabel(); draw(); },
      demo: () => { st.level = maxD(); afterFlood(); walkStep(); walkStep(); walkStep(); draw(); },
      api: {
        st, reset, newWall, toggle,
        floodAll: () => { st.playing = false; while (floodStep()) { /* */ } draw(); },
        walkAll: () => { let n = 0; while (walkStep() && n < 60) n++; draw(); return n; },
        numbers: () => nums.map((c) => c.map((n) => n.textContent)),
        click: (cls) => q(cls).click(),
        advance: (sec) => { for (let i = 0; i < sec * 60; i++) frame(1 / 60); },
      },
    };
  }

  /* ======================================================================
   * 6. Gyroscope - turn rate, added-up angle, bias and drift
   *
   * The MPU6050 on header H2 (hardware.md): at rest it reported about -240
   * raw on the vertical axis, -1.8 deg/s at 131 raw per deg/s. Model: the
   * robot's real turn rate follows the command with a 0.05 s lag; the gyro
   * reads real rate + bias + a little noise; 500 times a second that reading
   * (minus the calibrated bias) is added to the angle. Drift, and the few
   * degrees an uncalibrated 90 degree turn is off, follow from these numbers.
   * ==================================================================== */
  const GY = { bias: -1.8, noise: 0.3, tau: 0.05, dt: 0.002, turnV: 60, calT: 1, rMax: 200, T: 60, fast: 10 };
  function gyNew(bias) {
    return { t: 0, w: 0, cmd: 0, th: 0, h: 0, bias, est: 0, calib: null, calOk: false, turn: null,
      seed: 12345, m: bias, hist: [[0, 0]], nextRec: 0.1, fastUntil: 0 };
  }
  function gyNoise(s) {
    s.seed = (s.seed * 1103515245 + 12345) & 0x7fffffff;
    return (s.seed / 0x7fffffff * 2 - 1) * GY.noise;
  }
  function gyStep(s) {
    const dt = GY.dt;
    if (s.turn && !s.turn.stopped) {
      const rem = (s.turn.target - s.h) * s.turn.dir;
      if (rem <= 0.02) { s.cmd = 0; s.turn.stopped = true; }
      else s.cmd = s.turn.dir * clamp(rem * 3, 4, GY.turnV);
    }
    s.w += (s.cmd - s.w) * dt / GY.tau;
    if (s.turn && s.turn.stopped && !s.turn.done && Math.abs(s.w) < 0.01) { s.turn.done = true; s.turn.h1 = s.h; s.turn.th1 = s.th; }
    s.th += s.w * dt;
    s.m = s.w + s.bias + gyNoise(s);
    s.h += (s.m - s.est) * dt;
    if (s.calib) {
      if (Math.abs(s.w) > 0.3) { s.calib = null; s.calFail = true; }
      else {
        s.calib.sum += s.m; s.calib.n++;
        if (s.calib.n * dt >= GY.calT - 1e-9) { s.est = s.calib.sum / s.calib.n; s.calib = null; s.calOk = true; s.calDone = true; }
      }
    }
    s.t += dt;
    if (s.t >= s.nextRec - 1e-9) {
      s.hist.push([s.t, s.h - s.th]);
      s.nextRec += 0.1;
      if (s.hist.length > 1500) s.hist.splice(0, 500);
    }
  }
  function gyAdvance(s, sec) {
    const n = Math.round(sec / GY.dt);
    for (let i = 0; i < n; i++) gyStep(s);
  }
  const wrap180 = (a) => ((a % 360) + 540) % 360 - 180;

  function viewGyro(main, tp) {
    const RCX = 160, RCY = 196, GCX = 455, GCY = 232, GR = 128, DCX = 748, DCY = 188, DR = 106;
    let s = gyNew(GY.bias);
    let ev = null, evVars = {}, moved = false, waitFrom = 0;
    const deg = (x, d) => (x > 0.05 ? '+' : x < -0.05 ? '\u2212' : '') + nf(Math.abs(x), d == null ? 1 : d) + '\u00b0';

    const sh = topicShell(main, tp, {
      lead: 'gy_lead', merk: 'gy_merk',
      main:
        '<div class="stagebox"><div class="stage-cap">' + info('gy_tipStage', true) + '</div>' +
          '<svg class="gy-stage" viewBox="0 0 900 370" role="img"></svg></div>' +
        '<div class="stage-tools">' +
          '<button class="btn btn-sm gy-turnL" type="button">\u21b6 <span data-t="gy_turnL"></span></button>' +
          '<button class="btn btn-sm gy-turnR" type="button"><span data-t="gy_turnR"></span> \u21b7</button>' +
          '<button class="btn btn-sm gy-stop" type="button">' + ICO.pause + '<span data-t="gy_stop"></span></button>' +
          '<span class="spacer"></span>' +
          '<button class="btn btn-sm btn-go gy-drift" type="button">' + ICO.play + '<span data-t="gy_drift"></span></button>' +
          '<button class="btn btn-sm gy-wait" type="button">\u23f1 <span data-t="gy_wait"></span></button>' +
          '<button class="btn btn-sm btn-ghost gy-zero" type="button">' + ICO.zero + '<span data-t="gy_zero"></span></button>' +
        '</div>' +
        '<div class="scope"><div class="stage-cap"><span data-t="gy_curve"></span>' + info('gy_tipCurve', true) + '</div>' +
          '<svg class="gy-curve" viewBox="0 0 900 196" role="img"></svg></div>' +
        '<section class="panel"><h2 class="panel-h"><span data-t="gy_calcT"></span></h2><ol class="calc calc-2 gy-calc"></ol></section>',
      side:
        '<section class="panel">' +
          '<div class="ctl"><div class="ctl-head"><span data-t="gy_rate"></span><output class="ctl-val gy-rate-v"></output></div>' +
            '<input type="range" class="gy-rate" min="-180" max="180" step="10" data-ta="gy_rate"><p class="ctl-hint" data-t="gy_rateHint"></p></div>' +
          '<div class="ctl gy-calrow"><div class="ctl-head"><button class="btn btn-sm btn-primary gy-cal" type="button" data-t="gy_cal"></button>' +
            '<span class="gy-calstate"></span></div><p class="ctl-hint" data-t="gy_calHint"></p></div>' +
          '<details class="pro"><summary data-t="gy_biasOpen"></summary>' +
            '<div class="ctl"><div class="ctl-head"><span data-t="gy_bias"></span><output class="ctl-val gy-bias-v"></output></div>' +
            '<input type="range" class="gy-bias" min="-5" max="5" step="0.1" data-ta="gy_bias"><p class="ctl-hint" data-t="gy_biasHint"></p></div>' +
          '</details>' +
        '</section>' +
        '<div class="status gy-status"></div>' +
        '<div class="readouts readouts-3">' +
          '<div class="ro"><span data-t="gy_calc"></span><b class="gy-h"></b></div>' +
          '<div class="ro"><span data-t="gy_real"></span><b class="gy-th"></b></div>' +
          '<div class="ro"><span data-t="gy_err"></span><b class="gy-e"></b></div>' +
        '</div>',
      tryItems: () => [
        t('gy_try1', { imu: code('IMU') }),
        t('gy_try2', { imu: code('IMU') }),
        '<span class="soon">' + esc(t('wip')) + '</span> ' + esc(t('gy_trySoon')),
      ],
      bridge: () => '<span>' + esc(t('gy_bridge')) + '</span>' + code('IMU'),
    });
    const q = sh.q;

    /* ---- stage ---- */
    const st = q('.gy-stage');
    sv('rect', { width: 900, height: 370, class: 'st-floor' }, st);
    const lblRobot = sv('text', { x: 58, y: 40, class: 'st-txt' }, st);
    sv('rect', { x: 30, y: 66, width: 260, height: 260, fill: '#1b2330' }, st);
    sv('path', { d: 'M30 66 H290 V326 H30 Z', fill: 'none', stroke: 'var(--board)', 'stroke-width': 10 }, st);
    sv('line', { x1: RCX, x2: RCX, y1: 76, y2: 316, class: 'st-grid' }, st);
    sv('line', { y1: RCY, y2: RCY, x1: 40, x2: 280, class: 'st-grid' }, st);
    const robot = sv('use', { href: '#bot' }, st);
    const calBarBg = sv('rect', { x: 60, y: 300, width: 200, height: 10, rx: 5, fill: '#2b3445' }, st);
    const calBar = sv('rect', { x: 60, y: 300, height: 10, rx: 5, fill: 'var(--pad)' }, st);
    const calChip = sv('text', { x: 290, y: 40, class: 'st-txt-s gy-chip', 'text-anchor': 'end' }, st);

    /* rate gauge: -200 .. +200 deg/s over a half circle */
    const lblRate = sv('text', { x: GCX, y: 40, class: 'st-txt', 'text-anchor': 'middle' }, st);
    sv('path', { d: 'M' + (GCX - GR) + ' ' + GCY + ' A' + GR + ' ' + GR + ' 0 0 1 ' + (GCX + GR) + ' ' + GCY, fill: 'none', stroke: '#2b3445', 'stroke-width': 18 }, st);
    const rateArc = sv('path', { fill: 'none', stroke: 'var(--pad)', 'stroke-width': 18, opacity: 0.45 }, st);
    for (let v = -200; v <= 200; v += 50) {
      const a = v / GY.rMax * Math.PI / 2, big = v % 100 === 0;
      const r0 = GR + 12, r1 = GR + (big ? 24 : 18);
      sv('line', { x1: GCX + Math.sin(a) * r0, y1: GCY - Math.cos(a) * r0, x2: GCX + Math.sin(a) * r1, y2: GCY - Math.cos(a) * r1, stroke: '#5a6577', 'stroke-width': 2 }, st);
      if (big) sv('text', { x: GCX + Math.sin(a) * (GR + 40), y: GCY - Math.cos(a) * (GR + 40) + 4, class: 'st-txt-s', 'text-anchor': 'middle' }, st).textContent = (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(v);
    }
    const needle = sv('line', { x1: GCX, y1: GCY, x2: GCX, y2: GCY - GR + 8, stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round' }, st);
    sv('circle', { cx: GCX, cy: GCY, r: 9, fill: 'var(--board)' }, st);
    const rateVal = sv('text', { x: GCX, y: GCY + 50, class: 'st-big', 'text-anchor': 'middle', style: 'font-size:34px;font-variant-numeric:tabular-nums' }, st);
    sv('text', { x: GCX, y: GCY + 74, class: 'st-txt-s', 'text-anchor': 'middle' }, st).textContent = '\u00b0/s';

    /* heading dial: 0 at the top, clockwise */
    const lblHead = sv('text', { x: DCX, y: 40, class: 'st-txt', 'text-anchor': 'middle' }, st);
    sv('circle', { cx: DCX, cy: DCY, r: DR, fill: '#1b2330', stroke: '#2b3445', 'stroke-width': 3 }, st);
    for (let a = 0; a < 360; a += 30) {
      const r = a * Math.PI / 180, big = a % 90 === 0;
      sv('line', { x1: DCX + Math.sin(r) * (DR - (big ? 16 : 9)), y1: DCY - Math.cos(r) * (DR - (big ? 16 : 9)), x2: DCX + Math.sin(r) * DR, y2: DCY - Math.cos(r) * DR, stroke: '#5a6577', 'stroke-width': 2 }, st);
      if (big) sv('text', { x: DCX + Math.sin(r) * (DR - 30), y: DCY - Math.cos(r) * (DR - 30) + 4, class: 'st-txt-s', 'text-anchor': 'middle' }, st).textContent = a + '\u00b0';
    }
    const errArc = sv('path', { fill: 'rgba(210,43,30,.35)', stroke: 'none' }, st);
    const handReal = sv('line', { x1: DCX, y1: DCY, stroke: '#e7ecf3', 'stroke-width': 3, 'stroke-dasharray': '6 5', 'stroke-linecap': 'round' }, st);
    const handCalc = sv('line', { x1: DCX, y1: DCY, stroke: 'var(--pad)', 'stroke-width': 6, 'stroke-linecap': 'round' }, st);
    sv('circle', { cx: DCX, cy: DCY, r: 8, fill: 'var(--pad)' }, st);
    const txCalc = sv('text', { x: DCX - DR, y: DCY + DR + 30, class: 'sc-lbl-g' }, st);
    const txReal = sv('text', { x: DCX - DR, y: DCY + DR + 58, class: 'st-txt' }, st);
    const fastBadge = sv('text', { x: 880, y: 360, class: 'st-txt', 'text-anchor': 'end', style: 'fill:var(--pad)' }, st);

    /* ---- curve: computed minus real, last 60 s ---- */
    const cv = q('.gy-curve');
    const X0 = 64, X1 = 884, CYc = 114, KY = 1.05;
    sv('rect', { width: 900, height: 196, class: 'st-floor' }, cv);
    [-60, -30, 30, 60].forEach((v) => {
      sv('line', { x1: X0, x2: X1, y1: CYc - v * KY, y2: CYc - v * KY, class: 'sc-grid' }, cv);
      sv('text', { x: X0 - 6, y: CYc - v * KY + 4, class: 'sc-lbl', 'text-anchor': 'end' }, cv).textContent = (v > 0 ? '+' : '\u2212') + Math.abs(v) + '\u00b0';
    });
    sv('line', { x1: X0, x2: X1, y1: CYc, y2: CYc, class: 'sc-zero' }, cv);
    sv('text', { x: X0 - 6, y: CYc + 4, class: 'sc-lbl', 'text-anchor': 'end' }, cv).textContent = '0';
    const ticksG = sv('g', {}, cv);
    const cLine = sv('polyline', { class: 'sc-line' }, cv);
    const cDot = sv('circle', { r: 4.5, fill: 'var(--pad)' }, cv);

    function judge() {
      if (s.calib) return ['', 'gy_st_cal', {}];
      if (ev) return [ev === 'gy_st_calMove' ? 'bad' : ev === 'gy_st_waited' && Math.abs(evVars.raw) > 3 ? 'bad' : ev === 'gy_st_turnDone' && Math.abs(evVars.raw) > 1 ? 'bad' : 'ok', ev, evVars];
      if (Math.abs(s.w) >= 0.5 || (s.turn && !s.turn.done)) return ['', 'gy_st_turn', {}];
      const e = s.h - s.th;
      if (Math.abs(e) > 3) return ['bad', 'gy_st_drift', { e: deg(e, 0) }];
      return ['', moved ? 'gy_st_still' : 'gy_st_ready', {}];
    }
    let verdict = 'gy_st_ready';

    function draw() {
      const ang = s.th;
      robot.setAttribute('transform', 'translate(' + RCX + ' ' + RCY + ') rotate(' + ang.toFixed(2) + ') scale(1.55)');
      const pr = s.calib ? clamp(s.calib.n * GY.dt / GY.calT, 0, 1) : 0;
      calBar.setAttribute('width', (200 * pr).toFixed(1));
      calBar.style.display = calBarBg.style.display = s.calib ? '' : 'none';
      calChip.textContent = t('gy_calState') + ': ' + (s.calOk ? t('gy_calib') : t('gy_uncal'));
      lblRobot.textContent = t('gy_robot'); lblRate.textContent = t('gy_rateL'); lblHead.textContent = t('gy_headL');
      /* needle shows what the gyro reads (real rate + bias + noise) */
      const m = clamp(s.m, -GY.rMax * 1.08, GY.rMax * 1.08);
      const na = m / GY.rMax * 90;
      needle.setAttribute('transform', 'rotate(' + na.toFixed(2) + ' ' + GCX + ' ' + GCY + ')');
      needle.dataset.angle = na.toFixed(2);
      const a1 = na * Math.PI / 180, R = GR;
      rateArc.setAttribute('d', Math.abs(na) < 0.3 ? '' : 'M' + GCX + ' ' + (GCY - R) + ' A' + R + ' ' + R + ' 0 0 ' + (na > 0 ? 1 : 0) + ' ' + (GCX + Math.sin(a1) * R).toFixed(1) + ' ' + (GCY - Math.cos(a1) * R).toFixed(1));
      rateVal.textContent = (s.m > 0.05 ? '+' : s.m < -0.05 ? '\u2212' : '') + nf(Math.abs(s.m), 1);
      const hand = (el, a, len) => { const r = a * Math.PI / 180; el.setAttribute('x2', (DCX + Math.sin(r) * len).toFixed(1)); el.setAttribute('y2', (DCY - Math.cos(r) * len).toFixed(1)); };
      hand(handReal, s.th, DR - 14); hand(handCalc, s.h, DR - 6);
      const e = s.h - s.th;
      if (Math.abs(e) > 0.5) {
        const r0 = s.th * Math.PI / 180, r1 = s.h * Math.PI / 180, RR = DR - 40;
        const large = Math.abs(e) > 180 ? 1 : 0;
        errArc.setAttribute('d', 'M' + DCX + ' ' + DCY + ' L' + (DCX + Math.sin(r0) * RR).toFixed(1) + ' ' + (DCY - Math.cos(r0) * RR).toFixed(1) +
          ' A' + RR + ' ' + RR + ' 0 ' + large + ' ' + (e > 0 ? 1 : 0) + ' ' + (DCX + Math.sin(r1) * RR).toFixed(1) + ' ' + (DCY - Math.cos(r1) * RR).toFixed(1) + ' Z');
      } else errArc.setAttribute('d', '');
      txCalc.textContent = t('gy_calc') + ': ' + deg(wrap180(s.h));
      txReal.textContent = t('gy_real') + ': ' + deg(wrap180(s.th));
      fastBadge.textContent = s.t < s.fastUntil ? t('gy_fast') : '';
      /* curve */
      const t0 = Math.max(0, s.t - GY.T);
      const xs = (tt) => X0 + (tt - t0) / GY.T * (X1 - X0);
      const ys = (y) => CYc - clamp(y, -70, 70) * KY;
      let pts = '';
      for (const p of s.hist) if (p[0] >= t0) pts += xs(p[0]).toFixed(1) + ',' + ys(p[1]).toFixed(1) + ' ';
      cLine.setAttribute('points', pts + xs(s.t).toFixed(1) + ',' + ys(e).toFixed(1));
      cDot.setAttribute('cx', xs(s.t)); cDot.setAttribute('cy', ys(e));
      let tk = '';
      for (let k = Math.ceil(t0 / 10) * 10; k <= t0 + GY.T + 1e-6; k += 10) {
        const x = xs(k).toFixed(1);
        tk += '<line class="sc-grid" x1="' + x + '" x2="' + x + '" y1="40" y2="184"/><text class="sc-lbl" x="' + x + '" y="193" text-anchor="middle">' + k + ' s</text>';
      }
      ticksG.innerHTML = tk;
      /* side */
      q('.gy-rate-v').textContent = (s.cmd > 0 && !s.turn ? '+' : '') + (s.turn ? '' : nf(+q('.gy-rate').value, 0) + ' \u00b0/s');
      q('.gy-bias-v').textContent = nf(s.bias, 1) + ' \u00b0/s';
      q('.gy-calstate').textContent = s.calOk ? '\u2713 ' + t('gy_calib') + ' (' + nf(s.est, 2) + ' \u00b0/s)' : t('gy_uncal');
      q('.gy-calstate').className = 'gy-calstate' + (s.calOk ? ' ok' : '');
      q('.gy-h').textContent = deg(wrap180(s.h));
      q('.gy-th').textContent = deg(wrap180(s.th));
      q('.gy-e').textContent = deg(e);
      const j = judge();
      verdict = j[1];
      const stEl = q('.gy-status');
      stEl.className = 'status gy-status' + (j[0] ? ' ' + j[0] : '');
      stEl.textContent = t(j[1], j[2]);
      stEl.dataset.state = j[1];
      const b = s.bias;
      q('.gy-calc').innerHTML = [t('gy_c1'), t('gy_c2'), t('gy_c3', { b: nf(b, 1), d: nf(b * 60, 0) }), t('gy_c4')]
        .map((x, i) => '<li data-n="' + (i + 1) + '"' + ((i === 2 && verdict === 'gy_st_drift') || (i === 3 && s.calOk) ? ' class="hot"' : '') + '>' + esc(x) + '</li>').join('');
    }

    /* every user action: clear the last event message, run the action;
       with reduced motion, jump to its result straight away */
    function act(fn, rmSec) {
      ev = null; moved = true;
      fn();
      if (RM && rmSec) settle(rmSec);
      draw();
    }
    function settle(sec) {
      gyAdvance(s, sec);
      after();
    }
    function after() {
      if (s.calFail) { s.calFail = false; ev = 'gy_st_calMove'; evVars = {}; }
      if (s.calDone) { s.calDone = false; ev = 'gy_st_calDone'; evVars = { b: nf(s.est, 2) }; }
      if (s.turn && s.turn.done && !s.turn.told) {
        s.turn.told = true;
        const real = s.turn.th1 - s.turn.th0;
        ev = 'gy_st_turnDone'; evVars = { r: nf(Math.abs(real), 1) + '\u00b0', raw: Math.abs(real) - 90 };
      }
    }
    function setRate(v) {
      q('.gy-rate').value = v;
      s.turn = null; s.cmd = +v;
    }
    function turn(dir) {
      setRate(0);
      s.turn = { dir, target: s.h + 90 * dir, th0: s.th };
    }
    function calibrate() {
      if (Math.abs(s.w) > 0.3 || s.cmd !== 0) { s.calib = null; ev = 'gy_st_calMove'; evVars = {}; return; }
      s.calib = { sum: 0, n: 0 };
    }
    function zero() { s.th = 0; s.h = 0; s.hist = [[s.t, 0]]; }
    function drift() {
      const keepBias = s.bias;
      s = gyNew(keepBias);
      setRate(0);
      s.fastUntil = 30;
    }
    function wait() {
      setRate(0); s.w = 0; s.calib = null;
      const h0 = s.h;
      gyAdvance(s, 60);
      const d = s.h - h0;
      ev = 'gy_st_waited'; evVars = { e: deg(d, 0), raw: d };
    }

    q('.gy-rate').value = 0;
    q('.gy-bias').value = s.bias;
    q('.gy-rate').addEventListener('input', (e) => act(() => setRate(+e.target.value), 1.2));
    q('.gy-bias').addEventListener('input', (e) => act(() => { s.bias = +e.target.value; }, 0));
    q('.gy-turnR').addEventListener('click', () => act(() => turn(1), 5));
    q('.gy-turnL').addEventListener('click', () => act(() => turn(-1), 5));
    q('.gy-stop').addEventListener('click', () => act(() => setRate(0), 1));
    q('.gy-cal').addEventListener('click', () => act(calibrate, 1.2));
    q('.gy-zero').addEventListener('click', () => act(zero, 0));
    q('.gy-drift').addEventListener('click', () => act(drift, 30));
    q('.gy-wait').addEventListener('click', () => act(wait, 0));
    sh.relabel();
    draw();

    function frame(dt) {
      const k = s.t < s.fastUntil ? GY.fast : 1;
      gyAdvance(s, dt * k);
      after();
      draw();
    }
    return {
      kind: 'topic', id: 'gyro', frame,
      relabel: () => { sh.relabel(); draw(); },
      demo: (sec) => { setRate(0); gyAdvance(s, sec); draw(); },
      api: {
        get s() { return s; },
        setRate: (v) => act(() => setRate(v), 0),
        setBias: (b) => { s.bias = b; q('.gy-bias').value = b; draw(); },
        turn: (dir) => act(() => turn(dir), 0),
        calibrate: () => act(calibrate, 0),
        drift: () => act(drift, 0),
        wait: () => act(wait, 0),
        zero: () => act(zero, 0),
        advance: (sec) => { settle(sec); draw(); },
        needle: () => +needle.dataset.angle,
        status: () => verdict,
        click: (cls) => q(cls).click(),
      },
    };
  }

  /* ======================================================================
   * 7. Variables and counters - the editor's own blocks, run step by step
   *
   * The labels come from the editor (code-data.js, RRData) when it is
   * loaded, so they read exactly like the blocks in RatRocket Code. The run
   * follows code.js: "wiederhole bis" checks before every round.
   * ==================================================================== */
  const VA = { cells: 8, budget: 60, tick: 0.55 };
  const VAP = {
    1: () => [{ t: 'setVar', n: 0 }, { t: 'move' }, { t: 'changeVar', n: 1 }, { t: 'move' }, { t: 'changeVar', n: 1 },
      { t: 'move' }, { t: 'changeVar', n: 1 }, { t: 'showVar' }],
    2: (c) => [{ t: 'setVar', n: 0 }, { t: 'repeatUntil', cond: { op: c.op, n: c.n }, body: [{ t: 'move' }, { t: 'changeVar', n: c.d }] }, { t: 'showVar' }],
  };
  const VA_CAT = { move: 'move', setVar: 'var', changeVar: 'var', showVar: 'var', repeatUntil: 'loop' };
  const minus = (n) => String(n).replace('-', '\u2212');

  function viewVars(main, tp) {
    const C = 96, OX = 66, OY = 70;
    const cmp = { op: '=', n: 5, d: 1 };
    let part = 1, prog = VAP[1](), gen = null, st = null, playing = false, acc = 0;
    const vname = () => E('varSuggest')[0];

    const sh = topicShell(main, tp, {
      lead: 'va_lead', merk: 'va_merk',
      main:
        '<div class="stagebox"><div class="stage-cap">' + info('va_tipStage', true) + '</div>' +
          '<svg class="va-stage" viewBox="0 0 900 240" role="img"></svg></div>' +
        '<div class="stage-tools">' +
          '<button class="btn btn-sm btn-go va-run" type="button">' + ICO.play + '<span class="va-run-l"></span></button>' +
          '<button class="btn btn-sm va-step" type="button">' + ICO.step + '<span class="va-step-l"></span></button>' +
          '<button class="btn btn-sm btn-ghost va-reset" type="button">' + ICO.again + '<span class="va-reset-l"></span></button>' +
        '</div>' +
        '<section class="panel va-panel"><div class="va-cols">' +
          '<div><h2 class="panel-h"><span class="va-prog-t"></span>' + info('va_tipProg') + '</h2><div class="va-prog"></div></div>' +
          '<div><div class="watch va-watch"><div class="watch-row"><span class="watch-title"><span class="va-watch-t"></span>' + info('ed:i_watch') + '</span>' +
            '<span class="watch-list va-wlist"></span></div><div class="watch-log va-wlog" hidden></div></div></div>' +
        '</div></section>',
      side:
        '<section class="panel">' +
          '<div class="ctl"><div class="ctl-head"><span data-t="va_part"></span></div>' +
          '<div class="seg seg-full va-parts"><button class="seg-btn" type="button" data-p="1" data-t="va_p1"></button><button class="seg-btn" type="button" data-p="2" data-t="va_p2"></button></div>' +
          '<p class="ctl-hint va-hint" data-t="va_cmpHint"></p></div>' +
        '</section>' +
        '<div class="status va-status"></div>' +
        '<div class="readouts">' +
          '<div class="ro"><span data-t="va_cells"></span><b class="va-cells"></b></div>' +
          '<div class="ro"><span data-t="va_checks"></span><b class="va-checks"></b></div>' +
        '</div>',
      tryItems: () => [
        t('va_try1', { link: '<a href="code.html?level=8">' + esc(t('va_open')) + ' \u2192</a>' }),
        t('va_try2', { where: code('WHERE') }),
      ],
    });
    const q = sh.q;

    /* ---- stage: a corridor of 8 cells, robot facing east ---- */
    const svg = q('.va-stage');
    sv('rect', { width: 900, height: 240, class: 'st-floor' }, svg);
    sv('rect', { x: OX, y: OY, width: C * VA.cells, height: C, fill: '#1b2330' }, svg);
    const stamps = [], cellNo = [];
    for (let i = 0; i < VA.cells; i++) {
      if (i) sv('line', { x1: OX + i * C, x2: OX + i * C, y1: OY, y2: OY + C, class: 'st-grid' }, svg);
      cellNo.push(sv('text', { x: OX + i * C + C / 2, y: OY + C + 24, class: 'st-txt-s', 'text-anchor': 'middle' }, svg));
      stamps.push(sv('text', { x: OX + i * C + C - 10, y: OY + 22, class: 'va-stamp', 'text-anchor': 'end' }, svg));
    }
    sv('rect', { x: OX, y: OY - 10, width: C * VA.cells, height: 10, class: 'st-wall' }, svg);
    sv('rect', { x: OX, y: OY + C, width: C * VA.cells, height: 10, class: 'st-wall' }, svg);
    sv('rect', { x: OX + C * VA.cells, y: OY - 10, width: 10, height: C + 20, class: 'st-wall' }, svg);
    sv('rect', { x: OX - 10, y: OY - 10, width: 10, height: C + 20, class: 'st-wall' }, svg);
    const bot = sv('use', { href: '#bot', style: 'transition:transform .35s cubic-bezier(.4,0,.25,1)' }, svg);
    const bub = sv('g', { class: 'va-bub' }, svg);
    const bubR = sv('rect', { height: 34, rx: 10, fill: '#fff' }, bub);
    const bubP = sv('path', { fill: '#fff' }, bub);
    const bubT = sv('text', { class: 'va-bubt', 'text-anchor': 'middle' }, bub);
    const ouch = sv('text', { class: 'st-ouch', 'text-anchor': 'middle', y: OY - 22 }, svg);

    function condText(c) { return vname() + ' ' + c.op + ' ' + minus(c.n); }
    function label(b) {
      const vs = '<span class="vb-var">' + esc(vname()) + '</span>';
      const tpl = (k) => esc(E(k)).split('{v}').join(vs);
      if (b.t === 'move') return esc(E('b_move'));
      if (b.t === 'setVar') return tpl('b_setVar').replace('{n}', '<span class="vb-num">' + minus(b.n) + '</span>');
      if (b.t === 'showVar') return tpl('b_showVar');
      if (b.t === 'changeVar') {
        const n = part === 2
          ? '<select class="cond va-d" aria-label="' + esc(E('numLabel')) + '">' + [1, 2, -1].map((v) => '<option value="' + v + '"' + (v === b.n ? ' selected' : '') + '>' + minus(v) + '</option>').join('') + '</select>'
          : '<span class="vb-num">' + minus(b.n) + '</span>';
        return tpl('b_changeVar').replace('{n}', n);
      }
      if (b.t === 'repeatUntil') {
        const c = '<span class="cond-pill">' + vs + ' <select class="cond cond-op va-op" aria-label="=, >, <">' +
          ['=', '>', '<'].map((o) => '<option' + (o === b.cond.op ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select> ' +
          '<input class="num-in va-n" type="number" min="0" max="9" step="1" value="' + b.cond.n + '" aria-label="' + esc(E('numLabel')) + '"></span>';
        return esc(E('b_repeatUntil')).replace('{c}', c);
      }
      return '';
    }
    function blockHtml(b, path) {
      const kind = BLK[b.t] || {};
      const head = '<div class="row"><span class="glyph">' + esc(kind.glyph || '') + '</span><span class="lbl">' + label(b) + '</span></div>';
      if (b.body) {
        return '<div class="vb cat-' + VA_CAT[b.t] + ' has-body" data-path="' + path + '">' + head +
          '<div class="arm"><div class="belly">' + b.body.map((c, i) => blockHtml(c, path + '.' + i)).join('') + '</div></div><div class="foot"></div></div>';
      }
      return '<div class="vb cat-' + VA_CAT[b.t] + '" data-path="' + path + '">' + head + '</div>';
    }
    function renderProg() {
      q('.va-prog').innerHTML = prog.map((b, i) => blockHtml(b, String(i))).join('');
      const op = q('.va-op'), n = q('.va-n'), d = q('.va-d');
      if (op) op.addEventListener('change', () => { cmp.op = op.value; rebuild(); });
      if (n) n.addEventListener('change', () => { cmp.n = clamp(Math.round(+n.value || 0), 0, 9); rebuild(); });
      if (d) d.addEventListener('change', () => { cmp.d = +d.value; rebuild(); });
    }
    function rebuild() {
      prog = part === 1 ? VAP[1]() : VAP[2](cmp);
      renderProg(); reset();
    }

    /* ---- interpreter (same order of actions as code.js) ---- */
    function* runList(list, pre) {
      for (let i = 0; i < list.length; i++) {
        const b = list[i], p = (pre ? pre + '.' : '') + i;
        if (b.t === 'repeatUntil') {
          for (;;) {
            yield { k: 'check', p, b };
            if (st.lastCheck) break;
            yield* runList(b.body, p);
          }
        } else yield { k: b.t, p, b };
      }
    }
    function newState() {
      return { val: 0, x: 0, cells: 0, checks: 0, shown: [], last: null, bump: false, cur: null, lastCheck: false,
        zero: false, done: false, fail: null, n: 0, msg: 'va_st_ready', mv: {}, stamps: [] };
    }
    function reset() {
      st = newState(); gen = runList(prog, ''); playing = false; acc = 0;
      draw();
    }
    function cmpTrue(a, c) { return c.op === '>' ? a > c.n : c.op === '<' ? a < c.n : a === c.n; }
    function stepOnce() {
      if (st.done || st.fail) return false;
      st.bump = false;
      const r = gen.next();
      if (r.done) {
        st.done = true; st.cur = null; playing = false;
        st.msg = st.zero ? 'va_st_zero' : 'va_st_done';
        st.mv = { n: st.cells, v: vname(), k: minus(st.val), c: condText(cmp) };
        draw();
        return false;
      }
      const a = r.value, v = vname();
      st.cur = a.p;
      if (++st.n > VA.budget) { st.fail = 'failedLong'; st.msg = 'failedLong'; playing = false; draw(); return false; }
      if (a.k === 'move') {
        if (st.x >= VA.cells - 1) { st.fail = 'failedWall'; st.msg = 'failedWall'; playing = false; draw(); return false; }
        st.x++; st.cells++; st.msg = 'va_st_move'; st.mv = {};
      } else if (a.k === 'setVar') {
        if (st.val !== a.b.n) { st.last = v; st.bump = true; }
        st.val = a.b.n; st.last = v; st.msg = 'va_st_set'; st.mv = { v, n: minus(a.b.n) };
      } else if (a.k === 'changeVar') {
        const old = st.val;
        st.val += a.b.n; st.last = v; st.bump = st.val !== old;
        st.stamps.push([st.x, st.val]);
        st.msg = 'va_st_change'; st.mv = { v, a: minus(old), b: minus(st.val) };
      } else if (a.k === 'showVar') {
        st.shown.push(st.val); st.msg = 'va_st_show'; st.mv = { v, n: minus(st.val) };
      } else if (a.k === 'check') {
        st.checks++;
        st.lastCheck = cmpTrue(st.val, a.b.cond);
        if (st.lastCheck && st.checks === 1) st.zero = true;
        st.msg = 'va_st_check'; st.mv = { c: condText(a.b.cond), a: t(st.lastCheck ? 'va_yes' : 'va_no') };
      }
      draw();
      return true;
    }
    function runAll() { let i = 0; while (stepOnce() && i < 500) i++; }

    function draw() {
      const x = OX + st.x * C + C / 2, y = OY + C / 2;
      bot.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(90deg) scale(.6)';
      for (let i = 0; i < VA.cells; i++) { cellNo[i].textContent = String(i); stamps[i].textContent = ''; }
      st.stamps.forEach((s2) => { stamps[s2[0]].textContent = minus(s2[1]); });
      const showing = st.msg === 'va_st_show' || ((st.done) && st.shown.length);
      if (showing) {
        const txt = vname() + ': ' + minus(st.shown[st.shown.length - 1]);
        const w = 26 + txt.length * 10;
        bubR.setAttribute('x', x - w / 2); bubR.setAttribute('y', OY - 52); bubR.setAttribute('width', w);
        bubP.setAttribute('d', 'M' + (x - 8) + ' ' + (OY - 19) + ' L' + x + ' ' + (OY - 6) + ' L' + (x + 8) + ' ' + (OY - 19) + ' Z');
        bubT.setAttribute('x', x); bubT.setAttribute('y', OY - 29); bubT.textContent = txt;
        bub.style.display = '';
      } else bub.style.display = 'none';
      ouch.setAttribute('x', Math.min(x + 60, 820));
      ouch.textContent = st.fail === 'failedWall' ? t('pid_ouch') : '';
      /* program highlight */
      q('.va-prog').querySelectorAll('.vb').forEach((b) => b.classList.toggle('running', b.dataset.path === st.cur && !st.done));
      /* watch panel, as in the editor */
      const v = vname();
      q('.va-wlist').innerHTML = '<span class="wv' + (st.last === v ? ' is-new' : '') + (st.bump ? ' bump' : '') + '" data-var="' + esc(v) + '">' +
        '<span class="wv-name">' + esc(v) + '</span><output class="wv-val">' + minus(st.val) + '</output></span>';
      const log = q('.va-wlog');
      log.hidden = !st.shown.length;
      log.innerHTML = st.shown.length ? '<span class="wl-head">' + esc(E('shown')) + '</span>' +
        st.shown.slice(-8).map((n) => '<span class="wl-item">' + esc(v) + ': ' + minus(n) + '</span>').join('') : '';
      /* side */
      q('.va-cells').textContent = st.cells;
      q('.va-checks').textContent = part === 2 ? st.checks + '\u00d7' : '\u2013';
      q('.va-hint').hidden = part !== 2;
      main.querySelectorAll('.va-parts .seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.p === part)));
      const s = q('.va-status');
      const bad = st.fail || st.msg === 'va_st_zero';
      s.className = 'status va-status' + (bad ? ' bad' : st.done ? ' ok' : '');
      s.textContent = st.fail ? E(st.fail) : t(st.msg, Object.assign({ run: E('run'), step: E('step') }, st.mv));
      s.dataset.state = st.fail || st.msg;
      q('.va-run-l').textContent = playing ? t('pause') : E('run');
      q('.va-step-l').textContent = E('step');
      q('.va-reset-l').textContent = E('reset');
      q('.va-prog-t').textContent = E('program');
      q('.va-watch-t').textContent = E('watch');
    }

    q('.va-run').addEventListener('click', () => {
      if (st.done || st.fail) reset();
      if (RM) { runAll(); return; }
      playing = !playing; acc = VA.tick; draw();
    });
    q('.va-step').addEventListener('click', () => { playing = false; if (st.done || st.fail) reset(); stepOnce(); });
    q('.va-reset').addEventListener('click', reset);
    main.querySelectorAll('.va-parts .seg-btn').forEach((b) => b.addEventListener('click', () => { part = +b.dataset.p; rebuild(); }));
    sh.relabel();
    rebuild();

    function frame(dt) {
      if (!playing) return;
      acc += dt;
      if (acc >= VA.tick) { acc = 0; stepOnce(); }
    }
    return {
      kind: 'topic', id: 'variablen', frame,
      relabel: () => { sh.relabel(); renderProg(); draw(); },
      demo: () => { part = 2; rebuild(); for (let i = 0; i < 9; i++) stepOnce(); },
      api: {
        get st() { return st; },
        part: (p) => { part = p; rebuild(); },
        setCmp: (op, n, d) => { cmp.op = op; cmp.n = n; cmp.d = d == null ? 1 : d; part = 2; rebuild(); },
        step: stepOnce, runAll, reset,
        label: (i) => { const b = q('.va-prog').children[i]; return b ? b.querySelector('.lbl').textContent.replace(/\s+/g, ' ').trim() : ''; },
        expect: (k, n) => E(k).split('{v}').join(vname()).replace('{n}', minus(n)),
        watch: () => q('.va-wlist').textContent,
        log: () => q('.va-wlog').textContent,
        isNew: () => !!q('.va-wlist .wv.is-new'),
        status: () => q('.va-status').dataset.state,
      },
    };
  }

  /* ======================================================================
   * Home: topic cards with small animated teasers
   * ==================================================================== */
  const VIG = {
    pid: () => {
      const d = 'M-30 46 C 20 46, 44 140, 96 128 S 156 66, 196 84 S 254 98, 292 90 S 360 90, 440 90';
      return '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '<rect width="400" height="180" class="st-floor"/><rect y="12" width="400" height="14" class="st-wall"/><rect y="154" width="400" height="14" class="st-wall"/>' +
        '<line x1="0" x2="400" y1="90" y2="90" class="st-mid"/>' +
        '<path class="st-trail vg-pid-trail" d="' + d + '" stroke-dasharray="600" stroke-dashoffset="600"><animate attributeName="stroke-dashoffset" from="600" to="0" dur="5s" repeatCount="indefinite"/></path>' +
        '<g><use href="#bot" transform="rotate(90) scale(.62)"/><animateMotion dur="5s" repeatCount="indefinite" rotate="auto" path="' + d + '"/></g></svg>';
    },
    encoder: () =>
      '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="180" class="st-floor"/>' +
      '<g transform="translate(112 94)"><g class="vg-spin"><circle r="66" fill="#1d2127"/><circle r="60" fill="none" stroke="#2c323b" stroke-width="10" stroke-dasharray="8 6"/>' +
      '<circle r="50" fill="#cfd5de"/><circle r="44" fill="none" stroke="#7d8798" stroke-width="7" stroke-dasharray="1 2"/><circle r="38" fill="#e6e9ee"/>' +
      '<circle r="14" fill="#c9a046"/><path d="M0 -38 V-62 l14 4 -14 5" fill="var(--board)"/></g></g>' +
      '<rect x="104" y="14" width="16" height="10" rx="2" fill="var(--pad)" class="vg-blink"/>' +
      '<svg x="210" y="44" width="170" height="80" viewBox="0 0 170 80"><g class="vg-march"><path d="M0 64' + ' v-48 h15 v48 h15'.repeat(12) + '" fill="none" stroke="var(--pad)" stroke-width="3"/></g></svg>' +
      '<text x="296" y="152" text-anchor="middle" class="st-big" style="font-size:22px">2874 / U</text></svg>',
    pwm: () =>
      '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="180" class="st-floor"/>' +
      '<svg x="20" y="30" width="210" height="110" viewBox="0 0 210 110"><g class="vg-march"><path d="M0 96' + ' v-70 h30 v70 h30'.repeat(8) + '" fill="none" stroke="var(--pad)" stroke-width="3.4"/></g></svg>' +
      '<line x1="20" x2="230" y1="91" y2="91" class="sc-avg"/>' +
      '<g transform="translate(316 90)"><g class="vg-spin" style="animation-duration:1.6s"><circle r="62" fill="#1d2127"/><circle r="56" fill="none" stroke="#2c323b" stroke-width="10" stroke-dasharray="8 6"/><circle r="44" fill="#e6e9ee"/>' +
      '<path d="M0 0 L0 -40 M0 0 L38 12 M0 0 L-38 12" stroke="#aab2bf" stroke-width="8" stroke-linecap="round"/><circle r="12" fill="#c9a046"/></g></g>' +
      '<text x="124" y="166" text-anchor="middle" class="st-txt">50 %</text></svg>',
    ultraschall: () =>
      '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="180" class="st-floor"/>' +
      '<use href="#bot" transform="translate(52 90) rotate(90) scale(.66)"/>' +
      '<rect x="352" y="20" width="16" height="140" rx="3" class="st-wall"/>' +
      '<g class="vg-ping"><path d="M108 60 A34 34 0 0 1 108 120" fill="none" stroke="#6aa7ec" stroke-width="4" stroke-linecap="round"/></g>' +
      '<g class="vg-ping d2"><path d="M108 66 A28 28 0 0 1 108 114" fill="none" stroke="#6aa7ec" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>' +
      '<g class="vg-echo"><path d="M346 60 A34 34 0 0 0 346 120" fill="none" stroke="var(--pad)" stroke-width="4" stroke-linecap="round"/></g></svg>',
    floodfill: () => {
      const n = 7, m = 3, cs = 50, ox = 25, oy = 15;
      const goal = [3, 1];
      let s = '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="180" class="st-floor"/>';
      for (let x = 0; x < n; x++) for (let y = 0; y < m; y++) {
        const d = Math.abs(x - goal[0]) + Math.abs(y - goal[1]);
        s += '<rect x="' + (ox + x * cs) + '" y="' + (oy + y * cs) + '" width="' + cs + '" height="' + cs + '" class="vg-cell" style="--d:' + d + ';fill:hsl(208 72% ' + (30 + d * 6) + '%)"/>' +
          '<text x="' + (ox + x * cs + cs / 2) + '" y="' + (oy + y * cs + cs / 2) + '" text-anchor="middle" class="ff-num vg-num" style="--d:' + d + ';font-size:19px">' + d + '</text>';
      }
      return s + '<path d="M' + ox + ' ' + oy + 'h' + n * cs + 'v' + m * cs + 'h-' + n * cs + 'z M125 15 v50 M275 115 v50 M75 65 h50" fill="none" stroke="var(--board)" stroke-width="6" stroke-linecap="round"/></svg>';
    },
    gyro: () =>
      '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="180" class="st-floor"/>' +
      '<g transform="translate(96 92)"><g class="vg-turn"><use href="#bot" transform="scale(.9)"/></g></g>' +
      '<path d="M218 128 A72 72 0 0 1 362 128" fill="none" stroke="#2b3445" stroke-width="12"/>' +
      '<g transform="translate(290 128)"><g class="vg-needle"><path d="M0 0 V-62" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g><circle r="7" fill="var(--board)"/></g>' +
      '<text x="290" y="160" text-anchor="middle" class="st-txt">\u00b0/s</text></svg>',
    variablen: () => {
      let s = '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="180" class="st-floor"/>' +
        '<rect x="20" y="96" width="360" height="56" fill="#1b2330"/><rect x="20" y="90" width="360" height="6" class="st-wall"/><rect x="20" y="152" width="360" height="6" class="st-wall"/>' +
        '<g><use href="#bot" transform="rotate(90) scale(.42)"/><animateMotion dur="5s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;.2;.4;.6;.8" values="45,124;117,124;189,124;261,124;333,124"/></g>' +
        '<rect x="120" y="22" width="160" height="44" rx="10" fill="#fff"/><rect x="120" y="22" width="104" height="44" rx="10" fill="#d8690b"/><rect x="200" y="22" width="24" height="44" fill="#d8690b"/>' +
        '<text x="172" y="51" text-anchor="middle" style="font:600 18px var(--display);fill:#fff">' + esc(E('varSuggest')[0]) + '</text>';
      for (let i = 0; i < 5; i++) {
        s += '<text x="252" y="54" text-anchor="middle" opacity="' + (i ? 0 : 1) + '" style="font:600 24px var(--display);fill:var(--ink)">' + i +
          '<animate attributeName="opacity" dur="5s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;' + (i * 0.2).toFixed(1) + ';' + ((i + 1) * 0.2).toFixed(1) + '" values="0;1;0"/></text>';
      }
      return s + '</svg>';
    },
    print: () => {
      let s = '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="180" fill="#5a6577"/>';
      [[-8, 110, 30], [4, 170, 24], [-2, 232, 34]].forEach((p, i) => {
        s += '<g transform="translate(' + p[1] + ' ' + p[2] + ') rotate(' + p[0] + ')" class="vg-float" style="--dl:' + (i * 0.5) + 's"><rect width="96" height="136" rx="3" fill="#fff"/>' +
          '<rect x="10" y="12" width="60" height="7" rx="3" fill="#19212e"/><rect x="10" y="26" width="76" height="4" rx="2" fill="#c3cbd8"/><rect x="10" y="34" width="70" height="4" rx="2" fill="#c3cbd8"/>' +
          (i === 1 ? '<path d="M14 52 h68 v68 h-68 z M37 52 v68 M60 52 v68 M14 75 h68 M14 98 h68" fill="none" stroke="#19212e" stroke-width="1.6"/>' :
            '<path d="M14 54 h68 M14 70 h68 M14 86 h68 M14 102 h50" stroke="#c3cbd8" stroke-width="3"/><rect x="58" y="108" width="24" height="18" rx="3" fill="var(--board)"/>') + '</g>';
      });
      return s + '</svg>';
    },
    lex: () => {
      const words = ['PWM', 'H-Br\u00fccke', 'Encoder', 'UART', 'Totzone', 'LED', 'Bootloader', 'Flood-Fill', 'IMU'];
      const pos = [[24, 34], [118, 22], [250, 30], [40, 88], [150, 80], [290, 84], [60, 138], [196, 132], [318, 140]];
      let s = '<svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">';
      words.forEach((w, i) => {
        const wd = 18 + w.length * 9.2;
        s += '<g class="vg-float" style="--dl:' + (i * 0.4) + 's"><rect x="' + pos[i][0] + '" y="' + pos[i][1] + '" width="' + wd + '" height="30" rx="15" fill="#fff" opacity="' + (i % 3 ? 0.92 : 1) + '"/>' +
          '<text x="' + (pos[i][0] + wd / 2) + '" y="' + (pos[i][1] + 20) + '" text-anchor="middle" style="font:600 15px var(--display);fill:' + (i % 2 ? 'var(--ink)' : 'var(--board-dk)') + '">' + w + '</text></g>';
      });
      return s + '</svg>';
    },
  };

  function viewHome(main) {
    main.innerHTML = '<section class="home"><div class="home-head"><div><h1 data-t="homeTitle"></h1><p data-t="homeLead"></p></div></div><div class="cards"></div></section>';
    const cards = main.querySelector('.cards');
    TOPICS.forEach((tp, i) => {
      const a = document.createElement('a');
      a.className = 'tcard'; a.href = '#' + tp.id; a.dataset.topic = tp.id;
      a.innerHTML = '<div class="vig">' + VIG[tp.id]() + '</div><div class="tcard-body"><div class="tcard-top"><span class="num">' + (i + 1) +
        '</span><span class="tag"></span></div><h2></h2><p></p><span class="cta"></span></div>';
      cards.append(a);
    });
    const lx = document.createElement('a');
    lx.className = 'tcard tcard-lex'; lx.href = '#lexikon'; lx.dataset.topic = 'lexikon';
    lx.innerHTML = '<div class="vig">' + VIG.lex() + '</div><div class="tcard-body"><div class="tcard-top"><span class="num">A</span><span class="tag">' + LEX.length + '</span></div><h2></h2><p></p><span class="cta"></span></div>';
    cards.append(lx);
    const pc = document.createElement('a');
    pc.className = 'tcard tcard-print'; pc.href = 'print/index.html'; pc.dataset.topic = 'print';
    pc.innerHTML = '<div class="vig">' + VIG.print() + '</div><div class="tcard-body"><div class="tcard-top"><span class="num">\u2399</span><span class="tag">A4</span></div><h2></h2><p></p><span class="cta"></span></div>';
    cards.append(pc);
    /* the trail is revealed exactly as fast as the robot drives along it */
    const trail = main.querySelector('.vg-pid-trail');
    if (trail && trail.getTotalLength) {
      const len = Math.ceil(trail.getTotalLength());
      trail.setAttribute('stroke-dasharray', len);
      trail.setAttribute('stroke-dashoffset', len);
      trail.firstChild.setAttribute('from', len);
    }
    if (RM) main.querySelectorAll('.vig > svg').forEach((s) => { if (s.pauseAnimations) { s.pauseAnimations(); s.setCurrentTime(3.4); } });
    function relabel() {
      relabelDom(main);
      main.querySelectorAll('.tcard[data-topic]').forEach((a) => {
        const tp = TOPICS.find((x) => x.id === a.dataset.topic);
        if (tp) {
          a.querySelector('.tag').textContent = L(tp.tag);
          a.querySelector('h2').textContent = L(tp.title);
          a.querySelector('p').textContent = L(tp.sub);
          a.querySelector('.cta').textContent = t('go') + ' \u2192';
        } else if (a.dataset.topic === 'print') {
          a.querySelector('h2').textContent = t('printCardTitle');
          a.querySelector('p').textContent = t('printCardSub');
          a.querySelector('.cta').textContent = t('printCardGo') + ' \u2192';
        } else {
          a.querySelector('h2').textContent = t('lexCardTitle');
          a.querySelector('p').textContent = t('lexCardSub', { n: LEX.length });
          a.querySelector('.cta').textContent = t('lexCardGo') + ' \u2192';
          a.querySelector('.tag').textContent = t('lex_count', { n: LEX.length });
        }
      });
      setTitle(t('title'));
    }
    relabel();
    return { kind: 'home', relabel };
  }

  /* ======================================================================
   * Lexikon
   * ==================================================================== */
  const lexState = { q: '', cat: 'all' };
  const CAT_COL = { elek: '#e3a233', motor: '#d22b1e', sens: '#2f6fd0', regel: '#17935c', soft: '#5a6577', algo: '#7b4bc9' };
  const fold = (s) => String(s || '').toLowerCase()
    .replace(/\u00e4/g, 'ae').replace(/\u00f6/g, 'oe').replace(/\u00fc/g, 'ue').replace(/\u00df/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const HAY = {};
  LEX.forEach((e) => {
    const c = CATS.find((x) => x.id === e.cat) || {};
    HAY[e.id] = fold([e.id, e.term.de, e.term.en, e.text.de, e.text.en, e.where.de, e.where.en, e.alias, c.de, c.en].join(' '));
  });
  function lexMatch(e, q) {
    const words = fold(q).split(/\s+/).filter(Boolean);
    return words.every((w) => HAY[e.id].indexOf(w) >= 0);
  }

  /* micro-interactions; each gets the card, the figure svg and a controls row */
  const HB = {
    cw:    { hl: 1, ll: 0, hr: 0, lr: 1 },
    ccw:   { hl: 0, ll: 1, hr: 1, lr: 0 },
    coast: { hl: 0, ll: 0, hr: 0, lr: 0 },
    brake: { hl: 0, ll: 1, hr: 0, lr: 1 },
  };
  /* DRV8833 (hardware.md): one HIGH and one LOW drives, both LOW coast, both HIGH brake */
  const hbState = (in1, in2) => (in1 && !in2 ? 'cw' : !in1 && in2 ? 'ccw' : in1 && in2 ? 'brake' : 'coast');
  const ACTS = {
    hbridge(card, svg, row, out) {
      const s = { in1: 1, in2: 0 };
      row.innerHTML = '<button class="tog" type="button" data-in="1">IN1 <i></i></button><button class="tog" type="button" data-in="2">IN2 <i></i></button>';
      function upd() {
        const k = hbState(s.in1, s.in2);
        svg.dataset.hb = k;
        svg.querySelectorAll('.hb-sw').forEach((l) => {
          const closed = HB[k][l.dataset.sw];
          l.setAttribute('transform', closed ? '' : 'rotate(-32 ' + l.getAttribute('x1') + ' ' + l.getAttribute('y1') + ')');
          l.dataset.closed = closed ? '1' : '0';
        });
        row.querySelectorAll('.tog').forEach((b) => {
          const v = s['in' + b.dataset.in];
          b.setAttribute('aria-pressed', String(!!v));
          b.querySelector('i').textContent = v ? 'HIGH' : 'LOW';
        });
        out.textContent = t('hb_' + k);
        out.dataset.state = k;
      }
      row.querySelectorAll('.tog').forEach((b) => b.addEventListener('click', () => { const k = 'in' + b.dataset.in; s[k] = s[k] ? 0 : 1; upd(); }));
      upd();
      return upd;
    },
    dip(card, svg, row, out) {
      const s = [0, 0, 1];
      row.innerHTML = [1, 2, 3].map((i) => '<button class="tog" type="button" data-i="' + (i - 1) + '">SW' + i + ' <i></i></button>').join('');
      function upd() {
        svg.querySelectorAll('.lx-dip').forEach((r) => r.classList.toggle('on', !!s[+r.dataset.i]));
        row.querySelectorAll('.tog').forEach((b) => { const v = s[+b.dataset.i]; b.setAttribute('aria-pressed', String(!!v)); b.querySelector('i').textContent = v ? 'ON' : 'OFF'; });
        const key = 'dip_' + s.join('');
        out.textContent = (TEXT.de[key] ? t(key) : t('dip_none')) + ' \u00b7 ' + t('dip_note');
        out.dataset.state = s.join('');
      }
      row.querySelectorAll('.tog').forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.i; s[i] = s[i] ? 0 : 1; upd(); }));
      upd();
      return upd;
    },
    led(card, svg, row, out) {
      let on = true;
      row.innerHTML = '<button class="tog" type="button">LED <i></i></button>';
      const b = row.firstChild;
      function upd() { svg.classList.toggle('off', !on); b.setAttribute('aria-pressed', String(on)); b.querySelector('i').textContent = on ? 'HIGH' : 'LOW'; out.textContent = t(on ? 'led_on' : 'led_off'); }
      b.addEventListener('click', () => { on = !on; upd(); });
      upd();
      return upd;
    },
    press(card, svg, row, out) {
      let on = false;
      row.innerHTML = '<button class="tog" type="button">PB2 <i></i></button>';
      const b = row.firstChild;
      function upd() { svg.classList.toggle('pressed', on); b.setAttribute('aria-pressed', String(on)); b.querySelector('i').textContent = t('press_hold'); out.textContent = t(on ? 'press_on' : 'press_off'); }
      const set = (v) => { on = v; upd(); };
      b.addEventListener('pointerdown', () => set(true));
      b.addEventListener('pointerup', () => set(false));
      b.addEventListener('pointerleave', () => set(false));
      b.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(true); } });
      b.addEventListener('keyup', () => set(false));
      upd();
      return upd;
    },
    dead(card, svg, row, out) {
      let duty = 40;
      row.innerHTML = '<span class="ctl-hint"></span><input type="range" min="0" max="100" step="1" aria-label="PWM">';
      const lbl = row.firstChild, inp = row.lastChild;
      inp.value = duty;
      function upd() {
        const x = 30 + duty * 1.5, y = duty <= 25 ? 90 : 90 - (duty - 25) / 75 * 70;
        const dot = svg.querySelector('.lx-dot');
        dot.setAttribute('cx', x); dot.setAttribute('cy', y);
        lbl.textContent = t('dead_label') + ' ' + nf(duty, 0) + ' %';
        out.textContent = t(duty <= 25 ? 'dead_still' : 'dead_turns') + ' (PWM ' + Math.round(duty * 10.1) + ' / 1010)';
      }
      inp.addEventListener('input', () => { duty = +inp.value; upd(); });
      upd();
      return upd;
    },
    cmd(card, svg, row, out) {
      const R = { PING: 'PONG', CELL: 'CELL done', WALLS: 'WALLS: F=34(wall) L=47(wall) R=205', BAT: 'BAT: 7900 mV' };
      let cur = 'PING';
      row.innerHTML = Object.keys(R).map((k) => '<button class="tog tog-c" type="button" data-c="' + k + '">' + k + '</button>').join('');
      function upd() {
        svg.querySelector('.lx-q').textContent = '> ' + cur;
        svg.querySelector('.lx-a').textContent = R[cur];
        row.querySelectorAll('.tog').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c === cur)));
        out.textContent = t('cmd_pick') + (cur === 'WALLS' || cur === 'BAT' ? ' ' + t('cmd_example') : '');
      }
      row.querySelectorAll('.tog').forEach((b) => b.addEventListener('click', () => { cur = b.dataset.c; upd(); }));
      upd();
      return upd;
    },
    /* the editor's three variable blocks on one note */
    var(card, svg, row, out) {
      let n = 0, shown = false;
      const vn = () => E('varSuggest')[0];
      const lbl = (k, num) => E(k).split('{v}').join(vn()).replace('{n}', num);
      row.innerHTML = '<button class="tog tog-v" type="button" data-a="set"></button><button class="tog tog-v" type="button" data-a="change"></button><button class="tog tog-v" type="button" data-a="show"></button>';
      function upd(bump) {
        row.querySelector('[data-a="set"]').textContent = '= ' + lbl('b_setVar', '0');
        row.querySelector('[data-a="change"]').textContent = '\u00b1 ' + lbl('b_changeVar', '1');
        row.querySelector('[data-a="show"]').textContent = '\u25c9 ' + lbl('b_showVar');
        const val = svg.querySelector('.lx-val');
        val.textContent = String(n);
        svg.querySelector('.lx-vname').textContent = vn();
        if (bump) { val.classList.remove('bump'); void val.getBBox(); val.classList.add('bump'); }
        out.textContent = shown ? t('var_shown', { v: vn(), n }) : t('var_out', { v: vn(), n });
        out.dataset.state = String(n);
      }
      row.querySelectorAll('.tog').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.a;
        shown = a === 'show';
        if (a === 'set') n = 0;
        if (a === 'change') n++;
        upd(a !== 'show');
      }));
      upd();
      return () => upd();
    },
    /* update mode: UPDATE (or reset twice) -> RATROCKET drive -> copy the file */
    uf2(card, svg, row, out) {
      let s = 'run';
      row.innerHTML = '<button class="tog tog-c" type="button" data-a="up"></button><button class="tog" type="button" data-a="copy"></button>';
      function upd(msg) {
        svg.dataset.uf = s;
        row.querySelector('[data-a="up"]').textContent = t('uf2_update');
        row.querySelector('[data-a="copy"]').textContent = t('uf2_copy');
        row.querySelectorAll('.tog').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.a === 'up' && s === 'drive') || (b.dataset.a === 'copy' && s === 'done'))));
        out.textContent = t(msg || ('uf2_' + s));
        out.dataset.state = msg ? 'need' : s;
      }
      row.querySelector('[data-a="up"]').addEventListener('click', () => { s = 'drive'; upd(); });
      row.querySelector('[data-a="copy"]').addEventListener('click', () => { if (s === 'drive') { s = 'done'; upd(); } else upd('uf2_need'); });
      upd();
      return () => upd();
    },
    /* the D-pad of drive.html and the commands it sends (firmware.md) */
    dpad(card, svg, row, out) {
      const P = { x: 160, y: 62, a: 0 };
      const K = [['up', '\u25b2', 'FWD 160', 'FWD done'], ['left', '\u25c0', 'TURN -90', 'TURN done'], ['right', '\u25b6', 'TURN 90', 'TURN done'], ['stop', '\u25a0', 'STOP', '']];
      let last = null;
      row.innerHTML = K.map((k) => '<button class="tog tog-c" type="button" data-k="' + k[0] + '" aria-label="' + k[2] + '">' + k[1] + '</button>').join('');
      const g = svg.querySelector('.dp-bot');
      function upd() {
        g.style.transform = 'translate(' + P.x + 'px,' + P.y + 'px) rotate(' + P.a + 'deg)';
        if (!last) { out.textContent = t('dpad_ready'); out.dataset.state = ''; return; }
        out.textContent = last[0] === 'stop' ? t('dpad_stop') : t('dpad_sent', { c: last[2].replace('-', '\u2212'), a: last[3] });
        out.dataset.state = last[2];
      }
      row.querySelectorAll('.tog').forEach((b) => b.addEventListener('click', () => {
        last = K.find((k) => k[0] === b.dataset.k);
        if (last[0] === 'left') P.a -= 90;
        if (last[0] === 'right') P.a += 90;
        if (last[0] === 'up') {
          const r = P.a * Math.PI / 180;
          P.x += Math.round(Math.sin(r) * 18); P.y -= Math.round(Math.cos(r) * 18);
          if (P.x < 124 || P.x > 192 || P.y < 22 || P.y > 96) { P.x = 160; P.y = 62; }
        }
        upd();
      }));
      upd();
      return upd;
    },
  };

  function viewLex(main, focusId) {
    /* #lexikon/<entry id> jumps to one word, #lexikon/<category id> shows that group */
    const catLink = CATS.some((c) => c.id === focusId);
    if (focusId) { lexState.q = ''; lexState.cat = catLink ? focusId : 'all'; }
    if (catLink) focusId = '';
    main.innerHTML =
      '<section class="lex">' +
        '<div class="lex-head"><div><h1 data-t="lex_title"></h1><p data-t="lex_lead"></p></div></div>' +
        '<div class="lex-tools">' +
          '<label class="search">' + ICO.search + '<input type="search" class="lex-q" data-tp="lex_search" data-ta="lex_search" autocomplete="off"><button class="x lex-x" type="button" data-ta="lex_clear">\u00d7</button></label>' +
          '<div class="cats lex-cats"></div><span class="lex-count"></span>' +
        '</div>' +
        '<div class="lex-body"></div><p class="lex-none" data-t="lex_none" hidden></p>' +
      '</section>';
    const root = main.firstElementChild;
    const qEl = root.querySelector('.lex-q');
    const body = root.querySelector('.lex-body');
    const ac = new AbortController();
    let io = null;
    const updaters = {};

    function figure(card) {
      const e = LEX.find((x) => x.id === card.dataset.id);
      const fig = card.querySelector('.lx-fig');
      fig.innerHTML = '<svg class="lxs" viewBox="0 0 200 110" aria-hidden="true">' + e.fig(lang) + '</svg>';
      fig.dataset.done = '1';
      if (e.act && ACTS[e.act]) {
        const row = card.querySelector('.lx-act'), out = card.querySelector('.lx-out');
        updaters[e.id] = ACTS[e.act](card, fig.firstChild, row, out);
      }
    }
    function cardHtml(e) {
      const badge = { planned: ['', 'lex_planned'], wip: [' wip', 'lex_wip'], connected: [' conn', 'lex_connected'] }[e.status];
      const tags = (badge ? '<span class="lx-badge' + badge[0] + '">' + esc(t(badge[1])) + '</span>' : '') +
        (e.act ? '<span class="lx-try">' + esc(t('lex_try')) + '</span>' : '');
      const links = (e.topic ? '<a class="chip chip-exp" href="#' + e.topic + '">' + esc(t('lex_exp')) + ' \u2192</a>' : '') +
        (e.links || []).map((id) => {
          const o = LEX.find((x) => x.id === id);
          return o ? '<a class="chip" href="#lexikon/' + id + '">' + esc(L(o.term)) + '</a>' : '';
        }).join('');
      return '<article class="lx" id="lx-' + e.id + '" data-id="' + e.id + '">' +
        '<div class="lx-stage"><div class="lx-fig" role="img" aria-label="' + esc(L(e.term)) + '"></div>' +
        (e.act ? '<div class="lx-act"></div><p class="lx-out" aria-live="polite"></p>' : '') + '</div>' +
        '<div class="lx-head"><div><h3 class="lx-term">' + esc(L(e.term)) + tags + '</h3><div class="lx-alt">' + esc(other(e.term)) + '</div></div>' +
          '<a class="lx-link" href="#lexikon/' + e.id + '" title="' + esc(t('lex_link')) + '">#</a></div>' +
        '<p class="lx-text">' + esc(L(e.text)) + '</p>' +
        '<p class="lx-where"><b>' + esc(t('lex_where')) + '</b> ' + esc(L(e.where)) + '</p>' +
        '<div class="lx-links">' + links + '</div>' +
      '</article>';
    }
    function render() {
      if (io) io.disconnect();
      body.innerHTML = CATS.map((c) =>
        '<section class="lex-sec" data-cat="' + c.id + '"><h2><span class="cdot" style="background:' + CAT_COL[c.id] + '"></span>' + esc(L(c)) + '</h2>' +
        '<div class="lex-grid">' + LEX.filter((e) => e.cat === c.id).map(cardHtml).join('') + '</div></section>').join('');
      root.querySelector('.lex-cats').innerHTML = '<button class="pill" type="button" data-c="all">' + esc(t('lex_all')) + '</button>' +
        CATS.map((c) => '<button class="pill" type="button" data-c="' + c.id + '"><span class="dotc" style="background:' + CAT_COL[c.id] + '"></span>' + esc(L(c)) + '</button>').join('');
      root.querySelectorAll('.lex-cats .pill').forEach((b) => b.addEventListener('click', () => { lexState.cat = b.dataset.c; filter(); }));
      if ('IntersectionObserver' in window && !SELFTEST) {
        io = new IntersectionObserver((ents) => {
          ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); if (!en.target.querySelector('.lx-fig').dataset.done) figure(en.target); } });
        }, { rootMargin: '500px 0px' });
        body.querySelectorAll('.lx').forEach((c) => io.observe(c));
      } else {
        body.querySelectorAll('.lx').forEach(figure);
      }
      filter();
    }
    function filter() {
      let n = 0;
      body.querySelectorAll('.lx').forEach((c) => {
        const e = LEX.find((x) => x.id === c.dataset.id);
        const show = (lexState.cat === 'all' || e.cat === lexState.cat) && lexMatch(e, lexState.q);
        c.hidden = !show;
        if (show) n++;
      });
      body.querySelectorAll('.lex-sec').forEach((s) => { s.hidden = !s.querySelector('.lx:not([hidden])'); });
      root.querySelector('.lex-none').hidden = n > 0;
      root.querySelector('.lex-count').textContent = n === 1 ? t('lex_one') : t('lex_count', { n });
      root.querySelector('.lex-count').dataset.n = n;
      root.querySelectorAll('.lex-cats .pill').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.c === lexState.cat)));
      root.querySelector('.lex-x').hidden = !lexState.q;
      return n;
    }
    qEl.value = lexState.q;
    qEl.addEventListener('input', () => { lexState.q = qEl.value; filter(); }, { signal: ac.signal });
    root.querySelector('.lex-x').addEventListener('click', () => { lexState.q = ''; qEl.value = ''; filter(); qEl.focus(); });
    relabelDom(root);
    render();
    setTitle(t('lex_title') + ' \u2013 ' + t('title'));
    function focus(id) {
      const card = $('lx-' + id);
      if (!card) return false;
      if (!card.querySelector('.lx-fig').dataset.done) figure(card);
      card.scrollIntoView({ block: 'center' });
      card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
      return true;
    }
    if (focusId) setTimeout(() => focus(focusId), 0);
    return {
      kind: 'lex',
      relabel: () => { relabelDom(root); render(); setTitle(t('lex_title') + ' \u2013 ' + t('title')); },
      destroy: () => { ac.abort(); if (io) io.disconnect(); },
      api: {
        search: (s) => { lexState.q = s; qEl.value = s; return filter(); },
        cat: (c) => { lexState.cat = c; return filter(); },
        renderAll: () => body.querySelectorAll('.lx').forEach((c) => { if (!c.querySelector('.lx-fig').dataset.done) figure(c); }),
        focus,
      },
    };
  }

  /* ---------------- router ---------------- */
  const VIEWS = { pid: viewPid, encoder: viewEncoder, pwm: viewPwm, ultraschall: viewUltra, floodfill: viewFlood, gyro: viewGyro, variablen: viewVars };
  let view = null, routedHash = null;
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#/, ''));
    routedHash = h;
    if (view && view.destroy) view.destroy();
    hideTip();
    const main = $('view');
    main.innerHTML = '';
    const tp = TOPICS.find((x) => x.id === h);
    if (tp) view = VIEWS[tp.id](main, tp);
    else if (h === 'lexikon' || h.indexOf('lexikon/') === 0) view = viewLex(main, h.slice(8));
    else view = viewHome(main);
    $('tabTopics').setAttribute('aria-current', view.kind === 'lex' ? 'false' : 'page');
    $('tabLex').setAttribute('aria-current', view.kind === 'lex' ? 'page' : 'false');
    if (!(view.kind === 'lex' && h.length > 8)) window.scrollTo(0, 0);
    if (DEMO && view.demo) view.demo(+DEMO);
  }

  /* ---------------- language ---------------- */
  function applyLang() {
    document.documentElement.lang = lang;
    relabelDom(document.querySelector('.rail'));
    $('langBtn').textContent = t('lang');
    if (view && view.relabel) view.relabel();
  }
  function save() {
    if (SELFTEST) return;                               /* the self-test never stores anything */
    try { localStorage.setItem(STORE, JSON.stringify({ lang })); } catch (e) { /* private mode */ }
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null') || JSON.parse(localStorage.getItem('ratrocket.code') || 'null');
      if (s && (s.lang === 'de' || s.lang === 'en')) lang = s.lang;
    } catch (e) { /* ignore */ }
    const m = /[?&]lang=(de|en)\b/.exec(Q);
    if (m) lang = m[1];
  }

  /* ---------------- animation loop ----------------
   * requestAnimationFrame normally; a timer takes over while the page is
   * visible but rAF has stalled (headless browsers, some projector setups). */
  let lastTs = 0, frames = 0, lastRaf = 0;
  function tick(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    frames++;
    if (view && view.frame && !RM && !document.hidden && dt > 0) view.frame(dt);
  }
  function loop(ts) {
    lastRaf = performance.now();
    tick(ts);
    requestAnimationFrame(loop);
  }
  setInterval(() => {
    const now = performance.now();
    if (!document.hidden && now - lastRaf > 250) tick(now);
  }, 33);

  /* ======================================================================
   * Self-test (?selftest=1)
   * ==================================================================== */
  async function selftest() {
    const out = $('selftest');
    out.hidden = false;
    const res = [];
    const ok = (id, cond, msg) => { res.push({ id, ok: !!cond, msg: msg || '' }); out.textContent = res.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.id + (r.msg ? '  ' + r.msg : '')).join('\n'); };
    /* the hashchange event routes; route() again only if it has not happened */
    const go = async (hash) => {
      location.hash = hash;
      await sleep(40);
      if (routedHash !== hash) route();
      return view;
    };
    const has = (sel) => !!document.querySelector(sel);
    try {
      /* home */
      let v = await go('');
      ok('home.cards', document.querySelectorAll('.tcard').length === TOPICS.length + 2 && has('.tcard[href="print/index.html"]') &&
        TOPICS.every((tp) => has('.tcard[href="#' + tp.id + '"] .vig svg')), document.querySelectorAll('.tcard').length + ' cards');

      /* 1 PID */
      v = await go('pid');
      const P = v.api;
      ok('pid.elements', has('.pid-kp') && has('.pid-kd') && has('.pid-ki') && document.querySelectorAll('.pill[data-p]').length === 3 &&
        has('.pid-stage use') && has('.pid-curve .sc-line') && has('.tp-try li') && /KC/.test(document.querySelector('.tp-bridge').textContent));
      P.preset('weak'); P.advance(9);
      const weak = { bumps: P.s.bumps, v: P.verdict(), curve: P.curve() };
      ok('pid.weak', weak.bumps >= 1 && weak.v === 'wall', 'bumps ' + weak.bumps + ', ' + weak.v);
      P.preset('zig'); P.advance(12);
      const zigSides = new Set(P.s.bumpLog.map((b) => b[1]));
      ok('pid.zigzag', P.verdict() === 'zig' && zigSides.size === 2, P.verdict() + ', sides ' + zigSides.size);
      P.preset('good'); P.advance(9);
      const tail = P.s.hist.filter((h) => h[0] > P.s.t - 3).map((h) => Math.abs(h[1]));
      ok('pid.good', P.verdict() === 'good' && P.s.bumps === 0 && Math.max.apply(null, tail) < 4, P.verdict() + ', max ' + Math.max.apply(null, tail).toFixed(1) + ' mm');
      const goodCurve = P.curve();
      ok('pid.curveChangesWithP', goodCurve !== weak.curve && goodCurve.split(' ').length > 50);
      ok('pid.ghost', !!P.prev && document.querySelector('.pid-curve .sc-ghost').getAttribute('points').length > 20);
      const a = pidNew(), b = pidNew();
      pidAdvance(a, { kp: 0.5, kd: 1, ki: 0 }, 5); pidAdvance(b, { kp: 2.5, kd: 1, ki: 0 }, 5);
      ok('pid.physicsDependsOnP', Math.abs(a.y - b.y) > 1, 'y(P=0.5)=' + a.y.toFixed(1) + ' y(P=2.5)=' + b.y.toFixed(1));
      P.setGains(1.5, 1, 0.6); P.restart(); P.advance(14);
      const lastI = P.s.hist.filter((h) => h[0] > P.s.t - 3);
      const meanI = lastI.reduce((s, h) => s + h[1], 0) / lastI.length;
      ok('pid.integralRemovesOffset', Math.abs(meanI) < 1, 'mean ' + meanI.toFixed(2) + ' mm');
      const y0 = P.s.y, tPush = P.s.t; P.push(); P.advance(0.6);
      const kick = Math.max.apply(null, P.s.hist.filter((h) => h[0] > tPush).map((h) => Math.abs(h[1] - y0)));
      ok('pid.push', kick > 3, 'pushed ' + kick.toFixed(1) + ' mm off');

      /* 2 encoder */
      v = await go('encoder');
      const E = v.api;
      ok('enc.elements', has('#encTicks') && has('.enc-speed') && has('.enc-cell') && has('.enc-calc li') &&
        document.getElementById('encTicks').getAttribute('d').split('M').length - 1 === 2874);
      E.click('.enc-zero'); E.setSpeed(60); E.advance(1);
      const want = encRate(60) * 2874;
      ok('enc.counts', Math.abs(E.st.p - want) < want * 0.02, Math.round(E.st.p) + ' ~ ' + Math.round(want));
      E.setSpeed(0); E.click('.enc-zero'); E.click('.enc-cell'); E.advance(40);
      ok('enc.oneCell', Math.round(E.st.p) === 4305 && /160/.test(E.text('.enc-d')) && /4[.,]?305/.test(E.text('.enc-status')), Math.round(E.st.p) + ' pulses, ' + E.text('.enc-d'));
      E.click('.enc-zero'); E.click('.enc-turn'); E.advance(30);
      ok('enc.oneTurn', Math.round(E.st.p) === 2874, Math.round(E.st.p) + ' pulses');

      /* 3 PWM */
      v = await go('pwm');
      const W = v.api;
      ok('pwm.elements', has('.pwm-duty') && has('.pwm-cw') && has('.pwm-ccw') && has('.pwm-slow') && has('.pwm-fast') && has('.pwm-scope .sc-line') && has('.pwm-zi'));
      W.set({ duty: 0.5, dir: 1, fast: true }); W.advance(2);
      const w50 = W.m.w;
      ok('pwm.half', Math.abs(w50 - (0.5 - 0.25) / 0.75) < 0.06 && W.status() === 'pwm_st_smooth', 'w=' + w50.toFixed(3));
      const sc50 = W.scope();
      W.set({ duty: 0.2, dir: 1, fast: true }); W.advance(2);
      ok('pwm.deadBand', W.m.w === 0 && W.status() === 'pwm_st_dead', 'w=' + W.m.w);
      ok('pwm.scopeFollowsDuty', W.scope() !== sc50);
      W.set({ duty: 0.7, dir: -1, fast: true }); const a0 = W.m.ang; W.advance(1);
      ok('pwm.direction', W.m.ang < a0 - 10 && /,92 /.test(W.scope().split('|')[0]) && /,132 /.test(W.scope().split('|')[1]), 'angle ' + (W.m.ang - a0).toFixed(0));
      W.set({ duty: 0.5, dir: 1, fast: false });
      let lo = 9, hi = -9;
      for (let i = 0; i < 40; i++) { W.advance(0.05); if (W.m.t > 1) { lo = Math.min(lo, W.m.w); hi = Math.max(hi, W.m.w); } }
      ok('pwm.slowJerks', hi - lo > 0.4 && W.status() === 'pwm_st_jerk', 'swing ' + (hi - lo).toFixed(2));

      /* 4 ultrasound */
      v = await go('ultraschall');
      const U = v.api;
      ok('us.elements', has('.us-d') && has('.us-ping') && document.querySelectorAll('.seg-btn[data-w]').length === 3 && has('.us-stage use'));
      U.setWall('straight'); U.setDist(30); U.ping(); U.advance(0.2);
      const midFlight = document.querySelectorAll('.us-stage path[stroke="#6aa7ec"]').length;
      U.advance(2);
      const r30 = U.st.res;
      ok('us.echo30', r30 && r30.kind === 'echo' && Math.abs(r30.ms - 60 / 34.3) < 0.01 && Math.abs(r30.d - 30) < 0.05 && midFlight > 0,
        r30 ? r30.ms.toFixed(3) + ' ms, ' + r30.d.toFixed(2) + ' cm, waves ' + midFlight : 'no result');
      U.setDist(100); U.ping(); U.advance(5);
      ok('us.echo100', U.st.res && U.st.res.kind === 'echo' && Math.abs(U.st.res.d - 100) < 0.05, U.st.res && U.st.res.ms.toFixed(2) + ' ms');
      U.setWall('slant'); U.setDist(60); U.ping(); U.advance(12);
      ok('us.slantNoEcho', U.st.res && U.st.res.kind === 'none' && U.status() === 'none');
      U.setWall('gone'); U.ping(); U.advance(12);
      ok('us.goneNoEcho', U.st.res && U.st.res.kind === 'none');
      U.setWall('straight'); U.setDist(230); U.ping(); U.advance(8);
      ok('us.tooFar', U.st.res && U.st.res.kind === 'far', U.st.res && U.st.res.kind);

      /* 5 flood fill */
      v = await go('floodfill');
      const F = v.api;
      ok('ff.elements', has('.ff-play') && has('.ff-step') && has('.ff-walk') && has('.ff-wall') && document.querySelectorAll('.ff-hit').length === 40);
      F.reset(); F.st.level = -1;                /* dry board, also with reduced motion */
      F.click('.ff-step'); F.click('.ff-step');
      const after2 = F.numbers().flat().filter((s) => s !== '').length;
      F.floodAll();
      const nums = F.numbers().flat();
      const ref = ffFlood(ffMaze(FF.walls));
      ok('ff.stepwise', after2 > 1 && after2 < 25, after2 + ' cells after 2 steps');
      ok('ff.reachesAll', nums.every((s) => /^\d+$/.test(s)) && nums.join() === ref.map((c) => c.join()).join(), 'start=' + ref[0][0]);
      const steps = F.walkAll();
      ok('ff.walkDownhill', steps === ref[0][0] && F.st.bot.x === 2 && F.st.bot.y === 2, steps + ' steps');
      F.reset(); F.floodAll();
      const wallsBefore = JSON.stringify(F.st.w), len0 = ref[0][0];
      const added = F.newWall(); F.floodAll();
      const d2 = F.st.dist;
      let consistent = true;
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) {
        const dv = d2[x][y];
        if (dv < 0) consistent = false;
        if (dv > 0 && !['N', 'E', 'S', 'W'].some((d) => !(F.st.w[x][y] & DIRS[d][2]) && d2[x + DIRS[d][0]] && d2[x + DIRS[d][0]][y + DIRS[d][1]] === dv - 1)) consistent = false;
      }
      ok('ff.newWall', added && JSON.stringify(F.st.w) !== wallsBefore && consistent && d2[0][0] > len0, 'start ' + len0 + ' -> ' + d2[0][0]);
      const steps2 = F.walkAll();
      ok('ff.replanWalk', steps2 === d2[0][0] && F.st.dist[F.st.bot.x][F.st.bot.y] === 0, steps2 + ' steps');

      /* 6 gyroscope */
      v = await go('gyro');
      const G = v.api;
      ok('gyro.elements', has('.gy-rate') && has('.gy-cal') && has('.gy-turnR') && has('.gy-drift') && has('.gy-wait') && has('.gy-bias') &&
        has('.gy-stage use') && has('.gy-curve .sc-line') && document.querySelectorAll('.gy-calc li').length === 4 && /H2/.test(document.querySelector('.tp-bridge').textContent));
      G.setBias(GY.bias); G.drift(); G.zero();
      const rot0 = document.querySelector('.gy-stage use').getAttribute('transform');
      G.setRate(120); G.advance(1);
      const wantNeedle = (120 + GY.bias) / GY.rMax * 90;
      ok('gyro.needleFollowsRate', Math.abs(G.needle() - wantNeedle) < 2.5 && G.s.th > 90 && document.querySelector('.gy-stage use').getAttribute('transform') !== rot0,
        'needle ' + G.needle().toFixed(1) + ' want ' + wantNeedle.toFixed(1) + ', turned ' + G.s.th.toFixed(0));
      G.drift(); G.advance(30);
      const e30 = G.s.h - G.s.th;
      ok('gyro.driftGrows', Math.abs(e30 - GY.bias * 30) < 1.5 && G.status() === 'gy_st_drift' && Math.abs(G.s.th) < 0.01, 'error after 30 s ' + e30.toFixed(1) + ' deg');
      G.setRate(60); G.advance(0.5); G.calibrate(); G.advance(1.2);
      ok('gyro.calNeedsRest', G.s.est === 0 && !G.s.calOk && G.status() === 'gy_st_calMove', G.status());
      G.setRate(0); G.advance(1); G.calibrate(); G.advance(1.2);
      const est = G.s.est;
      G.zero(); G.advance(30);
      ok('gyro.calibrationStopsDrift', Math.abs(est - GY.bias) < 0.05 && G.s.calOk && Math.abs(G.s.h - G.s.th) < 0.5,
        'bias ' + est.toFixed(3) + ', error after 30 s ' + (G.s.h - G.s.th).toFixed(2));
      G.zero(); G.turn(1); G.advance(4);
      ok('gyro.turn90', Math.abs(G.s.h - 90) < 0.5 && Math.abs(G.s.th - 90) < 0.8 && G.status() === 'gy_st_turnDone', 'computed ' + G.s.h.toFixed(2) + ', real ' + G.s.th.toFixed(2));
      G.drift(); G.zero(); G.turn(1); G.advance(4);
      const tu = G.s.turn;
      ok('gyro.uncalibratedTurnOff', tu.done && Math.abs(tu.h1 - 90) < 0.5 && tu.th1 - 90 > 2 && G.status() === 'gy_st_turnDone' &&
        document.querySelector('.gy-status').classList.contains('bad'), 'computed ' + tu.h1.toFixed(1) + ', real ' + tu.th1.toFixed(1));
      G.drift(); G.wait();
      ok('gyro.waitMinute', G.status() === 'gy_st_waited' && Math.abs(G.s.h - G.s.th - GY.bias * 60) < 2, (G.s.h - G.s.th).toFixed(0) + ' deg');

      /* 7 variables */
      v = await go('variablen');
      const V = v.api;
      ok('var.elements', document.querySelectorAll('.va-prog .vb').length === 8 && has('.va-watch .wv') && document.querySelectorAll('.va-parts .seg-btn').length === 2 &&
        has('.va-stage use') && has('.va-run') && has('.va-step'));
      const edOk = !!window.RRData && V.label(0) === V.expect('b_setVar', 0) && V.label(1) === edText('b_move') && V.label(2) === V.expect('b_changeVar', 1) && V.label(7) === V.expect('b_showVar');
      ok('var.editorBlocks', edOk, window.RRData ? V.label(0) + ' | ' + V.label(2) + ' | ' + V.label(7) : 'code-data.js not loaded');
      V.reset(); V.step(); V.step(); V.step();
      ok('var.watchGold', V.st.val === 1 && V.isNew() && /1/.test(V.watch()) && V.st.x === 1 && V.status() === 'va_st_change', V.watch());
      V.runAll();
      ok('var.counter', V.st.val === 3 && V.st.x === 3 && V.st.shown.join() === '3' && V.status() === 'va_st_done' && V.log().indexOf(edText('varSuggest')[0] + ': 3') >= 0, V.log());
      V.setCmp('=', 5, 1);
      const p2 = document.querySelectorAll('.va-prog > .vb').length === 3 && has('.va-prog .vb.has-body .belly .vb') && has('.va-op') && has('.va-n');
      V.runAll();
      ok('var.untilEquals5', p2 && V.st.x === 5 && V.st.val === 5 && V.st.checks === 6 && V.status() === 'va_st_done', 'x ' + V.st.x + ', checks ' + V.st.checks);
      V.setCmp('>', 3, 1); V.runAll();
      ok('var.untilGreater3', V.st.x === 4 && V.st.val === 4, 'x ' + V.st.x);
      V.setCmp('<', 5, 1); V.runAll();
      ok('var.lessThanStopsAtOnce', V.st.x === 0 && V.st.checks === 1 && V.status() === 'va_st_zero', V.status());
      V.setCmp('=', 5, 2); V.runAll();
      ok('var.neverEquals5', V.st.fail === 'failedWall' && V.st.x === VA.cells - 1 && V.st.val === 14, 'x ' + V.st.x + ', val ' + V.st.val);
      const opSel = document.querySelector('.va-op');
      opSel.value = '>'; opSel.dispatchEvent(new Event('change'));
      const nIn = document.querySelector('.va-n'); nIn.value = 2; nIn.dispatchEvent(new Event('change'));
      V.runAll();
      ok('var.controlsInBlock', V.st.x === 2 && document.querySelector('.va-op').value === '>', 'x ' + V.st.x);

      /* Lexikon */
      v = await go('lexikon');
      const X = v.api;
      X.renderAll();
      const cards = document.querySelectorAll('.lx');
      const badFig = [...cards].filter((c) => !c.querySelector('.lx-fig svg.lxs') || c.querySelector('.lx-fig svg').childElementCount < 2).map((c) => c.dataset.id);
      ok('lex.allRender', cards.length === LEX.length && badFig.length === 0, cards.length + ' entries' + (badFig.length ? ', no figure: ' + badFig.join(',') : ''));
      const emptyLang = LEX.filter((e) => !['term', 'text', 'where'].every((k) => e[k] && e[k].de && e[k].en) || !e.fig('de') || !e.fig('en')).map((e) => e.id);
      ok('lex.bothLanguages', emptyLang.length === 0, emptyLang.join(','));
      const ids = new Set(LEX.map((e) => e.id));
      const badLinks = [];
      LEX.forEach((e) => { (e.links || []).forEach((l) => { if (!ids.has(l)) badLinks.push(e.id + '->' + l); }); if (e.topic && !VIEWS[e.topic]) badLinks.push(e.id + '->#' + e.topic); if (!CATS.some((c) => c.id === e.cat)) badLinks.push(e.id + ' cat'); });
      TOPICS.forEach((tp) => tp.lex.forEach((l) => { if (!ids.has(l)) badLinks.push(tp.id + '->' + l); }));
      ok('lex.links', badLinks.length === 0 && ids.size === LEX.length, badLinks.join(','));
      ok('lex.interactive', LEX.filter((e) => e.act).length >= 5 && LEX.filter((e) => /a-(spin|flow|ping|march|tour|blink|fill|cyc|wave|draw|needle|rise|glow|slide|drop)/.test(e.fig('de'))).length >= 8,
        LEX.filter((e) => e.act).length + ' interactive, ' + LEX.filter((e) => /a-[a-z]/.test(e.fig('de'))).length + ' animated');
      ok('lex.categories', CATS.every((c) => LEX.some((e) => e.cat === c.id)) && LEX.length >= 30, LEX.length + ' entries');
      const nAll = X.search('');
      const nMotor = X.search('motor');
      const nCap = X.search('capacitor');
      const capOk = !document.getElementById('lx-kondensator').hidden;
      const nUml = X.search('loeten');
      const umlOk = !document.getElementById('lx-loeten').hidden;
      const nNone = X.search('xyzzyq');
      ok('lex.search', nAll === LEX.length && nMotor > 0 && nMotor < nAll && nCap >= 1 && capOk && nUml >= 1 && umlOk && nNone === 0 && !document.querySelector('.lex-none').hidden,
        'all ' + nAll + ', motor ' + nMotor + ', capacitor ' + nCap + ', loeten ' + nUml + ', none ' + nNone);
      X.search('');
      const nCat = X.cat('sens');
      ok('lex.categoryFilter', nCat === LEX.filter((e) => e.cat === 'sens').length, nCat + ' sensors');
      X.cat('all');
      /* H-bridge truth table, DRV8833 (hardware.md): IN1/IN2 -> behaviour */
      const hb = document.getElementById('lx-hbruecke');
      const tg = hb.querySelectorAll('.tog');
      const setIn = (want) => [0, 1].forEach((i) => { if ((tg[i].getAttribute('aria-pressed') === 'true') !== !!want[i]) tg[i].click(); });
      const table = [[[1, 0], 'cw'], [[0, 1], 'ccw'], [[0, 0], 'coast'], [[1, 1], 'brake']];
      const hbRes = table.map(([ins, want]) => {
        setIn(ins);
        const svg = hb.querySelector('svg.lxs');
        const sw = {};
        svg.querySelectorAll('.hb-sw').forEach((l) => { sw[l.dataset.sw] = +l.dataset.closed; });
        const swOk = Object.keys(HB[want]).every((k) => HB[want][k] === sw[k]);
        const shorted = (sw.hl && sw.ll) || (sw.hr && sw.lr);
        return svg.dataset.hb === want && hb.querySelector('.lx-out').dataset.state === want && swOk && !shorted ? '' : ins.join('') + '!=' + want;
      }).filter(Boolean);
      ok('lex.hbridgeTruthTable', hbRes.length === 0 && hbState(1, 0) === 'cw' && hbState(0, 1) === 'ccw' && hbState(0, 0) === 'coast' && hbState(1, 1) === 'brake', hbRes.join(' ') || '10 cw, 01 ccw, 00 coast, 11 brake');
      const dipC = document.getElementById('lx-dip');
      ok('lex.dip', /Labyrinth|maze/.test(dipC.querySelector('.lx-out').textContent));
      /* new Lexikon words */
      const NEW = ['liste', 'funktion', 'karte', 'dipmodi', 'fernsteuerung'];
      const missingNew = NEW.filter((id) => {
        const e = LEX.find((x) => x.id === id);
        const c = document.getElementById('lx-' + id);
        return !e || !e.term.de || !e.term.en || !e.text.en || !e.where.en || !c || !c.querySelector('.lx-fig svg.lxs') || c.querySelector('.lx-fig svg').childElementCount < 2;
      });
      ok('lex.newEntries', missingNew.length === 0, missingNew.join(',') || NEW.join(', '));
      const imu = LEX.find((e) => e.id === 'imu');
      const imuC = document.getElementById('lx-imu');
      ok('lex.gyroConnected', imu.status === 'connected' && imu.topic === 'gyro' && /H2/.test(imu.where.de) && /in Arbeit/.test(imu.where.de) &&
        /angeschlossen|connected/.test(imuC.querySelector('.lx-badge').textContent) && !/geplant|planned/.test(imuC.textContent));
      const dm = window.RLData.DIPMODES;
      const dmC = document.getElementById('lx-dipmodi');
      ok('lex.dipModesTable', dm.map((m) => m.sw.join('')).join() === '000,100,010,110,001' && dmC.querySelectorAll('.lx-dmn').length === 5 &&
        /Labyrinth|Maze/.test(dmC.querySelectorAll('.lx-dmn')[4].textContent));
      const varC = document.getElementById('lx-variable');
      const vb = (a) => varC.querySelector('.tog[data-a="' + a + '"]').click();
      vb('set'); vb('change'); vb('change');
      const v2 = varC.querySelector('.lx-val').textContent;
      vb('show');
      const shownTxt = varC.querySelector('.lx-out').textContent;
      vb('set');
      ok('lex.variableInteractive', v2 === '2' && /2/.test(shownTxt) && varC.querySelector('.lx-val').textContent === '0' &&
        varC.querySelector('.tog[data-a="change"]').textContent.indexOf(edText('b_changeVar').split(' ')[0]) >= 0, v2 + ' / ' + shownTxt);
      const ufC = document.getElementById('lx-bootloader');
      const ufS = ufC.querySelector('svg.lxs');
      ufC.querySelector('.tog[data-a="copy"]').click();
      const ufNeed = ufC.querySelector('.lx-out').dataset.state;
      ufC.querySelector('.tog[data-a="up"]').click();
      const ufDrive = ufS.dataset.uf;
      ufC.querySelector('.tog[data-a="copy"]').click();
      ok('lex.uf2Steps', ufNeed === 'need' && ufDrive === 'drive' && ufS.dataset.uf === 'done' && /RATROCKET/.test(ufC.textContent), ufNeed + ' ' + ufDrive + ' ' + ufS.dataset.uf);
      const dpC = document.getElementById('lx-fernsteuerung');
      dpC.querySelector('.tog[data-k="up"]').click();
      const dp1 = dpC.querySelector('.lx-out').dataset.state;
      dpC.querySelector('.tog[data-k="right"]').click();
      ok('lex.remoteCommands', dp1 === 'FWD 160' && dpC.querySelector('.lx-out').dataset.state === 'TURN 90' && /rotate\(90deg\)/.test(dpC.querySelector('.dp-bot').style.transform), dp1);
      /* deep link */
      v = await go('lexikon/totzone');
      await sleep(60);
      const tz = document.getElementById('lx-totzone');
      const r = tz && tz.getBoundingClientRect();
      ok('lex.deepLink', tz && tz.classList.contains('hit') && r.top < window.innerHeight && r.bottom > 0 && tz.querySelector('.lx-fig svg'), r ? 'top ' + Math.round(r.top) : 'missing');
      await go('lexikon/motor');
      const nVis = document.querySelectorAll('.lx:not([hidden])').length;
      ok('lex.categoryLink', nVis === LEX.filter((e) => e.cat === 'motor').length && document.querySelector('.lex-cats .pill[data-c="motor"]').getAttribute('aria-pressed') === 'true', nVis + ' motor entries');
      lexState.cat = 'all';

      /* worksheets: every link on print/index.html opens a sheet of 1-2 pages.
         Each print page reports itself to its parent (print/print.js). */
      const msgs = [];
      const onMsg = (e) => { if (e.data && e.data.rrPrint) msgs.push(e.data); };
      window.addEventListener('message', onMsg);
      const ifr = [];
      const frame = (src) => {
        const f = document.createElement('iframe');
        f.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;height:600px;visibility:hidden';
        f.src = src; document.body.appendChild(f); ifr.push(f);
      };
      const until = async (cond, ms) => { const t0 = performance.now(); while (!cond() && performance.now() - t0 < ms) await sleep(50); return cond(); };
      frame('print/index.html');
      await until(() => msgs.some((m) => m.rrPrint === 'index'), 5000);
      const idx = msgs.find((m) => m.rrPrint === 'index');
      const links = idx ? idx.links : [];
      links.forEach((l) => frame('print/' + l));
      await until(() => msgs.filter((m) => m.rrPrint === 'sheet').length >= links.length, 9000);
      const sheets = msgs.filter((m) => m.rrPrint === 'sheet');
      const bad = links.filter((l) => { const m = sheets.find((s) => s.file === l.split('/').pop()); return !m || m.pages < 1 || m.pages > 2; });
      ok('print.indexLinks', !!idx && links.length >= 10 && bad.length === 0, (idx ? links.length + ' sheets' : 'index did not answer') + (bad.length ? ', broken: ' + bad.join(',') : ''));
      ok('print.linkedFromPage', has('#tabPrint[href="print/index.html"]') && links.some((l) => /zahlenflut/.test(l)));
      ifr.forEach((f) => f.remove());
      window.removeEventListener('message', onMsg);

      /* language */
      await go('pid');
      const l0 = lang, l1 = lang === 'de' ? 'en' : 'de';
      const titleOf = (l) => TOPICS[0].title[l];
      const start = document.querySelector('.tp-title').textContent === titleOf(l0);
      $('langBtn').click();
      const flipped = document.querySelector('.tp-title').textContent === titleOf(l1) &&
        document.querySelector('.rail .brand-text strong').textContent === TEXT[l1].title && document.documentElement.lang === l1;
      const st1 = document.querySelector('.pid-status').textContent;
      $('langBtn').click();
      ok('lang.toggle', start && flipped && document.querySelector('.tp-title').textContent === titleOf(l0) && st1.length > 3, l0 + ' -> ' + l1 + ' -> ' + lang);
      const missing = Object.keys(TEXT.de).filter((k) => !(k in TEXT.en)).concat(Object.keys(TEXT.en).filter((k) => !(k in TEXT.de)));
      ok('lang.keys', missing.length === 0, missing.join(','));

      /* animation loop is alive (soft: headless may throttle rAF) */
      const f0 = frames; await sleep(250);
      ok('loop.running', frames > f0, (frames - f0) + ' frames');

      /* font from web/fonts, no CDN */
      try { await document.fonts.load('600 16px Fredoka'); } catch (e) { /* */ }
      const fred = [...document.fonts].some((f) => /Fredoka/.test(f.family) && f.status === 'loaded');
      const ext = [...document.querySelectorAll('script[src],link[href]')].filter((n) => /^(https?:)?\/\//.test(n.getAttribute('src') || n.getAttribute('href')));
      ok('offline.font', fred && ext.length === 0, (fred ? 'Fredoka loaded' : 'Fredoka missing') + ', external ' + ext.length);
    } catch (err) {
      ok('exception', false, String(err && err.stack || err));
    }
    location.hash = '';
    await sleep(40);
    if (routedHash !== '') route();
    const fails = res.filter((r) => !r.ok).map((r) => r.id);
    document.title = fails.length ? 'SELFTEST FAIL ' + fails.join(' ') : 'SELFTEST PASS (' + res.length + ' checks)';
    titleLock = true;
    out.textContent = document.title + '\n' + out.textContent;
  }

  /* ---------------- start ---------------- */
  function init() {
    load();
    window.addEventListener('hashchange', route);
    $('langBtn').addEventListener('click', () => { lang = lang === 'de' ? 'en' : 'de'; save(); applyLang(); });
    $('brandBtn').addEventListener('click', (e) => {
      const b = e.currentTarget.querySelector('.brand-bot');
      b.classList.remove('cheer'); void b.offsetWidth; b.classList.add('cheer');
    });
    route();
    applyLang();
    requestAnimationFrame(loop);
    if (SELFTEST) setTimeout(selftest, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
