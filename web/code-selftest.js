/*
 * Self-check for the levels. Loaded only by code.html?selftest=1.
 *
 * For every level it drops in the solution a pupil is meant to find, runs it
 * in the simulator at full speed and checks that the level is solved and that
 * the block count earns three stars. Every task starts inside, on (0,0)
 * facing north; an escape maze has exactly one opening in its border. A
 * level that cannot be solved, or whose par is wrong, is a bug in
 * code-data.js, not in the pupil. Levels 6 and 9 must solve all three of
 * their mazes.
 *
 * Then the own maze (level 7): mazes set through the hook must be won by a
 * known program, with the default and with a moved and turned start, for
 * both kinds of goal - and no stars may be handed out there. The one-goal
 * rule (star XOR one opening) is checked through the same edits a click
 * makes. Zufall must build perfect mazes up to 32x32 with the goal farthest
 * from the start, a wall follower must get out of them, and Echter Roboter
 * must refuse mazes above 5x5. Then the program files: a saved program must
 * open again unchanged, and broken or hostile files must be refused.
 *
 * Then variables: setze/aendere/compare give the right values and start at
 * 0 on every run; "wiederhole bis" checks before each round and a condition
 * that never comes true ends at the action budget; the watch panel and the
 * "zeige" bubble; "Neue Variable" through the page; wrong programs must not
 * win tasks 8 and 9; with a stand-in robot no variable ever reaches it;
 * version-2 files and localStorage keep the variables, version-1 files still
 * open. Then the font must come from web/fonts.
 *
 * Then Profi-Woerter (labels only), own blocks (counting, no recursion),
 * lists (from 1, errors as messages, the watch panel), values in number
 * fields, the robot's map - and a flood fill built from these blocks only,
 * which must solve random 5x5 mazes in the simulation and with a stand-in
 * robot that answers WALLS. Last, the rail links.
 *
 * code.html?selftest=hook only sets up window.RRApp (for screenshots) and
 * runs nothing. The self-test never writes to localStorage.
 *
 * Result goes into <pre id="selftest"> and document.title, so a headless
 * screenshot or --dump-dom shows it.
 */
