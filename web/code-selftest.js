/*
 * Self-check for the levels. Loaded only by code.html?selftest=1.
 *
 * For every level it drops in the solution a pupil is meant to find, runs it
 * in the simulator at full speed and checks that the level is solved and that
 * the block count earns three stars. Every task starts inside, on (0,0)
 * facing north; an escape maze has exactly one opening in its border. A
 * level that cannot be solved, or whose par is wrong, is a bug in
 * code-data.js, not in the pupil. Level 6 must solve all three of its mazes.
 *
 * Then the own maze (level 7): mazes set through the hook must be won by a
 * known program, with the default and with a moved and turned start, for
 * both kinds of goal - and no stars may be handed out there. The one-goal
 * rule (star XOR one opening) is checked through the same edits a click
 * makes. Zufall must build perfect mazes up to 32x32 with the goal farthest
 * from the start, a wall follower must get out of them, and Echter Roboter
 * must refuse mazes above 5x5. Then the program files: a saved program must
 * open again unchanged, and broken or hostile files must be refused. Last,
 * the font must come from web/fonts.
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
  const STATS = { 1: [2, 0, 20], 2: [4, 1, 48], 3: [6, 2, 76], 4: [4, 1, 48], 5: [5, 3, 74] };
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
    A.setProg(clone(SOLUTIONS[5]));
    const d5 = A.exportData();
    const b5 = A.parseFile(JSON.stringify(d5, null, 2));
    add('file1', d5.version === 1 && d5.level === 5 && d5.lang && !('maze' in d5) && b5 &&
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
      P({ version: 2, prog: [] }),
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
