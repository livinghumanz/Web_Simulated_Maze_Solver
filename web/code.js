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
 *
 * Variables belong to one program (one scope per task): a list of names,
 * kept with the program. Their values live only here in the browser and
 * start at 0 on every run; the robot never hears about them. A condition is
 * either a sensor condition ('frontFree' ...) or a comparison {v, op, n}.
 *
 * Task 7 also has lists (items from 1), own blocks ("Meine Bausteine": a
 * name for a list of blocks, defined under the program, never using
 * itself) and the robot's map ("Karte": a number per cell and the walls it
 * has remembered), so a flood fill can be built from blocks. A number
 * field holds a number or a value read when the block runs: {v}, {len},
 * {p}. Profi-Woerter only changes the labels. See docs/code-editor.md.
 */
(function () {
  'use strict';

  const { BLOCKS, CONDITIONS, OPS, NUM_MIN, NUM_MAX, TEXT, LEVELS } = window.RRData;
  const $ = (id) => document.getElementById(id);
  const STORE = 'ratrocket.code';
  const MAX_ACTIONS = 400;
  const SELFTEST = /[?&]selftest/.test(location.search);
  const VAR_MAX = 12;                   /* variables per program */
  /* letters (with umlauts and sharp s) and digits, a letter first, 1..12 */
  const VAR_NAME = /^[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df][A-Za-z0-9\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df]{0,11}$/;
  /* own blocks: letters, digits and single spaces, a letter first, 1..16 */
  const FUNC_MAX = 8;
  /* lists: names like variables (one name space with them), at most 8 per
     program, at most 1000 items each */
  const LIST_MAX = 8, LIST_ITEMS = 1000;
  /* the thinking budget: 250 per cell to the 4th, at least 60000, at most
     two million (see maxThinks) */
  const THINK_MIN = 60000, THINK_PER = 250, THINK_CAP = 2000000;
  const FUNC_NAME = /^[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df](?:[A-Za-z0-9\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc\u00df]| (?! )){0,15}$/;

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
  let vars = [];                  /* the open program's variable names */
  let varsBy = {};                /* per level id, saved like progs */
  let varVals = new Map();        /* name -> value during and after a run */
  let lastChanged = null;         /* the variable that changed last (watch panel) */
  let shownLog = [];              /* what "zeige" showed in this run: [name, value] */
  let profi = false;              /* Profi-Woerter: real keywords on the blocks */
  let funcs = [];                 /* the open program's own blocks: [{name, body}] */
  let funcsBy = {};               /* per level id, saved like progs */
  let lists = [];                 /* the open program's list names */
  let listsBy = {};               /* per level id, saved like progs */
  let listVals = new Map();       /* name -> array of numbers during and after a run */
  let lastList = null;            /* {l, i}: the list item that changed last (watch panel) */

  /* a number for people: a real minus sign */
  const fmtNum = (n) => String(n).replace('-', '\u2212');

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
      goal: (v && v.goal) || lv.goal,              /* a variant may move the star */
      bot: { x: lv.start.x, y: lv.start.y, d: lv.start.d },
      angle: ANGLE[lv.start.d],      /* keeps turning, so 270->360 spins the short way */
      room: lv.goal === 'out' || !!lv.sandbox,     /* space round the maze to drive out */
      entered: inside(lv.start.x, lv.start.y),     /* own maze: a start outside comes in first */
      moves: 0, turns: 0,                          /* for the tournament counters */
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
      case 'repeatUntil':
        /* checks before every round; each check is one action, so a
           condition that never comes true still ends at the action budget */
        for (;;) {
          yield askFor(b);
          if (ctx.test(b.cond)) break;
          yield* runList(b.body, ctx);
        }
        break;
      case 'ifElse':
        yield askFor(b);                     /* read the sensors first */
        if (ctx.test(b.cond)) yield* runList(b.body, ctx);
        else yield* runList(b.alt, ctx);
        break;
      case 'setVar':    yield { act: 'var', op: 'set', b }; break;
      case 'changeVar': yield { act: 'var', op: 'change', b }; break;
      case 'showVar':   yield { act: 'show', b }; break;
      case 'listAdd': case 'listSet': case 'listGet': case 'listClear':
        yield { act: 'list', b };
        break;
      case 'mapWalls': yield { act: 'walls', b }; break;      /* asks the sensors */
      case 'mapClear': case 'mapSet': case 'mapGet':
        yield { act: 'map', b };
        break;
      case 'call': {
        /* an own block: one action to step in, then its body. Drops and
           files never let a block use itself; the depth guard only catches
           a hand-made loop. */
        const f = funcs.find((x) => x.name === b.f);
        if (!f) break;
        if (ctx.stack.length >= FUNC_MAX) throw runError('funcSelf');
        yield { act: 'tick', b };
        ctx.stack.push(b);
        yield* runList(f.body, ctx);
        ctx.stack.pop();
        break;
      }
      default: break;
    }
  }

  /* A mistake the program makes while it runs (a list index that does not
     exist ...): the run ends with this message instead of a crash. */
  const runError = (key, vars) => Object.assign(new Error(key), { run: true, key, vars });

  /* Conditions: a sensor string, a comparison {v, op, n}, a map string
     ('mapFront' ...: that side of the robot's cell open on its map) or a map
     question about any cell {x, y, dir}. */
  const MAP_CONDS = ['mapFront', 'mapRight', 'mapLeft'];
  const isCompare = (c) => !!c && typeof c === 'object' && 'op' in c;
  const isCellCond = (c) => !!c && typeof c === 'object' && 'dir' in c;
  const isSensor = (c) => typeof c === 'string' && CONDITIONS.includes(c);
  /* A sensor condition asks the robot (WALLS); everything else only looks
     at the browser's own memory - nothing is sent. */
  const askFor = (b) => (isSensor(b.cond) ? { act: 'sense', b } : { act: 'tick', b });
  const varVal = (name) => varVals.get(name) || 0;

  /* ---------------- operands ----------------
   * A number field holds a number, or a value read when the block runs:
   * {v} a variable, {len} how many items a list has, {p} where the robot
   * is: x, y, d (its direction 1 north, 2 east, 3 south, 4 west) - and sx,
   * sy where the star is (-1 without a star). */
  const listOf = (name) => listVals.get(name) || [];
  const POS = ['x', 'y', 'd', 'sx', 'sy'];
  const DIR_NUM = { N: 1, E: 2, S: 3, W: 4 };
  const NUM_DIR = [null, 'N', 'E', 'S', 'W'];
  function posVal(p) {
    const b = world.bot, g = isStar(world.goal) ? world.goal : null;
    return p === 'x' ? b.x : p === 'y' ? b.y : p === 'd' ? DIR_NUM[b.d]
         : p === 'sx' ? (g ? g.x : -1) : p === 'sy' ? (g ? g.y : -1) : 0;
  }
  function val(o) {
    if (typeof o === 'number') return o;
    if (!o || typeof o !== 'object') return 0;
    if ('v' in o) return varVal(o.v);
    if ('len' in o) return listOf(o.len).length;
    if ('p' in o) return posVal(o.p);
    return 0;
  }

  function compare(c) {
    const a = varVal(c.v), n = val(c.n);
    return c.op === '>' ? a > n : c.op === '<' ? a < n : a === n;
  }

  function makeCtx() {
    return {
      walls: null,                            /* robot mode: last WALLS reading */
      stack: [],                              /* the own blocks being run, outermost first */
      isOut() {                 /* out = outside the grid, after having been inside */
        return world.entered && !world.inside(world.bot.x, world.bot.y);
      },
      test(cond) {
        if (isCompare(cond)) return compare(cond);
        if (isCellCond(cond)) {
          const x = val(cond.x), y = val(cond.y);
          cellIndex(x, y);                     /* a cell that is not there: a message */
          return mapOpen(x, y, dirOf(val(cond.dir)));
        }
        if (MAP_CONDS.includes(cond)) {
          const b = world.bot;
          const side = cond === 'mapFront' ? b.d : cond === 'mapRight' ? RIGHT_OF[b.d] : LEFT_OF[b.d];
          return world.inside(b.x, b.y) && mapOpen(b.x, b.y, side);
        }
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

  /* One list block. Items are numbered from 1, like in Scratch; an index
     that is not there ends the run with a message that says how many
     items the list has. */
  function doList(b) {
    const arr = listVals.get(b.l) || [];
    listVals.set(b.l, arr);
    const at = (i) => {
      if (!Number.isInteger(i) || i < 1 || i > arr.length) {
        throw runError(!arr.length ? 'errEmpty' : arr.length === 1 ? 'errIndexOne' : 'errIndex', { l: b.l, i: fmtNum(i), k: arr.length });
      }
      return i - 1;
    };
    if (b.t === 'listAdd') {
      if (arr.length >= LIST_ITEMS) throw runError('errFull', { l: b.l });
      arr.push(val(b.n));
      lastList = { l: b.l, i: arr.length - 1 };
    } else if (b.t === 'listSet') {
      const k = at(val(b.i));
      arr[k] = val(b.n);
      lastList = { l: b.l, i: k };
    } else if (b.t === 'listGet') {
      const k = at(val(b.i));
      setVarValue(b.v, arr[k]);
    } else {
      arr.length = 0;
      lastList = { l: b.l, i: -1 };
    }
    if (b.t !== 'listGet') { lastChanged = null; paint('watch'); }
  }

  /* ---------------- the robot's map ("Karte") ----------------
   * The robot's own memory of the maze, empty at the start of every run:
   * a number per cell (-1 = empty; drawn faintly in the maze once the
   * program writes it) and the walls it has remembered. "merke Waende
   * hier" writes down what the three sensors see - front, left and right of
   * the cell it stands on: the drawing in the simulation, the WALLS answer
   * on the real robot. A wall it does not know counts as open (like the
   * robot's own flood fill); the border is always closed - the map ends
   * there. Cell (0,0) is bottom left. */
  let mapNums = [];                    /* y * n + x -> number, -1 = empty */
  let mapKnown = new Map();            /* "x,y,D" -> true wall / false open */
  let lastCell = -1;                   /* the number written last (drawn gold) */

  function resetMap() {
    const n = world ? world.n : 0;
    mapNums = new Array(n * n).fill(-1);
    mapKnown = new Map();
    lastCell = -1;
  }

  /* a cell's index, or a message if there is no such cell */
  function cellIndex(x, y) {
    const n = world.n;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= n || y >= n) {
      throw runError('errCell', { x: fmtNum(x), y: fmtNum(y), m: n - 1 });
    }
    return y * n + x;
  }
  /* 1..4 -> N E S W, or a message */
  function dirOf(r) {
    if (!NUM_DIR[r]) throw runError('errDir', { r: fmtNum(r) });
    return NUM_DIR[r];
  }

  /* one side of a cell, written down for both cells it divides */
  function remember(x, y, d, wall) {
    mapKnown.set(x + ',' + y + ',' + d, wall);
    const nx = x + DX[d], ny = y + DY[d];
    if (world.inside(nx, ny)) mapKnown.set(nx + ',' + ny + ',' + OPP[d], wall);
  }
  /* open on the map: inside the grid, and no remembered wall */
  function mapOpen(x, y, d) {
    if (!world.inside(x + DX[d], y + DY[d])) return false;
    return mapKnown.get(x + ',' + y + ',' + d) !== true;
  }

  function doMap(b) {
    if (b.t === 'mapClear') {
      mapNums.fill(-1);
      lastCell = -1;
    } else if (b.t === 'mapSet') {
      const k = cellIndex(val(b.x), val(b.y));
      mapNums[k] = val(b.n);
      lastCell = k;
    } else {
      const k = cellIndex(val(b.x), val(b.y));
      setVarValue(b.v, mapNums[k] === undefined ? -1 : mapNums[k]);
      return;
    }
    paint('map');
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

  /* Thinking and driving. Driving actions (fahre, drehe, a sensor question)
   * move or ask the robot. Thinking actions (variables, lists, comparisons,
   * stepping into an own block) only touch the browser's memory.
   * A short row of thinking is shown block by block, as always. A program
   * that thinks a lot (a flood fill: hundreds of blocks per cell) gets the
   * "Denk-Turbo" once a row of more than THINK_STREAK thinking blocks
   * happens: from then on thinking is quiet - the watch panel and the map
   * are painted a few times a second, not after every block - and as fast
   * as the Tempo slider allows (slowest: 25 ms a block, so the flood can be
   * watched; from the middle on at once). Driving never changes. */
  const THINK_ACTS = new Set(['tick', 'var', 'show', 'list', 'map']);
  const THINK_STREAK = 12;
  const QUICK_MS = [25, 6, 0, 0, 0];
  let quiet = false;                     /* this action paints later */
  const dirty = { watch: false, map: false };
  let pendingBubble = null;

  /* the watch panel (and later the map) now, or at the next catch-up */
  function paint(what) {
    if (quiet) { dirty[what] = true; return; }
    if (what === 'watch') renderWatch(); else drawMapLayer();
  }
  function flushPaint() {
    if (dirty.watch) { dirty.watch = false; renderWatch(); }
    if (dirty.map) { dirty.map = false; drawMapLayer(); }
    if (pendingBubble != null) { const s = pendingBubble; pendingBubble = null; showBubble(s); }
  }
  /* after quiet thinking: paint, and mark the block the program is at */
  function catchUp() {
    flushPaint();
    if (session && session.hl) highlight(session.hl, session.ctx.stack);
  }

  /* One action. Returns true, false (a wall, or the robot refused), or
   * 'silent': the real robot did not answer in time. Every move and turn
   * that happened is counted for the tournament (world.moves, world.turns). */
  /* the robot's answer to WALLS: F=mm L=mm R=mm, "(wall)" after a side it calls a wall */
  const WALLS_RE = /^WALLS: F=(\d+)(\(wall\))? L=(\d+)(\(wall\))? R=(\d+)(\(wall\))?/;
  let timeScale = 1;                       /* the self-test shortens the waits */
  async function perform(a, ctx) {
    const real = $('realChk').checked && port && !tooBigForBot();
    const pause = (k) => (real || quiet ? null : sleep(stepMs() * k));

    if (a.act === 'tick') { return true; }

    /* variables and lists live here in the browser: nothing goes to the robot */
    if (a.act === 'var') {
      const b = a.b;
      setVarValue(b.v, a.op === 'set' ? val(b.n) : varVal(b.v) + val(b.n));
      await pause(0.45);
      return true;
    }
    if (a.act === 'show') {
      const v = varVal(a.b.v);
      shownLog.push([a.b.v, v]);
      if (quiet) { dirty.watch = true; pendingBubble = a.b.v + ': ' + v; return true; }
      renderWatch();
      showBubble(a.b.v + ': ' + v);
      await pause(0.6);
      return true;
    }
    if (a.act === 'list') {
      doList(a.b);
      await pause(0.45);
      return true;
    }
    if (a.act === 'map') {
      doMap(a.b);
      await pause(0.45);
      return true;
    }

    /* "merke Waende hier": front, left and right of the robot's cell go
       into its map - from the drawing, or from the real robot's WALLS */
    if (a.act === 'walls') {
      const b = world.bot;
      if (!world.inside(b.x, b.y)) return true;          /* outside the maze: no cell to note */
      let seen;
      if (real) {
        send('WALLS');
        const m = await expect(WALLS_RE, 4000 * timeScale);
        if (!m) return 'silent';
        seen = { front: !!m[2], left: !!m[4], right: !!m[6] };
      } else {
        seen = { front: !openSide(world, b.d), left: !openSide(world, LEFT_OF[b.d]), right: !openSide(world, RIGHT_OF[b.d]) };
      }
      remember(b.x, b.y, b.d, seen.front);
      remember(b.x, b.y, LEFT_OF[b.d], seen.left);
      remember(b.x, b.y, RIGHT_OF[b.d], seen.right);
      paint('map');
      if (!real) await sleep(stepMs() * 0.45);
      return true;
    }

    if (a.act === 'sense') {
      if (real) {
        send('WALLS');
        const m = await expect(WALLS_RE, 4000 * timeScale);
        if (!m) return 'silent';
        ctx.walls = { front: !!m[2], left: !!m[4], right: !!m[6] };
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
        const m = await expect(/^TURN (done|rejected)/, 12000 * timeScale);
        if (!m) return 'silent';
        if (m[1] !== 'done') return false;
      }
      world.turns++;
      drawBot();
      if (!real) await sleep(stepMs() * 0.8);
      return true;
    }

    if (a.act === 'move') {
      const canGo = openSide(world, world.bot.d);
      if (real) {
        send('CELL');
        const m = await expect(/^CELL (done|failed)/, 15000 * timeScale);
        if (!m) return 'silent';
        if (m[1] !== 'done') return false;
      } else if (!canGo) {
        return false;
      }
      const from = { x: world.bot.x, y: world.bot.y };
      hideBubble();
      world.bot.x += DX[world.bot.d];
      world.bot.y += DY[world.bot.d];
      if (world.inside(world.bot.x, world.bot.y)) world.entered = true;
      world.moves++;
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
  /* Every run - and every maze of a level with variants - starts with all
     variables at 0 and all lists empty. */
  function startSession() {
    const ctx = makeCtx();
    resetVars();
    session = { gen: runList(prog, ctx), ctx, actions: 0, thinks: 0, streak: 0, turbo: false,
                burst: 0, yieldAt: 0, hl: null, alive: true };
    return session;
  }

  async function advance() {
    if (!session || !session.alive) return false;
    let step, ok;
    try { step = session.gen.next(); }
    catch (e) { if (e && e.run) { finish(false, e.key, e.vars); return false; } throw e; }
    const { value, done: d } = step;
    if (d) { programEnded(); return false; }
    /* two runaway guards: one for driving, a far bigger one for thinking */
    const think = THINK_ACTS.has(value.act);
    if (think) {
      if (++session.thinks > maxThinks()) { finish(false, 'failedLong'); return false; }
      if (++session.streak > THINK_STREAK) session.turbo = true;
    } else {
      if (++session.actions > maxActions()) { finish(false, 'failedLong'); return false; }
      session.streak = 0;
    }
    const s = session;
    quiet = think && s.turbo;
    s.hl = value.b;
    if (!quiet) { flushPaint(); highlight(value.b, s.ctx.stack); }
    try { ok = await perform(value, s.ctx); }
    catch (e) { quiet = false; if (e && e.run && session === s && s.alive) { finish(false, e.key, e.vars); return false; } throw e; }
    if (quiet) {
      quiet = false;
      const ms = fast ? 0 : QUICK_MS[($('speed').value | 0) - 1] || 0;
      if (ms) { catchUp(); await sleep(ms); }
      else if (++s.burst >= 20000 || performance.now() - s.yieldAt > 40) {
        s.burst = 0;
        catchUp();
        await sleep(0);                  /* let the page breathe: Stopp, the panels */
        s.yieldAt = performance.now();
      }
    }
    if (!session || !session.alive) return false;
    if (ok === 'silent') { finish(false, 'botSilent'); return false; }
    if (!ok) { finish(false, 'failedWall'); return false; }
    if (!level().endOnStar && reachedGoal()) { finish(true); return false; }
    return true;
  }

  /* The program has run to its end. Most tasks are lost by then (a win
   * stops the run at the goal). Tasks with endOnStar are judged now: the
   * robot must stand on the star - and, with cells, have driven exactly that
   * many cells; with countCells, a variable must hold the cells driven. */
  function programEnded() {
    const lv = level();
    if (!lv.endOnStar) { finish(false); return; }
    if (!reachedGoal()) { finish(false, 'failedOffStar'); return; }
    const moves = world.moves;
    if (lv.cells && moves !== lv.cells) { finish(false, 'failedCells', { n: moves, k: lv.cells }); return; }
    if (lv.countCells && !vars.some((v) => varVal(v) === moves)) { finish(false, 'failedCount', { n: moves }); return; }
    finish(true);
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
   * tasks keep the old 400. Thinking has its own, far bigger budget: a
   * flood fill thinks hundreds of blocks per cell driven (measured in the
   * self-test), and a thinking loop that never ends still stops within a
   * few seconds. */
  const maxActions = () => Math.max(MAX_ACTIONS, 16 * world.n * world.n + 50);
  const maxThinks = () => Math.min(THINK_CAP, Math.max(THINK_MIN, THINK_PER * Math.pow(world.n, 4)));

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
    catchUp();                       /* a step always shows everything */
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
    syncVarCtl();
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
    resetVars();
    drawMaze();
    syncEdit();
    syncVarCtl();
  }

  let lastResult = null;
  let lastStats = null;
  let lastThinks = 0;                       /* thinking actions of the last run (self-test) */

  /* What the tournament counts (docs/curriculum/anhang-turnier.md): blocks,
   * cells driven, turns (all three turn blocks alike), and the drive-time
   * points: 10 per cell, 8 per turn. */
  function runStats() {
    const moves = world.moves, turns = world.turns;
    return { blocks: countAll(), moves, turns, points: 10 * moves + 8 * turns };
  }

  function finish(win, failKey, failVars) {
    lastResult = { win: !!win, reason: failKey || (win ? 'goal' : 'failedEnd') };
    lastStats = runStats();
    quiet = false;
    flushPaint();                    /* what the quiet thinking left unpainted */
    lastThinks = session ? session.thinks : 0;
    if (session) session.alive = false;
    session = null;
    highlight(null);
    setRunning(false);

    const lv = level();
    if (win && lv.variants && variantIx < lv.variants.length) {
      variantIx++;                                    /* same program, next maze */
      world = buildWorld(lv, variantIx);
      drawMaze();
      const of = lv.variants.length + 1;
      if ($('realChk').checked && port) {
        /* a real robot never starts on its own: the pupil rebuilds the maze,
           puts the robot back on the start, then presses Weiter */
        say(t('solvedNext', { i: variantIx, n: of }), 'win', 'goOn', lastStats);
      } else {
        say(t('solved') + ' ' + variantIx + '/' + of, 'win', null, lastStats);
        nextMaze = setTimeout(() => { nextMaze = null; startSession(); runAll(); }, 900);
      }
      return;
    }
    if (win && lv.sandbox) {                          /* own maze: no stars, just the count */
      const used = countAll();
      say(t('solvedBlocks', { n: used, b: blocksWord(used) }), 'win', null, lastStats);
      celebrate();
    } else if (win) {
      const stars = starsFor(countAll(), lv.par);
      done[lv.id] = Math.max(done[lv.id] || 0, stars);
      save();
      renderLevels();
      renderTask();                                   /* the header shows the new stars */
      say(t('solvedStars', { n: stars }), 'win', levelIx < LEVELS.length - 1 ? 'next' : null, lastStats);
      celebrate();
    } else {
      say(t(failKey || 'failedEnd', failVars), 'lose', 'again', lastStats);
    }
  }

  /* ["6 Bausteine", "5 Felder", "3 Drehungen", "74 Fahrzeit-Punkte"] */
  function statsParts(s) {
    const w = (n, one, many) => n + ' ' + t(n === 1 ? one : many);
    return [w(s.blocks, 'blockOne', 'blocksUsed'), w(s.moves, 'cellOne', 'cellMany'),
            w(s.turns, 'turnOne', 'turnMany'), s.points + ' ' + t('points')];
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

  /* What the program costs, for stars and counters: every block once where
     it stands. An own block counts 1 for its "definiere" head plus the
     blocks inside it - once, however often it is used - and every use
     counts 1. So an own block never beats a loop: a body of b blocks used k
     times costs 1 + b + k, written out k * b. */
  function countAll() {
    let n = countBlocks(prog);
    for (const f of funcs) n += 1 + countBlocks(f.body);
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
    svg.append(el('g', { id: 'mapKnown', class: 'map-known' }));  /* the walls the robot's map remembers */
    if (n <= 12) {
      for (let x = 0; x <= n; x++) for (let y = 0; y <= n; y++) {
        svg.append(el('circle', { cx: pad + x * cs, cy: pad + y * cs, r: 2.6, class: 'pad-dot' }));
      }
    }

    svg.append(el('g', { id: 'editHl' }));         /* own maze: what a click would change */
    svg.append(el('polyline', { id: 'trailLine', points: '', class: 'trail' }));
    updateTrail(svg);
    svg.append(el('g', { id: 'mapNums', class: 'map-nums' }));   /* ... and its numbers, over the trail */
    drawMapLayer();

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

  /* The robot's map in the maze: every number the program has written,
     faint in its cell (the one written last in gold), and every wall it
     has remembered as a thin gold line on that wall. Numbers only while
     cells are big enough to read them. */
  function drawMapLayer() {
    const nums = $('mapNums'), known = $('mapKnown');
    if (!nums || !known || !world) return;
    nums.textContent = '';
    known.textContent = '';
    const { n, cs } = geom();
    if (cs >= 14) {
      const fs = Math.max(9, Math.min(26, cs * 0.36));
      for (let k = 0; k < mapNums.length && k < n * n; k++) {
        if (mapNums[k] === -1 || mapNums[k] === undefined) continue;
        const [cx, cy] = centre(k % n, Math.floor(k / n));
        const tx = el('text', { x: cx.toFixed(1), y: cy.toFixed(1), 'font-size': fs.toFixed(1),
                                class: 'map-num' + (k === lastCell ? ' is-new' : '') });
        tx.textContent = fmtNum(mapNums[k]);
        nums.append(tx);
      }
    }
    let d = '';
    for (const [key, wall] of mapKnown) {
      if (!wall) continue;
      const [x, y, side] = key.split(',');
      const nx = +x + DX[side], ny = +y + DY[side];
      if ((side === 'S' || side === 'W') && world.inside(nx, ny)) continue;   /* each wall once */
      const s = edgeSeg(+x, +y, side).map((v) => +v.toFixed(1));
      d += 'M' + s[0] + ' ' + s[1] + 'L' + s[2] + ' ' + s[3];
    }
    if (d) known.append(el('path', { d, class: 'map-wall' }));
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

  /* "zeige": a speech bubble over the robot with the value. It stays until
     the robot drives on, the next "zeige", or about one and a half seconds. */
  let bubbleTimer = null;
  function showBubble(text) {
    hideBubble();
    const svg = $('maze');
    const { cs } = geom();
    const [cx, cy] = centre(world.bot.x, world.bot.y);
    const fs = 17, h = 30, tail = 7;
    const g = el('g', { id: 'bubble', class: 'bubble' });
    const txt = el('text', { 'font-size': fs, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    txt.textContent = text;
    g.append(txt);
    svg.append(g);
    let w = 0;
    try { w = txt.getComputedTextLength(); } catch (e) { w = 0; }
    w = Math.max(40, (w || text.length * fs * 0.55) + 22);
    const left = Math.max(3, Math.min(400 - w - 3, cx - w / 2));
    const top = Math.max(3, cy - cs * 0.46 - h - tail);
    const tx = Math.max(left + 10, Math.min(left + w - 10, cx));
    g.insertBefore(el('path', { class: 'bubble-box', d:
      'M' + (left + 8) + ' ' + top + 'H' + (left + w - 8) + 'Q' + (left + w) + ' ' + top + ' ' + (left + w) + ' ' + (top + 8) +
      'V' + (top + h - 8) + 'Q' + (left + w) + ' ' + (top + h) + ' ' + (left + w - 8) + ' ' + (top + h) +
      'H' + (tx + 6) + 'L' + tx + ' ' + (top + h + tail) + 'L' + (tx - 6) + ' ' + (top + h) +
      'H' + (left + 8) + 'Q' + left + ' ' + (top + h) + ' ' + left + ' ' + (top + h - 8) +
      'V' + (top + 8) + 'Q' + left + ' ' + top + ' ' + (left + 8) + ' ' + top + 'Z' }), txt);
    txt.setAttribute('x', (left + w / 2).toFixed(1));
    txt.setAttribute('y', (top + h / 2 + 1).toFixed(1));
    bubbleTimer = setTimeout(hideBubble, Math.max(1500, stepMs() * 2.5));
  }
  function hideBubble() {
    clearTimeout(bubbleTimer);
    const b = $('bubble');
    if (b) b.remove();
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
  const clampNum = (v) => Math.min(NUM_MAX, Math.max(NUM_MIN, Math.round(v)));
  const stopDrag = (node) => { node.addEventListener('pointerdown', (e) => e.stopPropagation()); return node; };

  function makeSelect(cls, options, value, onChange) {
    const sel = stopDrag(document.createElement('select'));
    sel.className = cls;
    for (const item of options) {
      if (item.group) {
        const g = document.createElement('optgroup');
        g.label = item.group;
        for (const o of item.options) g.append(option(o, value));
        sel.append(g);
      } else {
        sel.append(option(item, value));
      }
    }
    sel.addEventListener('change', (e) => onChange(e.target.value));
    return sel;
  }
  function option(o, value) {
    const n = document.createElement('option');
    n.value = o.value; n.textContent = o.text; n.selected = o.value === value;
    return n;
  }

  /* A number from -999 to 999 (setze, aendere, comparisons): type it, or
     step it with - and +. In the palette and the drag ghost just the value. */
  function numField(get, set, live) {
    const wrap = document.createElement('span');
    wrap.className = 'num num-var';
    if (!live) {
      const val = document.createElement('output'); val.textContent = String(get()).replace('-', '\u2212');
      wrap.append(val);
      return wrap;
    }
    const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '\u2212';
    const inp = stopDrag(document.createElement('input'));
    inp.className = 'num-in';
    inp.type = 'text';
    inp.inputMode = 'numeric';
    inp.maxLength = 4;
    inp.value = get();
    inp.setAttribute('aria-label', t('numLabel'));
    const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+';
    minus.addEventListener('click', (e) => { e.stopPropagation(); set(clampNum(get() - 1)); renderProgram(); });
    plus.addEventListener('click', (e) => { e.stopPropagation(); set(clampNum(get() + 1)); renderProgram(); });
    inp.addEventListener('input', () => {
      const v = parseInt(inp.value.replace('\u2212', '-'), 10);
      if (Number.isFinite(v)) set(clampNum(v));
    });
    inp.addEventListener('change', () => renderProgram());
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    wrap.append(minus, inp, plus);
    return wrap;
  }

  /* The program's variables to pick from (and the block's own one, should
     it be missing from the list). */
  function varOptions(current) {
    const names = vars.slice();
    if (current && !names.includes(current)) names.push(current);
    return names.map((v) => ({ value: v, text: v }));
  }
  function listOptions(current) {
    const names = lists.slice();
    if (current && !names.includes(current)) names.push(current);
    return names.map((v) => ({ value: v, text: v }));
  }

  /* ---------------- number fields and values ----------------
   * A number field (setze, aendere, the list blocks, a comparison) holds a
   * number - typed, or stepped with - and + - or a value that is read when
   * the block runs: a variable, or how many items a list has. The little
   * picker next to the number chooses one; a value pill from the box can
   * also be dropped on the field. Stored as a number, {v} or {len}. */
  const opKey = (o) => (typeof o === 'number' ? '#' : 'v' in o ? 'v:' + o.v : 'len' in o ? 'len:' + o.len : 'p:' + o.p);
  function opFromKey(k) {
    if (k === '#') return 0;
    const i = k.indexOf(':'), kind = k.slice(0, i), name = k.slice(i + 1);
    return kind === 'v' ? { v: name } : kind === 'len' ? { len: name } : { p: name };
  }
  /* words in the chosen language; Profi-Woerter has its own for some */
  const wordsOf = (key, v) => (profi && TEXT[lang] && TEXT[lang]['p_' + key] ? t('p_' + key, v) : t(key, v));
  function opText(o) {
    if (typeof o === 'number') return fmtNum(o);
    if ('v' in o) return o.v;
    if ('len' in o) return wordsOf('o_len', { l: o.len });
    return wordsOf('o_' + o.p);
  }

  /* A picker as wide as what it shows, not as its longest choice: the text
     measured in the block font, plus padding and the arrow. */
  let measureCtx = null;
  function fitSelect(sel) {
    const o = sel.selectedOptions[0];
    if (!o) return;
    let w = 0;
    try {
      measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
      measureCtx.font = '500 15px Fredoka, "Trebuchet MS", system-ui, sans-serif';
      w = measureCtx.measureText(o.textContent).width;
    } catch (e) { w = 0; }
    sel.style.width = w ? Math.ceil(w + 40) + 'px' : 'calc(' + Math.max(2, o.textContent.length) + 'ch + 40px)';
  }

  /* what the picker offers: a number, the variables, the list lengths */
  function opChoices(cur) {
    const groups = [{ group: t('opNumber'), options: [{ value: '#', text: t('opNumber') }] }];
    const vs = vars.slice();
    if (cur && 'v' in cur && !vs.includes(cur.v)) vs.push(cur.v);
    if (vs.length) groups.push({ group: t('condVars'), options: vs.map((v) => ({ value: 'v:' + v, text: v })) });
    const ls = lists.slice();
    if (cur && 'len' in cur && !ls.includes(cur.len)) ls.push(cur.len);
    if (ls.length) groups.push({ group: t('cat_list'), options: ls.map((l) => ({ value: 'len:' + l, text: opText({ len: l }) })) });
    if (hasMap() || (cur && 'p' in cur)) groups.push({ group: t('opRobot'), options: POS.map((p) => ({ value: 'p:' + p, text: opText({ p }) })) });
    return groups;
  }
  /* the map blocks (and the robot's position as a value) are in this task's box */
  const hasMap = () => level().allow.includes('mapWalls');

  /* one number field; slot = {p: block path, k: key, c: 1 if in the
     condition} - where a dropped value pill goes */
  function opField(host, key, live, slot) {
    const o = host[key];
    let node;
    if (typeof o === 'number') {
      node = numField(() => host[key], (v) => { host[key] = v; }, live);
      if (live && (vars.length || lists.length || hasMap())) {
        const pick = makeSelect('op-src', opChoices(null), '#', (val) => { host[key] = opFromKey(val); renderProgram(); });
        pick.title = t('opPick');
        pick.setAttribute('aria-label', t('opPick'));
        node.append(pick);
      }
    } else if (!live) {
      node = document.createElement('span');
      node.className = 'cond cond-pill op-pill';
      node.textContent = opText(o);
    } else {
      node = makeSelect('cond var-pick op-val', opChoices(o), opKey(o), (val) => { host[key] = opFromKey(val); renderProgram(); });
      fitSelect(node);
    }
    if (live && slot) node.dataset.slot = JSON.stringify(slot);
    return node;
  }

  /* The condition: one picker for the six sensor conditions and the
     variables; a variable adds the comparison (= > <) and its number. */
  function condNodes(b, live, path) {
    const c = b.cond;
    const slot = (k) => path && { p: path, k, c: 1 };
    if (!live && (isCompare(c) || isCellCond(c))) {   /* palette and drag ghost: one compact pill */
      const pill = document.createElement('span');
      pill.className = 'cond cond-pill';
      pill.textContent = isCompare(c) ? c.v + ' ' + c.op + ' ' + opText(c.n)
        : t('c_mapCell') + ' ' + t('c_mapCellT').replace('{x}', opText(c.x)).replace('{y}', opText(c.y)).replace('{r}', opText(c.dir));
      return [pill];
    }
    const cur = isCompare(c) ? '#' + c.v : isCellCond(c) ? '@cell' : c;
    const items = [{ group: t('condSensors'), options: CONDITIONS.map((k) => ({ value: k, text: t('c_' + k) })) }];
    if (hasMap() || MAP_CONDS.includes(c) || isCellCond(c)) {
      items.push({ group: t('cat_map'), options: MAP_CONDS.map((k) => ({ value: k, text: t('c_' + k) }))
        .concat([{ value: '@cell', text: t('c_mapCell') }]) });
    }
    const names = varOptions(isCompare(c) ? c.v : null);
    if (names.length) items.push({ group: t('condVars'), options: names.map((o) => ({ value: '#' + o.value, text: o.text })) });
    const sel = makeSelect('cond', items, cur, (val) => {
      if (val.charAt(0) === '#') {
        const old = isCompare(b.cond) ? b.cond : null;
        b.cond = { v: val.slice(1), op: old ? old.op : '=', n: old ? old.n : 5 };
      } else if (val === '@cell') {
        b.cond = { x: 0, y: 0, dir: 1 };      /* Feld 0 0 nach 1 (Norden) offen */
      } else {
        b.cond = val;
      }
      renderProgram();
    });
    if (live) fitSelect(sel);
    if (isCellCond(c)) {
      /* "Feld x y nach r offen": three number fields after the picker */
      const out = [sel];
      for (const part of t('c_mapCellT').split(/(\{[xyr]\})/)) {
        if (part === '{x}' || part === '{y}') out.push(opField(c, part.charAt(1), live, slot(part.charAt(1))));
        else if (part === '{r}') out.push(opField(c, 'dir', live, slot('dir')));
        else if (part) out.push(document.createTextNode(part));
      }
      return out;
    }
    if (!isCompare(c)) return [sel];
    const op = makeSelect('cond cond-op', OPS.map((o) => ({ value: o, text: o })), c.op, (val) => { c.op = val; renderProgram(); });
    return [sel, op, opField(c, 'n', live, slot('n'))];
  }

  /* A block's label template. Profi-Woerter puts the keywords of real
     programming languages on the blocks ([if], [repeat] ...); a block
     without a p_ label keeps its normal one. Only the label changes -
     never the program, the help texts or the tasks. */
  function labelOf(key) {
    const pro = profi && TEXT[lang] && TEXT[lang]['p_' + key];
    return pro || t('b_' + key);
  }

  /* "[if]" -> a keyword, drawn as code */
  function keyword(p) {
    const k = document.createElement('span');
    k.className = 'kw';
    k.textContent = p.slice(1, -1);
    return k;
  }

  /* {n} {i} {x} {y}: number fields; {v} a variable, {l} a list, {c} the
     condition, {f} an own block's name; [..] a keyword */
  function labelNodes(b, template, live, path) {
    const out = [];
    const def = BLOCKS[b.t];
    const parts = template.split(/(\{[a-z]\}|\[[^\]]+\])/);
    for (const p of parts) {
      const key = p.length === 3 && p.charAt(0) === '{' ? p.charAt(1) : null;
      if (p.charAt(0) === '[') {
        out.push(keyword(p));
      } else if (key === 'f') {
        const s = document.createElement('span'); s.className = 'fname'; s.textContent = b.f;
        out.push(s);
      } else if (key === 'n' && def.count) {
        const wrap = document.createElement('span');
        wrap.className = 'num';
        const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '\u2212';
        const val = document.createElement('output'); val.textContent = b.n;
        const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+';
        minus.addEventListener('click', (e) => { e.stopPropagation(); b.n = Math.max(1, b.n - 1); renderProgram(); });
        plus.addEventListener('click', (e) => { e.stopPropagation(); b.n = Math.min(9, b.n + 1); renderProgram(); });
        wrap.append(minus, val, plus);
        out.push(wrap);
      } else if (key && def.ops && key in def.ops) {
        out.push(opField(b, key, live, path && { p: path, k: key }));
      } else if (key === 'v') {
        const vs = makeSelect('cond var-pick', varOptions(b.v), b.v, (val) => { b.v = val; renderProgram(); });
        if (live) fitSelect(vs);
        out.push(vs);
      } else if (key === 'l') {
        const ls = makeSelect('cond var-pick list-pick', listOptions(b.l), b.l, (val) => { b.l = val; renderProgram(); });
        if (live) fitSelect(ls);
        out.push(ls);
      } else if (key === 'c') {
        out.push(...condNodes(b, live, path));
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
    if (def.f) node.dataset.f = b.f;
    if (path) node.dataset.path = JSON.stringify(path);
    node.dataset.live = live ? '1' : '';

    const row = document.createElement('div');
    row.className = 'row';
    const gl = document.createElement('span'); gl.className = 'glyph'; gl.textContent = def.glyph;
    const lb = document.createElement('span'); lb.className = 'lbl';
    lb.append(...labelNodes(b, labelOf(b.t), live, path));
    row.append(gl, lb);
    node.append(row);

    if (def.body) {
      node.append(armFor(b.body, path, 'body', live));
      if (def.alt) {
        const mid = document.createElement('div');
        mid.className = 'mid';
        const s = document.createElement('span'); s.className = 'lbl';
        s.append(...labelNodes(b, labelOf('else'), live));
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

  /* An own block's definition, under the program: "definiere Name" with a
     belly that takes blocks like any other (its blocks have paths that
     start below 0: -1 is the first own block). x deletes it if unused. */
  function renderDef(f, k) {
    const node = document.createElement('div');
    node.className = 'blk cat-func has-body def';
    node.dataset.def = f.name;
    const row = document.createElement('div');
    row.className = 'row';
    const gl = document.createElement('span'); gl.className = 'glyph'; gl.textContent = BLOCKS.call.glyph;
    const lb = document.createElement('span'); lb.className = 'lbl';
    lb.append(...labelNodes({ t: 'call', f: f.name }, labelOf('def'), false));
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'def-del'; del.textContent = '\u00d7';
    del.setAttribute('aria-label', t('funcDel', { f: f.name }));
    del.addEventListener('click', () => deleteFunc(f.name));
    row.append(gl, lb, del);
    const foot = document.createElement('div'); foot.className = 'foot';
    node.append(row, armFor(f.body, [-(k + 1)], 'body', true), foot);
    return node;
  }

  /* A value pill in the box ("Laenge von Weg"): drag it onto a number field
     in the program. */
  function valuePill(o, cat) {
    const p = document.createElement('span');
    p.className = 'val-pill cat-' + cat;
    p.dataset.op = JSON.stringify(o);
    p.textContent = opText(o);
    return p;
  }

  const PALETTE_CATS = ['move', 'loop', 'decide', 'var', 'list', 'map', 'func'];
  const CAT_INFO = { var: 'i_vars', list: 'i_lists', map: 'i_map', func: 'i_funcs' };

  function renderPalette() {
    const host = $('paletteList');
    host.textContent = '';
    const allow = level().allow;
    const groups = {};
    for (const type of allow) (groups[BLOCKS[type].cat] ||= []).push(type);
    for (const cat of PALETTE_CATS) {
      if (!groups[cat]) continue;
      const g = document.createElement('div');
      g.className = 'cat cat-' + cat;
      const h = document.createElement('div'); h.className = 'cat-name'; h.textContent = t('cat_' + cat);
      const box = document.createElement('div'); box.className = 'cat-blocks';
      if (CAT_INFO[cat]) {
        const i = document.createElement('button');
        i.className = 'info'; i.textContent = 'i'; i.dataset.tipKey = CAT_INFO[cat]; i.setAttribute('aria-label', 'Info');
        h.append(' ', i);
      }
      if (cat === 'var' || cat === 'list' || cat === 'func') box.append(nameTools(cat));
      if (cat === 'func') {
        for (const f of funcs) box.append(renderBlock({ t: 'call', f: f.name }, null, false));
      } else {
        /* a block that needs a variable or a list appears once there is one */
        for (const type of groups[cat]) {
          const def = BLOCKS[type];
          if ((def.v && !vars.length) || (def.l && !lists.length)) continue;
          box.append(renderBlock(freshBlock(type), null, false));
        }
      }
      if (cat === 'list' && lists.length) {
        const pills = document.createElement('div');
        pills.className = 'val-pills';
        for (const l of lists) pills.append(valuePill({ len: l }, 'list'));
        box.append(pills);
      }
      if (cat === 'map') {                       /* where the robot is, where the star is */
        const pills = document.createElement('div');
        pills.className = 'val-pills';
        for (const p of POS) pills.append(valuePill({ p }, 'map'));
        box.append(pills);
      }
      g.append(h, box);
      host.append(g);
    }
    syncVarCtl();
  }

  function freshBlock(type, f) {
    const def = BLOCKS[type];
    const b = { t: type };
    if (def.f) b.f = f || '';
    if (def.count) b.n = def.countDefault;
    if (def.v) b.v = vars[0] || '';
    if (def.l) b.l = lists[0] || '';
    if (def.ops) for (const k in def.ops) b[k] = def.ops[k];
    if (def.cond) b.cond = def.condDefault;
    /* "wiederhole bis" counts to 5 when there is a variable to count with */
    if (type === 'repeatUntil' && vars.length) b.cond = { v: vars[0], op: '=', n: 5 };
    if (def.body) b.body = [];
    if (def.alt) b.alt = [];
    return b;
  }

  /* ---------------- names: variables, lists and own blocks ----------------
   * The Variablen, Listen and Meine Bausteine boxes share one small tool:
   * "Neue Variable" / "Neue Liste" / "Neuer Baustein" opens a name field right in the palette
   * (no browser prompt), with a suggestion and the name rules; OK stays off
   * while the name is wrong, and the reason shows under the field. A name
   * is unique, case does not count.
   * Variables: letters and digits, a letter first, up to 12; at most 12;
   * chips with x delete one, but only while no block uses it.
   * Lists: named like variables, in one name space with them (a list and a
   * variable never share a name); at most 8; chips like variables.
   * Own blocks: letters, digits and single spaces, up to 16; at most 8;
   * the x on the definition deletes one, again only while unused. */
  let formOpen = null;            /* whose name field is open: 'var', 'list', 'func' or null */
  const toolMsg = { var: '', list: '', func: '' };

  /* list given (a file, localStorage): only that list counts; otherwise
     the program's variables and lists */
  function varNameProblem(name, list) {
    if (!VAR_NAME.test(name)) return 'varBad';
    const low = name.toLowerCase();
    if ((list || vars.concat(lists)).some((v) => v.toLowerCase() === low)) return 'varTaken';
    if ((list || vars).length >= VAR_MAX) return 'varFull';
    return null;
  }

  function listNameProblem(name, list) {
    if (typeof name !== 'string' || !VAR_NAME.test(name)) return 'varBad';
    const low = name.toLowerCase();
    if ((list || lists.concat(vars)).some((v) => v.toLowerCase() === low)) return 'varTaken';
    if ((list || lists).length >= LIST_MAX) return 'listFull';
    return null;
  }

  function funcNameProblem(name, list) {
    if (typeof name !== 'string' || name !== name.trim() || !FUNC_NAME.test(name)) return 'funcBad';
    const names = list || funcs.map((f) => f.name);
    const low = name.toLowerCase();
    if (names.some((v) => v.toLowerCase() === low)) return 'varTaken';
    if (names.length >= FUNC_MAX) return 'funcFull';
    return null;
  }

  /* what each kind of name needs */
  const KIND = {
    var: { problem: (n) => varNameProblem(n), add: (n) => addVar(n), max: 12, suggest: 'varSuggest', sep: '',
           btn: 'newVarBtn', input: 'varNameIn', newKey: 'newVar', nameKey: 'varName' },
    list: { problem: (n) => listNameProblem(n), add: (n) => addList(n), max: 12, suggest: 'listSuggest', sep: '',
            btn: 'newListBtn', input: 'listNameIn', newKey: 'newList', nameKey: 'listName' },
    func: { problem: (n) => funcNameProblem(n), add: (n) => addFunc(n), max: 16, suggest: 'funcSuggest', sep: ' ',
            btn: 'newFuncBtn', input: 'funcNameIn', newKey: 'newFunc', nameKey: 'funcName' },
  };
  const tidyName = (s) => s.replace(/\s+/g, ' ').trim();

  /* the suggestion: Schritte, then Zaehler, then Zaehler2 ...; own blocks:
     Mein Baustein, then Mein Baustein 2 ... */
  function suggestName(kind) {
    const k = KIND[kind || 'var'];
    const base = (TEXT[lang] && TEXT[lang][k.suggest]) || TEXT.de[k.suggest];
    for (const s of base) if (!k.problem(s)) return s;
    const stem = base[base.length - 1];
    for (let i = 2; i < 100; i++) if (!k.problem(stem + k.sep + i)) return stem + k.sep + i;
    return '';
  }

  function nameTools(kind) {
    const k = KIND[kind];
    const box = document.createElement('div');
    box.className = 'var-tools';
    const msgBox = (text) => {
      const msg = document.createElement('div');
      msg.className = 'var-msg';
      msg.setAttribute('role', 'status');
      msg.textContent = text || '';
      return msg;
    };
    if (formOpen === kind) {
      const form = document.createElement('form');
      form.className = 'var-new';
      const inp = stopDrag(document.createElement('input'));
      inp.id = k.input;
      inp.className = 'var-ctl';
      inp.maxLength = k.max;
      inp.autocomplete = 'off';
      inp.spellcheck = false;
      inp.value = suggestName(kind);
      inp.setAttribute('aria-label', t(k.nameKey));
      const ok = document.createElement('button');
      ok.type = 'submit'; ok.className = 'var-ok var-ctl'; ok.textContent = 'OK';
      const no = document.createElement('button');
      no.type = 'button'; no.className = 'var-x var-ctl'; no.textContent = '\u00d7';
      no.setAttribute('aria-label', t('varCancel'));
      const msg = msgBox();
      const check = () => {
        const why = inp.value ? k.problem(tidyName(inp.value)) : 'varBad';
        ok.disabled = !!why || !!session;
        msg.textContent = inp.value && why ? t(why) : '';
      };
      inp.addEventListener('input', check);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeForm(); } });
      no.addEventListener('click', closeForm);
      form.addEventListener('submit', (e) => { e.preventDefault(); k.add(tidyName(inp.value)); });
      form.append(inp, ok, no);
      box.append(form, msg);
      check();
      setTimeout(() => { if (document.activeElement !== inp && inp.isConnected && !SELFTEST) { inp.focus(); inp.select(); } }, 0);
    } else {
      const add = document.createElement('button');
      add.type = 'button';
      add.id = k.btn;
      add.className = 'var-add var-ctl';
      const plus = el('svg', { class: 'ico', viewBox: '0 0 16 16', 'aria-hidden': 'true' });
      plus.append(el('path', { d: 'M8 3v10M3 8h10' }));
      add.append(plus, document.createTextNode(t(k.newKey)));
      add.addEventListener('click', () => openForm(kind));
      box.append(add);
      if (toolMsg[kind]) box.append(msgBox(toolMsg[kind]));
    }
    const chipNames = kind === 'var' ? vars : kind === 'list' ? lists : [];
    if (chipNames.length) {
      const list = document.createElement('div');
      list.className = 'var-chips';
      for (const v of chipNames) {
        const chip = document.createElement('span');
        chip.className = 'var-chip';
        const name = document.createElement('span'); name.textContent = v;
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'var-del var-ctl'; del.textContent = '\u00d7';
        del.setAttribute('aria-label', t('varDel', { v }));
        del.addEventListener('click', () => (kind === 'list' ? deleteList(v) : deleteVar(v)));
        chip.append(name, del);
        list.append(chip);
      }
      box.append(list);
    }
    return box;
  }

  function openForm(kind) {
    if (session) return;
    formOpen = kind;
    toolMsg[kind] = '';
    renderPalette();
  }
  function closeForm() { formOpen = null; renderPalette(); }
  /* a new task or file: no field open, no old message */
  function resetForms() { formOpen = null; for (const k in toolMsg) toolMsg[k] = ''; }

  /* true if the name was added */
  function addVar(name) {
    if (session) return false;
    const why = varNameProblem(name);
    if (why) { toolMsg.var = t(why); if (formOpen !== 'var') renderPalette(); return false; }
    vars.push(name);
    resetForms();
    varsChanged();
    return true;
  }

  /* every block of the program, own blocks included */
  function eachBlock(fn) {
    const walk = (list) => { for (const b of list) { fn(b); if (b.body) walk(b.body); if (b.alt) walk(b.alt); } };
    walk(prog);
    for (const f of funcs) walk(f.body);
  }

  /* every number field of a block: its own, and its condition's */
  function opsOf(b) {
    const out = [];
    const def = BLOCKS[b.t];
    if (def && def.ops) for (const k in def.ops) out.push(b[k]);
    if (isCompare(b.cond)) out.push(b.cond.n);
    if (isCellCond(b.cond)) out.push(b.cond.x, b.cond.y, b.cond.dir);
    return out.filter((o) => o && typeof o === 'object');
  }

  function varUsed(name) {
    let used = false;
    eachBlock((b) => {
      if (b.v === name || (isCompare(b.cond) && b.cond.v === name)) used = true;
      for (const o of opsOf(b)) if (o.v === name) used = true;
    });
    return used;
  }

  function listUsed(name) {
    let used = false;
    eachBlock((b) => {
      if (b.l === name) used = true;
      for (const o of opsOf(b)) if (o.len === name) used = true;
    });
    return used;
  }

  /* true if the name was added */
  function addList(name) {
    if (session) return false;
    const why = listNameProblem(name);
    if (why) { toolMsg.list = t(why); if (formOpen !== 'list') renderPalette(); return false; }
    lists.push(name);
    resetForms();
    varsChanged();
    return true;
  }

  /* true if deleted; a list that a block still uses stays */
  function deleteList(name) {
    if (session) return false;
    if (listUsed(name)) { toolMsg.list = t('varUsed', { v: name }); renderPalette(); return false; }
    lists.splice(lists.indexOf(name), 1);
    listVals.delete(name);
    toolMsg.list = '';
    varsChanged();
    return true;
  }

  /* true if deleted; a variable that a block still uses stays */
  function deleteVar(name) {
    if (session) return false;
    if (varUsed(name)) { toolMsg.var = t('varUsed', { v: name }); renderPalette(); return false; }
    vars.splice(vars.indexOf(name), 1);
    varVals.delete(name);
    toolMsg.var = '';
    varsChanged();
    return true;
  }

  function varsChanged() {
    renderPalette();
    renderProgram();          /* the pickers in the blocks list the new names; saves */
    renderWatch();
  }

  /* ---------------- own blocks ("Meine Bausteine") ----------------
   * A name for a list of blocks, defined under the program and used like
   * any block. No parameters (v1); variables are shared with the program.
   * A block must never use itself, not even through another one: such a
   * drop is refused with a message, and a file with it does not open. */
  function addFunc(name) {
    if (session) return false;
    const why = funcNameProblem(name);
    if (why) { toolMsg.func = t(why); if (formOpen !== 'func') renderPalette(); return false; }
    funcs.push({ name, body: [] });
    resetForms();
    renderPalette();
    renderProgram();
    return true;
  }

  /* the own blocks a list of blocks uses, directly */
  function callsIn(list, out) {
    out = out || new Set();
    for (const b of list) {
      if (b.t === 'call') out.add(b.f);
      if (b.body) callsIn(b.body, out);
      if (b.alt) callsIn(b.alt, out);
    }
    return out;
  }

  /* does own block `from` use `to`, directly or through others? */
  function reaches(from, to, list, seen) {
    seen = seen || new Set();
    if (seen.has(from)) return false;
    seen.add(from);
    const f = (list || funcs).find((x) => x.name === from);
    if (!f) return false;
    for (const g of callsIn(f.body)) if (g === to || reaches(g, to, list, seen)) return true;
    return false;
  }

  /* Would `block` dropped into container cpath make an own block use
     itself? Only the bellies of own blocks (cpath below 0) can. */
  function wouldRecurse(block, cpath) {
    if (!cpath.length || cpath[0] >= 0) return false;
    const host = funcs[-cpath[0] - 1].name;
    for (const g of callsIn([block])) if (g === host || reaches(g, host)) return true;
    return false;
  }

  function funcUsed(name) {
    let used = false;
    eachBlock((b) => { if (b.t === 'call' && b.f === name) used = true; });
    return used;
  }

  /* true if deleted (with the blocks inside it); a used one stays */
  function deleteFunc(name) {
    if (session) return false;
    if (funcUsed(name)) { say(t('funcUsed', { f: name })); return false; }
    funcs.splice(funcs.findIndex((f) => f.name === name), 1);
    hideVerdict();
    renderPalette();
    renderProgram();
    return true;
  }

  /* nothing about names changes while a program runs */
  function syncVarCtl() {
    document.querySelectorAll('#paletteList .var-ctl, #defList .def-del').forEach((c) => { c.disabled = !!session; });
  }

  /* ---------------- the watch panel ----------------
   * Next to the maze: every variable and its value now. The one that
   * changed last has a gold outline (and blinks once); all start at 0 with
   * each run. Under it, what "zeige" showed in this run. */
  function resetVars() {
    varVals = new Map();
    listVals = new Map();
    lastChanged = null;
    lastList = null;
    shownLog = [];
    pendingBubble = null;
    resetMap();
    drawMapLayer();
    for (const k in dirty) dirty[k] = false;
    hideBubble();
    renderWatch();
  }

  function setVarValue(name, value) {
    const changed = varVal(name) !== value;
    varVals.set(name, value);
    if (changed) { lastChanged = name; lastList = null; }
    if (quiet) dirty.watch = true;
    else renderWatch(changed ? name : null);
  }

  function renderWatch(bump) {
    const box = $('watch');
    if (!box) return;
    box.hidden = !vars.length && !lists.length;
    $('watchVars').hidden = !vars.length;
    renderWatchLists();
    const list = $('watchList');
    list.textContent = '';
    for (const v of vars) {
      const item = document.createElement('span');
      item.className = 'wv' + (v === lastChanged ? ' is-new' : '') + (v === bump ? ' bump' : '');
      item.dataset.var = v;
      const name = document.createElement('span'); name.className = 'wv-name'; name.textContent = v;
      const val = document.createElement('output'); val.className = 'wv-val'; val.textContent = String(varVal(v)).replace('-', '\u2212');
      item.append(name, val);
      list.append(item);
    }
    const log = $('watchLog');
    log.textContent = '';
    log.hidden = !shownLog.length;
    if (shownLog.length) {
      const head = document.createElement('span'); head.className = 'wl-head'; head.textContent = t('shown');
      log.append(head);
      const from = Math.max(0, shownLog.length - 8);       /* the last eight */
      if (from) log.append(document.createTextNode('\u2026'));
      for (const [v, n] of shownLog.slice(from)) {
        const s = document.createElement('span'); s.className = 'wl-item';
        s.textContent = v + ': ' + String(n).replace('-', '\u2212');
        log.append(s);
      }
    }
  }

  /* Each list as a row of numbered boxes: item 1 first, the item that
     changed last in gold; a long list shows its first WATCH_ITEMS and how
     many more there are. */
  const WATCH_ITEMS = 30;
  function renderWatchLists() {
    const host = $('watchLists');
    host.textContent = '';
    host.hidden = !lists.length;
    if (!lists.length) return;
    const head = document.createElement('span');
    head.className = 'watch-title';
    const ht = document.createElement('span'); ht.textContent = t('cat_list');
    const i = document.createElement('button');
    i.className = 'info'; i.textContent = 'i'; i.dataset.tipKey = 'i_watchLists'; i.setAttribute('aria-label', 'Info');
    head.append(ht, i);
    host.append(head);
    for (const name of lists) {
      const arr = listOf(name);
      const row = document.createElement('div');
      row.className = 'wl-row';
      row.dataset.list = name;
      const nm = document.createElement('span'); nm.className = 'wl-name'; nm.textContent = name;
      const items = document.createElement('span'); items.className = 'wl-items';
      if (!arr.length) {
        const e = document.createElement('span'); e.className = 'wl-empty'; e.textContent = t('listEmpty');
        items.append(e);
      }
      arr.slice(0, WATCH_ITEMS).forEach((n, k) => {
        const it = document.createElement('span');
        it.className = 'wli' + (lastList && lastList.l === name && lastList.i === k ? ' is-new' : '');
        const ix = document.createElement('i'); ix.textContent = k + 1;
        it.append(ix, document.createTextNode(fmtNum(n)));
        items.append(it);
      });
      if (arr.length > WATCH_ITEMS) {
        const more = document.createElement('span'); more.className = 'wl-more';
        more.textContent = t('listMore', { n: arr.length - WATCH_ITEMS });
        items.append(more);
      }
      row.append(nm, items);
      host.append(row);
    }
  }

  function renderProgram() {
    const host = $('progList');
    host.textContent = '';
    host.dataset.cpath = '[]';
    host.dataset.empty = t('dropHere');
    prog.forEach((b, i) => host.append(renderBlock(b, [i], true)));
    const defs = $('defList');
    defs.textContent = '';
    funcs.forEach((f, k) => defs.append(renderDef(f, k)));
    defs.hidden = !funcs.length;
    const used = countAll();
    $('blockCount').textContent = used + ' ' + blocksWord(used);
    syncVarCtl();
    saveProg();
    save();
  }

  /* The block that runs now gets a gold ring; the own blocks it runs
     inside ("calling") a fainter one. */
  function highlight(b, stack) {
    document.querySelectorAll('.prog-scroll .blk.running, .prog-scroll .blk.calling')
      .forEach((n) => n.classList.remove('running', 'calling'));
    if (!b) return;
    const mark = (blk, cls) => {
      const path = findPath(blk);
      const node = path && document.querySelector(".prog-scroll .blk[data-path='" + JSON.stringify(path) + "']");
      if (node) node.classList.add(cls);
    };
    for (const c of stack || []) mark(c, 'calling');
    mark(b, 'running');
  }

  /* where a block stands: in the program, or in an own block (path below 0) */
  function findPath(target) {
    const p = findIn(prog, target, []);
    if (p) return p;
    for (let k = 0; k < funcs.length; k++) {
      const q = findIn(funcs[k].body, target, [-(k + 1), 'body']);
      if (q) return q;
    }
    return null;
  }

  function findIn(list, target, base) {
    for (let i = 0; i < list.length; i++) {
      if (list[i] === target) return base.concat(i);
      for (const key of ['body', 'alt']) {
        if (list[i][key]) {
          const p = findIn(list[i][key], target, base.concat(i, key));
          if (p) return p;
        }
      }
    }
    return null;
  }

  /* ---------------- blocks: dragging ---------------- */
  /* the list a container path points at; a path that starts below 0 is
     in an own block: -1 the first one, -2 the second ... */
  const arrayAt = (cpath) => {
    let list = prog;
    for (let i = 0; i < cpath.length; i += 2) {
      const b = i === 0 && cpath[0] < 0 ? funcs[-cpath[0] - 1] : list[cpath[i]];
      list = b[cpath[i + 1]];
    }
    return list;
  };

  let drag = null;

  function onPointerDown(ev) {
    if (ev.button != null && ev.button !== 0) return;
    if (ev.target.closest('button, select, input')) return;
    const pill = ev.target.closest('.val-pill');
    if (pill) { if (!session) startPill(ev, pill); return; }
    const node = ev.target.closest('.blk');
    if (!node || node.classList.contains('def')) return;   /* a definition stays where it is */
    if (session) return;                       /* not while a program runs */

    const live = node.dataset.live === '1';
    const srcPath = live ? JSON.parse(node.dataset.path) : null;
    const block = live ? arrayAt(srcPath.slice(0, -1))[srcPath[srcPath.length - 1]]
                       : freshBlock(node.dataset.type, node.dataset.f);

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
    if (drag.pill) { pillTarget(ev.clientX, ev.clientY); return; }

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
    if (d.pill) {
      document.querySelectorAll('.slot-hot').forEach((n) => n.classList.remove('slot-hot'));
      if (d.slot) dropValue(d.op, d.slot);
      renderProgram();
      return;
    }

    const tgt = d.target;
    if (!tgt) {
      if (d.overTrash && d.srcPath) removeAt(d.srcPath);   /* only the bin deletes */
      renderProgram();
      return;
    }
    dropBlock(d.block, d.srcPath, tgt.cpath, tgt.index);
    renderProgram();
  }

  /* Put `block` into container cpath at index - from the palette (srcPath
     null) or moved from srcPath. Refused: a block into itself, and an own
     block that would use itself (with a message). True if it moved. */
  function dropBlock(block, srcPath, cpath, index) {
    if (srcPath && JSON.stringify(cpath.slice(0, srcPath.length)) === JSON.stringify(srcPath)) return false;
    if (wouldRecurse(block, cpath)) { say(t('funcSelf'), 'lose'); return false; }
    if (srcPath) {
      const srcContainer = srcPath.slice(0, -1);
      const srcIndex = srcPath[srcPath.length - 1];
      removeAt(srcPath);
      if (JSON.stringify(srcContainer) === JSON.stringify(cpath) && srcIndex < index) index--;
    }
    arrayAt(cpath).splice(index, 0, block);
    return true;
  }

  function removeAt(path) {
    arrayAt(path.slice(0, -1)).splice(path[path.length - 1], 1);
  }

  /* ---------------- value pills ----------------
   * A pill from the box ("Laenge von Weg") is dragged onto a number field
   * in the program: the field then holds that value. */
  function startPill(ev, pill) {
    const rect = pill.getBoundingClientRect();
    const ghost = $('ghost');
    ghost.textContent = '';
    ghost.style.width = '';
    ghost.append(pill.cloneNode(true));
    ghost.hidden = false;
    drag = { pill: true, op: JSON.parse(pill.dataset.op), slot: null, dx: ev.clientX - rect.left, dy: ev.clientY - rect.top };
    moveGhost(ev.clientX, ev.clientY);
    ev.preventDefault();
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    window.addEventListener('pointercancel', onPointerUp, { once: true });
  }

  function pillTarget(x, y) {
    document.querySelectorAll('.slot-hot').forEach((n) => n.classList.remove('slot-hot'));
    const under = document.elementFromPoint(x, y);
    const slot = under && under.closest('.prog-scroll [data-slot]');
    drag.slot = slot ? JSON.parse(slot.dataset.slot) : null;
    if (slot) slot.classList.add('slot-hot');
  }

  /* slot: {p: block path, k: field, c: 1 if in the condition}. True if set. */
  function dropValue(op, slot) {
    if (session || !slot || !Array.isArray(slot.p) || !slot.p.length) return false;
    let blk;
    try { blk = arrayAt(slot.p.slice(0, -1))[slot.p[slot.p.length - 1]]; } catch (e) { return false; }
    if (!blk || !BLOCKS[blk.t]) return false;
    const ops = BLOCKS[blk.t].ops;
    const condOk = (isCompare(blk.cond) && slot.k === 'n') || (isCellCond(blk.cond) && ['x', 'y', 'dir'].includes(slot.k));
    if (slot.c ? !condOk : !(ops && slot.k in ops)) return false;
    (slot.c ? blk.cond : blk)[slot.k] = opData(op);
    return true;
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
    vars = varsBy[level().id] || [];
    funcs = funcsBy[level().id] || [];
    lists = listsBy[level().id] || [];
    resetForms();
    resetRun();
    renderLevels();
    renderTask();
    renderPalette();
    renderProgram();
    save();
  }

  /* The verdict bar: a message, after a run the tournament counters under
   * it, and maybe one button (next task / try again / Weiter). */
  function say(msg, kind, action, stats) {
    const v = $('verdict');
    v.textContent = '';
    v.className = 'verdict' + (kind ? ' ' + kind : '');
    if (stats) {
      const box = document.createElement('span');
      box.className = 'msg';
      const line = document.createElement('span');
      line.className = 'stats';
      statsParts(stats).forEach((part, i) => {          /* each count stays in one piece */
        if (i) line.append(' \u00b7 ');
        const s = document.createElement('span');
        s.textContent = part;
        line.append(s);
      });
      box.append(document.createTextNode(msg), line);
      v.append(box);
    } else {
      v.append(document.createTextNode(msg));
    }
    if (action) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = action === 'next' ? t('nextLevel') : action === 'goOn' ? t('goOn') : t('tryAgain');
      b.addEventListener('click', () => {
        hideVerdict();
        if (action === 'next') goLevel(Math.min(LEVELS.length - 1, levelIx + 1));
        else if (action === 'goOn') { startSession(); runAll(); }
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
   * Speichern downloads {version, level, lang, vars, funcs?, prog} as
   * ratrocket-aufgabe<N>.json - on level 7 with the pupil's maze as well.
   * vars lists the program's variable names, lists its lists, funcs its
   * own blocks ({name, body}). A number field holds a number or (version 3)
   * a value: {v: variable} or {len: list}. The file says the lowest version that holds the
   * program, so an older copy of the page still opens what it can:
   *   1 - before variables (no vars), the seven first block types;
   *   2 - variables, comparisons, "wiederhole bis";
   *   3 - own blocks, lists, values in number fields.
   * Opening is strict: JSON.parse only (nothing in a file ever runs), known
   * block types and conditions only, names valid and declared, no own
   * block that uses itself, repeat counts clamped to 1..9, other numbers to
   * -999..999, and any other key is dropped. A bad file changes nothing. */
  const FILE_MAX = 200000, FILE_BLOCKS = 500, FILE_DEPTH = 12;
  const V1_TYPES = ['move', 'right', 'left', 'around', 'repeat', 'untilOut', 'ifElse'];
  const V2_TYPES = V1_TYPES.concat(['repeatUntil', 'setVar', 'changeVar', 'showVar']);

  const opData = (o) => (typeof o === 'number' ? o : JSON.parse(JSON.stringify(o)));
  const condData = (c) => (isCompare(c) ? { v: c.v, op: c.op, n: opData(c.n) }
    : isCellCond(c) ? { x: opData(c.x), y: opData(c.y), dir: opData(c.dir) } : c);

  function progData(list) {
    return list.map((b) => {
      const def = BLOCKS[b.t], o = { t: b.t };
      if (def.v) o.v = b.v;
      if (def.f) o.f = b.f;
      if (def.l) o.l = b.l;
      if (def.count) o.n = b.n;
      if (def.ops) for (const k in def.ops) o[k] = opData(b[k]);
      if (def.cond) o.cond = condData(b.cond);
      if (def.body) o.body = progData(b.body || []);
      if (def.alt) o.alt = progData(b.alt || []);
      return o;
    });
  }

  /* 3 if the program needs anything newer than version 2 */
  function fileVersion() {
    let v = funcs.length || lists.length ? 3 : 2;
    eachBlock((b) => {
      if (!V2_TYPES.includes(b.t) || opsOf(b).length) v = 3;
      if (b.cond && !isSensor(b.cond) && !isCompare(b.cond)) v = 3;
    });
    return v;
  }

  function exportData() {
    const lv = level();
    const version = fileVersion();
    const data = { version, level: lv.id, lang, vars: vars.slice() };
    if (version >= 3) data.lists = lists.slice();
    if (version >= 3) data.funcs = funcs.map((f) => ({ name: f.name, body: progData(f.body) }));
    data.prog = progData(prog);
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

  const isNum = (n) => typeof n === 'number' && isFinite(n);
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

  /* A list of variable names: valid, unique, at most VAR_MAX; or null. */
  function cleanVars(list) {
    if (!Array.isArray(list) || list.length > VAR_MAX) return null;
    const out = [];
    for (const v of list) {
      if (typeof v !== 'string' || varNameProblem(v, out)) return null;
      out.push(v);
    }
    return out;
  }

  /* A list of list names: valid, unique, at most LIST_MAX; or null. */
  function cleanLists(list) {
    if (!Array.isArray(list) || list.length > LIST_MAX) return null;
    const out = [];
    for (const v of list) {
      if (typeof v !== 'string' || listNameProblem(v, out)) return null;
      out.push(v);
    }
    return out;
  }

  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  /* A number field: a number (clamped to -999..999), or from version 3 a
     declared variable {v} or list length {len}; or null. */
  function cleanOp(o, names) {
    if (isNum(o)) return clampNum(o);
    if (names.version < 3 || !isObj(o) || Object.keys(o).length !== 1) return null;
    if (own(o, 'v')) return names.vars.includes(o.v) ? { v: o.v } : null;
    if (own(o, 'len')) return names.lists.includes(o.len) ? { len: o.len } : null;
    if (own(o, 'p')) return POS.includes(o.p) ? { p: o.p } : null;
    return null;
  }

  /* A condition: one of the six sensor conditions, or a comparison of a
     declared variable: {v, op, n}. */
  function cleanCond(c, names) {
    if (typeof c === 'string') return CONDITIONS.includes(c) || (names.version >= 3 && MAP_CONDS.includes(c)) ? c : null;
    if (names.version >= 3 && isObj(c) && own(c, 'dir')) {          /* Feld x y nach r offen (map) */
      const x = cleanOp(c.x, names), y = cleanOp(c.y, names), dir = cleanOp(c.dir, names);
      return x === null || y === null || dir === null ? null : { x, y, dir };
    }
    if (!isObj(c) || !names.vars.includes(c.v) || !OPS.includes(c.op)) return null;
    const n = cleanOp(c.n, names);
    return n === null ? null : { v: c.v, op: c.op, n };
  }

  /* names: {vars, funcs, version} - what the file declares; count: {n} */
  function cleanList(list, depth, count, names) {
    if (!Array.isArray(list) || depth > FILE_DEPTH) return null;
    const types = names.version === 1 ? V1_TYPES : names.version === 2 ? V2_TYPES : null;
    const out = [];
    for (const b of list) {
      if (!isObj(b)) return null;
      if (typeof b.t !== 'string' || !Object.prototype.hasOwnProperty.call(BLOCKS, b.t)) return null;
      if (types && !types.includes(b.t)) return null;          /* an older file knows only these */
      if (++count.n > FILE_BLOCKS) return null;
      const def = BLOCKS[b.t], o = { t: b.t };
      if (def.v) {
        if (!names.vars.includes(b.v)) return null;          /* unknown variable */
        o.v = b.v;
      }
      if (def.f) {
        if (!names.funcs.includes(b.f)) return null;         /* unknown own block */
        o.f = b.f;
      }
      if (def.l) {
        if (!names.lists.includes(b.l)) return null;         /* unknown list */
        o.l = b.l;
      }
      if (def.count) {
        if (!isNum(b.n)) return null;
        o.n = Math.min(9, Math.max(1, Math.round(b.n)));
      }
      if (def.ops) {
        for (const k in def.ops) if ((o[k] = cleanOp(b[k], names)) === null) return null;
      }
      if (def.cond && !(o.cond = cleanCond(b.cond, names))) return null;
      if (def.body && !(o.body = cleanList(b.body, depth + 1, count, names))) return null;
      if (def.alt && !(o.alt = cleanList(b.alt, depth + 1, count, names))) return null;
      out.push(o);
    }
    return out;
  }

  /* Own blocks from a file or from localStorage: names valid and unique,
     at most FUNC_MAX, bodies clean, and none uses itself. null if not. */
  function cleanFuncs(list, count, names) {
    if (!Array.isArray(list) || list.length > FUNC_MAX) return null;
    for (const f of list) {
      if (!isObj(f) || funcNameProblem(f.name, names.funcs)) return null;
      names.funcs.push(f.name);
    }
    count.n += list.length;                                  /* each "definiere" head */
    const out = [];
    for (const f of list) {
      const body = cleanList(f.body, 1, count, names);
      if (!body) return null;
      out.push({ name: f.name, body });
    }
    for (const f of out) if (reaches(f.name, f.name, out)) return null;
    return out;
  }

  /* file text -> {level, vars, funcs, prog, maze?} or null. Version 1 has
     no variables (a vars key there is ignored), versions 2 and 3 must list
     them; own blocks come with version 3. */
  function parseFile(text) {
    if (typeof text !== 'string' || text.length > FILE_MAX) return null;
    let d;
    try { d = JSON.parse(text); } catch (e) { return null; }
    if (!isObj(d) || ![1, 2, 3].includes(d.version)) return null;
    const varNames = d.version === 1 ? [] : cleanVars(d.vars);
    if (!varNames) return null;
    const listNames = d.version >= 3 && d.lists != null ? cleanLists(d.lists) : [];
    if (!listNames) return null;
    const low = varNames.map((v) => v.toLowerCase());
    if (listNames.some((l) => low.includes(l.toLowerCase()))) return null;   /* one name space */
    const names = { vars: varNames, lists: listNames, funcs: [], version: d.version };
    const count = { n: 0 };
    const fs = d.version >= 3 && d.funcs != null ? cleanFuncs(d.funcs, count, names) : [];
    if (!fs) return null;
    const p = cleanList(d.prog, 0, count, names);
    if (!p) return null;
    const out = { level: Number.isInteger(d.level) ? d.level : null, vars: varNames, lists: listNames, funcs: fs, prog: p };
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
    vars = data.vars;
    lists = data.lists;
    funcs = data.funcs;
    resetForms();
    saveProg();
    if (data.maze && lv.sandbox) {
      sandbox.n = data.maze.n;
      sandbox.mazes[data.maze.n] = data.maze.m;
      syncTools();
    }
    resetRun();
    renderTask();
    renderPalette();
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
      't-cellLabel': 'cellLabel', 't-save': 'save', 't-open': 'open', 'driveLink': 'driveLink',
      'learnLink': 'learnLink', 'shopLink': 'shopLink',
      't-sbWalls': 'sbWalls', 't-sbStart': 'sbStart', 't-sbGoal': 'sbGoal',
      'sbClear': 'sbClear', 'sbRandom': 'sbRandom', 't-watch': 'watch',
    };
    for (const id in map) { const n = $(id); if (n) n.textContent = t(map[id]); }
    $('sbSize').setAttribute('aria-label', t('sbSize'));
    document.querySelector('.rail-links').setAttribute('aria-label', t('pagesNav'));
    renderSizes();
    $('langBtn').textContent = t('lang');
    $('t-profi').textContent = t('profi');
    $('profiBtn').setAttribute('aria-pressed', String(profi));
    $('connectBtn').textContent = port ? t('disconnect') : t('connect');
    if (!port) $('linkText').textContent = t('notConnected');
    $('runBtn').textContent = t('run');
    $('stepBtn').textContent = t('step');
    $('resetBtn').textContent = t('reset');
    renderLevels(); renderTask(); renderPalette(); renderProgram(); renderWatch();
  }

  function setLink(cls, text) {
    $('linkState').className = 'link-state' + (cls ? ' ' + cls : '');
    $('linkText').textContent = text;
  }

  /* ---------------- persistence ---------------- */
  function saveProg() { progs[level().id] = prog; varsBy[level().id] = vars; funcsBy[level().id] = funcs; listsBy[level().id] = lists; }
  /* what goes into localStorage (variables: field vars, per level id) */
  const storeData = () => ({ lang, profi, levelIx, progs, done, sandbox, vars: varsBy, funcs: funcsBy, lists: listsBy });
  function save() {
    if (SELFTEST) return;                 /* the self-test must not overwrite real work */
    try {
      localStorage.setItem(STORE, JSON.stringify(storeData()));
    } catch (e) { /* private mode */ }
  }

  /* Stored variable lists, checked like a file's; a list that is not valid
     is dropped. Then every name a stored program uses is added back if it is
     a valid name, so a program never points at a missing variable. */
  /* Stored names per task (variables or lists), checked like a file's; a
     list of names that is not valid is dropped. Then every name a stored
     program or own block uses is added back if it is a valid name, so a
     program never points at a missing variable or list. A variable never
     takes a name its task's lists have. */
  function restoreNames(s, programs, ownBlocks, clean, usedIn, problem, avoid) {
    const out = {};
    if (isObj(s)) {
      for (const id of Object.keys(s)) {
        const list = clean(s[id]);
        if (list && LEVELS.some((lv) => String(lv.id) === id)) out[id] = list;
      }
    }
    const walk = (list, names) => {
      if (!Array.isArray(list)) return;
      for (const b of list) {
        if (!isObj(b)) continue;
        for (const v of usedIn(b)) {
          if (typeof v === 'string' && !names.includes(v) && !problem(v, names)) names.push(v);
        }
        walk(b.body, names);
        walk(b.alt, names);
      }
    };
    if (isObj(programs)) {
      for (const id of Object.keys(programs)) {
        if (!LEVELS.some((lv) => String(lv.id) === id)) continue;
        const names = out[id] || [];
        walk(programs[id], names);
        for (const fb of (isObj(ownBlocks) && ownBlocks[id]) || []) walk(fb.body, names);
        if (names.length) out[id] = names;
      }
    }
    if (isObj(avoid)) {
      for (const id of Object.keys(out)) {
        const low = (avoid[id] || []).map((n) => n.toLowerCase());
        out[id] = out[id].filter((n) => !low.includes(n.toLowerCase()));
        if (!out[id].length) delete out[id];
      }
    }
    return out;
  }

  const opsRaw = (b) => { try { return opsOf(b); } catch (e) { return []; } };
  function restoreVars(s, programs, ownBlocks, listStore) {
    return restoreNames(s, programs, ownBlocks, cleanVars,
      (b) => [b.v, isCompare(b.cond) ? b.cond.v : null].concat(opsRaw(b).map((o) => o.v)),
      (v, names) => varNameProblem(v, names), listStore);
  }
  function restoreLists(s, programs, ownBlocks) {
    return restoreNames(s, programs, ownBlocks, cleanLists,
      (b) => [b.l].concat(opsRaw(b).map((o) => o.len)),
      (v, names) => listNameProblem(v, names), null);
  }


  /* Stored own blocks per task: names valid and unique, at most FUNC_MAX,
     a body that is a list; a bad entry is dropped. (Like the stored
     programs, the bodies themselves are taken as they are; a block that
     somehow uses itself still only ends its run with a message.) */
  function restoreFuncs(s) {
    const out = {};
    if (!isObj(s)) return out;
    for (const id of Object.keys(s)) {
      if (!LEVELS.some((lv) => String(lv.id) === id) || !Array.isArray(s[id])) continue;
      const list = [];
      for (const f of s[id]) {
        if (isObj(f) && Array.isArray(f.body) && !funcNameProblem(f.name, list.map((x) => x.name))) list.push({ name: f.name, body: f.body });
      }
      if (list.length) out[id] = list;
    }
    return out;
  }

  function load() {
    sandbox = sbFresh();
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!s) return;
      if (s.lang === 'de' || s.lang === 'en') lang = s.lang;
      if (typeof s.profi === 'boolean') profi = s.profi;
      if (typeof s.levelIx === 'number' && LEVELS[s.levelIx]) levelIx = s.levelIx;
      if (s.progs && typeof s.progs === 'object') progs = s.progs;
      if (s.done && typeof s.done === 'object') done = s.done;
      sandbox = sbRestore(s.sandbox);
      funcsBy = restoreFuncs(s.funcs);
      listsBy = restoreLists(s.lists, progs, funcsBy);
      varsBy = restoreVars(s.vars, progs, funcsBy, listsBy);
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
    vars = varsBy[LEVELS[levelIx].id] || [];
    funcs = funcsBy[LEVELS[levelIx].id] || [];
    lists = listsBy[LEVELS[levelIx].id] || [];
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
    $('profiBtn').addEventListener('click', () => { profi = !profi; save(); applyLang(); });
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
        /* variables: the open program's names, and the values now */
        get vars() { return vars.slice(); },
        get varValues() { const o = {}; for (const v of vars) o[v] = varVal(v); return o; },
        setVars(list) { vars = list.slice(); saveProg(); resetForms(); resetVars(); renderPalette(); renderProgram(); },
        addVar, deleteVar, varNameProblem, stepOnce, storeData, restoreVars,
        get profi() { return profi; },
        get lang() { return lang; },
        /* own blocks: [{name, body}] - set as they are (no checks: the
           self-test also builds a hand-made loop to try the run guard) */
        get funcs() { return funcs; },
        setFuncs(list) { funcs = list; saveProg(); resetForms(); renderPalette(); renderProgram(); },
        addFunc, deleteFunc, funcNameProblem, countAll, restoreFuncs,
        /* lists: the open program's names, and their items now */
        get lists() { return lists.slice(); },
        get listValues() { const o = {}; for (const l of lists) o[l] = listOf(l).slice(); return o; },
        setLists(list) { lists = list.slice(); saveProg(); resetForms(); resetVars(); renderPalette(); renderProgram(); },
        addList, deleteList, listNameProblem, restoreLists,
        /* a value pill dropped on a number field, as the mouse does it */
        dropValue(op, slot) { const ok = dropValue(op, slot); renderProgram(); return ok; },
        get thinks() { return session ? session.thinks : lastThinks; },
        /* the robot's map now: numbers (y * n + x, -1 empty) and remembered sides */
        maxThinksFor: (n) => Math.min(THINK_CAP, Math.max(THINK_MIN, THINK_PER * Math.pow(n, 4))),
        get mapState() { return { nums: mapNums.slice(), known: Object.fromEntries(mapKnown) }; },
        /* a drop exactly as the mouse makes it: container path, index */
        dropBlock(block, srcPath, cpath, index) { const ok = dropBlock(block, srcPath, cpath, index); renderProgram(); return ok; },
        get world() { return world; },
        get lastResult() { return lastResult; },
        get done() { return Object.assign({}, done); },
        /* tournament counters of the last run: {blocks, moves, turns, points} */
        get stats() { return lastStats && Object.assign({}, lastStats); },
        /* A stand-in for the real robot: handler(line) gives the reply lines
           ([] = silence), fed in like the serial reader does. null = off. */
        fakeRobot(handler) {
          if (!handler) { port = writer = null; rxWaiters = []; $('realChk').checked = false; return; }
          port = { fake: true };
          writer = {
            write(text) {
              const out = handler(text.replace(/\r?\n$/, '')) || [];
              setTimeout(() => out.forEach((l) => { rxWaiters = rxWaiters.filter((w) => !w.try(l)); }), 1);
            },
          };
          $('realChk').checked = true;
        },
        setTimeScale(s) { timeScale = s; },
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