(function () {
  'use strict';
  if (/[?&]selftest=hook\b/.test(location.search)) return;
  const A = window.RRApp;
  const B = (t, extra) => Object.assign({ t }, extra);

  /* The intended solution per level id. */
  const SOLUTIONS = {
    1: [B('move'), B('move')],
    2: [B('move'), B('move'), B('right'), B('move'), B('move')],
    3: [B('repeat', { n: 3, body: [B('move'), B('move'), B('right')] })],
    4: [B('repeat', { n: 8, body: [
          B('ifElse', { cond: 'frontFree', body: [B('move')], alt: [B('right')] }),
        ] })],
    /* right-hand wall follower: decide, then drive one cell */
    5: [B('untilOut', { body: [
          B('ifElse', { cond: 'rightFree',
            body: [B('right')],
            alt: [B('ifElse', { cond: 'frontFree', body: [], alt: [B('left')] })] }),
          B('move'),
        ] })],
  };
  SOLUTIONS[6] = SOLUTIONS[5];
  /* count every cell: 2 cells, turn right - three times round the U */
  SOLUTIONS[8] = [B('repeat', { n: 3, body: [
    B('repeat', { n: 2, body: [B('move'), B('changeVar', { v: 'Schritte', n: 1 })] }),
    B('right'),
  ] })];
  /* stop after exactly 5 cells: the variable steers the loop */
  const UNTIL5 = (cmp) => [B('repeatUntil', { cond: cmp, body: [
    B('ifElse', { cond: 'frontFree',
      body: [B('move'), B('changeVar', { v: 'Schritte', n: 1 })],
      alt: [B('right')] }),
  ] })];
  SOLUTIONS[9] = UNTIL5({ v: 'Schritte', op: '=', n: 5 });
  /* the variables each solution needs */
  const VARS = { 8: ['Schritte'], 9: ['Schritte'] };

  /* Right-hand rule that also gets out of dead ends: when right and front
   * are both blocked it only turns left, without driving. */
  const FOLLOWER = [B('untilOut', { body: [
    B('ifElse', { cond: 'rightFree',
      body: [B('right'), B('move')],
      alt: [B('ifElse', { cond: 'frontFree', body: [B('move')], alt: [B('left')] })] }),
  ] })];

  /* Own mazes (level 7), default start (0,0) facing north unless given. */
  const OWN = [
    { id: '7a', name: '3x3 with star',
      maze: { n: 3, walls: ['1,0,E', '1,1,N', '0,0,N'], exits: [], goal: { x: 2, y: 2 } },
      prog: [B('right'), B('move'), B('left'), B('move'), B('right'), B('move'), B('left'), B('move')] },
    { id: '7b', name: '4x4 with exit, past a dead end',
      maze: { n: 4, walls: ['3,1,N', '2,2,E'], exits: ['3,3,N'], goal: null },
      prog: FOLLOWER },
    { id: '7c', name: '5x5 with star',
      maze: { n: 5, walls: ['1,1,N', '2,2,E', '3,3,N', '0,3,E'], exits: [], goal: { x: 4, y: 4 } },
      prog: [B('right'), B('repeat', { n: 4, body: [B('move')] }), B('left'), B('repeat', { n: 4, body: [B('move')] })] },
    { id: '7d', name: 'start (2,1) facing west, star',
      maze: { n: 4, walls: [], exits: [], goal: { x: 0, y: 3 }, start: { x: 2, y: 1, d: 'W' } },
      prog: [B('move'), B('move'), B('right'), B('move'), B('move')] },
    { id: '7e', name: 'start (2,1) facing west, exit',
      maze: { n: 4, walls: [], exits: ['3,2,E'], goal: null, start: { x: 2, y: 1, d: 'W' } },
      prog: [B('around'), B('move'), B('left'), B('move'), B('right'), B('move')] },
  ];

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const verdict = async () => {
    for (let i = 0; i < 600 && !A.lastResult; i++) await sleep(10);
    return A.lastResult || { win: false, reason: 'timeout' };
  };
  /* open sides in the border of the simulator's maze */
  function borderOpenings(w) {
    let k = 0;
    for (let x = 0; x < w.n; x++) for (let y = 0; y < w.n; y++) {
      if (y === w.n - 1 && !w.walls[x][y].N) k++;
      if (y === 0 && !w.walls[x][y].S) k++;
      if (x === w.n - 1 && !w.walls[x][y].E) k++;
      if (x === 0 && !w.walls[x][y].W) k++;
    }
    return k;
  }
  const at = (b) => b.x + ',' + b.y + ',' + b.d;

  async function check(level, index) {
    A.goLevel(index);
    A.setVars(VARS[level.id] || []);
    A.setProg(clone(SOLUTIONS[level.id]));
    A.clearResult();
    A.resetRun();
    const start = at(A.world.bot);
    const want = level.goal === 'out' ? 1 : 0;
    let border = borderOpenings(A.world) === want;
    await A.runAll();
    /* a level with variants restarts itself on its next maze: wait for each */
    const mazes = 1 + (level.variants ? level.variants.length : 0);
    let r, solved = 0;
    for (let m = 0; m < mazes; m++) {
      r = await verdict();
      border = border && borderOpenings(A.world) === want;
      if (!r.win) break;
      solved++;
      if (m < mazes - 1) A.clearResult();
    }

    const used = A.countBlocks(A.prog);
    const stars = A.starsFor(used, level.par);
    return {
      id: level.id,
      name: level.name.de,
      ok: r.win && solved === mazes && stars === 3 && start === '0,0,N' && border,
      detail: (r.win ? 'solved' : 'FAILED (' + r.reason + ')') +
              (mazes > 1 ? ' ' + solved + '/' + mazes + ' mazes' : '') +
              ', ' + used + ' blocks, par ' + level.par + ', ' + stars + ' stars, start ' + start +
              (want ? ', one exit' : '') + (border ? '' : ' - BORDER WRONG'),
    };
  }

  /* Tournament counters after the intended solutions, against the scoring
   * of docs/curriculum/anhang-turnier.md (cell 10, turn 8). Task 2's 48 and
   * task 5's 74 are the numbers the curriculum itself quotes. */
  const STATS = { 1: [2, 0, 20], 2: [4, 1, 48], 3: [6, 2, 76], 4: [4, 1, 48], 5: [5, 3, 74], 8: [6, 3, 84] };
  const seen = {};
  function statsCheck() {
    const bad = [];
    for (const id in STATS) {
      const s = seen[id], [m, tr, p] = STATS[id];
      if (!s || s.moves !== m || s.turns !== tr || s.points !== p || s.points !== 10 * s.moves + 8 * s.turns) {
        bad.push(id + ': ' + JSON.stringify(s));
      }
    }
    return { id: 'stats', ok: !bad.length,
             detail: 'cells / turns / drive-time points: ' + (bad.length ? 'BAD ' + bad.join('; ')
               : Object.keys(STATS).map((id) => 'task ' + id + ' ' + seen[id].points).join(', ')) };
  }

  /* Task 3 teaches the loop: the shortcut along the bottom is walled off,
   * and without a loop it costs 8 blocks and one star. */
  async function loopCheck(index) {
    const run = async (p) => {
      A.goLevel(index); A.setProg(clone(p)); A.clearResult(); A.resetRun();
      await A.runAll();
      return verdict();
    };
    const cut = await run([B('right'), B('move'), B('move')]);
    const long = [B('move'), B('move'), B('right'), B('move'), B('move'), B('right'), B('move'), B('move')];
    const flat = await run(long);
    const stars = A.starsFor(A.countBlocks(long), A.LEVELS[index].par);
    return { id: 'loop3', ok: !cut.win && cut.reason === 'failedWall' && flat.win && stars === 1,
             detail: 'shortcut right/move/move: ' + (cut.win ? 'WINS' : 'blocked (' + cut.reason + ')') +
                     '; 8 blocks without a loop: ' + (flat.win ? 'solved' : 'FAILED') + ', ' + stars + ' star(s)' };
  }

  /* A stand-in robot that answers from the simulator's maze. */
  function botReply(line) {
    const w = A.world, b = w.bot;
    const open = (d) => w.inside(b.x, b.y) && !w.walls[b.x][b.y][d];
    const R = { N: 'E', E: 'S', S: 'W', W: 'N' }, L = { N: 'W', W: 'S', S: 'E', E: 'N' };
    if (line === 'CELL') return [open(b.d) ? 'CELL done' : 'CELL failed'];
    if (/^TURN /.test(line)) return ['TURN done (event 0)'];
    if (line === 'WALLS') {
      const f = (d) => (open(d) ? '300' : '60(wall)');
      return ['WALLS: F=' + f(b.d) + ' L=' + f(L[b.d]) + ' R=' + f(R[b.d])];
    }
    return [];
  }

  /* Task 6 with the real robot: after each maze the run waits for Weiter -
   * nothing starts by itself. */
  async function chainCheck(index) {
    const level = A.LEVELS[index];
    const mazes = 1 + level.variants.length;
    const bar = document.getElementById('verdict');
    let ok = true, why = '';
    A.goLevel(index);
    A.setProg(clone(SOLUTIONS[6]));
    A.clearResult();
    A.resetRun();
    A.fakeRobot(botReply);
    try {
      await A.runAll();
      for (let m = 0; m < mazes; m++) {
        const r = await verdict();
        if (!r.win) { ok = false; why = 'maze ' + (m + 1) + ' ' + r.reason; break; }
        if (m === mazes - 1) break;
        const btn = bar.querySelector('button');
        await sleep(1500);                                   /* the simulation would have gone on by now */
        if (!btn || A.world.trail.length) { ok = false; why = 'started by itself after maze ' + (m + 1); break; }
        A.clearResult();
        btn.click();
      }
    } finally {
      A.fakeRobot(null);
    }
    return { id: 'chain6', ok, detail: 'task 6, real robot: ' + (ok ? 'waits for Weiter after each maze, ' + mazes + '/' + mazes + ' solved' : 'BAD ' + why) };
  }

  /* No answer from the robot is its own message, not a wall. */
  async function silentCheck() {
    const out = [];
    A.setTimeScale(0.01);
    A.fakeRobot(() => []);
    try {
      for (const [id, prog] of [[1, [B('move'), B('move')]], [4, SOLUTIONS[4]]]) {
        A.goLevel(A.LEVELS.findIndex((l) => l.id === id));
        A.setProg(clone(prog));
        A.clearResult();
        A.resetRun();
        await A.runAll();
        out.push((await verdict()).reason);
      }
    } finally {
      A.fakeRobot(null);
      A.setTimeScale(1);
    }
    return { id: 'silent', ok: out.every((r) => r === 'botSilent'),
             detail: 'robot silent on CELL and on WALLS: ' + out.join(', ') };
  }

  async function ownCheck(c, index) {
    A.goLevel(index);
    if (!A.setSandbox(c.maze)) return { id: c.id, ok: false, detail: c.name + ': maze refused' };
    A.setProg(clone(c.prog));
    A.clearResult();
    A.resetRun();
    const s = c.maze.start || { x: 0, y: 0, d: 'N' };
    const startOk = at(A.world.bot) === at(s);
    const openings = borderOpenings(A.world);
    await A.runAll();
    const r = await verdict();
    const id = A.LEVELS[index].id;
    const noStars = !(id in A.done);
    const goalOk = c.maze.goal ? A.world.goal !== 'out' && openings === 0 : A.world.goal === 'out' && openings === 1;
    return {
      id: c.id,
      ok: r.win && noStars && goalOk && startOk && A.world.n === c.maze.n,
      detail: c.name + ': ' + (r.win ? 'solved' : 'FAILED (' + r.reason + ')') + ', ' +
              A.countBlocks(A.prog) + ' blocks' + (noStars ? ', no stars' : ', STARS GIVEN') +
              (startOk ? '' : ', START WRONG') + (goalOk ? '' : ', GOAL WRONG'),
    };
  }

  /* A run on an own maze with a given program: the result, and the robot
   * where it started. */
  async function play(own, maze, prog) {
    A.goLevel(own);
    if (!A.setSandbox(maze)) return { r: { win: false, reason: 'maze refused' }, start: '' };
    A.setProg(clone(prog));
    A.clearResult();
    A.resetRun();
    const start = at(A.world.bot);
    await A.runAll();
    return { r: await verdict(), start };
  }

  /* The own maze's rules, played through. Start outside: in only through an
   * opening, out (any opening, even the way in) wins without a star. With a
   * star only the star wins - outside is just outside. No star and no
   * opening: nothing runs, a message says why. */
  async function ruleChecks(own) {
    const out = [];
    let p = await play(own, { n: 4, walls: [], exits: ['0,1,W', '3,2,E'], goal: null, start: { x: -1, y: 1, d: 'E' } },
      [B('move'), B('move'), B('move'), B('move'), B('left'), B('move'), B('right'), B('move')]);
    out.push({ id: 'out7', ok: p.r.win && p.start === '-1,1,E',
               detail: 'start outside, in through one opening, out through another: ' + (p.r.win ? 'won' : 'FAILED (' + p.r.reason + ')') });
    p = await play(own, { n: 4, walls: [], exits: ['0,1,W'], goal: null, start: { x: -1, y: 1, d: 'E' } },
      [B('move'), B('around'), B('move')]);
    out.push({ id: 'back7', ok: p.r.win, detail: 'no star: back out through the way in counts too (own game, no policing): ' + (p.r.win ? 'won' : 'FAILED (' + p.r.reason + ')') });
    p = await play(own, { n: 4, walls: [], exits: ['2,0,S'], goal: { x: 2, y: 3 }, start: { x: 2, y: -1, d: 'N' } },
      [B('repeat', { n: 4, body: [B('move')] })]);
    out.push({ id: 'star7', ok: p.r.win && p.start === '2,-1,N', detail: 'start outside below the maze, star inside: ' + (p.r.win ? 'won' : 'FAILED (' + p.r.reason + ')') });
    p = await play(own, { n: 3, walls: [], exits: ['0,0,W'], goal: { x: 2, y: 2 } }, [B('left'), B('move')]);
    out.push({ id: 'starOut7', ok: !p.r.win && p.r.reason === 'failedEnd',
               detail: 'with a star, driving out is no win: ' + (p.r.win ? 'WON' : 'no win (' + p.r.reason + ')') });
    p = await play(own, { n: 4, walls: [], exits: [], goal: null }, [B('move')]);
    const bar = document.getElementById('verdict');
    out.push({ id: 'nogoal7', ok: !A.lastResult && !bar.hidden && A.world.trail.length === 0,
               detail: 'no star, no opening: nothing runs, message "' + (bar.hidden ? '' : bar.textContent) + '"' });
    return out;
  }

  /* The editing rules, through the same edits a click makes. */
  function editCheck(own) {
    const bad = [];
    const m = () => A.exportData().maze;
    const expect = (what, cond) => { if (!cond) bad.push(what); };
    A.goLevel(own);
    A.setSandbox({ n: 4, walls: [], exits: [], goal: { x: 3, y: 3 } });
    A.edit('walls', { edge: '3,1,E' });
    A.edit('walls', { edge: '0,3,N' });
    expect('openings: as many as you like, the star stays', m().exits.length === 2 && m().goal && m().goal.x === 3);
    A.edit('walls', { edge: '3,1,E' });
    expect('border line again closes it', m().exits.join() === '0,3,N');
    expect('no star on the start cell', !A.edit('goal', { cell: { x: 0, y: 0 } }) && m().goal.x === 3);
    expect('no start on the star', !A.edit('start', { cell: { x: 3, y: 3 } }));
    const turns = [];
    for (let i = 0; i < 4; i++) { A.edit('start', { cell: { x: 0, y: 0 } }); turns.push(m().start.d); }
    expect('start cell again turns right: E,S,W,N', turns.join() === 'E,S,W,N');
    A.edit('start', { cell: { x: -1, y: 2 } });
    expect('start just outside the border, same heading', at(m().start) === '-1,2,N' && at(A.world.bot) === '-1,2,N');
    expect('no start on a ring corner or farther out', !A.edit('start', { cell: { x: -1, y: -1 } }) && !A.edit('start', { cell: { x: -2, y: 1 } }));
    A.edit('goal', { cell: { x: 3, y: 3 } });
    expect('star again takes it away', m().goal === null);
    return { id: 'edit', ok: !bad.length,
             detail: 'pure toggles, star and openings side by side, start inside or just outside: ' + (bad.length ? 'BAD ' + bad.join('; ') : 'all rules hold') };
  }

  /* Zufall, checked independently of code.js: walk the maze from a cell
   * and count steps. */
  const STEP = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
  function walk(mz, from) {
    const n = mz.n, wall = new Set(mz.walls);
    const shut = (x, y, d) => (d === 'N' ? wall.has(x + ',' + y + ',N') : d === 'E' ? wall.has(x + ',' + y + ',E')
      : d === 'S' ? wall.has(x + ',' + (y - 1) + ',N') : wall.has((x - 1) + ',' + y + ',E'));
    const dist = new Map([[from.x + ',' + from.y, 0]]);
    const queue = [[from.x, from.y]];
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i];
      for (const d in STEP) {
        const nx = x + STEP[d][0], ny = y + STEP[d][1];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || dist.has(nx + ',' + ny) || shut(x, y, d)) continue;
        dist.set(nx + ',' + ny, dist.get(x + ',' + y) + 1);
        queue.push([nx, ny]);
      }
    }
    return dist;
  }

  /* Starts for the random checks: inside, or just outside on some side. */
  const startFor = (n, r) => [{ x: 0, y: 0, d: 'N' }, { x: -1, y: 1, d: 'E' }, { x: n - 1, y: 0, d: 'W' },
                              { x: Math.floor(n / 2), y: n, d: 'S' }][r % 4];
  const inGrid = (c, n) => c.x >= 0 && c.y >= 0 && c.x < n && c.y < n;
  const firstCell = (s, n) => ({ x: Math.min(n - 1, Math.max(0, s.x)), y: Math.min(n - 1, Math.max(0, s.y)) });

  /* Every random maze must be perfect: all cells reachable, n*n-1 openings
   * (a tree, so exactly one way between two cells). The start stays as
   * placed; a start outside gets its way in; a star goes to the cell
   * farthest from the start; without a star there is an exit at the
   * farthest border cell; no other opening is left. */
  function randomCheck(n, own, runs) {
    A.goLevel(own);
    const bad = [];
    for (let r = 0; r < runs; r++) {
      const starMode = r % 2 === 0;
      const start = startFor(n, r);
      const first = firstCell(start, n);
      A.setSandbox({ n, walls: [], start, exits: ['0,1,W', (n - 1) + ',0,S'],
                     goal: starMode ? { x: Math.floor(n / 2), y: Math.floor(n / 2) + 1 } : null });
      A.randomize();
      const mz = A.exportData().maze;
      const dist = walk(mz, first);
      let far = -1, farBorder = -1;
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
        const k = dist.get(x + ',' + y);
        far = Math.max(far, k);
        if (x === 0 || y === 0 || x === n - 1 || y === n - 1) farBorder = Math.max(farBorder, k);
      }
      const wayIn = inGrid(start, n) ? null
        : first.x + ',' + first.y + ',' + (start.x < 0 ? 'W' : start.x >= n ? 'E' : start.y < 0 ? 'S' : 'N');
      const others = mz.exits.filter((e) => e !== wayIn);
      const why = [];
      if (dist.size !== n * n) why.push('unreachable cells');
      if (mz.walls.length !== 2 * n * (n - 1) - (n * n - 1)) why.push('not a perfect maze');
      if (at(mz.start) !== at(start)) why.push('start moved');
      if (wayIn && !mz.exits.includes(wayIn)) why.push('no way in');
      if (starMode) {
        if (!mz.goal) why.push('star gone');
        else if (dist.get(mz.goal.x + ',' + mz.goal.y) !== far) why.push('star not the farthest');
        if (others.length) why.push('openings left');
      } else if (others.length !== 1) {
        why.push(others.length + ' exits');
      } else {
        const [x, y, d] = others[0].split(',');
        const nx = +x + STEP[d][0], ny = +y + STEP[d][1];
        if (!(nx < 0 || ny < 0 || nx >= n || ny >= n)) why.push('exit not on the border');
        else if (dist.get(x + ',' + y) !== farBorder) why.push('exit not the farthest');
      }
      if (why.length) bad.push(why.join('/'));
    }
    return { id: 'rnd' + n, ok: !bad.length,
             detail: runs + ' random ' + n + 'x' + n + ' mazes, starts inside and outside: ' + (bad.length ? 'BAD ' + bad.join('; ')
               : 'perfect, all cells reachable; start kept, way in open; star or exit farthest from the start') };
  }

  /* Zufall mazes are solvable: the right-hand rule (FOLLOWER, the variant
   * that also handles dead ends) walks every corridor of a perfect maze, so
   * it reaches the star, or gets out - from a start inside or outside. */
  async function solveCheck(id, n, own, runs, starMode) {
    let won = 0, why = '';
    for (let r = 0; r < runs; r++) {
      A.goLevel(own);
      A.setSandbox({ n, walls: [], exits: [], start: startFor(n, r),
                     goal: starMode ? { x: Math.floor(n / 2), y: Math.floor(n / 2) + 1 } : null });
      A.randomize();
      A.setProg(clone(FOLLOWER));
      A.clearResult();
      A.resetRun();
      await A.runAll();
      const res = await verdict();
      if (res.win) won++; else why = res.reason;
    }
    return { id, ok: won === runs,
             detail: 'wall follower ' + (starMode ? 'reaches the star in ' : 'gets out of ') + won + '/' + runs +
                     ' random ' + n + 'x' + n + ' mazes' + (runs > 1 ? ' (starts inside and outside)' : '') +
                     (why ? ' (failed: ' + why + ')' : '') };
  }

  /* The real robot only knows mazes up to 5x5. No robot is connected here,
   * so only the guard is tested: 8x8 is refused with the 5x5 message before
   * anything runs; 5x5 is not (it asks for the robot instead). */
  async function botCapCheck(own) {
    const chk = document.getElementById('realChk');
    const bar = document.getElementById('verdict');
    const text = () => (bar.hidden ? '' : bar.textContent);
    const cap = /5\u00a0\u00d7\u00a05/;
    A.goLevel(own);
    A.setProg([B('move')]);
    chk.checked = true;
    try {
      A.setSandbox({ n: 8, walls: [], exits: [], goal: { x: 7, y: 7 } });
      A.clearResult();
      await A.runAll();
      const t8 = text(), ran8 = !!A.lastResult || A.world.trail.length > 0;
      A.setSandbox({ n: 5, walls: [], exits: [], goal: { x: 4, y: 4 } });
      A.clearResult();
      await A.runAll();
      const t5 = text(), ran5 = !!A.lastResult || A.world.trail.length > 0;
      return { id: 'bot8', ok: cap.test(t8) && !ran8 && !cap.test(t5) && !ran5,
               detail: 'Echter Roboter on 8x8: ' + (cap.test(t8) && !ran8 ? 'refused, 5x5 message' : 'NOT REFUSED') +
                       '; on 5x5: ' + (cap.test(t5) ? 'WRONGLY CAPPED' : 'no cap') };
    } finally {
      chk.checked = false;
    }
  }

  /* Speichern / Oeffnen: the file format and the strict check on opening. */
  function fileChecks(level5, own) {
    const out = [];
    const add = (id, ok, detail) => out.push({ id, ok: !!ok, detail });
    const P = (o) => JSON.stringify(Object.assign({ version: 1, level: 1, lang: 'de' }, o));

    A.goLevel(level5);
    A.setVars([]);
    A.setProg(clone(SOLUTIONS[5]));
    const d5 = A.exportData();
    const b5 = A.parseFile(JSON.stringify(d5, null, 2));
    add('file1', d5.version === 2 && d5.level === 5 && d5.lang && !('maze' in d5) && b5 &&
        b5.level === 5 && JSON.stringify(b5.prog) === JSON.stringify(d5.prog),
        'saved task-5 program opens again unchanged');

    A.goLevel(own);
    A.setSandbox(OWN[4].maze);
    const d7 = A.exportData();
    const b7 = A.parseFile(JSON.stringify(d7));
    add('file2', d7.maze && b7 && b7.maze && b7.maze.n === 4 &&
        JSON.stringify(b7.maze.m) === JSON.stringify({ walls: d7.maze.walls, exits: d7.maze.exits, goal: d7.maze.goal, start: d7.maze.start }),
        'own maze (with its start) is saved with the program and opens again');

    const c = A.parseFile(P({ prog: [B('repeat', { n: 42, body: [B('move')] }),
      B('repeat', { n: -3, body: [] }), B('repeat', { n: 2.6, body: [] })] }));
    add('file3', c && c.prog[0].n === 9 && c.prog[1].n === 1 && c.prog[2].n === 3,
        'repeat counts clamped to 1..9');

    const s = A.parseFile(P({ prog: [{ t: 'move', n: 5, onclick: 'alert(1)', body: [] }] }));
    add('file4', s && JSON.stringify(s.prog) === '[{"t":"move"}]', 'unknown keys dropped');

    let deep = [B('move')];
    for (let i = 0; i < 40; i++) deep = [B('repeat', { n: 2, body: deep })];
    const bad = [
      'not json', '', '[]', 'null', '"text"',
      P({ version: 3, prog: [] }),
      P({ prog: {} }),
      P({ prog: [B('jump')] }),
      P({ prog: [{ t: '__proto__' }] }),
      P({ prog: [{ t: 'constructor' }] }),
      P({ prog: [B('ifElse', { cond: 'alert(1)', body: [], alt: [] })] }),
      P({ prog: [B('repeat', { n: '3', body: [] })] }),
      P({ prog: [B('repeat', { n: 3 })] }),
      P({ prog: deep }),
      P({ prog: [], maze: { n: 33, walls: [], exits: [], goal: null } }),
      P({ prog: [], maze: { n: 2, walls: [], exits: [], goal: null } }),
      P({ prog: [], maze: { n: 3, walls: ['0,0,W'], exits: [], goal: null } }),
      P({ prog: [], maze: { n: 3, walls: [], exits: ['1,1,N'], goal: null } }),
      P({ prog: [], maze: { n: 3, walls: [], exits: [], goal: { x: 3, y: 0 } } }),
      P({ prog: [], maze: { n: 3, walls: [], exits: [], goal: { x: 0, y: 0 } } }),
      P({ prog: [], maze: { n: 3, walls: [], exits: [], goal: null, start: { x: 1, y: 1, d: 'X' } } }),
    ];
    const through = bad.filter((txt) => A.parseFile(txt) !== null);
    add('file5', !through.length, bad.length + ' broken or hostile files refused' +
        (through.length ? ' - LET THROUGH: ' + through.join(' | ') : ''));
    return out;
  }

  /* ---------------- variables ---------------- */
  const V = (v, op, n) => ({ v, op, n });
  const EMPTY3 = { n: 3, walls: [], exits: [], goal: { x: 2, y: 2 } };

  /* A program on the own maze (3x3, no walls, star top right): the result
     and the variables' values at the end. */
  async function runOwn(own, names, prog, maze) {
    A.goLevel(own);
    A.setSandbox(maze || EMPTY3);
    A.setVars(names);
    A.setProg(clone(prog));
    A.clearResult();
    A.resetRun();
    await A.runAll();
    const r = await verdict();
    return { r, vals: A.varValues };
  }

  /* All mazes of a level (variants restart on their own in the simulation). */
  async function playLevel(index, names, prog) {
    A.goLevel(index);
    A.setVars(names);
    A.setProg(clone(prog));
    A.clearResult();
    A.resetRun();
    await A.runAll();
    const lv = A.LEVELS[index];
    const mazes = 1 + (lv.variants ? lv.variants.length : 0);
    let r, solved = 0;
    for (let m = 0; m < mazes; m++) {
      r = await verdict();
      if (!r.win) break;
      solved++;
      if (m < mazes - 1) A.clearResult();
    }
    return { r, solved, mazes, stars: A.starsFor(A.countBlocks(prog), lv.par) };
  }

  /* setze / aendere (also by a negative number) / the three comparisons;
     every run starts at 0 again */
  async function varSemantics(own) {
    const prog = [
      B('setVar', { v: 'a', n: 3 }),
      B('changeVar', { v: 'a', n: -1 }),
      B('changeVar', { v: 'a', n: 5 }),
      B('ifElse', { cond: V('a', '>', 6), body: [B('changeVar', { v: 'b', n: 1 })], alt: [B('changeVar', { v: 'b', n: 100 })] }),
      B('ifElse', { cond: V('a', '<', 7), body: [B('changeVar', { v: 'b', n: 10 })], alt: [B('changeVar', { v: 'b', n: 2 })] }),
      B('ifElse', { cond: V('a', '=', 7), body: [B('changeVar', { v: 'b', n: 20 })], alt: [] }),
      B('changeVar', { v: 'c', n: -1 }),
      B('changeVar', { v: 'c', n: -1 }),
      B('ifElse', { cond: V('c', '<', -1), body: [B('setVar', { v: 'd', n: 1 })], alt: [B('setVar', { v: 'd', n: 2 })] }),
    ];
    const one = await runOwn(own, ['a', 'b', 'c', 'd'], prog);
    const two = await runOwn(own, ['a', 'b', 'c', 'd'], prog);
    const want = '{"a":7,"b":23,"c":-2,"d":1}';
    const got1 = JSON.stringify(one.vals), got2 = JSON.stringify(two.vals);
    return { id: 'varSet', ok: got1 === want && got2 === want && one.r.reason === 'failedEnd',
             detail: 'setze 3, \u00e4ndere -1 and +5, > < = in wenn, negatives: ' + got1 +
                     (got2 === got1 ? ', same again on the next run (starts at 0)' : ', SECOND RUN ' + got2) };
  }

  /* wiederhole bis: checks before each round; a comparison or a sensor */
  async function untilCheck(own) {
    const bad = [];
    let p = await runOwn(own, ['a', 'r'], [B('repeatUntil', { cond: V('a', '=', 4), body: [B('changeVar', { v: 'a', n: 1 }), B('changeVar', { v: 'r', n: 1 })] })]);
    if (p.vals.a !== 4 || p.vals.r !== 4) bad.push('a=4 after 4 rounds: ' + JSON.stringify(p.vals));
    p = await runOwn(own, ['a'], [B('repeatUntil', { cond: V('a', '>', 9), body: [B('changeVar', { v: 'a', n: 3 })] })]);
    if (p.vals.a !== 12) bad.push('> 9 in steps of 3: ' + p.vals.a);
    p = await runOwn(own, ['a', 'r'], [B('repeatUntil', { cond: V('a', '=', 0), body: [B('changeVar', { v: 'r', n: 1 })] })]);
    if (p.vals.r !== 0) bad.push('true at once, body must not run: r=' + p.vals.r);
    p = await runOwn(own, [], [B('repeatUntil', { cond: 'frontWall', body: [B('move')] })]);
    const w = A.world;
    if (p.r.reason !== 'failedEnd' || w.bot.y !== 2 || w.moves !== 2) bad.push('until wall ahead: ' + p.r.reason + ' at y=' + w.bot.y);
    return { id: 'until', ok: !bad.length,
             detail: 'wiederhole bis: counts to 4, > 9, true at once (0 rounds), "vorne Wand" stops at the wall: ' + (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* a condition that never comes true still ends, at the action budget */
  async function budgetCheck(own) {
    const a = await runOwn(own, ['a'], [B('repeatUntil', { cond: V('a', '=', 5), body: [B('changeVar', { v: 'a', n: 2 })] })]);
    const b = await runOwn(own, ['a'], [B('repeatUntil', { cond: V('a', '=', 1), body: [] })]);
    const c = await runOwn(own, [], [B('repeatUntil', { cond: 'frontFree', body: [B('right')] }),
                                     B('repeatUntil', { cond: 'leftWall', body: [B('right')] })],
                           { n: 3, walls: ['0,0,N', '0,0,E'], exits: [], goal: { x: 2, y: 2 } });
    const ok = [a, b, c].every((x) => x.r.reason === 'failedLong');
    return { id: 'budget', ok, detail: 'never-true "wiederhole bis" (+2 never hits 5; empty body; turning in a closed corner): ' +
             [a, b, c].map((x) => x.r.reason).join(', ') };
  }

  /* the watch panel: 0 at the start, the new value after each step with a
     gold outline on what changed last, "zeige" as a bubble and in the log,
     everything back to 0 on Zurueck; hidden without variables */
  async function watchCheck(own) {
    const bad = [];
    const box = document.getElementById('watch');
    const item = (v) => document.querySelector('#watchList .wv[data-var="' + v + '"]');
    const val = (v) => (item(v) ? item(v).querySelector('.wv-val').textContent : '?');
    A.goLevel(own);
    A.setSandbox(EMPTY3);
    A.setVars(['a', 'b']);
    A.setProg([B('setVar', { v: 'a', n: 3 }), B('changeVar', { v: 'b', n: -1 }), B('showVar', { v: 'a' }), B('move')]);
    A.clearResult();
    A.resetRun();
    if (box.hidden || val('a') !== '0' || val('b') !== '0') bad.push('start: ' + val('a') + '/' + val('b'));
    await A.stepOnce();
    if (val('a') !== '3' || !item('a').classList.contains('is-new') || !item('a').classList.contains('bump')) bad.push('after setze: a=' + val('a'));
    await A.stepOnce();
    if (val('b') !== '\u22121' || !item('b').classList.contains('is-new') || item('a').classList.contains('is-new')) bad.push('after \u00e4ndere: b=' + val('b'));
    await A.stepOnce();
    const bubble = document.querySelector('#maze #bubble text');
    const log = document.getElementById('watchLog');
    if (!bubble || bubble.textContent !== 'a: 3') bad.push('no bubble "a: 3"');
    if (log.hidden || !/a: 3/.test(log.textContent)) bad.push('log: "' + log.textContent + '"');
    await A.stepOnce();
    if (document.querySelector('#maze #bubble')) bad.push('bubble stays after driving on');
    A.resetRun();
    if (val('a') !== '0' || val('b') !== '0' || !log.hidden) bad.push('after Zur\u00fcck: ' + val('a') + '/' + val('b'));
    A.setVars([]);
    if (!box.hidden) bad.push('shown without variables');
    return { id: 'watch', ok: !bad.length, detail: 'watch panel: 0 at the start, live values, gold on the last change, zeige bubble and log, reset, hidden without variables: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* "Neue Variable" in the palette, through the page itself: the inline
     field with its suggestion, the name rules, the blocks appearing, and
     deleting only what no block uses. Tasks 1-6 have no Variablen box. */
  async function varUiCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    const P = A.varNameProblem;
    const good = ['Schritte', 'Z\u00e4hler', 'x1', 'abcdefghijkl', '\u00dcber', 'constructor'];
    const wrong = ['', '1x', 'a b', 'abcdefghijklm', '__proto__', 'Z\u00e4hler-2', 'caf\u00e9'];
    for (const n of good) if (P(n, [])) bad.push('refused ' + n);
    for (const n of wrong) if (!P(n, [])) bad.push('took "' + n + '"');
    if (P('schritte', ['Schritte']) !== 'varTaken') bad.push('case-insensitive duplicate');
    A.goLevel(own);
    A.setVars([]);
    A.setProg([]);
    if (q('#paletteList [data-type="setVar"]')) bad.push('blocks before any variable');
    q('#newVarBtn').click();
    const inp = q('#varNameIn');
    if (!inp || inp.value !== 'Schritte') bad.push('suggestion "' + (inp && inp.value) + '"');
    inp.value = '1x';
    inp.dispatchEvent(new Event('input'));
    if (!q('.var-ok').disabled || !q('.var-msg').textContent) bad.push('bad name not stopped');
    inp.value = 'Schritte';
    inp.dispatchEvent(new Event('input'));
    q('.var-new').requestSubmit();
    if (A.vars.join() !== 'Schritte') bad.push('not created: ' + A.vars.join());
    for (const ty of ['setVar', 'changeVar', 'showVar']) if (!q('#paletteList [data-type="' + ty + '"]')) bad.push('no ' + ty + ' block');
    q('#newVarBtn').click();
    if (q('#varNameIn').value !== 'Z\u00e4hler') bad.push('second suggestion "' + q('#varNameIn').value + '"');
    q('#varNameIn').value = 'SCHRITTE';
    q('#varNameIn').dispatchEvent(new Event('input'));
    if (!q('.var-ok').disabled) bad.push('duplicate allowed');
    q('.var-x').click();
    A.setProg([B('showVar', { v: 'Schritte' })]);
    if (A.deleteVar('Schritte') || A.vars.length !== 1 || !/Schritte/.test(q('#paletteList .var-msg').textContent)) bad.push('deleted a used variable');
    A.setProg([]);
    if (!A.deleteVar('Schritte') || A.vars.length) bad.push('could not delete an unused variable');
    const withVars = [];
    for (let i = 0; i < A.LEVELS.length; i++) {
      A.goLevel(i);
      if (q('#paletteList .cat-var')) withVars.push(A.LEVELS[i].id);
    }
    if (withVars.join() !== '7,8,9') bad.push('Variablen box on tasks ' + withVars.join());
    const ids = A.LEVELS.map((l) => l.id).join();
    if (ids !== '1,2,3,4,5,6,7,8,9' || !A.LEVELS[6].sandbox) bad.push('task ids ' + ids);
    return { id: 'varUi', ok: !bad.length, detail: 'Neue Variable: field with suggestion, name rules, blocks appear, delete only unused; box on tasks 7-9 only; ids 1-9 stable: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* Wrong programs must not win tasks 8 and 9. */
  async function varTaskNegatives(i8, i9) {
    const out = [];
    let p = await playLevel(i8, ['Schritte'], [B('repeat', { n: 3, body: [B('repeat', { n: 2, body: [B('move')] }), B('right')] })]);
    const noCount = p.r.reason;
    p = await playLevel(i8, ['Schritte'], [B('repeat', { n: 3, body: [B('repeat', { n: 2, body: [B('move')] }), B('changeVar', { v: 'Schritte', n: 1 }), B('right')] })]);
    const half = p.r.reason;
    p = await playLevel(i8, ['Schritte'], [B('repeat', { n: 3, body: [B('move'), B('changeVar', { v: 'Schritte', n: 1 }), B('move'), B('changeVar', { v: 'Schritte', n: 1 }), B('right')] })]);
    const oneLoop = p.r.win && p.stars === 3;
    out.push({ id: 'neg8', ok: noCount === 'failedCount' && half === 'failedCount' && oneLoop,
               detail: 'task 8: to the star without counting: ' + noCount + '; counting once per corner: ' + half +
                       '; one loop counting every cell (6 blocks): ' + (oneLoop ? 'solved, 3 stars' : 'NOT 3 STARS') });

    const more = await playLevel(i9, ['Schritte'], UNTIL5(V('Schritte', '>', 5)));
    const wall = await playLevel(i9, [], [B('repeatUntil', { cond: 'frontWall', body: [B('move')] })]);
    const noTurn = await playLevel(i9, ['Schritte'], [B('repeatUntil', { cond: V('Schritte', '=', 5), body: [B('move'), B('changeVar', { v: 'Schritte', n: 1 })] })]);
    const flat = await playLevel(i9, [], [B('move'), B('move'), B('right'), B('move'), B('move'), B('right'), B('move')]);
    /* a fixed number of rounds fits one maze, never all three */
    const fixed7 = await playLevel(i9, [], [B('repeat', { n: 7, body: [B('ifElse', { cond: 'frontFree', body: [B('move')], alt: [B('right')] })] })]);
    const fixed8 = await playLevel(i9, [], [B('repeat', { n: 8, body: [B('ifElse', { cond: 'frontFree', body: [B('move')], alt: [B('right')] })] })]);
    const back = await playLevel(i9, ['Schritte'], UNTIL5(V('Schritte', '=', 6)).concat([B('around'), B('move')]));
    const nested = await playLevel(i9, ['Schritte'], [B('repeatUntil', { cond: V('Schritte', '=', 5), body: [
      B('repeatUntil', { cond: 'frontFree', body: [B('right')] }), B('move'), B('changeVar', { v: 'Schritte', n: 1 })] })]);
    const ok = more.r.reason === 'failedOffStar' && !wall.r.win && noTurn.r.reason === 'failedWall' &&
               flat.solved === 1 && !flat.r.win && fixed7.solved < 3 && fixed8.solved < 3 &&
               back.r.reason === 'failedCells' && nested.solved === 3 && nested.stars === 3;
    out.push({ id: 'neg9', ok,
               detail: 'task 9: until Schritte > 5: ' + more.r.reason + '; until wall ahead: ' + wall.r.reason +
                       '; no turning: ' + noTurn.r.reason + '; fixed moves: ' + flat.solved + '/3 (' + flat.r.reason + ')' +
                       '; wiederhole 7 mal / 8 mal: ' + fixed7.solved + '/3, ' + fixed8.solved + '/3' +
                       '; past the star and back (7 cells): ' + back.r.reason +
                       '; until Schritte = 5 around "until front free: turn": ' + nested.solved + '/3, ' + nested.stars + ' stars' });
    return out;
  }

  /* Variables never reach the robot: task 8 sends only CELL and TURN, and
     task 9 asks WALLS only for its sensor "wenn" - never for a comparison. */
  async function botVarCheck(i8, i9) {
    const lines = [];
    const rec = (line) => { lines.push(line); return botReply(line); };
    let r8, r9, sent8, sent9;
    try {
      A.goLevel(i8);
      A.setVars(['Schritte']);
      A.setProg(clone(SOLUTIONS[8]));
      A.clearResult();
      A.resetRun();
      A.fakeRobot(rec);
      await A.runAll();
      r8 = await verdict();
      sent8 = lines.splice(0).join(',');
      A.fakeRobot(null);
      A.goLevel(i9);
      A.setVars(['Schritte']);
      A.setProg(clone(SOLUTIONS[9]));
      A.clearResult();
      A.resetRun();
      A.fakeRobot(rec);
      await A.runAll();
      r9 = await verdict();                         /* first maze; then it waits for Weiter */
      sent9 = lines.splice(0);
    } finally {
      A.fakeRobot(null);
      A.resetRun();
    }
    const want8 = 'CELL,CELL,TURN 90,CELL,CELL,TURN 90,CELL,CELL,TURN 90';
    const n = (k) => sent9.filter((l) => l === k).length;
    const only9 = sent9.every((l) => l === 'CELL' || l === 'TURN 90' || l === 'WALLS');
    const ok = r8.win && sent8 === want8 && r9.win && only9 && n('CELL') === 5 && n('TURN 90') === 2 && n('WALLS') === 7;
    return { id: 'botVar', ok, detail: 'real robot, variables stay in the browser: task 8 sent ' + sent8 +
             (sent8 === want8 ? '' : ' (WANTED ' + want8 + ')') + '; task 9 maze 1: ' + n('CELL') + ' CELL, ' + n('TURN 90') +
             ' TURN, ' + n('WALLS') + ' WALLS (7 sensor checks, 8 comparisons not sent)' + (only9 ? '' : ', OTHER LINES ' + sent9.join(',')) +
             ', ' + (r8.win && r9.win ? 'both solved' : 'NOT SOLVED') };
  }

  /* Files v2 with variables; version 1 still opens; strict checks. Also
     what goes into localStorage. */
  function varFileChecks(i9, own) {
    const out = [];
    const add = (id, ok, detail) => out.push({ id, ok: !!ok, detail });
    const P2 = (o) => JSON.stringify(Object.assign({ version: 2, level: 9, lang: 'de', vars: ['a'] }, o));
    const P1 = (o) => JSON.stringify(Object.assign({ version: 1, level: 5, lang: 'de' }, o));

    A.goLevel(i9);
    A.setVars(['Schritte', 'constructor']);
    A.setProg(clone(SOLUTIONS[9]).concat([B('setVar', { v: 'constructor', n: -7 }), B('showVar', { v: 'Schritte' })]));
    const d = A.exportData();
    const b = A.parseFile(JSON.stringify(d, null, 2));
    add('fileVar1', d.version === 2 && JSON.stringify(d.vars) === '["Schritte","constructor"]' && b &&
        JSON.stringify(b.vars) === JSON.stringify(d.vars) && JSON.stringify(b.prog) === JSON.stringify(d.prog) &&
        b.prog[0].cond.v === 'Schritte' && b.prog[1].n === -7,
        'version 2: variables and a program using them save and open again unchanged');

    const v1 = A.parseFile(P1({ prog: SOLUTIONS[5] }));
    add('fileVar2', v1 && v1.vars.length === 0 && JSON.stringify(v1.prog) === JSON.stringify(SOLUTIONS[5]),
        'a version-1 file (no variables) still opens');

    const c = A.parseFile(P2({ prog: [B('setVar', { v: 'a', n: 5000 }), B('changeVar', { v: 'a', n: -5000 }), B('changeVar', { v: 'a', n: 2.6 }),
      B('repeatUntil', { cond: V('a', '>', 1e6), body: [] }), B('ifElse', { cond: V('a', '<', -12.4), body: [], alt: [] })] }));
    add('fileVar3', c && c.prog[0].n === 999 && c.prog[1].n === -999 && c.prog[2].n === 3 &&
        c.prog[3].cond.n === 999 && c.prog[4].cond.n === -12,
        'numbers clamped to -999..999 and rounded');

    const bad = [
      P2({ vars: undefined, prog: [] }),
      P2({ vars: 'a', prog: [] }),
      P2({ prog: [B('setVar', { v: 'b', n: 1 })] }),
      P2({ prog: [B('showVar', {})] }),
      P2({ prog: [B('showVar', { v: 5 })] }),
      P2({ prog: [B('changeVar', { v: 'a', n: '1' })] }),
      P2({ prog: [B('setVar', { v: 'a' })] }),
      P2({ prog: [B('repeatUntil', { cond: V('b', '=', 1), body: [] })] }),
      P2({ prog: [B('repeatUntil', { cond: V('a', '>=', 1), body: [] })] }),
      P2({ prog: [B('ifElse', { cond: V('a', '=', '1'), body: [], alt: [] })] }),
      P2({ prog: [B('repeatUntil', { cond: 'alert(1)', body: [] })] }),
      P2({ prog: [B('repeatUntil', { cond: V('a', '=', 1) })] }),
      P2({ vars: ['1x'], prog: [] }),
      P2({ vars: ['__proto__'], prog: [] }),
      P2({ vars: ['a', 'A'], prog: [] }),
      P2({ vars: ['abcdefghijklm'], prog: [] }),
      P2({ vars: 'abcdefghijklm'.split(''), prog: [] }),
      P2({ vars: [7], prog: [] }),
      P1({ vars: ['a'], prog: [B('setVar', { v: 'a', n: 1 })] }),
      P1({ prog: [B('repeatUntil', { cond: 'frontWall', body: [] })] }),
      P1({ prog: [B('ifElse', { cond: V('a', '=', 1), body: [], alt: [] })] }),
    ];
    const through = bad.filter((txt) => A.parseFile(txt) !== null);
    add('fileVar4', !through.length, bad.length + ' broken files with variables refused (unknown or bad names, bad comparisons, v1 with v2 blocks)' +
        (through.length ? ' - LET THROUGH: ' + through.join(' | ') : ''));

    /* localStorage: the variable lists go with the programs, are checked on
       loading, and a program never points at a missing variable */
    A.goLevel(i9);
    A.setVars(['Schritte']);
    const s = A.storeData();
    const r = A.restoreVars({ 9: ['Schritte', 'a b'], 8: ['Schritte'], 99: ['x'], 7: 'no' },
                            { 7: [B('showVar', { v: 'Z\u00e4hler' })], 9: [B('setVar', { v: 'Neu', n: 1 })], 1: [B('move')] });
    add('storeVar', s.vars && JSON.stringify(s.vars[9]) === '["Schritte"]' &&
        JSON.stringify(r) === JSON.stringify({ 7: ['Z\u00e4hler'], 8: ['Schritte'], 9: ['Neu'] }),
        'localStorage: vars saved per task; on loading bad lists are dropped and used names come back: ' + JSON.stringify(r));
    A.goLevel(own);
    return out;
  }

  /* ---------------- own blocks ("Meine Bausteine") ---------------- */
  const bar = () => document.getElementById('verdict');
  const barText = () => (bar().hidden ? '' : bar().textContent);

  /* "Neuer Baustein" through the page: the field with its suggestion, the
     name rules, the block in the box and its definition under the program;
     the box only on task 7. */
  async function funcUiCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    const P = A.funcNameProblem;
    const good = ['Ecke', 'Mein Baustein', 'Flut 2', 'Zick zack', 'abcdefghijklmnop', '\u00dcber', 'constructor'];
    const wrong = ['', ' Ecke', 'Ecke ', 'Zick  zack', '1x', 'abcdefghijklmnopq', '__proto__', 'Ecke-2', 'caf\u00e9', 7];
    for (const n of good) if (P(n, [])) bad.push('refused "' + n + '"');
    for (const n of wrong) if (!P(n, [])) bad.push('took "' + n + '"');
    if (P('ecke', ['Ecke']) !== 'varTaken') bad.push('case-insensitive duplicate');
    if (P('X', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) !== 'funcFull') bad.push('a ninth one');
    A.goLevel(own);
    A.setFuncs([]);
    A.setVars([]);
    A.setProg([]);
    if (!q('#paletteList .cat-func')) bad.push('no Meine Bausteine box on task 7');
    if (q('#paletteList .cat-func .blk')) bad.push('a block before any own block');
    q('#newFuncBtn').click();
    const inp = q('#funcNameIn');
    if (!inp || inp.value !== 'Mein Baustein') bad.push('suggestion "' + (inp && inp.value) + '"');
    inp.value = '9 Leben';
    inp.dispatchEvent(new Event('input'));
    if (!q('.cat-func .var-ok').disabled || !q('.cat-func .var-msg').textContent) bad.push('bad name not stopped');
    inp.value = '  Treppe  ';
    inp.dispatchEvent(new Event('input'));
    q('.cat-func .var-new').requestSubmit();
    if (A.funcs.map((f) => f.name).join() !== 'Treppe') bad.push('not created: ' + A.funcs.map((f) => f.name).join());
    if (!q('#paletteList .cat-func .blk[data-type="call"][data-f="Treppe"]')) bad.push('no Treppe block in the box');
    if (q('#defList').hidden || !q('#defList .blk.def[data-def="Treppe"] .belly[data-cpath="[-1,\\"body\\"]"]')) bad.push('no definition with a belly under the program');
    q('#newFuncBtn').click();
    q('#funcNameIn').value = 'TREPPE';
    q('#funcNameIn').dispatchEvent(new Event('input'));
    if (!q('.cat-func .var-ok').disabled) bad.push('duplicate allowed');
    q('.cat-func .var-x').click();
    const withFuncs = [];
    for (let i = 0; i < A.LEVELS.length; i++) {
      A.goLevel(i);
      if (q('#paletteList .cat-func')) withFuncs.push(A.LEVELS[i].id);
    }
    if (withFuncs.join() !== '7') bad.push('Meine Bausteine box on tasks ' + withFuncs.join());
    A.goLevel(own);
    A.setFuncs([]);
    return { id: 'funcUi', ok: !bad.length, detail: 'Neuer Baustein: field with suggestion, name rules (spaces inside, 16, case-insensitive, at most 8), block in the box, definition under the program; box on task 7 only: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* An own block runs like its blocks written out, step by step with the
     running block and the "calling" one marked, and counts once. */
  async function funcRunCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    A.goLevel(own);
    A.setSandbox(OWN[0].maze);                 /* 3x3 stairs: right, move, left, move - twice */
    A.setVars([]);
    A.setFuncs([{ name: 'Treppe', body: [B('right'), B('move'), B('left'), B('move')] }]);
    A.setProg([]);
    if (!A.dropBlock(B('call', { f: 'Treppe' }), null, [], 0) || !A.dropBlock(B('call', { f: 'Treppe' }), null, [], 1)) bad.push('drop into the program refused');
    const count = A.countAll();
    if (count !== 7) bad.push('count ' + count + ' (want 2 uses + 1 head + 4 inside = 7)');
    A.clearResult();
    A.resetRun();
    await A.stepOnce();
    if (!q('#progList .blk.running[data-type="call"]')) bad.push('step 1: the use is not marked');
    await A.stepOnce();
    if (!q('#defList .blk.running[data-type="right"]') || !q('#progList .blk.calling[data-type="call"]')) bad.push('step 2: inside not marked');
    A.resetRun();
    A.clearResult();
    await A.runAll();
    const r = await verdict();
    const s = A.stats;
    if (!r.win || !s || s.blocks !== 7 || s.moves !== 4 || s.turns !== 4) bad.push('run: ' + r.reason + ' ' + JSON.stringify(s));
    A.setFuncs([]);
    return { id: 'funcRun', ok: !bad.length, detail: 'own block "Treppe" used twice solves the stairs maze; counts 1 head + 4 inside + 2 uses = 7 (written out: 8); stepping marks the block inside and the use: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* No own block may use itself: refused on the drop (directly, through
     another block, hidden in a loop) with a message, refused in files, and
     a hand-made loop still ends with that message instead of hanging.
     A used block cannot be deleted. */
  async function funcRecCheck(own) {
    const bad = [];
    A.goLevel(own);
    A.setSandbox(EMPTY3);
    A.setVars([]);
    A.setFuncs([{ name: 'A', body: [] }, { name: 'Bb', body: [B('call', { f: 'A' })] }]);
    A.setProg([]);
    A.clearResult();
    A.resetRun();
    const self = A.dropBlock(B('call', { f: 'A' }), null, [-1, 'body'], 0);
    const msg = barText();
    const loop = A.dropBlock(B('call', { f: 'Bb' }), null, [-1, 'body'], 0);
    const hidden = A.dropBlock(B('repeat', { n: 2, body: [B('call', { f: 'Bb' })] }), null, [-1, 'body'], 0);
    const selfB = A.dropBlock(B('call', { f: 'Bb' }), null, [-2, 'body'], 0);
    if (self || loop || hidden || selfB) bad.push('let through: ' + [self, loop, hidden, selfB].join());
    if (!/nicht selbst/.test(msg)) bad.push('message "' + msg + '"');
    if (A.funcs[0].body.length || A.funcs[1].body.length !== 1) bad.push('bodies changed');
    const fine1 = A.dropBlock(B('call', { f: 'A' }), null, [], 0);
    const fine2 = A.dropBlock(B('move'), null, [-1, 'body'], 0);
    const fine3 = A.dropBlock(A.prog[0], [0], [-2, 'body'], 1);        /* moved from the program into Bb */
    if (!fine1 || !fine2 || !fine3 || A.prog.length || A.funcs[1].body.length !== 2) bad.push('allowed drops: ' + [fine1, fine2, fine3].join() + ' ' + JSON.stringify(A.funcs));
    if (A.deleteFunc('A') || !/benutzt/.test(barText())) bad.push('deleted A while Bb uses it');
    if (!A.deleteFunc('Bb') || !A.deleteFunc('A') || A.funcs.length) bad.push('could not delete unused ones');
    /* a loop made by hand, past every check: the run ends with the message */
    A.setFuncs([{ name: 'A', body: [B('call', { f: 'Bb' })] }, { name: 'Bb', body: [B('call', { f: 'A' })] }]);
    A.setProg([B('call', { f: 'A' })]);
    A.clearResult();
    A.resetRun();
    await A.runAll();
    const r = await verdict();
    if (r.reason !== 'funcSelf') bad.push('hand-made loop: ' + r.reason);
    A.setFuncs([]);
    A.setProg([]);
    return { id: 'funcRec', ok: !bad.length, detail: 'own block using itself refused on the drop (direct, through another, inside a loop) with "' + msg + '"; allowed drops work; used block not deletable; a hand-made loop ends with the message: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* Files: own blocks make it version 3 and open again unchanged; a
     version-2 file cannot hold them; recursion and bad names are refused.
     localStorage keeps them per task. */
  function funcFileChecks(own) {
    const out = [];
    const add = (id, ok, detail) => out.push({ id, ok: !!ok, detail });
    const F = (funcs, prog, extra) => JSON.stringify(Object.assign({ version: 3, level: 7, lang: 'de', vars: ['a'], funcs, prog: prog || [] }, extra));
    A.goLevel(own);
    A.setVars(['a']);
    A.setFuncs([{ name: 'Zick zack', body: [B('right'), B('move'), B('changeVar', { v: 'a', n: 1 })] },
                { name: 'Zwei', body: [B('call', { f: 'Zick zack' }), B('call', { f: 'Zick zack' })] }]);
    A.setProg([B('call', { f: 'Zwei' }), B('showVar', { v: 'a' })]);
    const d = A.exportData();
    const b = A.parseFile(JSON.stringify(d, null, 2));
    add('funcFile1', d.version === 3 && d.funcs.length === 2 && b && JSON.stringify(b.funcs) === JSON.stringify(d.funcs) &&
        JSON.stringify(b.prog) === JSON.stringify(d.prog) && b.funcs[1].body[0].f === 'Zick zack',
        'version 3: own blocks (one using another) save and open again unchanged');
    const s = A.storeData();
    const r = A.restoreFuncs({ 7: [{ name: 'Gut', body: [] }, { name: '1 schlecht', body: [] }, { name: 'gut', body: [] }, { name: 'Ohne' }], 99: [{ name: 'X', body: [] }], 3: 'nein' });
    const rv = A.restoreVars({}, { 7: [] }, { 7: [{ name: 'F', body: [B('setVar', { v: 'Innen', n: 1 })] }] });
    add('funcStore', s.funcs && s.funcs[7] && s.funcs[7].length === 2 && JSON.stringify(r) === '{"7":[{"name":"Gut","body":[]}]}' &&
        JSON.stringify(rv) === '{"7":["Innen"]}',
        'localStorage: own blocks kept per task; on loading bad names, duplicates and bodies are dropped, variables used inside come back: ' + JSON.stringify(r));
    const deep = (n) => { let x = [B('move')]; for (let i = 0; i < n; i++) x = [B('repeat', { n: 2, body: x })]; return x; };
    const bad = [
      F([{ name: 'A', body: [B('call', { f: 'A' })] }]),
      F([{ name: 'A', body: [B('call', { f: 'B' })] }, { name: 'B', body: [B('call', { f: 'A' })] }]),
      F([{ name: 'A', body: [B('call', { f: 'B' })] }, { name: 'B', body: [B('call', { f: 'C' })] }, { name: 'C', body: [B('repeat', { n: 2, body: [B('call', { f: 'A' })] })] }]),
      F([{ name: 'A', body: [] }], [B('call', { f: 'Nix' })]),
      F([{ name: 'A', body: [B('call', { f: 'Nix' })] }]),
      F([{ name: 'A', body: [] }, { name: 'a', body: [] }]),
      F([{ name: '1A', body: [] }]),
      F([{ name: 'A ', body: [] }]),
      F([{ name: '__proto__', body: [] }]),
      F([{ name: 'A' }]),
      F([{ name: 'A', body: {} }]),
      F([{ name: 'A', body: [B('jump')] }]),
      F([{ name: 'A', body: [B('setVar', { v: 'b', n: 1 })] }]),
      F({ A: [] }),
      F('A'.repeat(3).split('').map((x, i) => ({ name: 'F' + i, body: [] })).concat('abcdef'.split('').map((x) => ({ name: x, body: [] })))),
      F([{ name: 'A', body: deep(12) }]),
      F([{ name: 'A', body: [] }], [B('call', {})]),
      F([{ name: 'A', body: [] }], [B('call', { f: 7 })]),
      JSON.stringify({ version: 2, level: 7, lang: 'de', vars: [], funcs: [{ name: 'A', body: [] }], prog: [B('call', { f: 'A' })] }),
      JSON.stringify({ version: 4, level: 7, lang: 'de', vars: [], prog: [] }),
    ];
    const through = bad.filter((txt) => A.parseFile(txt) !== null);
    add('funcFile2', !through.length, bad.length + ' broken files with own blocks refused (using itself directly / through others / in a loop, unknown, duplicate or bad names, more than 8, too deep, version 2 with own blocks)' +
        (through.length ? ' - LET THROUGH: ' + through.join(' | ') : ''));
    A.setFuncs([]);
    A.setVars([]);
    A.setProg([]);
    return out;
  }

  /* ---------------- lists and values in number fields ---------------- */
  /* a program on the empty 3x3 own maze with these variables and lists */
  async function runWith(own, names, listNames, prog, maze) {
    A.goLevel(own);
    A.setSandbox(maze || EMPTY3);
    A.setFuncs([]);
    A.setVars(names);
    A.setLists(listNames);
    A.setProg(clone(prog));
    A.clearResult();
    A.resetRun();
    await A.runAll();
    const r = await verdict();
    return { r, vals: A.varValues, lists: A.listValues };
  }

  /* "Neue Liste" through the page: suggestion, name rules shared with the
     variables (one name space), the blocks and the "Laenge von" pill, chips
     that delete only what is unused; the box only on task 7. */
  async function listUiCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    A.goLevel(own);
    A.setFuncs([]);
    A.setLists([]);
    A.setVars(['Weg']);
    A.setProg([]);
    const P = A.listNameProblem;
    if (P('Liste', []) || P('Z\u00e4hler2', []) || !P('1x', []) || !P('a b', []) || !P(5, [])) bad.push('name rules');
    if (P('weg') !== 'varTaken' || A.varNameProblem('Neu') || P('L', ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) !== 'listFull') bad.push('one name space with variables / at most 8');
    if (!q('#paletteList .cat-list') || q('#paletteList .cat-list .blk')) bad.push('box missing or blocks before any list');
    q('#newListBtn').click();
    const inp = q('#listNameIn');
    if (!inp || inp.value !== 'Liste') bad.push('suggestion "' + (inp && inp.value) + '" (Weg is a variable here)');
    inp.value = 'WEG';
    inp.dispatchEvent(new Event('input'));
    if (!q('.cat-list .var-ok').disabled) bad.push('a list named like a variable allowed');
    inp.value = 'Felder';
    inp.dispatchEvent(new Event('input'));
    q('.cat-list .var-new').requestSubmit();
    if (A.lists.join() !== 'Felder') bad.push('not created: ' + A.lists.join());
    for (const ty of ['listAdd', 'listSet', 'listGet', 'listClear']) if (!q('#paletteList .cat-list [data-type="' + ty + '"]')) bad.push('no ' + ty);
    const pill = q('#paletteList .cat-list .val-pill');
    if (!pill || pill.textContent !== 'L\u00e4nge von Felder' || pill.dataset.op !== '{"len":"Felder"}') bad.push('pill ' + (pill && pill.textContent));
    if (A.varNameProblem('felder') !== 'varTaken') bad.push('a variable named like a list allowed');
    A.setProg([B('listAdd', { l: 'Felder', n: 1 })]);
    if (A.deleteList('Felder') || !/Felder/.test(q('#paletteList .cat-list .var-msg').textContent)) bad.push('deleted a used list');
    A.setProg([B('setVar', { v: 'Weg', n: { len: 'Felder' } })]);
    if (A.deleteList('Felder')) bad.push('deleted a list used as a length');
    A.setProg([]);
    if (!A.deleteList('Felder') || A.lists.length) bad.push('could not delete an unused list');
    const withLists = [];
    for (let i = 0; i < A.LEVELS.length; i++) {
      A.goLevel(i);
      if (q('#paletteList .cat-list')) withLists.push(A.LEVELS[i].id);
    }
    if (withLists.join() !== '7') bad.push('Listen box on tasks ' + withLists.join());
    A.goLevel(own);
    A.setVars([]);
    return { id: 'listUi', ok: !bad.length, detail: 'Neue Liste: suggestion, names shared with the variables, blocks and "L\u00e4nge von" pill appear, delete only unused; box on task 7 only: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* add / item / replace / length / delete all, counting from 1, values
     in number fields, and a fresh empty list on every run */
  async function listRunCheck(own) {
    const prog = [
      B('listAdd', { l: 'Z', n: 3 }), B('listAdd', { l: 'Z', n: 5 }), B('listAdd', { l: 'Z', n: -7 }),
      B('listGet', { v: 'a', i: 2, l: 'Z' }),                          /* a = 5 */
      B('setVar', { v: 'n', n: { len: 'Z' } }),                         /* n = 3 */
      B('listGet', { v: 'c', i: { v: 'n' }, l: 'Z' }),                  /* c = -7: item n */
      B('listSet', { l: 'Z', i: 1, n: { v: 'a' } }),                    /* Z = 5, 5, -7 */
      B('changeVar', { v: 'a', n: { v: 'c' } }),                        /* a = -2 */
      B('listAdd', { l: 'K', n: { len: 'Z' } }),                        /* K = 3 */
      B('listClear', { l: 'Z' }), B('listAdd', { l: 'Z', n: 1 }),
      B('ifElse', { cond: V('n', '=', { len: 'K' }), body: [B('changeVar', { v: 'b', n: 10 })], alt: [] }),   /* 3 = 1? no */
      B('ifElse', { cond: V('n', '>', { len: 'Z' }), body: [B('changeVar', { v: 'b', n: 1 })], alt: [] }),    /* 3 > 1: b = 1 */
      B('ifElse', { cond: V('c', '<', { v: 'a' }), body: [B('changeVar', { v: 'b', n: 100 })], alt: [] }),  /* -7 < -2: b = 101 */
    ];
    A.goLevel(own);
    A.setSandbox(EMPTY3);
    A.setFuncs([]);
    A.setVars(['a', 'b', 'c', 'n']);
    A.setLists(['Z', 'K']);
    const runs = [];
    for (let k = 0; k < 2; k++) {
      A.setProg(clone(prog));
      A.clearResult();
      A.resetRun();
      await A.runAll();
      const r = await verdict();
      runs.push(JSON.stringify({ r: r.reason, v: A.varValues, l: A.listValues }));
    }
    const want = JSON.stringify({ r: 'failedEnd', v: { a: -2, b: 101, c: -7, n: 3 }, l: { Z: [1], K: [3] } });
    return { id: 'listRun', ok: runs[0] === want && runs[1] === want,
             detail: 'add, item (1 = first, also item n), replace, length, delete all, values in number fields and comparisons: ' + runs[0] +
                     (runs[1] === runs[0] ? '; the same on the next run (lists start empty)' : '; SECOND RUN ' + runs[1]) };
  }

  /* An item that is not there ends the run with a friendly message that
     names the list and says how many items it has. */
  async function listErrCheck(own) {
    const out = [];
    const cases = [
      ['item 0', [B('listAdd', { l: 'Z', n: 4 }), B('listGet', { v: 'a', i: 0, l: 'Z' })], 'errIndexOne', /Element 0 .*nur 1 Element./],
      ['item 3 of 2', [B('listAdd', { l: 'Z', n: 4 }), B('listAdd', { l: 'Z', n: 4 }), B('listGet', { v: 'a', i: 3, l: 'Z' })], 'errIndex', /kein Element 3 .*2 Elemente/],
      ['item 1 of an empty list', [B('listGet', { v: 'a', i: 1, l: 'Z' })], 'errEmpty', /Z ist leer/],
      ['replace item -1', [B('listAdd', { l: 'Z', n: 4 }), B('listSet', { l: 'Z', i: -1, n: 2 })], 'errIndexOne', /Element \u22121/],
      ['item a = 2 (a variable)', [B('setVar', { v: 'a', n: 2 }), B('listAdd', { l: 'Z', n: 4 }), B('listGet', { v: 'a', i: { v: 'a' }, l: 'Z' })], 'errIndexOne', /Element 2/],
      ['the 1001st item', [B('repeatUntil', { cond: V('a', '>', 1000), body: [B('listAdd', { l: 'Z', n: 1 }), B('changeVar', { v: 'a', n: 1 })] })], 'errFull', /voll/],
    ];
    const bad = [];
    for (const [name, prog, reason, msg] of cases) {
      const p = await runWith(own, ['a'], ['Z'], prog);
      const text = barText();
      if (p.r.reason !== reason || !msg.test(text) || !/lose/.test(bar().className)) bad.push(name + ': ' + p.r.reason + ' "' + text + '"');
    }
    out.push({ id: 'listErr', ok: !bad.length, detail: 'items that are not there (0, past the end, empty list, -1, by a variable) and the 1001st item end the run with a message: ' +
               (bad.length ? 'BAD ' + bad.join('; ') : 'all right') });
    return out;
  }

  /* The watch panel shows each list: numbered items, gold on the last
     change, "leer" when empty; also without any variable; Zurueck empties. */
  async function listWatchCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    const items = (l) => Array.from(document.querySelectorAll('#watchLists .wl-row[data-list="' + l + '"] .wli')).map((n) => n.textContent);
    const gold = () => Array.from(document.querySelectorAll('#watchLists .wli.is-new')).map((n) => n.closest('.wl-row').dataset.list + ':' + n.textContent);
    A.goLevel(own);
    A.setSandbox(EMPTY3);
    A.setFuncs([]);
    A.setVars([]);
    A.setLists(['Weg', 'Leer']);
    A.setProg([B('listAdd', { l: 'Weg', n: 4 }), B('listAdd', { l: 'Weg', n: -2 }), B('listSet', { l: 'Weg', i: 1, n: 9 }), B('move')]);
    A.clearResult();
    A.resetRun();
    if (q('#watch').hidden || !q('#watchVars').hidden || q('#watchLists').hidden) bad.push('panel not shown for lists alone');
    if (!/leer/.test(q('#watchLists .wl-row[data-list="Leer"]').textContent)) bad.push('empty list not "leer"');
    await A.stepOnce();
    await A.stepOnce();
    if (items('Weg').join() !== '14,2\u22122' || gold().join() !== 'Weg:2\u22122') bad.push('after two adds: ' + items('Weg').join() + ' gold ' + gold().join());
    await A.stepOnce();
    if (items('Weg').join() !== '19,2\u22122' || gold().join() !== 'Weg:19') bad.push('after replace: ' + items('Weg').join() + ' gold ' + gold().join());
    A.resetRun();
    if (items('Weg').length || !/leer/.test(q('#watchLists .wl-row[data-list="Weg"]').textContent)) bad.push('not empty after Zur\u00fcck');
    A.setLists([]);
    if (!q('#watch').hidden) bad.push('panel shown with no list and no variable');
    return { id: 'listWatch', ok: !bad.length, detail: 'watch panel: each list with numbered items, gold on the last change, "leer", shown without variables, Zur\u00fcck empties: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* Values in number fields through the page: the picker next to a number
     chooses a variable, a pill dropped on a field sets "Laenge von"; and
     back to a number. */
  async function opUiCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    A.goLevel(own);
    A.setFuncs([]);
    A.setVars(['a', 'b']);
    A.setLists(['Weg']);
    A.setProg([B('setVar', { v: 'a', n: 4 }), B('repeatUntil', { cond: V('a', '>', 2), body: [] })]);
    const pick = q('#progList .blk[data-path="[0]"] .op-src');
    if (!pick) bad.push('no picker next to the number');
    else {
      pick.value = 'v:b';
      pick.dispatchEvent(new Event('change'));
      if (JSON.stringify(A.prog[0].n) !== '{"v":"b"}') bad.push('picker: ' + JSON.stringify(A.prog[0].n));
    }
    const slot = q('#progList .blk[data-path="[1]"] .row [data-slot]');
    const spec = slot && JSON.parse(slot.dataset.slot);
    if (!spec || !A.dropValue({ len: 'Weg' }, spec) || JSON.stringify(A.prog[1].cond.n) !== '{"len":"Weg"}') bad.push('pill on the comparison: ' + JSON.stringify(A.prog[1].cond));
    if (A.dropValue({ len: 'Weg' }, { p: [0], k: 'v' }) || A.dropValue({ len: 'Weg' }, { p: [7], k: 'n' })) bad.push('pill took a wrong slot');
    const back = q('#progList .blk[data-path="[0]"] .op-val');
    if (!back || back.selectedOptions[0].textContent !== 'b') bad.push('value not shown as a picker');
    else {
      back.value = '#';
      back.dispatchEvent(new Event('change'));
      if (A.prog[0].n !== 0) bad.push('back to a number: ' + JSON.stringify(A.prog[0].n));
    }
    A.setVars([]);
    A.setLists([]);
    A.setProg([]);
    return { id: 'opUi', ok: !bad.length, detail: 'number fields: the picker sets a variable, a "L\u00e4nge von" pill dropped on a comparison sets the length, wrong slots refused, back to a number: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* Files with lists and values: version 3, opened again unchanged; older
     versions cannot hold them; undeclared names and bad values refused;
     localStorage keeps lists per task and brings back names in use. */
  function listFileChecks(own) {
    const out = [];
    const add = (id, ok, detail) => out.push({ id, ok: !!ok, detail });
    const F = (o) => JSON.stringify(Object.assign({ version: 3, level: 7, lang: 'de', vars: ['a'], lists: ['Z'], prog: [] }, o));
    A.goLevel(own);
    A.setFuncs([]);
    A.setVars(['a']);
    A.setLists(['Z', 'Weg']);
    A.setProg([B('listAdd', { l: 'Z', n: { v: 'a' } }), B('listSet', { l: 'Weg', i: { len: 'Z' }, n: -999 }),
               B('listGet', { v: 'a', i: 1, l: 'Z' }), B('listClear', { l: 'Weg' }),
               B('repeatUntil', { cond: V('a', '>', { len: 'Weg' }), body: [B('changeVar', { v: 'a', n: { v: 'a' } })] })]);
    const d = A.exportData();
    const b = A.parseFile(JSON.stringify(d));
    add('listFile1', d.version === 3 && JSON.stringify(d.lists) === '["Z","Weg"]' && b && JSON.stringify(b.lists) === JSON.stringify(d.lists) &&
        JSON.stringify(b.prog) === JSON.stringify(d.prog) && JSON.stringify(b.prog[1]) === '{"t":"listSet","l":"Weg","i":{"len":"Z"},"n":-999}',
        'version 3: lists and values in number fields save and open again unchanged');
    const bad = [
      F({ prog: [B('listAdd', { l: 'Y', n: 1 })] }),
      F({ prog: [B('listAdd', { l: 'Z' })] }),
      F({ prog: [B('listAdd', { n: 1 })] }),
      F({ prog: [B('listGet', { v: 'a', l: 'Z' })] }),
      F({ prog: [B('listGet', { v: 'b', i: 1, l: 'Z' })] }),
      F({ prog: [B('listSet', { l: 'Z', i: '1', n: 1 })] }),
      F({ prog: [B('setVar', { v: 'a', n: { v: 'b' } })] }),
      F({ prog: [B('setVar', { v: 'a', n: { len: 'Y' } })] }),
      F({ prog: [B('setVar', { v: 'a', n: { v: 'a', len: 'Z' } })] }),
      F({ prog: [B('setVar', { v: 'a', n: {} })] }),
      F({ prog: [B('setVar', { v: 'a', n: [1] })] }),
      F({ prog: [B('setVar', { v: 'a', n: { q: 'a' } })] }),
      F({ prog: [B('repeatUntil', { cond: V('a', '=', { len: 'nix' }), body: [] })] }),
      F({ lists: ['a'] }),
      F({ lists: ['Z', 'z'] }),
      F({ lists: ['1Z'] }),
      F({ lists: 'Z' }),
      F({ lists: 'abcdefghi'.split('') }),
      JSON.stringify({ version: 2, level: 7, lang: 'de', vars: ['a'], prog: [B('setVar', { v: 'a', n: { v: 'a' } })] }),
      JSON.stringify({ version: 2, level: 7, lang: 'de', vars: ['a'], lists: ['Z'], prog: [B('listClear', { l: 'Z' })] }),
    ];
    const through = bad.filter((txt) => A.parseFile(txt) !== null);
    add('listFile2', !through.length, bad.length + ' broken files with lists or values refused (unknown list or variable, missing fields, bad values, name clashes, more than 8, version 2 with v3 content)' +
        (through.length ? ' - LET THROUGH: ' + through.join(' | ') : ''));
    const s = A.storeData();
    const r = A.restoreLists({ 7: ['Z', 'a b'], 8: ['Weg'], 99: ['X'] }, { 7: [B('listAdd', { l: 'Neu', n: 1 })], 8: [B('setVar', { v: 'x', n: { len: 'Q' } })] }, {});
    const rv = A.restoreVars({ 8: ['Q'] }, {}, {}, r);
    add('listStore', s.lists && JSON.stringify(s.lists[7]) === '["Z","Weg"]' && JSON.stringify(r) === '{"7":["Neu"],"8":["Weg","Q"]}' && JSON.stringify(rv) === '{}',
        'localStorage: lists saved per task; bad lists dropped, names in use come back (also as a length), a variable never takes a list\'s name: ' + JSON.stringify(r));
    A.setVars([]);
    A.setLists([]);
    A.setProg([]);
    return out;
  }

  /* ---------------- the robot's map ("Karte") ---------------- */
  /* 3x3, one wall east of the start cell, star top right */
  const KMAZE = { n: 3, walls: ['0,0,E'], exits: [], goal: { x: 2, y: 2 } };
  const P = (p) => ({ p });
  const Vv = (v) => ({ v });

  /* merke Waende hier, numbers, the map conditions, the position values,
     and a fresh empty map on every run */
  async function mapRunCheck(own) {
    const bad = [];
    const prog = [
      B('mapWalls'),
      B('ifElse', { cond: 'mapFront', body: [B('changeVar', { v: 'f', n: 1 })], alt: [] }),              /* open */
      B('ifElse', { cond: 'mapRight', body: [B('changeVar', { v: 'f', n: 10 })], alt: [] }),             /* the wall */
      B('ifElse', { cond: 'mapLeft', body: [B('changeVar', { v: 'f', n: 100 })], alt: [] }),             /* the border */
      B('ifElse', { cond: { x: 1, y: 0, dir: 4 }, body: [B('changeVar', { v: 'f', n: 1000 })], alt: [] }),  /* same wall, other side */
      B('ifElse', { cond: { x: 1, y: 1, dir: 1 }, body: [B('changeVar', { v: 'g', n: 1 })], alt: [] }),  /* unknown: open */
      B('ifElse', { cond: { x: 2, y: 2, dir: 2 }, body: [B('changeVar', { v: 'g', n: 10 })], alt: [] }), /* border: closed */
      B('mapSet', { x: 2, y: 1, n: 7 }),
      B('mapGet', { v: 'a', x: 2, y: 1 }),
      B('mapGet', { v: 'b', x: 0, y: 0 }),
      B('right'),
      B('setVar', { v: 'd', n: P('d') }),
      B('setVar', { v: 'x', n: P('sx') }), B('changeVar', { v: 'x', n: P('sy') }), B('changeVar', { v: 'x', n: P('x') }),
      B('mapSet', { x: P('x'), y: P('y'), n: Vv('a') }),
      B('mapGet', { v: 'c', x: 0, y: 0 }),
      B('mapClear'),
      B('mapGet', { v: 'e', x: 2, y: 1 }),
    ];
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'x'];
    let p = await runWith(own, names, [], prog, KMAZE);
    const known = JSON.stringify(A.mapState.known);
    const want = '{"a":7,"b":-1,"c":7,"d":2,"e":-1,"f":1,"g":1,"x":4}';
    if (JSON.stringify(p.vals) !== want) bad.push('values ' + JSON.stringify(p.vals));
    if (known !== '{"0,0,N":false,"0,1,S":false,"0,0,W":true,"0,0,E":true,"1,0,W":true}') bad.push('remembered ' + known);
    /* the next run starts with an empty map: no number, no remembered wall
       (so the wall to the right is unknown - and unknown counts as open) */
    await runWith(own, names, [], [B('mapSet', { x: 1, y: 1, n: 5 }), B('mapWalls')], KMAZE);
    p = await runWith(own, names, [], [B('mapGet', { v: 'a', x: 1, y: 1 }),
      B('ifElse', { cond: 'mapRight', body: [B('setVar', { v: 'f', n: 1 })], alt: [] })], KMAZE);
    if (p.vals.a !== -1 || p.vals.f !== 1) bad.push('next run: a=' + p.vals.a + ' f=' + p.vals.f);
    return { id: 'mapRun', ok: !bad.length, detail: 'merke W\u00e4nde hier keeps front/left/right (both sides of a wall), offen laut Karte vorne/rechts/links and Feld x y nach r, unknown = open, border closed, numbers (-1 empty), mein x/meine Richtung/Stern x y, l\u00f6sche alle Zahlen, empty map on every run: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* cells and directions that are not there end the run with a message */
  async function mapErrCheck(own) {
    const bad = [];
    const cases = [
      ['cell 3 0', [B('mapSet', { x: 3, y: 0, n: 1 })], 'errCell', /\(3, 0\) gibt es nicht .*0 bis 2/],
      ['cell -1 0', [B('mapGet', { v: 'a', x: -1, y: 0 })], 'errCell', /\(\u22121, 0\)/],
      ['cell 0 3 in a condition', [B('ifElse', { cond: { x: 0, y: 3, dir: 1 }, body: [], alt: [] })], 'errCell', /\(0, 3\)/],
      ['direction 5', [B('ifElse', { cond: { x: 0, y: 0, dir: 5 }, body: [], alt: [] })], 'errDir', /Richtung 5 gibt es nicht .*1 ist Norden/],
      ['direction 0', [B('repeatUntil', { cond: { x: 0, y: 0, dir: 0 }, body: [] })], 'errDir', /Richtung 0/],
    ];
    for (const [name, prog, reason, msg] of cases) {
      const p = await runWith(own, ['a'], [], prog, KMAZE);
      if (p.r.reason !== reason || !msg.test(barText())) bad.push(name + ': ' + p.r.reason + ' "' + barText() + '"');
    }
    return { id: 'mapErr', ok: !bad.length, detail: 'cells off the map and directions other than 1-4 end the run with a message: ' + (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* the numbers appear faintly in their cells (the newest in gold), the
     remembered walls as a gold line; Zurueck clears them */
  async function mapDrawCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    await runWith(own, [], [], [B('mapSet', { x: 0, y: 2, n: 3 }), B('mapSet', { x: 1, y: 2, n: -4 }), B('mapWalls')], KMAZE);
    const nums = Array.from(document.querySelectorAll('#mapNums text.map-num'));
    const txt = nums.map((n) => n.textContent + (n.classList.contains('is-new') ? '*' : '')).join();
    if (txt !== '3,\u22124*') bad.push('numbers "' + txt + '"');
    const cell = q('#maze rect.cell');                       /* cell (0,2) is the first rect drawn at the top left */
    if (nums[0] && cell) {
      const cx = +cell.getAttribute('x') - 1 + (+cell.getAttribute('width') + 2) / 2;
      if (Math.abs(+nums[0].getAttribute('x') - cx) > 1 || Math.abs(+nums[0].getAttribute('y') - cx) > 1) bad.push('3 not in cell (0,2)');
    }
    const op = nums[0] ? getComputedStyle(nums[0]).fillOpacity : '1';
    if (!(+op < 0.6)) bad.push('not faint: ' + op);
    if (!q('#mapKnown path.map-wall')) bad.push('no remembered wall drawn');
    A.resetRun();
    if (document.querySelector('#mapNums text') || q('#mapKnown path')) bad.push('still drawn after Zur\u00fcck');
    return { id: 'mapDraw', ok: !bad.length, detail: 'map numbers drawn faintly in their cells (newest gold), remembered walls drawn, cleared by Zur\u00fcck: ' + (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* The Karte box (task 7 only) with its value pills; the condition picker
     offers the map conditions there; a "mein x" pill lands on a field. */
  async function mapUiCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    A.goLevel(own);
    A.setFuncs([]);
    A.setLists([]);
    A.setVars(['a']);
    A.setProg([B('mapSet', { x: 0, y: 0, n: 0 }), B('ifElse', { cond: 'frontFree', body: [], alt: [] })]);
    for (const ty of ['mapWalls', 'mapClear', 'mapSet', 'mapGet']) if (!q('#paletteList .cat-map [data-type="' + ty + '"]')) bad.push('no ' + ty);
    const pills = Array.from(document.querySelectorAll('#paletteList .cat-map .val-pill')).map((n) => n.textContent).join();
    if (pills !== 'mein x,mein y,meine Richtung,Stern x,Stern y') bad.push('pills ' + pills);
    const slot = q('#progList .blk[data-path="[0]"] [data-slot]');
    if (!slot || !A.dropValue({ p: 'x' }, JSON.parse(slot.dataset.slot)) || JSON.stringify(A.prog[0].x) !== '{"p":"x"}') bad.push('mein x pill: ' + JSON.stringify(A.prog[0]));
    const condSel = q('#progList .blk[data-path="[1]"] select.cond');
    const opts = condSel ? Array.from(condSel.options).map((o) => o.value) : [];
    if (!opts.includes('mapFront') || !opts.includes('@cell')) bad.push('condition picker: ' + opts.join());
    if (condSel) {
      condSel.value = '@cell';
      condSel.dispatchEvent(new Event('change'));
      if (JSON.stringify(A.prog[1].cond) !== '{"x":0,"y":0,"dir":1}' || document.querySelectorAll('#progList .blk[data-path="[1]"] > .row [data-slot]').length !== 3) bad.push('Feld \u2026: ' + JSON.stringify(A.prog[1].cond));
    }
    const withMap = [];
    for (let i = 0; i < A.LEVELS.length; i++) {
      A.goLevel(i);
      if (q('#paletteList .cat-map')) withMap.push(A.LEVELS[i].id);
    }
    if (withMap.join() !== '7') bad.push('Karte box on tasks ' + withMap.join());
    A.goLevel(A.LEVELS.findIndex((l) => l.id === 4));
    A.setProg([B('ifElse', { cond: 'frontFree', body: [], alt: [] })]);
    const o4 = Array.from(q('#progList select.cond').options).map((o) => o.value);
    if (o4.includes('mapFront')) bad.push('map conditions offered on task 4');
    A.setProg([]);
    A.goLevel(own);
    A.setVars([]);
    A.setProg([]);
    return { id: 'mapUi', ok: !bad.length, detail: 'Karte box on task 7 only: four blocks, five value pills (mein x ... Stern y) that land on a number field, map conditions in the picker (not on task 4), "Feld \u2026" with three fields: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* The flood fill, built from blocks only: Karte-Bausteine, loops,
     variables, lists and two own blocks - no sensor condition, no help
     from the page. Each round: note the walls here, flood the map from the
     star (an unknown wall counts as open), go to the neighbour with the
     smallest number. Directions 1-4 = N E S W; DX/DY: the step per
     direction; QX/QY: the queue; I: where it is read. */
  const FLOOD = (() => {
    const v = Vv;
    return {
      vars: ['I', 'FX', 'FY', 'D', 'N', 'R', 'NX', 'NY', 'H', 'Z'],
      lists: ['DX', 'DY', 'QX', 'QY'],
      funcs: [
        { name: 'Nachbar', body: [                                /* NX, NY: the neighbour of FX, FY in direction R; N its number */
          B('listGet', { v: 'NX', i: v('R'), l: 'DX' }),
          B('changeVar', { v: 'NX', n: v('FX') }),
          B('listGet', { v: 'NY', i: v('R'), l: 'DY' }),
          B('changeVar', { v: 'NY', n: v('FY') }),
          B('mapGet', { v: 'N', x: v('NX'), y: v('NY') }),
        ] },
        { name: 'Flut', body: [                                   /* the numbers: 0 on the star, +1 per cell */
          B('mapClear'),
          B('mapSet', { x: P('sx'), y: P('sy'), n: 0 }),
          B('listClear', { l: 'QX' }),
          B('listClear', { l: 'QY' }),
          B('listAdd', { l: 'QX', n: P('sx') }),
          B('listAdd', { l: 'QY', n: P('sy') }),
          B('setVar', { v: 'I', n: 1 }),
          B('repeatUntil', { cond: { v: 'I', op: '>', n: { len: 'QX' } }, body: [
            B('listGet', { v: 'FX', i: v('I'), l: 'QX' }),
            B('listGet', { v: 'FY', i: v('I'), l: 'QY' }),
            B('mapGet', { v: 'D', x: v('FX'), y: v('FY') }),
            B('changeVar', { v: 'D', n: 1 }),
            B('setVar', { v: 'R', n: 1 }),
            B('repeat', { n: 4, body: [
              B('ifElse', { cond: { x: v('FX'), y: v('FY'), dir: v('R') }, body: [
                B('call', { f: 'Nachbar' }),
                B('ifElse', { cond: V('N', '=', -1), body: [
                  B('mapSet', { x: v('NX'), y: v('NY'), n: v('D') }),
                  B('listAdd', { l: 'QX', n: v('NX') }),
                  B('listAdd', { l: 'QY', n: v('NY') }),
                ], alt: [] }),
              ], alt: [] }),
              B('changeVar', { v: 'R', n: 1 }),
            ] }),
            B('changeVar', { v: 'I', n: 1 }),
          ] }),
        ] },
      ],
      prog: [
        B('listAdd', { l: 'DX', n: 0 }), B('listAdd', { l: 'DX', n: 1 }), B('listAdd', { l: 'DX', n: 0 }), B('listAdd', { l: 'DX', n: -1 }),
        B('listAdd', { l: 'DY', n: 1 }), B('listAdd', { l: 'DY', n: 0 }), B('listAdd', { l: 'DY', n: -1 }), B('listAdd', { l: 'DY', n: 0 }),
        B('repeatUntil', { cond: V('H', '<', 0), body: [                /* until no way is left (-1 here) */
          B('mapWalls'),
          B('call', { f: 'Flut' }),
          B('setVar', { v: 'FX', n: P('x') }),
          B('setVar', { v: 'FY', n: P('y') }),
          B('mapGet', { v: 'H', x: v('FX'), y: v('FY') }),
          B('setVar', { v: 'R', n: 1 }),
          B('repeat', { n: 4, body: [                                /* Z: the open direction downhill */
            B('ifElse', { cond: { x: v('FX'), y: v('FY'), dir: v('R') }, body: [
              B('call', { f: 'Nachbar' }),
              B('ifElse', { cond: V('N', '<', v('H')), body: [
                B('setVar', { v: 'H', n: v('N') }),
                B('setVar', { v: 'Z', n: v('R') }),
              ], alt: [] }),
            ], alt: [] }),
            B('changeVar', { v: 'R', n: 1 }),
          ] }),
          B('repeatUntil', { cond: V('Z', '=', P('d')), body: [B('right')] }),
          B('move'),
        ] }),
      ],
    };
  })();
  const FLOOD_TYPES = ['listAdd', 'listGet', 'listClear', 'setVar', 'changeVar', 'mapWalls', 'mapClear', 'mapSet', 'mapGet',
                       'repeat', 'repeatUntil', 'ifElse', 'call', 'right', 'move'];

  function loadFlood(own, maze) {
    A.goLevel(own);
    A.setSandbox(maze);
    if (maze.random) A.randomize();
    A.setVars(FLOOD.vars);
    A.setLists(FLOOD.lists);
    A.setFuncs(clone(FLOOD.funcs));
    A.setProg(clone(FLOOD.prog));
    A.clearResult();
    A.resetRun();
  }

  /* shortest path from the start to the star in the drawn maze */
  function shortest(mz) {
    const d = walk(mz, mz.start);
    return d.get(mz.goal.x + ',' + mz.goal.y);
  }

  async function floodCheck(own, runs) {
    const bad = [];
    /* the fixture really uses only these blocks, and never a sensor */
    const types = new Set();
    let sensor = false;
    const scan = (list) => { for (const b of list) { types.add(b.t); if (typeof b.cond === 'string') sensor = true; if (b.body) scan(b.body); if (b.alt) scan(b.alt); } };
    scan(FLOOD.prog);
    FLOOD.funcs.forEach((f) => scan(f.body));
    const extra = Array.from(types).filter((ty) => !FLOOD_TYPES.includes(ty));
    if (extra.length || sensor) bad.push('fixture uses ' + extra.join() + (sensor ? ' and a sensor condition' : ''));
    let won = 0, thinks = 0, extraMoves = 0, numbered = true;
    const blocks = [];
    for (let r = 0; r < runs; r++) {
      loadFlood(own, { n: 5, walls: [], exits: [], goal: { x: 2, y: 3 }, random: true });
      const mz = A.exportData().maze;
      await A.runAll();
      const res = await verdict();
      if (res.win && A.world.bot.x === mz.goal.x && A.world.bot.y === mz.goal.y) won++;
      else bad.push('maze ' + (r + 1) + ': ' + res.reason);
      thinks = Math.max(thinks, A.thinks);
      extraMoves = Math.max(extraMoves, A.stats.moves - shortest(mz));
      if (document.querySelectorAll('#mapNums text.map-num').length !== 25) numbered = false;
      blocks.push(A.stats.blocks);
    }
    if (!numbered) bad.push('the 25 flood numbers are not drawn');
    /* It does not know the maze, it explores: in this 3x3 the way along the
       top looks as short as the real one along the bottom, and the robot
       only sees the two hidden walls when it stands next to them - 8 cells
       instead of the shortest 4. */
    loadFlood(own, { n: 3, walls: ['1,2,E', '1,1,E'], exits: [], goal: { x: 2, y: 2 } });
    await A.runAll();
    const trap = await verdict();
    if (!trap.win || A.stats.moves !== 8) bad.push('trap maze: ' + trap.reason + ' after ' + A.stats.moves + ' cells (want 8)');
    return { id: 'flood', ok: !bad.length && won === runs,
             detail: 'flood fill built from blocks (' + blocks[0] + ' blocks: Karte-Bausteine, loops, variables, lists, 2 own blocks; no sensor) solves ' + won + '/' + runs +
                     ' random 5x5 mazes from (0,0) to the star; at most ' + extraMoves + ' cells more than the shortest way while exploring; at most ' + thinks +
                     ' thinking actions (budget ' + A.maxThinksFor(5) + '); all 25 numbers drawn; explores a trap 3x3 in 8 cells (shortest 4) as it learns the walls' +
                     (bad.length ? ' - BAD ' + bad.join('; ') : '') };
  }

  /* The same flood fill with a stand-in robot: "merke Waende hier" asks
     WALLS and the map holds what the robot answered; nothing but CELL, TURN
     and WALLS goes out. Then a robot that reports a wall the drawing does
     not have: the map believes the robot. A silent robot: the message. */
  async function floodBotCheck(own) {
    const bad = [];
    const lines = [];
    let res, mz;
    try {
      loadFlood(own, { n: 5, walls: [], exits: [], goal: { x: 2, y: 3 }, random: true });
      mz = A.exportData().maze;
      A.fakeRobot((line) => { lines.push(line); return botReply(line); });
      await A.runAll();
      res = await verdict();
    } finally {
      A.fakeRobot(null);
    }
    const n = (k) => lines.filter((l) => l === k).length;
    const other = lines.filter((l) => !['CELL', 'TURN 90', 'WALLS'].includes(l));
    if (!res.win) bad.push('not solved: ' + res.reason);
    if (other.length) bad.push('other lines: ' + other.join());
    if (n('WALLS') !== n('CELL')) bad.push(n('WALLS') + ' WALLS for ' + n('CELL') + ' cells (one per round)');
    /* every remembered side matches the maze the stand-in robot reports from */
    const w = A.world, known = A.mapState.known;
    const wrong = Object.keys(known).filter((k) => { const [x, y, d] = k.split(','); return known[k] !== !!w.walls[+x][+y][d]; });
    if (wrong.length || !Object.keys(known).length) bad.push('map differs from the robot at ' + wrong.join(' '));
    /* phantom wall: the robot says "wall ahead", the drawing has none */
    let phantom, plain;
    try {
      A.goLevel(own);
      A.setSandbox(EMPTY3);
      A.setFuncs([]); A.setLists([]); A.setVars([]);
      A.setProg([B('mapWalls')]);
      A.clearResult();
      A.resetRun();
      A.fakeRobot((line) => (line === 'WALLS' ? ['WALLS: F=60(wall) L=300 R=300'] : []));
      await A.runAll();
      await verdict();
      phantom = A.mapState.known;
      A.fakeRobot(null);
      A.clearResult();
      A.resetRun();
      await A.runAll();
      await verdict();
      plain = A.mapState.known;
      A.setTimeScale(0.01);
      A.fakeRobot(() => []);
      A.clearResult();
      A.resetRun();
      await A.runAll();
    } finally {
      A.fakeRobot(null);
      A.setTimeScale(1);
    }
    const silent = (await verdict()).reason;
    if (phantom['0,0,N'] !== true || phantom['0,0,E'] !== false || plain['0,0,N'] !== false) bad.push('phantom wall: robot ' + JSON.stringify(phantom) + ', drawing ' + JSON.stringify(plain));
    if (silent !== 'botSilent') bad.push('silent robot: ' + silent);
    return { id: 'floodBot', ok: !bad.length, detail: 'stand-in robot: the block flood fill solves a random 5x5 sending only CELL, TURN 90 and WALLS (' + n('CELL') + ' CELL, ' + n('TURN 90') + ' TURN, ' + n('WALLS') +
             ' WALLS), its map equals the robot\'s answers; a wall only the robot reports goes into the map; no answer to WALLS: botSilent' + (bad.length ? ' - BAD ' + bad.join('; ') : '') };
  }

  /* Files: the map blocks, the map conditions and the position values are
     version 3 and open again unchanged; bad ones are refused. */
  function mapFileChecks(own) {
    const out = [];
    const add = (id, ok, detail) => out.push({ id, ok: !!ok, detail });
    loadFlood(own, { n: 5, walls: [], exits: [], goal: { x: 4, y: 4 } });
    const d = A.exportData();
    const b = A.parseFile(JSON.stringify(d));
    add('mapFile1', d.version === 3 && b && JSON.stringify(b.prog) === JSON.stringify(d.prog) && JSON.stringify(b.funcs) === JSON.stringify(d.funcs) &&
        JSON.stringify(b.lists) === '["DX","DY","QX","QY"]',
        'version 3: the flood fill (map blocks, "Feld x y nach r", mein x / Stern x) saves and opens again unchanged');
    const F = (prog) => JSON.stringify({ version: 3, level: 7, lang: 'de', vars: ['a'], lists: [], prog });
    const bad = [
      F([B('mapSet', { x: 0, y: 0 })]),
      F([B('mapSet', { x: { p: 'z' }, y: 0, n: 1 })]),
      F([B('mapGet', { x: 0, y: 0 })]),
      F([B('mapGet', { v: 'b', x: 0, y: 0 })]),
      F([B('ifElse', { cond: 'mapUp', body: [], alt: [] })]),
      F([B('ifElse', { cond: { x: 0, y: 0 }, body: [], alt: [] })]),
      F([B('ifElse', { cond: { x: 0, y: '0', dir: 1 }, body: [], alt: [] })]),
      F([B('ifElse', { cond: { x: 0, y: 0, dir: { p: 'q' } }, body: [], alt: [] })]),
      JSON.stringify({ version: 2, level: 7, lang: 'de', vars: ['a'], prog: [B('ifElse', { cond: 'mapFront', body: [], alt: [] })] }),
      JSON.stringify({ version: 2, level: 7, lang: 'de', vars: ['a'], prog: [B('setVar', { v: 'a', n: { p: 'x' } })] }),
      JSON.stringify({ version: 2, level: 7, lang: 'de', vars: ['a'], prog: [B('mapWalls')] }),
    ];
    const through = bad.filter((txt) => A.parseFile(txt) !== null);
    add('mapFile2', !through.length, bad.length + ' broken files with map blocks refused (missing fields, unknown values or conditions, version 2 with map content)' +
        (through.length ? ' - LET THROUGH: ' + through.join(' | ') : ''));
    A.setFuncs([]); A.setLists([]); A.setVars([]); A.setProg([]);
    return out;
  }

  /* Profi-Woerter on the new blocks too: lists, map, own blocks, values */
  async function profiNewCheck(own) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    const kws = (sel) => (q(sel) ? Array.from(q(sel).querySelectorAll(':scope > .row .lbl .kw')).map((k) => k.textContent).join('|') : '?');
    const btn = q('#profiBtn');
    A.goLevel(own);
    A.setVars(['a']);
    A.setLists(['Weg']);
    A.setFuncs([{ name: 'Flut', body: [] }]);
    A.setProg([]);
    if (!A.profi) btn.click();
    const want = { listAdd: 'add|to', listSet: 'replace item|of|with', listGet: 'set|to item|of', listClear: 'delete all of', mapSet: 'set|to', mapGet: 'set|to' };
    for (const ty in want) { const k = kws('#paletteList .blk[data-type="' + ty + '"]'); if (k !== want[ty]) bad.push(ty + ': ' + k); }
    if (kws('#defList .blk.def') !== 'define') bad.push('definition: ' + kws('#defList .blk.def'));
    const pill = q('#paletteList .cat-list .val-pill');
    if (!pill || pill.textContent !== 'length of Weg') bad.push('pill ' + (pill && pill.textContent));
    if (labelText(q('#paletteList .blk[data-type="mapWalls"] .lbl')) !== 'merke W\u00e4nde hier') bad.push('robot words changed');
    btn.click();
    if (kws('#defList .blk.def') !== '' || labelText(q('#defList .blk.def .lbl')) !== 'definiere Flut' || q('#paletteList .cat-list .val-pill').textContent !== 'L\u00e4nge von Weg') bad.push('off again');
    A.setFuncs([]); A.setLists([]); A.setVars([]);
    return { id: 'profiNew', ok: !bad.length, detail: 'Profi-W\u00f6rter on lists (add, replace item, item, delete all, length of), map (set ... to), own blocks (define); robot words stay; off again: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* The rail links to the sister pages, in both languages. */
  function linkCheck() {
    const get = () => ['driveLink', 'learnLink', 'shopLink'].map((id) => {
      const a = document.getElementById(id);
      return a ? a.textContent + '>' + a.getAttribute('href') : 'MISSING ' + id;
    }).join(', ');
    const lb = document.getElementById('langBtn');
    if (A.lang !== 'de') lb.click();
    const de = get();
    lb.click();
    const en = get();
    lb.click();
    const ok = de === 'Fernsteuerung>drive.html, Lernen>learn.html, Werkstatt>werkstatt.html' &&
               en === 'Remote control>drive.html, Learn>learn.html, Workshop>werkstatt.html' && A.lang === 'de';
    return { id: 'links', ok, detail: 'rail links: ' + de + ' | ' + en };
  }

  /* A block label as a pupil reads it: a picker counts as its chosen
     entry, a number field as its number. */
  function labelText(node) {
    const walk = (n) => {
      if (n.nodeType === 3) return n.textContent;
      if (n.nodeType !== 1) return '';
      if (n.tagName === 'SELECT') return ' ' + (n.selectedOptions[0] ? n.selectedOptions[0].textContent : '') + ' ';
      if (n.tagName === 'INPUT') return ' ' + n.value + ' ';
      if (n.tagName === 'BUTTON') return '';
      return Array.from(n.childNodes).map(walk).join('');
    };
    return walk(node).replace(/\s+/g, ' ').trim();
  }

  /* Profi-Woerter: through the rail button, in German and in English, on
     and off. The block labels switch to the keywords of real code (drawn
     as code), robot words and conditions stay in the language, help texts
     and tasks do not change, the program does not change, a run still wins,
     and the setting goes into localStorage. */
  async function profiCheck(own, i9) {
    const bad = [];
    const q = (s) => document.querySelector(s);
    const btn = q('#profiBtn'), langBtn = q('#langBtn');
    const blk = (ty) => q('#paletteList .blk[data-type="' + ty + '"]');
    const lbl = (ty) => (blk(ty) ? labelText(blk(ty).querySelector(':scope > .row .lbl')) : '?');
    const kws = (ty) => (blk(ty) ? Array.from(blk(ty).querySelectorAll(':scope > .row .lbl .kw')).map((k) => k.textContent).join('|') : '?');
    const elseLbl = () => (blk('ifElse') ? blk('ifElse').querySelector(':scope > .mid .lbl').textContent.trim() : '?');
    const tipText = (key) => {
      const i = q('[data-tip-key="' + key + '"]');
      i.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      const s = q('#tip').textContent;
      q('#tip').hidden = true;
      return s;
    };
    const setProfi = (on) => { if (A.profi !== on) btn.click(); };
    const setLang = (l) => { if (A.lang !== l) langBtn.click(); };
    setLang('de');
    setProfi(false);
    A.goLevel(own);
    A.setSandbox(EMPTY3);
    A.setVars(['Schritte']);
    const prog = [B('repeatUntil', { cond: V('Schritte', '=', 2), body: [B('ifElse', { cond: 'frontFree', body: [B('move'), B('changeVar', { v: 'Schritte', n: 1 })], alt: [B('right')] })] })];
    A.setProg(clone(prog));
    const task = q('#taskBox').textContent, tip = tipText('i_vars'), head = q('#t-palette').textContent;
    if (!/^wenn /.test(lbl('ifElse')) || !/^wiederhole 3 mal/.test(lbl('repeat')) || document.querySelector('.blk .kw')) bad.push('off: ' + lbl('ifElse') + ' / ' + lbl('repeat'));
    setProfi(true);
    const want = { ifElse: 'if', repeat: 'repeat|times', repeatUntil: 'repeat until', untilOut: 'repeat until', setVar: 'set|to', changeVar: 'change|by', showVar: 'show' };
    for (const ty in want) if (kws(ty) !== want[ty]) bad.push('de ' + ty + ': ' + kws(ty));
    if (elseLbl() !== 'else') bad.push('de else: ' + elseLbl());
    if (lbl('move') !== 'fahre 1 Feld' || lbl('untilOut') !== 'repeat until drau\u00dfen' || lbl('ifElse') !== 'if rechts frei') bad.push('de robot words: ' + lbl('move') + ' / ' + lbl('untilOut') + ' / ' + lbl('ifElse'));
    const inProg = q('#progList .blk[data-type="repeatUntil"] > .row .lbl .kw');
    if (!inProg || inProg.textContent !== 'repeat until') bad.push('program blocks not relabelled');
    if (q('#taskBox').textContent !== task || tipText('i_vars') !== tip || q('#t-palette').textContent !== head) bad.push('help or task text changed');
    if (JSON.stringify(A.prog) !== JSON.stringify(prog)) bad.push('program changed');
    if (A.storeData().profi !== true || q('#profiBtn').getAttribute('aria-pressed') !== 'true') bad.push('not stored / not pressed');
    setLang('en');
    for (const ty in want) if (kws(ty) !== want[ty]) bad.push('en ' + ty + ': ' + kws(ty));
    if (lbl('untilOut') !== 'repeat until out' || lbl('move') !== 'move 1 cell' || lbl('ifElse') !== 'if right is free') bad.push('en labels: ' + lbl('untilOut') + ' / ' + lbl('ifElse'));
    if (!/Your own maze.*Build your maze/.test(q('#taskBox').textContent) || !/named note/.test(tipText('i_vars'))) bad.push('en help or task text not English');
    setProfi(false);
    if (lbl('ifElse') !== 'if right is free' || document.querySelector('.blk .kw')) bad.push('en off: ' + lbl('ifElse'));
    setProfi(true);
    setLang('de');
    /* with Profi-Woerter on, task 9 is still solved the same way */
    const p = await playLevel(i9, ['Schritte'], SOLUTIONS[9]);
    if (!(p.solved === 3 && p.stars === 3)) bad.push('task 9 with Profi-W\u00f6rter: ' + p.solved + '/3');
    setProfi(false);
    if (!/^wenn /.test(lbl('ifElse')) || A.storeData().profi !== false) bad.push('back off: ' + lbl('ifElse'));
    return { id: 'profi', ok: !bad.length,
             detail: 'Profi-W\u00f6rter on/off in German and English: keywords if/else/repeat/repeat until/set/change/show as code, robot words stay, help and tasks unchanged, program unchanged, task 9 still 3/3, stored: ' +
             (bad.length ? 'BAD ' + bad.join('; ') : 'all right') };
  }

  /* offline: the display font must come from web/fonts, not from the web */
  async function fontCheck() {
    let faces = [];
    try { faces = await document.fonts.load('600 20px Fredoka'); } catch (e) { faces = []; }
    const remote = document.querySelector('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]');
    const ok = faces.length > 0 && document.fonts.check('600 20px Fredoka') && !remote;
    return { id: 'font', ok, detail: ok ? 'Fredoka loaded from fonts/fredoka-latin.woff2, no font CDN'
                                        : 'Fredoka not loaded from web/fonts' + (remote ? ' (CDN link still there)' : '') };
  }

  async function guard(id, fn) {
    try { return await fn(); } catch (e) { return { id, ok: false, detail: 'threw: ' + e.message }; }
  }

  async function run() {
    const out = [];
    const own = A.LEVELS.findIndex((l) => l.sandbox);
    A.setFast(true);
    for (let i = 0; i < A.LEVELS.length; i++) {
      if (A.LEVELS[i].sandbox) continue;
      out.push(await guard(A.LEVELS[i].id, () => check(A.LEVELS[i], i)));
      seen[A.LEVELS[i].id] = A.stats;
    }
    out.push(await guard('stats', async () => statsCheck()));
    out.push(await guard('loop3', () => loopCheck(A.LEVELS.findIndex((l) => l.id === 3))));
    out.push(await guard('chain6', () => chainCheck(A.LEVELS.findIndex((l) => l.id === 6))));
    out.push(await guard('silent', () => silentCheck()));
    for (const c of OWN) out.push(await guard(c.id, () => ownCheck(c, own)));
    try { out.push(...await ruleChecks(own)); }
    catch (e) { out.push({ id: 'rules', ok: false, detail: 'threw: ' + e.message }); }
    out.push(await guard('edit', () => editCheck(own)));
    for (const [n, runs] of [[3, 8], [5, 8], [8, 8], [32, 4]]) out.push(await guard('rnd' + n, () => randomCheck(n, own, runs)));
    for (const [id, n, runs, star] of [['esc5', 5, 4, false], ['star5', 5, 4, true], ['esc8', 8, 2, false],
                                       ['star8', 8, 2, true], ['esc16', 16, 1, false]]) {
      out.push(await guard(id, () => solveCheck(id, n, own, runs, star)));
    }
    out.push(await guard('bot8', () => botCapCheck(own)));
    try { out.push(...fileChecks(A.LEVELS.findIndex((l) => l.id === 5), own)); }
    catch (e) { out.push({ id: 'file', ok: false, detail: 'threw: ' + e.message }); }
    const i8 = A.LEVELS.findIndex((l) => l.id === 8), i9 = A.LEVELS.findIndex((l) => l.id === 9);
    out.push(await guard('varSet', () => varSemantics(own)));
    out.push(await guard('until', () => untilCheck(own)));
    out.push(await guard('budget', () => budgetCheck(own)));
    out.push(await guard('watch', () => watchCheck(own)));
    out.push(await guard('varUi', () => varUiCheck(own)));
    try { out.push(...await varTaskNegatives(i8, i9)); }
    catch (e) { out.push({ id: 'neg', ok: false, detail: 'threw: ' + e.message }); }
    out.push(await guard('botVar', () => botVarCheck(i8, i9)));
    try { out.push(...varFileChecks(i9, own)); }
    catch (e) { out.push({ id: 'fileVar', ok: false, detail: 'threw: ' + e.message }); }
    out.push(await guard('profi', () => profiCheck(own, i9)));
    out.push(await guard('funcUi', () => funcUiCheck(own)));
    out.push(await guard('funcRun', () => funcRunCheck(own)));
    out.push(await guard('funcRec', () => funcRecCheck(own)));
    try { out.push(...funcFileChecks(own)); }
    catch (e) { out.push({ id: 'funcFile', ok: false, detail: 'threw: ' + e.message }); }
    out.push(await guard('listUi', () => listUiCheck(own)));
    out.push(await guard('listRun', () => listRunCheck(own)));
    try { out.push(...await listErrCheck(own)); }
    catch (e) { out.push({ id: 'listErr', ok: false, detail: 'threw: ' + e.message }); }
    out.push(await guard('listWatch', () => listWatchCheck(own)));
    out.push(await guard('opUi', () => opUiCheck(own)));
    try { out.push(...listFileChecks(own)); }
    catch (e) { out.push({ id: 'listFile', ok: false, detail: 'threw: ' + e.message }); }
    out.push(await guard('mapRun', () => mapRunCheck(own)));
    out.push(await guard('mapErr', () => mapErrCheck(own)));
    out.push(await guard('mapDraw', () => mapDrawCheck(own)));
    out.push(await guard('mapUi', () => mapUiCheck(own)));
    out.push(await guard('flood', () => floodCheck(own, 5)));
    out.push(await guard('floodBot', () => floodBotCheck(own)));
    try { out.push(...mapFileChecks(own)); }
    catch (e) { out.push({ id: 'mapFile', ok: false, detail: 'threw: ' + e.message }); }
    out.push(await guard('profiNew', () => profiNewCheck(own)));
    out.push(await guard('links', async () => linkCheck()));
    out.push(await fontCheck());
    A.setFast(false);

    const bad = out.filter((r) => !r.ok);
    const text = out.map((r) => (r.ok ? 'PASS ' : 'FAIL ') + r.id + ' ' + r.detail).join('\n');
    const pre = document.createElement('pre');
    pre.id = 'selftest';
    pre.style.cssText = 'position:fixed;inset:0;z-index:999;margin:0;padding:24px;' +
      'background:#141a24;color:#dfe6f0;font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap';
    pre.textContent = (bad.length ? bad.length + ' CHECK(S) FAILED' : 'ALL PASS') +
      ' (' + out.length + ' checks)\n\n' + text;
    document.body.append(pre);
    document.title = bad.length ? 'SELFTEST FAIL ' + bad.map((r) => r.id).join(',') : 'SELFTEST PASS';
  }

  run();
})();
