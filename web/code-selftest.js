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
 * open. Last, the font must come from web/fonts.
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
