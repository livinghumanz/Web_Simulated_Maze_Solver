/*
 * RatRocket Code - block editor, maze simulator and robot link.
 *
 * Blocks are plain objects: {t:'move'} or {t:'repeat', n:3, body:[...]}.
 * A path addresses one block, alternating index and key:
 *   [2]            -> prog[2]
 *   [2,'body',0]   -> prog[2].body[0]
 * A container path is the same list without the final index.
 *
 * The same program runs in the simulator and on the real robot. In robot mode
 * every block becomes a console command (CELL, TURN, WALLS) over Web Serial,
 * and the sensor answers decide the "wenn" blocks - so the robot, not the
 * drawing, is the truth.
 *
 * Level 7 is a sandbox: the pupil draws the maze. Programs can be saved to
 * and opened from a JSON file, for handing in.
 */
(function () {
  'use strict';

  const { BLOCKS, CONDITIONS, TEXT, LEVELS } = window.RRData;
  const $ = (id) => document.getElementById(id);
  const STORE = 'ratrocket.code';
  const MAX_ACTIONS = 400;
  const SELFTEST = /[?&]selftest/.test(location.search);

  /* ---------------- state ---------------- */
  let lang = 'de';
  let levelIx = 0;
  let variantIx = 0;
  let prog = [];
  let progs = {};                 /* per level id */
  let done = {};                  /* level id -> stars */
  let world = null;
  let session = null;             /* {gen, ctx} while a program runs */
  let timer = null;
  let port = null, writer = null, reader = null;
  let rxWaiters = [];
  let sandbox = null;             /* level 7: {n, mazes: {3: maze, 4: maze, 5: maze}} */
  let editTool = 'walls';         /* level 7: 'walls' or 'goal' - what a click changes */

  const t = (key, vars) => {
    let s = (TEXT[lang] && TEXT[lang][key]) || TEXT.de[key] || key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  };
  const level = () => LEVELS[levelIx];

  /* ---------------- maze model ---------------- */
  const DIRS = ['N', 'E', 'S', 'W'];
  const DX = { N: 0, E: 1, S: 0, W: -1 };
  const DY = { N: 1, E: 0, S: -1, W: 0 };
  const OPP = { N: 'S', E: 'W', S: 'N', W: 'E' };
  const RIGHT_OF = { N: 'E', E: 'S', S: 'W', W: 'N' };
  const LEFT_OF = { N: 'W', W: 'S', S: 'E', E: 'N' };
  const ANGLE = { N: 0, E: 90, S: 180, W: 270 };

  function buildWorld(lv, vIx) {
    const v = (lv.variants && vIx > 0) ? lv.variants[vIx - 1] : null;
    const n = lv.n;
    const walls = [];
    for (let x = 0; x < n; x++) {
      walls.push([]);
      for (let y = 0; y < n; y++) {
        walls[x].push({ N: y === n - 1, E: x === n - 1, S: y === 0, W: x === 0 });
      }
    }
    const inside = (x, y) => x >= 0 && y >= 0 && x < n && y < n;
    const set = (x, y, d, on) => {
      if (!inside(x, y)) return;
      walls[x][y][d] = on;
      const nx = x + DX[d], ny = y + DY[d];
      if (inside(nx, ny)) walls[nx][ny][OPP[d]] = on;
    };
    for (const s of (v ? v.walls : lv.walls) || []) {
      const [x, y, d] = s.split(',');
      set(+x, +y, d.trim(), true);
    }
    const exit = v ? v.exit : lv.exit;
    if (exit) walls[exit.x][exit.y][exit.side] = false;
    if (!v) for (const e of lv.exits || []) walls[e.x][e.y][e.side] = false;   /* own maze */

    return {
      n, walls, exit, inside,
      goal: lv.goal,
      bot: { x: lv.start.x, y: lv.start.y, d: lv.start.d },
      angle: ANGLE[lv.start.d],      /* keeps turning, so 270->360 spins the short way */
      room: lv.goal === 'out' || !!lv.sandbox,     /* space round the maze to drive out */
      entered: inside(lv.start.x, lv.start.y),     /* own maze: a start outside comes in first */
      trail: [],
    };
  }

  /* Is the wall on side `d` of the robot's cell open? Outside the maze (own
   * maze only) the one way is forward into the maze, through an opening. */
  function openSide(w, d) {
    const b = w.bot;
    if (w.inside(b.x, b.y)) return !w.walls[b.x][b.y][d];
    const nx = b.x + DX[d], ny = b.y + DY[d];
    return w.inside(nx, ny) && !w.walls[nx][ny][OPP[d]];
  }

  /* ---------------- own maze (level 7) ----------------
   * One maze per grid size, 3x3 up to 32x32: {walls, exits, goal, start}.
   * Walls are "x,y,DIR" as in LEVELS, kept once on the N or E side of a
   * cell; exits are any number of openings in the border. start is the
   * robot's cell and heading: inside, or in the ring of cells just outside
   * the border (then it gets in only through an opening). Goal: the star if
   * there is one (openings are just terrain then); without a star, getting
   * out after having been inside. With neither star nor opening nothing
   * runs. */
  const SB_MIN = 3, SB_MAX = 32;           /* Micromouse mazes are 16x16 and 32x32 */
  const sbSizeOk = (n) => Number.isInteger(n) && n >= SB_MIN && n <= SB_MAX;
  /* The firmware's maze is at most 5x5 (MAZE_DIMENSIONS_MAX): bigger own
   * mazes run in the simulation only, and the robot is never driven in them. */
  const BOT_MAX = 5;
  const tooBigForBot = () => !!level().sandbox && sandbox.n > BOT_MAX;
  const sbNoGoal = () => !!level().sandbox && !sbMaze().goal && !sbMaze().exits.length;

  const sbDefault = (n) => ({ walls: [], exits: [], goal: { x: n - 1, y: n - 1 }, start: { x: 0, y: 0, d: 'N' } });
  const sbFresh = () => ({ n: 3, mazes: {} });             /* sizes are filled in when used */
  function sbMaze() {
    return sandbox.mazes[sandbox.n] || (sandbox.mazes[sandbox.n] = sbDefault(sandbox.n));
  }

  /* "x,y,DIR" -> {key, border}, key in its stored form; null if not an edge */
  function sbEdge(s, n) {
    const m = typeof s === 'string' && /^(\d{1,2}),(\d{1,2}),([NESW])$/.exec(s);
    if (!m) return null;
    let x = +m[1], y = +m[2], d = m[3];
    if (x >= n || y >= n) return null;
    const nx = x + DX[d], ny = y + DY[d];
    const border = !(nx >= 0 && ny >= 0 && nx < n && ny < n);
    if (!border && (d === 'S' || d === 'W')) { x = nx; y = ny; d = OPP[d]; }
    return { key: x + ',' + y + ',' + d, border };
  }

  /* a cell just outside the border, next to one border cell (no corners) */
  const sbRing = (x, y, n) => ((x === -1 || x === n) && y >= 0 && y < n) || ((y === -1 || y === n) && x >= 0 && x < n);

  /* A stored or opened maze, checked strictly: a clean copy, or null. A
   * missing start means the corner (0,0) facing north; the start is inside
   * or on the ring; the star is inside and not on the start. */
  function sbClean(m, n) {
    if (!sbSizeOk(n) || !m || typeof m !== 'object') return null;
    const edges = (list, border) => {
      if (!Array.isArray(list) || list.length > 4 * n * (n + 1)) return null;
      const out = new Set();
      for (const s of list) {
        const e = sbEdge(s, n);
        if (!e || e.border !== border) return null;
        out.add(e.key);
      }
      return Array.from(out);
    };
    const pos = (c) => c && typeof c === 'object' && Number.isInteger(c.x) && Number.isInteger(c.y);
    const inside = (c) => c.x >= 0 && c.y >= 0 && c.x < n && c.y < n;
    const walls = edges(m.walls, false), exits = edges(m.exits, true);
    if (!walls || !exits) return null;
    let start = { x: 0, y: 0, d: 'N' };
    if (m.start != null) {
      const s = m.start;
      if (!pos(s) || !(inside(s) || sbRing(s.x, s.y, n)) || !DIRS.includes(s.d)) return null;
      start = { x: s.x, y: s.y, d: s.d };
    }
    let goal = null;
    if (m.goal != null) {
      if (!pos(m.goal) || !inside(m.goal) || (m.goal.x === start.x && m.goal.y === start.y)) return null;
      goal = { x: m.goal.x, y: m.goal.y };
    }
    return { walls, exits, goal, start };
  }

  function sbRestore(s) {
    const sb = sbFresh();
    if (!s || typeof s !== 'object' || !s.mazes || typeof s.mazes !== 'object') return sb;
    for (const k of Object.keys(s.mazes)) {
      const n = Number(k);
      const m = sbSizeOk(n) && sbClean(s.mazes[k], n);
      if (m) sb.mazes[n] = m;
    }
    if (sbSizeOk(s.n)) sb.n = s.n;
    return sb;
  }

  /* The level the simulator builds. Level 7 takes its maze from the pupil. */
  function worldLevel() {
    const lv = level();
    if (!lv.sandbox) return lv;
    const m = sbMaze();
    return Object.assign({}, lv, {
      n: sandbox.n,
      walls: m.walls,
      exits: m.exits.map((k) => { const p = k.split(','); return { x: +p[0], y: +p[1], side: p[2] }; }),
      goal: m.goal ? { x: m.goal.x, y: m.goal.y } : (m.exits.length ? 'out' : null),
      start: { x: m.start.x, y: m.start.y, d: m.start.d },
    });
  }

  const isStar = (g) => !!g && g !== 'out';

  /* ---------------- interpreter ---------------- */
  function* runList(list, ctx) {
    for (const b of list) yield* runBlock(b, ctx);
  }

  function* runBlock(b, ctx) {
    switch (b.t) {
      case 'move':   yield { act: 'move', b }; break;
      case 'left':   yield { act: 'turn', deg: -90, b }; break;
      case 'right':  yield { act: 'turn', deg: 90, b }; break;
      case 'around': yield { act: 'turn', deg: 180, b }; break;
      case 'repeat':
        for (let i = 0; i < (b.n || 1); i++) yield* runList(b.body, ctx);
        break;
      case 'untilOut':
        while (!ctx.isOut()) {
          yield { act: 'tick', b };          /* an empty loop still costs steps */
          yield* runList(b.body, ctx);
        }
        break;
      case 'ifElse':
        yield { act: 'sense', b };           /* read the sensors first */
        if (ctx.test(b.cond)) yield* runList(b.body, ctx);
        else yield* runList(b.alt, ctx);
        break;
      default: break;
    }
  }

  function makeCtx() {
    return {
      walls: null,                            /* robot mode: last WALLS reading */
      isOut() {                 /* out = outside the grid, after having been inside */
        return world.entered && !world.inside(world.bot.x, world.bot.y);
      },
      test(cond) {
        const side = cond.startsWith('front') ? world.bot.d
                   : cond.startsWith('right') ? RIGHT_OF[world.bot.d]
                   : LEFT_OF[world.bot.d];
        let free;
        if (this.walls) {
          free = cond.startsWith('front') ? !this.walls.front
               : cond.startsWith('right') ? !this.walls.right
               : !this.walls.left;
        } else {
          free = openSide(world, side);
        }
        return cond.endsWith('Free') ? free : !free;
      },
    };
  }

  /* ---------------- robot link (Web Serial) ---------------- */
  async function connect() {
    if (port) { await disconnect(); return; }
    if (!('serial' in navigator)) { say(t('noSerial'), 'lose'); return; }
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
  }

  async function disconnect() {
    try { if (reader) await reader.cancel(); } catch (e) {}
    try { if (writer) await writer.close(); } catch (e) {}
    try { if (port) await port.close(); } catch (e) {}
    port = writer = reader = null;
    rxWaiters = [];
    setLink('', t('notConnected'));
    $('connectBtn').textContent = t('connect');
    $('realChk').checked = false;
  }

  async function readLoop() {
    let buf = '';
    try {
      for (;;) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += value;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, '');
          buf = buf.slice(i + 1);
          if (line) rxWaiters = rxWaiters.filter((w) => !w.try(line));
        }
      }
    } catch (e) { /* link lost */ }
    if (port) disconnect();
  }

  function send(line) { if (writer) writer.write(line + '\r\n'); }

  function expect(re, ms) {
    return new Promise((resolve) => {
      const w = {
        try(line) { const m = line.match(re); if (m) { clearTimeout(w.to); resolve(m); return true; } return false; },
      };
      w.to = setTimeout(() => { rxWaiters = rxWaiters.filter((x) => x !== w); resolve(null); }, ms);
      rxWaiters.push(w);
    });
  }

  /* ---------------- performing one action ---------------- */
  let fast = false;
  /* Time per step. Big own mazes take shorter steps, in proportion to the
     cell, so the robot crosses the screen as fast as in a 5x5 - a 32x32 maze
     stays watchable. Up to 5x5 nothing changes. */
  const stepMs = () => {
    if (fast) return 0;
    const base = [900, 650, 430, 280, 160][($('speed').value | 0) - 1] || 430;
    return world && world.n > 5 ? Math.round(base * Math.min(1, geom().cs / 57)) : base;
  };

  async function perform(a, ctx) {
    const real = $('realChk').checked && port && !tooBigForBot();

    if (a.act === 'tick') { return true; }

    if (a.act === 'sense') {
      if (real) {
        send('WALLS');
        const m = await expect(/^WALLS: F=(\d+)(\(wall\))? L=(\d+)(\(wall\))? R=(\d+)(\(wall\))?/, 4000);
        ctx.walls = m ? { front: !!m[2], left: !!m[4], right: !!m[6] } : null;
      } else {
        ctx.walls = null;
      }
      return true;
    }

    if (a.act === 'turn') {
      const steps = Math.round(a.deg / 90);
      for (let i = 0; i < Math.abs(steps); i++) {
        world.bot.d = steps > 0 ? RIGHT_OF[world.bot.d] : LEFT_OF[world.bot.d];
      }
      world.angle += a.deg;
      if (real) {
        send('TURN ' + a.deg);
        const m = await expect(/^TURN (done|rejected)/, 12000);
        if (!m || m[1] !== 'done') return false;
      }
      drawBot();
      if (!real) await sleep(stepMs() * 0.8);
      return true;
    }

    if (a.act === 'move') {
      const canGo = openSide(world, world.bot.d);
      if (real) {
        send('CELL');
        const m = await expect(/^CELL (done|failed)/, 15000);
        if (!m || m[1] !== 'done') return false;
      } else if (!canGo) {
        return false;
      }
      const from = { x: world.bot.x, y: world.bot.y };
      world.bot.x += DX[world.bot.d];
      world.bot.y += DY[world.bot.d];
      if (world.inside(world.bot.x, world.bot.y)) world.entered = true;
      world.trail.push(from);
      updateTrail();
      drawBot();
      if (!real) await sleep(stepMs());
      return true;
    }
    return true;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------------- running ---------------- */
  function startSession() {
    const ctx = makeCtx();
    session = { gen: runList(prog, ctx), ctx, actions: 0, alive: true };
    return session;
  }

  async function advance() {
    if (!session || !session.alive) return false;
    const { value, done: d } = session.gen.next();
    if (d) { finish(false); return false; }
    if (++session.actions > maxActions()) { finish(false, 'failedLong'); return false; }
    highlight(value.b);
    const ok = await perform(value, session.ctx);
    if (!session.alive) return false;
    if (!ok) { finish(false, 'failedWall'); return false; }
    if (reachedGoal()) { finish(true); return false; }
    return true;
  }

  /* The star; or, for an escape maze, being outside the grid after having
   * been inside (tasks 5 and 6 start inside and have one exit; an own maze
   * may start outside, and any opening counts). No goal: never. */
  function reachedGoal() {
    if (!world.goal) return false;
    if (world.goal === 'out') return world.entered && !world.inside(world.bot.x, world.bot.y);
    return world.bot.x === world.goal.x && world.bot.y === world.goal.y;
  }

  /* Runaway guard, scaled with the maze: a wall follower needs about 8 steps
   * per cell (measured: 544 at most on random 8x8), so 16 per cell never
   * stops a correct program, while a real endless loop still ends. 3x3
   * tasks keep the old 400. */
  const maxActions = () => Math.max(MAX_ACTIONS, 16 * world.n * world.n + 50);

  /* Reasons not to start at all (a message instead of a run). */
  function cannotRun() {
    if (!prog.length) return 'emptyProgram';
    if (sbNoGoal()) return 'noGoal';
    if ($('realChk').checked && tooBigForBot()) return 'botMax';
    if ($('realChk').checked && !port) return 'botNeeded';
    return null;
  }

  async function runAll() {
    const why = cannotRun();
    if (why) { say(t(why)); return; }
    if (!session) { resetRun(); startSession(); }
    setRunning(true);
    while (session && session.alive) {
      const more = await advance();
      if (!more) break;
    }
    setRunning(false);
  }

  async function stepOnce() {
    const why = session ? null : cannotRun();
    if (why) { say(t(why)); return; }
    if (!session) { resetRun(); startSession(); }
    setRunning(true);
    await advance();
    setRunning(false);
  }

  function stopRun() {
    if (session) session.alive = false;
    session = null;
    if (port) send('STOP');
    setRunning(false);
    say(t('stopped'));
  }

  function setRunning(on) {
    $('runBtn').textContent = on ? t('stop') : t('run');
    $('runBtn').classList.toggle('is-stop', on);
    $('stepBtn').disabled = on;
    $('botGroup') && $('botGroup').classList.toggle('driving', on);
    syncEdit();
  }

  let nextMaze = null;            /* timer: same program, next maze (level 6) */

  function resetRun() {
    if (session) session.alive = false;
    session = null;
    clearTimeout(nextMaze);         /* a pending next maze must not start on another level */
    nextMaze = null;
    variantIx = 0;
    world = buildWorld(worldLevel(), 0);
    highlight(null);
    hideVerdict();
    drawMaze();
    syncEdit();
  }

  let lastResult = null;

  function finish(win, failKey) {
    lastResult = { win: !!win, reason: failKey || (win ? 'goal' : 'failedEnd') };
    if (session) session.alive = false;
    session = null;
    highlight(null);
    setRunning(false);

    const lv = level();
    if (win && lv.variants && variantIx < lv.variants.length) {
      variantIx++;                                    /* same program, next maze */
      world = buildWorld(lv, variantIx);
      say(t('solved') + ' ' + (variantIx + 1) + '/' + (lv.variants.length + 1), 'win');
      drawMaze();
      nextMaze = setTimeout(() => { nextMaze = null; startSession(); runAll(); }, 900);
      return;
    }
    if (win && lv.sandbox) {                          /* own maze: no stars, just the count */
      const used = countBlocks(prog);
      say(t('solvedBlocks', { n: used, b: blocksWord(used) }), 'win');
      celebrate();
    } else if (win) {
      const stars = starsFor(countBlocks(prog), lv.par);
      done[lv.id] = Math.max(done[lv.id] || 0, stars);
      save();
      renderLevels();
      renderTask();                                   /* the header shows the new stars */
      say(t('solvedStars', { n: stars }), 'win', levelIx < LEVELS.length - 1 ? 'next' : null);
      celebrate();
    } else {
      say(t(failKey || 'failedEnd'), 'lose', 'again');
    }
  }

  const starsFor = (used, par) => (used <= par ? 3 : used <= Math.ceil(par * 1.7) ? 2 : 1);
  const blocksWord = (n) => (n === 1 ? t('blockOne') : t('blocksUsed'));

  function countBlocks(list) {
    let n = 0;
    for (const b of list) {
      n++;
      if (b.body) n += countBlocks(b.body);
      if (b.alt) n += countBlocks(b.alt);
    }
    return n;
  }

  /* ---------------- maze drawing ---------------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs) => {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  function geom() {
    const n = world.n, size = 400;
    /* escape mazes (and every own maze, so it never jumps) leave about one
       cell round the grid for the robot to drive out into */
    const pad = world.room ? (n > 3 ? Math.round(size / (n + 2)) : 84) : 46;
    const cs = (size - 2 * pad) / n;
    return { n, pad, cs, size };
  }
  function cellXY(x, y) {
    const { pad, cs, n } = geom();
    return [pad + x * cs, pad + (n - 1 - y) * cs];
  }
  function centre(x, y) { const [px, py] = cellXY(x, y); const { cs } = geom(); return [px + cs / 2, py + cs / 2]; }
  /* the line on side d of cell (x,y): [x1, y1, x2, y2] */
  function edgeSeg(x, y, d) {
    const [L, T] = cellXY(x, y);
    const { cs } = geom();
    const R = L + cs, B = T + cs;
    return { N: [L, T, R, T], E: [R, T, R, B], S: [L, B, R, B], W: [L, T, L, B] }[d];
  }

  function drawMaze() {
    const svg = $('maze');
    svg.textContent = '';
    const { n, cs, pad } = geom();
    const w = world;
    /* Light enough for a 32x32 maze (1024 cells): walls and openings are one
       path each, above 16x16 the cells are one tile, and the corner dots go
       above 12x12. Up to 5x5 the stylesheet's line widths apply unchanged;
       bigger mazes get thinner lines that shrink with the cell. */
    const wallW = n > 5 ? Math.max(1.5, cs * 0.15) : 0;
    const f = wallW / 9;
    for (const [k, v] of [['--wall-w', 9 * f], ['--open-w', 7 * f], ['--hl-w', 9 * f + 5]]) {
      if (f) svg.style.setProperty(k, v.toFixed(2)); else svg.style.removeProperty(k);
    }
    if (f) svg.style.setProperty('--open-dash', (2 * f).toFixed(2) + ' ' + (11 * f).toFixed(2));
    else svg.style.removeProperty('--open-dash');

    const star = isStar(w.goal) ? w.goal : null;
    if (n <= 16) {
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
        const [px, py] = cellXY(x, y);
        const isGoal = star && star.x === x && star.y === y;
        svg.append(el('rect', { x: px + 1, y: py + 1, width: cs - 2, height: cs - 2, rx: 4,
                                class: isGoal ? 'cell cell-goal' : 'cell' }));
      }
    } else {
      svg.append(el('rect', { x: pad, y: pad, width: n * cs, height: n * cs, class: 'cell' }));
      if (star) {
        const [px, py] = cellXY(star.x, star.y);
        svg.append(el('rect', { x: px, y: py, width: cs, height: cs, class: 'cell cell-goal' }));
      }
    }
    for (let i = 1; i < n; i++) {
      svg.append(el('line', { x1: pad + i * cs, y1: pad, x2: pad + i * cs, y2: pad + n * cs, class: 'grid-line' }));
      svg.append(el('line', { x1: pad, y1: pad + i * cs, x2: pad + n * cs, y2: pad + i * cs, class: 'grid-line' }));
    }

    if (star) {
      const [cx, cy] = centre(star.x, star.y);
      const R = cs * (n > 12 ? 0.34 : 0.21);              /* small cells: a bigger share */
      svg.append(el('path', { class: 'star', d: starPath(cx, cy, R, R * 0.43) }));
    }

    /* each shared edge once; openings first, so walls cover their ends */
    let dWall = '', dOpen = '';
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (const d of DIRS) {
      if (d === 'S' && y > 0) continue;
      if (d === 'W' && x > 0) continue;
      const isBorder = !w.inside(x + DX[d], y + DY[d]);
      if (!w.walls[x][y][d] && !isBorder) continue;
      const s = edgeSeg(x, y, d).map((v) => +v.toFixed(2));
      const seg = 'M' + s[0] + ' ' + s[1] + 'L' + s[2] + ' ' + s[3];
      if (w.walls[x][y][d]) dWall += seg; else dOpen += seg;
    }
    if (dOpen) svg.append(el('path', { d: dOpen, class: 'wall-open' }));
    if (dWall) svg.append(el('path', { d: dWall, class: 'wall' }));
    if (n <= 12) {
      for (let x = 0; x <= n; x++) for (let y = 0; y <= n; y++) {
        svg.append(el('circle', { cx: pad + x * cs, cy: pad + y * cs, r: 2.6, class: 'pad-dot' }));
      }
    }

    svg.append(el('g', { id: 'editHl' }));         /* own maze: what a click would change */
    svg.append(el('polyline', { id: 'trailLine', points: '', class: 'trail' }));
    updateTrail(svg);

    const g = el('g', { id: 'botGroup' });
    const hop = el('g', { class: 'bot-hop' });      /* the win moment animates this */
    const u = document.createElementNS(SVGNS, 'use');
    u.setAttribute('href', '#bot');
    const k = (cs * 0.37) / 80;    /* 80 units = board diameter; 0.37 = user-chosen size in the cell */
    u.setAttribute('transform', 'scale(' + k.toFixed(3) + ')');
    hop.append(u);
    g.append(hop);
    svg.append(g);
    drawBot();
  }

  function updateTrail() {
    const line = $('trailLine');
    if (!line) return;
    const w = world;
    const pts = w.trail.length
      ? w.trail.concat([{ x: w.bot.x, y: w.bot.y }]).map((c) => centre(c.x, c.y).join(',')).join(' ')
      : '';
    line.setAttribute('points', pts);
  }

  function drawBot() {
    const g = $('botGroup');
    if (!g) return;
    const [cx, cy] = centre(world.bot.x, world.bot.y);
    g.style.setProperty('--step', stepMs() + 'ms');
    g.setAttribute('transform', 'translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') rotate(' + world.angle + ')');
  }

  function starPath(cx, cy, R, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const rad = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + (cx + rad * Math.cos(a)).toFixed(1) + ' ' + (cy + rad * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }

  /* ---------------- win moment ----------------
   * Gold stars burst from the robot for about a second and the robot hops.
   * Pure SVG + CSS. Nothing at all when the system asks for less motion. */
  function celebrate() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const svg = $('maze');
    const cs = Math.max(geom().cs, 40);               /* still a burst in a 32x32 maze */
    const [cx, cy] = centre(world.bot.x, world.bot.y);
    const g = el('g', { class: 'burst', transform: 'translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ')' });
    const N = 14;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 2 * Math.PI + (i % 2 ? 0.16 : -0.1);
      const dist = cs * (0.62 + 0.13 * ((i * 3) % 5));
      const small = i % 3 === 2;
      const R = cs * (small ? 0.05 : 0.085);
      const s = el('path', { class: small ? 'spark spark-sm' : 'spark', d: starPath(0, 0, R, R * 0.45) });
      s.style.setProperty('--dx', (Math.cos(a) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * dist).toFixed(1) + 'px');
      s.style.setProperty('--spin', (i % 2 ? 1 : -1) * (110 + 35 * (i % 4)) + 'deg');
      s.style.setProperty('--delay', (i % 4) * 35 + 'ms');
      g.append(s);
    }
    svg.append(g);
    const hop = svg.querySelector('#botGroup .bot-hop');
    if (hop) { hop.classList.remove('hop'); void hop.getBoundingClientRect(); hop.classList.add('hop'); }
    setTimeout(() => g.remove(), 1600);
  }

  /* ---------------- own maze: editing ----------------
   * While no program runs, a click on the maze edits it with one of three
   * tools. Walls: the nearest line, on or off - inside a wall, on the border
   * an opening (as many as you like). Start: a cell inside, or just outside
   * the border, becomes the start; the start cell again turns the robot a
   * quarter to the right. Goal: a cell gets the star; the star again takes
   * it away. Star and start never share a cell. */
  const canEdit = () => !!level().sandbox && !session;

  function syncEdit() {
    const sb = !!level().sandbox;
    const live = sb && !session;
    $('sbBar').hidden = !sb;
    $('screen').classList.toggle('is-edit', live);
    document.querySelectorAll('#sbBar .sb-ctl').forEach((c) => { c.disabled = !live; });
    if (!live) drawHl(null);
  }

  function syncTools() {
    for (const [id, tool] of [['sbWalls', 'walls'], ['sbStart', 'start'], ['sbGoal', 'goal']]) {
      $(id).setAttribute('aria-pressed', String(editTool === tool));
    }
    $('sbSize').value = String(sandbox.n);
  }

  /* 3x3 .. 32x32, grouped by whether the real robot can drive them */
  function renderSizes() {
    const sel = $('sbSize');
    sel.textContent = '';
    for (const [label, a, b] of [[t('sizesBot'), SB_MIN, BOT_MAX], [t('sizesSim'), BOT_MAX + 1, SB_MAX]]) {
      const g = document.createElement('optgroup');
      g.label = label;
      for (let n = a; n <= b; n++) {
        const o = document.createElement('option');
        o.value = String(n);
        o.textContent = n + ' \u00d7 ' + n;
        g.append(o);
      }
      sel.append(g);
    }
    sel.value = String(sandbox.n);
  }

  /* pointer -> maze units (the 400 x 400 viewBox) */
  function mazePoint(ev) {
    const r = $('maze').getBoundingClientRect();
    const s = 400 / r.width;
    return [(ev.clientX - r.left) * s, (ev.clientY - r.top) * s];
  }

  /* What a click at (ux,uy) would change: {edge}, {cell} or null. Lines only
   * count near them, so a click in the middle of a cell does nothing. */
  function editTarget(ux, uy) {
    const { n, pad, cs } = geom();
    const gx = (ux - pad) / cs, gy = (uy - pad) / cs;            /* grid units, y down */
    if (editTool !== 'walls') {
      const col = Math.floor(gx), row = Math.floor(gy);
      const c = { x: col, y: n - 1 - row }, m = sbMaze();
      const inGrid = col >= 0 && row >= 0 && col < n && row < n;
      if (editTool === 'goal') {
        return inGrid && !(c.x === m.start.x && c.y === m.start.y) ? { cell: c } : null;
      }
      if (!inGrid && !sbRing(c.x, c.y, n)) return null;            /* start: inside or the ring */
      return m.goal && c.x === m.goal.x && c.y === m.goal.y ? null : { cell: c };
    }
    const vx = Math.round(gx), hy = Math.round(gy);
    const dv = Math.abs(gx - vx), dh = Math.abs(gy - hy);
    if (Math.min(dv, dh) > 0.34) return null;
    let s;
    if (dv <= dh) {                                              /* a line running up and down */
      const row = Math.floor(gy);
      if (row < 0 || row >= n || vx < 0 || vx > n) return null;
      s = vx === n ? (n - 1) + ',' + (n - 1 - row) + ',E' : vx + ',' + (n - 1 - row) + ',W';
    } else {                                                     /* a line running across */
      const col = Math.floor(gx);
      if (col < 0 || col >= n || hy < 0 || hy > n) return null;
      s = hy === n ? col + ',0,S' : col + ',' + (n - 1 - hy) + ',N';
    }
    const e = sbEdge(s, n);
    return e ? { edge: e } : null;
  }

  function drawHl(tgt) {
    const g = $('editHl');
    if (!g) return;
    g.textContent = '';
    if (!tgt) return;
    if (tgt.cell) {
      const [px, py] = cellXY(tgt.cell.x, tgt.cell.y);
      const { cs } = geom();
      g.append(el('rect', { x: px + 5, y: py + 5, width: cs - 10, height: cs - 10, rx: 7, class: 'hl-cell' }));
    } else {
      const p = tgt.edge.key.split(',');
      const seg = edgeSeg(+p[0], +p[1], p[2]);
      g.append(el('line', { x1: seg[0], y1: seg[1], x2: seg[2], y2: seg[3], class: 'hl-edge' }));
    }
  }

  /* One edit with one tool; false if nothing changes. */
  function applyEdit(tool, tgt) {
    if (!canEdit() || !tgt) return false;
    const m = sbMaze(), n = sandbox.n;
    let turned = false;
    if (tool === 'walls' && tgt.edge) {
      const list = tgt.edge.border ? m.exits : m.walls;
      const i = list.indexOf(tgt.edge.key);
      if (i >= 0) list.splice(i, 1); else list.push(tgt.edge.key);
    } else if (tool === 'start' && tgt.cell) {
      const c = tgt.cell, s = m.start;
      const inGrid = c.x >= 0 && c.y >= 0 && c.x < n && c.y < n;
      if (!inGrid && !sbRing(c.x, c.y, n)) return false;
      if (m.goal && c.x === m.goal.x && c.y === m.goal.y) return false;
      if (c.x === s.x && c.y === s.y) { s.d = RIGHT_OF[s.d]; turned = true; }
      else m.start = { x: c.x, y: c.y, d: s.d };
    } else if (tool === 'goal' && tgt.cell) {
      const c = tgt.cell;
      if (!(c.x >= 0 && c.y >= 0 && c.x < n && c.y < n)) return false;
      if (c.x === m.start.x && c.y === m.start.y) return false;
      m.goal = m.goal && m.goal.x === c.x && m.goal.y === c.y ? null : { x: c.x, y: c.y };
    } else {
      return false;
    }
    sbChanged();
    if (turned) spinStart();
    return true;
  }

  /* the robot visibly turns a quarter to the right into its new heading */
  function spinStart() {
    const g = $('botGroup');
    if (!g) return;
    const to = world.angle;
    world.angle = to - 90;
    drawBot();
    void g.getBoundingClientRect();
    world.angle = to;
    drawBot();
  }

  function onMazeClick(ev) {
    const tgt = canEdit() ? editTarget(...mazePoint(ev)) : null;
    if (applyEdit(editTool, tgt) && ev.pointerType !== 'touch') drawHl(tgt);
  }

  function onMazeHover(ev) {
    if (ev.pointerType === 'touch') return;
    drawHl(canEdit() ? editTarget(...mazePoint(ev)) : null);
  }

  function sbChanged() {
    resetRun();
    renderTask();
    save();
  }

  function setTool(tool) { editTool = tool; syncTools(); }

  function setSize(n) {
    if (!sbSizeOk(n) || !canEdit()) { syncTools(); return; }
    sandbox.n = n;
    syncTools();
    sbChanged();
  }

  /* Leeren: all walls go; start and goal stay. */
  function sbClear() {
    if (!canEdit()) return;
    sbMaze().walls = [];
    sbChanged();
  }

  /* Zufall: a perfect maze - every cell can be reached, and by exactly one
   * way - dug by an iterative backtracker (no recursion, instant at 32x32).
   * The start stays as placed. The border closes again, except: a start
   * outside gets the opening in front of it, and a maze without a star gets
   * one exit at the border cell farthest from the start. A star moves to
   * the cell farthest from the start. */
  function sbRandom() {
    if (!canEdit()) return;
    const n = sandbox.n, m = sbMaze(), s = m.start;
    const inGrid = (x, y) => x >= 0 && y >= 0 && x < n && y < n;
    /* the first cell inside: the start, or the one next to a start outside */
    const first = { x: Math.min(n - 1, Math.max(0, s.x)), y: Math.min(n - 1, Math.max(0, s.y)) };
    const open = new Set();                              /* inner edges dug through */
    const seen = new Set([first.x + ',' + first.y]);
    const stack = [[first.x, first.y]];
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const ways = DIRS.filter((d) => inGrid(x + DX[d], y + DY[d]) && !seen.has((x + DX[d]) + ',' + (y + DY[d])));
      if (!ways.length) { stack.pop(); continue; }
      const d = ways[Math.floor(Math.random() * ways.length)];
      open.add(sbEdge(x + ',' + y + ',' + d, n).key);
      seen.add((x + DX[d]) + ',' + (y + DY[d]));
      stack.push([x + DX[d], y + DY[d]]);
    }
    const walls = [];
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      if (x < n - 1 && !open.has(x + ',' + y + ',E')) walls.push(x + ',' + y + ',E');
      if (y < n - 1 && !open.has(x + ',' + y + ',N')) walls.push(x + ',' + y + ',N');
    }
    m.walls = walls;
    const dist = stepsFrom(n, walls, first);
    m.exits = [];
    if (!inGrid(s.x, s.y)) {                             /* the way in */
      const side = s.x < 0 ? 'W' : s.x >= n ? 'E' : s.y < 0 ? 'S' : 'N';
      m.exits.push(first.x + ',' + first.y + ',' + side);
    }
    if (m.goal) m.goal = farthestCell(n, dist);
    else {
      const out = farthestBorder(n, dist);
      if (!m.exits.includes(out)) m.exits.push(out);
    }
    sbChanged();
  }

  /* steps from cell `from` to every cell, walking through the maze */
  function stepsFrom(n, walls, from) {
    const wall = new Set(walls);
    const dist = new Map([[from.x + ',' + from.y, 0]]);
    const queue = [[from.x, from.y]];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const d of DIRS) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || dist.has(nx + ',' + ny)) continue;
        if (wall.has(sbEdge(x + ',' + y + ',' + d, n).key)) continue;
        dist.set(nx + ',' + ny, dist.get(x + ',' + y) + 1);
        queue.push([nx, ny]);
      }
    }
    return dist;
  }

  function farthestCell(n, dist) {
    let best = null, far = -1;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      const k = dist.get(x + ',' + y);
      if (k > far) { far = k; best = { x, y }; }
    }
    return best;
  }

  /* the border side of the border cell farthest away */
  function farthestBorder(n, dist) {
    let best = null, far = -1;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (const d of ['E', 'N', 'S', 'W']) {
      const e = sbEdge(x + ',' + y + ',' + d, n);
      if (!e.border) continue;
      const k = dist.get(x + ',' + y);
      if (k > far) { far = k; best = e.key; }
    }
    return best;
  }

  /* ---------------- blocks: rendering ---------------- */
  function labelNodes(b, template) {
    const out = [];
    const parts = template.split(/(\{n\}|\{c\})/);
    for (const p of parts) {
      if (p === '{n}') {
        const wrap = document.createElement('span');
        wrap.className = 'num';
        const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '\u2212';
        const val = document.createElement('output'); val.textContent = b.n;
        const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+';
        minus.addEventListener('click', (e) => { e.stopPropagation(); b.n = Math.max(1, b.n - 1); renderProgram(); });
        plus.addEventListener('click', (e) => { e.stopPropagation(); b.n = Math.min(9, b.n + 1); renderProgram(); });
        wrap.append(minus, val, plus);
        out.push(wrap);
      } else if (p === '{c}') {
        const sel = document.createElement('select');
        sel.className = 'cond';
        for (const c of CONDITIONS) {
          const o = document.createElement('option');
          o.value = c; o.textContent = t('c_' + c); o.selected = c === b.cond;
          sel.append(o);
        }
        sel.addEventListener('change', (e) => { b.cond = e.target.value; });
        sel.addEventListener('pointerdown', (e) => e.stopPropagation());
        out.push(sel);
      } else if (p) {
        out.push(document.createTextNode(p));
      }
    }
    return out;
  }

  function renderBlock(b, path, live) {
    const def = BLOCKS[b.t];
    const node = document.createElement('div');
    node.className = 'blk cat-' + def.cat + (def.body ? ' has-body' : '');
    node.dataset.type = b.t;
    if (path) node.dataset.path = JSON.stringify(path);
    node.dataset.live = live ? '1' : '';

    const row = document.createElement('div');
    row.className = 'row';
    const gl = document.createElement('span'); gl.className = 'glyph'; gl.textContent = def.glyph;
    const lb = document.createElement('span'); lb.className = 'lbl';
    lb.append(...labelNodes(b, t('b_' + b.t)));
    row.append(gl, lb);
    node.append(row);

    if (def.body) {
      node.append(armFor(b.body, path, 'body', live));
      if (def.alt) {
        const mid = document.createElement('div');
        mid.className = 'mid';
        const s = document.createElement('span'); s.className = 'lbl'; s.textContent = t('b_else');
        mid.append(s);
        node.append(mid, armFor(b.alt, path, 'alt', live));
      }
      const foot = document.createElement('div'); foot.className = 'foot';
      node.append(foot);
    }
    return node;
  }

  function armFor(list, path, key, live) {
    const arm = document.createElement('div');
    arm.className = 'arm';
    const belly = document.createElement('div');
    belly.className = 'belly';
    if (live && path) belly.dataset.cpath = JSON.stringify(path.concat(key));
    (list || []).forEach((child, i) => belly.append(renderBlock(child, path ? path.concat(key, i) : null, live)));
    arm.append(belly);
    return arm;
  }

  function renderPalette() {
    const host = $('paletteList');
    host.textContent = '';
    const allow = level().allow;
    const groups = {};
    for (const type of allow) (groups[BLOCKS[type].cat] ||= []).push(type);
    for (const cat of ['move', 'loop', 'decide']) {
      if (!groups[cat]) continue;
      const g = document.createElement('div');
      const h = document.createElement('div'); h.className = 'cat-name'; h.textContent = t('cat_' + cat);
      const box = document.createElement('div'); box.className = 'cat-blocks';
      for (const type of groups[cat]) box.append(renderBlock(freshBlock(type), null, false));
      g.append(h, box);
      host.append(g);
    }
  }

  function freshBlock(type) {
    const def = BLOCKS[type];
    const b = { t: type };
    if (def.count) b.n = def.countDefault;
    if (def.cond) b.cond = def.condDefault;
    if (def.body) b.body = [];
    if (def.alt) b.alt = [];
    return b;
  }

  function renderProgram() {
    const host = $('progList');
    host.textContent = '';
    host.dataset.cpath = '[]';
    host.dataset.empty = t('dropHere');
    prog.forEach((b, i) => host.append(renderBlock(b, [i], true)));
    const used = countBlocks(prog);
    $('blockCount').textContent = used + ' ' + blocksWord(used);
    saveProg();
    save();
  }

  function highlight(b) {
    document.querySelectorAll('#progList .blk.running').forEach((n) => n.classList.remove('running'));
    if (!b) return;
    const path = findPath(prog, b);
    if (!path) return;
    const want = JSON.stringify(path);
    const node = Array.from(document.querySelectorAll('#progList .blk'))
      .find((x) => x.dataset.path === want);
    if (node) node.classList.add('running');
  }

  function findPath(list, target, base) {
    base = base || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i] === target) return base.concat(i);
      for (const key of ['body', 'alt']) {
        if (list[i][key]) {
          const p = findPath(list[i][key], target, base.concat(i, key));
          if (p) return p;
        }
      }
    }
    return null;
  }

  /* ---------------- blocks: dragging ---------------- */
  const arrayAt = (cpath) => {
    let list = prog;
    for (let i = 0; i < cpath.length; i += 2) list = list[cpath[i]][cpath[i + 1]];
    return list;
  };

  let drag = null;

  function onPointerDown(ev) {
    if (ev.button != null && ev.button !== 0) return;
    if (ev.target.closest('button, select, input')) return;
    const node = ev.target.closest('.blk');
    if (!node) return;
    if (session) return;                       /* not while a program runs */

    const live = node.dataset.live === '1';
    const srcPath = live ? JSON.parse(node.dataset.path) : null;
    const block = live ? arrayAt(srcPath.slice(0, -1))[srcPath[srcPath.length - 1]]
                       : freshBlock(node.dataset.type);

    const rect = node.getBoundingClientRect();
    const ghost = $('ghost');
    ghost.textContent = '';
    ghost.style.width = rect.width + 'px';
    ghost.append(renderBlock(block, null, false));
    ghost.hidden = false;

    drag = { block, srcPath, dx: ev.clientX - rect.left, dy: ev.clientY - rect.top, moved: false };
    moveGhost(ev.clientX, ev.clientY);
    if (live) node.classList.add('dim');
    ev.preventDefault();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
  }

  function moveGhost(x, y) {
    const g = $('ghost');
    g.style.left = (x - drag.dx) + 'px';
    g.style.top = (y - drag.dy) + 'px';
  }

  function onPointerMove(ev) {
    if (!drag) return;
    drag.moved = true;
    moveGhost(ev.clientX, ev.clientY);

    drag.overTrash = hitTest($('trash'), ev.clientX, ev.clientY);
    $('trash').classList.toggle('hot', !!(drag.overTrash && drag.srcPath));

    drag.target = drag.overTrash ? null : dropTarget(ev.clientX, ev.clientY);
    showInsert(drag.target);
  }

  function hitTest(node, x, y) {
    const r = node.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function dropTarget(x, y) {
    const under = document.elementFromPoint(x, y);
    const c = under && under.closest('[data-cpath]');
    if (!c) return null;
    const kids = Array.from(c.children).filter((k) => k.classList.contains('blk'));
    let index = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { index = i; break; }
    }
    return { node: c, cpath: JSON.parse(c.dataset.cpath), index, kids };
  }

  function showInsert(tgt) {
    const bar = $('insert');
    if (!tgt) { bar.hidden = true; return; }
    const r = tgt.node.getBoundingClientRect();
    let y;
    if (tgt.kids.length === 0) y = r.top + r.height / 2;
    else if (tgt.index < tgt.kids.length) y = tgt.kids[tgt.index].getBoundingClientRect().top - 4;
    else y = tgt.kids[tgt.kids.length - 1].getBoundingClientRect().bottom + 1;
    bar.style.left = (r.left + 4) + 'px';
    bar.style.top = y + 'px';
    bar.style.width = Math.max(40, r.width - 8) + 'px';
    bar.hidden = false;
  }

  function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove);
    $('ghost').hidden = true;
    $('insert').hidden = true;
    $('trash').classList.remove('hot');
    const d = drag;
    drag = null;
    if (!d) return;

    const tgt = d.target;
    if (!tgt) {
      if (d.overTrash && d.srcPath) removeAt(d.srcPath);   /* only the bin deletes */
      renderProgram();
      return;
    }
    /* never drop a block inside itself */
    if (d.srcPath && JSON.stringify(tgt.cpath.slice(0, d.srcPath.length)) === JSON.stringify(d.srcPath)) {
      renderProgram();
      return;
    }
    let index = tgt.index;
    if (d.srcPath) {
      const srcContainer = d.srcPath.slice(0, -1);
      const srcIndex = d.srcPath[d.srcPath.length - 1];
      removeAt(d.srcPath);
      if (JSON.stringify(srcContainer) === JSON.stringify(tgt.cpath) && srcIndex < index) index--;
    }
    arrayAt(tgt.cpath).splice(index, 0, d.block);
    renderProgram();
  }

  function removeAt(path) {
    arrayAt(path.slice(0, -1)).splice(path[path.length - 1], 1);
  }

  /* ---------------- levels and messages ---------------- */
  function renderLevels() {
    const nav = $('levelNav');
    nav.textContent = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      b.className = 'lvl' + (done[lv.id] ? ' done' : '');
      b.textContent = lv.id;
      b.title = lv.name[lang];
      if (i === levelIx) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', () => goLevel(i));
      nav.append(b);
    });
  }

  function renderTask() {
    const lv = level();
    const box = $('taskBox');
    box.textContent = '';
    const h = document.createElement('h2');
    h.textContent = lv.id + '. ' + lv.name[lang];
    if (!lv.sandbox) {                              /* own maze: no stars to earn */
      const stars = document.createElement('span');
      stars.className = 'stars';
      stars.textContent = ' ' + '\u2605'.repeat(done[lv.id] || 0) + '\u2606'.repeat(3 - (done[lv.id] || 0));
      h.append(stars);
    }
    const p = document.createElement('p');
    const m = lv.sandbox ? sbMaze() : null;
    p.textContent = (m && !m.goal ? (m.exits.length ? lv.taskOut : lv.taskNone) : lv.task)[lang];
    const i = document.createElement('button');
    i.className = 'info'; i.textContent = 'i'; i.setAttribute('aria-label', t('hint'));
    i.dataset.tip = lv.hint[lang];
    p.append(' ', i);
    box.append(h, p);
  }

  function goLevel(i) {
    if (session) stopRun();
    saveProg();
    levelIx = i;
    prog = progs[level().id] || [];
    resetRun();
    renderLevels();
    renderTask();
    renderPalette();
    renderProgram();
    save();
  }

  function say(msg, kind, action) {
    const v = $('verdict');
    v.textContent = '';
    v.className = 'verdict' + (kind ? ' ' + kind : '');
    v.append(document.createTextNode(msg));
    if (action) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = action === 'next' ? t('nextLevel') : t('tryAgain');
      b.addEventListener('click', () => {
        hideVerdict();
        if (action === 'next') goLevel(Math.min(LEVELS.length - 1, levelIx + 1));
        else resetRun();
      });
      v.append(b);
    }
    v.hidden = false;
  }
  const hideVerdict = () => { $('verdict').hidden = true; };

  /* Where the real robot goes: the start cell of this task, facing its way -
     in the own maze possibly just outside the border. */
  function placeText() {
    const lv = level();
    const s = lv.sandbox ? sbMaze().start : lv.start;
    const n = lv.sandbox ? sandbox.n : lv.n;
    const d = t('dir_' + s.d);
    if (s.x >= 0 && s.y >= 0 && s.x < n && s.y < n) {
      if (s.x === 0 && s.y === 0 && s.d === 'N') return t('botPlace');
      return t('botPlaceAt', { c: s.x + 1, r: s.y + 1, d });
    }
    const w = s.x < 0 ? t('out_W', { r: s.y + 1 }) : s.x >= n ? t('out_E', { r: s.y + 1 })
            : s.y < 0 ? t('out_S', { c: s.x + 1 }) : t('out_N', { c: s.x + 1 });
    return t('botPlaceOut', { w, d });
  }

  /* ---------------- program files ----------------
   * Speichern downloads {version:1, level, lang, prog} as
   * ratrocket-aufgabe<N>.json - on level 7 with the pupil's maze as well.
   * Opening is strict: JSON.parse only (nothing in a file ever runs), known
   * block types and conditions only, repeat counts clamped to 1..9, and any
   * other key is dropped. A bad file changes nothing. */
  const FILE_MAX = 200000, FILE_BLOCKS = 500, FILE_DEPTH = 12;

  function progData(list) {
    return list.map((b) => {
      const def = BLOCKS[b.t], o = { t: b.t };
      if (def.count) o.n = b.n;
      if (def.cond) o.cond = b.cond;
      if (def.body) o.body = progData(b.body || []);
      if (def.alt) o.alt = progData(b.alt || []);
      return o;
    });
  }

  function exportData() {
    const lv = level();
    const data = { version: 1, level: lv.id, lang, prog: progData(prog) };
    if (lv.sandbox) data.maze = Object.assign({ n: sandbox.n }, JSON.parse(JSON.stringify(sbMaze())));
    return data;
  }

  function saveFile() {
    const data = exportData();
    const name = 'ratrocket-aufgabe' + data.level + '.json';
    const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    say(t('saved', { f: name }));
  }

  function cleanList(list, depth, count) {
    if (!Array.isArray(list) || depth > FILE_DEPTH) return null;
    const out = [];
    for (const b of list) {
      if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
      if (typeof b.t !== 'string' || !Object.prototype.hasOwnProperty.call(BLOCKS, b.t)) return null;
      if (++count.n > FILE_BLOCKS) return null;
      const def = BLOCKS[b.t], o = { t: b.t };
      if (def.count) {
        if (typeof b.n !== 'number' || !isFinite(b.n)) return null;
        o.n = Math.min(9, Math.max(1, Math.round(b.n)));
      }
      if (def.cond) {
        if (!CONDITIONS.includes(b.cond)) return null;
        o.cond = b.cond;
      }
      if (def.body && !(o.body = cleanList(b.body, depth + 1, count))) return null;
      if (def.alt && !(o.alt = cleanList(b.alt, depth + 1, count))) return null;
      out.push(o);
    }
    return out;
  }

  /* file text -> {level, prog, maze?} or null */
  function parseFile(text) {
    if (typeof text !== 'string' || text.length > FILE_MAX) return null;
    let d;
    try { d = JSON.parse(text); } catch (e) { return null; }
    if (!d || typeof d !== 'object' || Array.isArray(d) || d.version !== 1) return null;
    const p = cleanList(d.prog, 0, { n: 0 });
    if (!p) return null;
    const out = { level: Number.isInteger(d.level) ? d.level : null, prog: p };
    if (d.maze != null) {
      const n = d.maze.n;
      const m = sbClean(d.maze, n);
      if (!m) return null;
      out.maze = { n, m };
    }
    return out;
  }

  /* The program always goes into the task that is open now. */
  async function openFile(ev) {
    const input = ev.target;
    const f = input.files && input.files[0];
    let data = null;
    try { if (f && f.size <= FILE_MAX) data = parseFile(await f.text()); } catch (e) { data = null; }
    input.value = '';                                /* the same file can be opened again */
    if (!f) return;
    if (!data) { say(t('badFile'), 'lose'); return; }
    if (session) stopRun();
    const lv = level();
    prog = data.prog;
    if (data.maze && lv.sandbox) {
      sandbox.n = data.maze.n;
      sandbox.mazes[data.maze.n] = data.maze.m;
      syncTools();
    }
    resetRun();
    renderTask();
    renderProgram();
    const from = data.level !== lv.id && LEVELS.some((l) => l.id === data.level);
    say(from ? t('loadedFrom', { n: data.level }) : t('loaded'));
  }

  /* ---------------- tooltips ---------------- */
  let tipFor = null;
  function showTip(btn) {
    const txt = btn.dataset.tip || t(btn.dataset.tipKey || '');
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
    const b = e.target.closest && e.target.closest('.info');
    if (b) showTip(b); else if (tipFor && !e.target.closest('.info')) hideTip();
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

  /* ---------------- language ---------------- */
  function applyLang() {
    document.documentElement.lang = lang;
    const map = {
      't-title': 'title', 't-tagline': 'tagline', 't-palette': 'palette', 't-program': 'program',
      't-start': 'startHere', 't-end': 'end', 't-trash': 'trash', 't-where': 'whereBot',
      't-speed': 'speed', 't-robotCard': 'robotCard', 't-sensorCard': 'sensorCard',
      't-cellLabel': 'cellLabel', 't-save': 'save', 't-open': 'open',
      't-sbWalls': 'sbWalls', 't-sbStart': 'sbStart', 't-sbGoal': 'sbGoal',
      'sbClear': 'sbClear', 'sbRandom': 'sbRandom',
    };
    for (const id in map) { const n = $(id); if (n) n.textContent = t(map[id]); }
    $('sbSize').setAttribute('aria-label', t('sbSize'));
    renderSizes();
    $('langBtn').textContent = t('lang');
    $('connectBtn').textContent = port ? t('disconnect') : t('connect');
    if (!port) $('linkText').textContent = t('notConnected');
    $('runBtn').textContent = t('run');
    $('stepBtn').textContent = t('step');
    $('resetBtn').textContent = t('reset');
    renderLevels(); renderTask(); renderPalette(); renderProgram();
  }

  function setLink(cls, text) {
    $('linkState').className = 'link-state' + (cls ? ' ' + cls : '');
    $('linkText').textContent = text;
  }

  /* ---------------- persistence ---------------- */
  function saveProg() { progs[level().id] = prog; }
  function save() {
    if (SELFTEST) return;                 /* the self-test must not overwrite real work */
    try {
      localStorage.setItem(STORE, JSON.stringify({ lang, levelIx, progs, done, sandbox }));
    } catch (e) { /* private mode */ }
  }
  function load() {
    sandbox = sbFresh();
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!s) return;
      if (s.lang === 'de' || s.lang === 'en') lang = s.lang;
      if (typeof s.levelIx === 'number' && LEVELS[s.levelIx]) levelIx = s.levelIx;
      if (s.progs && typeof s.progs === 'object') progs = s.progs;
      if (s.done && typeof s.done === 'object') done = s.done;
      sandbox = sbRestore(s.sandbox);
    } catch (e) { /* ignore */ }
  }

  /* ---------------- wiring ---------------- */
  function cheer(node) {
    node.classList.remove('cheer');
    void node.offsetWidth;
    node.classList.add('cheer');
  }

  function init() {
    load();
    /* ?level=3 opens that task straight away - handy for a worksheet link */
    const want = /[?&]level=(\d+)/.exec(location.search);
    if (want) {
      const i = LEVELS.findIndex((lv) => lv.id === +want[1]);
      if (i >= 0) levelIx = i;
    }
    prog = progs[LEVELS[levelIx].id] || [];
    world = buildWorld(worldLevel(), 0);

    document.addEventListener('pointerdown', onPointerDown);
    $('maze').addEventListener('click', onMazeClick);
    $('maze').addEventListener('pointermove', onMazeHover);
    $('maze').addEventListener('pointerleave', () => drawHl(null));
    $('sbWalls').addEventListener('click', () => setTool('walls'));
    $('sbStart').addEventListener('click', () => setTool('start'));
    $('sbGoal').addEventListener('click', () => setTool('goal'));
    $('sbSize').addEventListener('change', (e) => setSize(+e.target.value));
    $('sbClear').addEventListener('click', sbClear);
    $('sbRandom').addEventListener('click', sbRandom);
    $('saveBtn').addEventListener('click', saveFile);
    $('openBtn').addEventListener('click', () => $('openFile').click());
    $('openFile').addEventListener('change', openFile);
    $('connectBtn').addEventListener('click', connect);
    $('langBtn').addEventListener('click', () => { lang = lang === 'de' ? 'en' : 'de'; save(); applyLang(); });
    $('runBtn').addEventListener('click', () => (session && $('runBtn').classList.contains('is-stop') ? stopRun() : runAll()));
    $('stepBtn').addEventListener('click', stepOnce);
    $('resetBtn').addEventListener('click', () => { resetRun(); hideVerdict(); });
    $('speed').addEventListener('input', drawBot);
    $('realChk').addEventListener('change', (e) => {
      if (e.target.checked && !port) { e.target.checked = false; say(t('botNeeded')); }
      else if (e.target.checked) say(tooBigForBot() ? t('botMax') : placeText());
      else hideVerdict();
    });
    $('brandBtn').addEventListener('click', (e) => { e.preventDefault(); cheer(e.currentTarget.querySelector('.brand-bot')); });
    $('cardBot').addEventListener('click', (e) => cheer(e.currentTarget));

    applyLang();
    drawMaze();
    syncTools();
    syncEdit();

    /* ?selftest plays a known solution for every level - see code-selftest.js */
    if (SELFTEST) {
      window.RRApp = {
        LEVELS,
        get prog() { return prog; },
        setProg(p) { prog = p; renderProgram(); },
        get world() { return world; },
        get lastResult() { return lastResult; },
        get done() { return Object.assign({}, done); },
        setFast(v) { fast = !!v; },
        clearResult() { lastResult = null; },
        goLevel, resetRun, runAll, countBlocks, starsFor,
        /* own maze: {n, walls, exits, goal}, checked like a stored one */
        setSandbox(m) {
          const c = m && sbClean(m, m.n);
          if (!c) return false;
          sandbox.n = m.n;
          sandbox.mazes[m.n] = c;
          syncTools();
          if (level().sandbox) sbChanged();
          return true;
        },
        randomize: sbRandom,
        /* one edit as a click would do it: tool 'walls' with {edge: "x,y,D"},
           tool 'start' or 'goal' with {cell: {x, y}} */
        edit(tool, spec) {
          const tgt = spec.edge ? { edge: sbEdge(spec.edge, sandbox.n) } : spec.cell ? { cell: spec.cell } : null;
          return applyEdit(tool, tgt && (tgt.cell || tgt.edge) ? tgt : null);
        },
        exportData, parseFile,
      };
      const s = document.createElement('script');
      s.src = 'code-selftest.js';
      document.body.append(s);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
