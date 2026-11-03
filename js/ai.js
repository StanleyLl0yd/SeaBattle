const AI_BITS = Array.from({ length: SIZE * SIZE }, (_, i) => 1n << BigInt(i));
    const AI_PLACEMENTS = [[], [], [], [], []];
    for (let length = 1; length <= 4; length++) {
      for (let i = 0; i < SIZE * SIZE; i++) for (const horizontal of [true, false]) {
        if (length === 1 && !horizontal) continue;
        const [x, y] = xy(i);
        if (x + (horizontal ? length : 1) > SIZE || y + (horizontal ? 1 : length) > SIZE) continue;
        const cells = Array.from({ length }, (_, n) => index(x + (horizontal ? n : 0), y + (horizontal ? 0 : n)));
        let mask = 0n, halo = 0n, edge = 0;
        for (const cell of cells) {
          mask |= AI_BITS[cell];
          halo |= AI_BITS[cell];
          for (const neighbor of neighbors(cell)) halo |= AI_BITS[neighbor];
          const [cx, cy] = xy(cell);
          if (cx === 0 || cx === SIZE - 1 || cy === 0 || cy === SIZE - 1) edge++;
        }
        AI_PLACEMENTS[length].push({ cells, mask, halo, edge });
      }
    }

    function aiNoviceShot(shots, level) {
      const open = shots.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
      if (!open.length) return null;
      const adjacent = [];
      for (let i = 0; i < shots.length; i++) if (shots[i] === "hit") {
        for (const n of neighbors(i, false)) if (shots[n] === null) adjacent.push(n);
      }
      if (adjacent.length && Math.random() < (level === 1 ? 0.65 : 0.9))
        return randomFrom([...new Set(adjacent)]);
      return randomFrom(open);
    }

// Build entire remaining fleets compatible with observed hits and misses.
// Exhaust small endgames; otherwise sample bounded, randomized completions.
function aiJointPosterior(shots, lengths, placements, active, level) {
  const exact = lengths.length <= 2;
  const deadline = Date.now() + (level >= 18 ? 25 : level >= 16 ? 19 : 13);
  const nodeLimit = exact ? 65000 : level >= 18 ? 13000 : level >= 16 ? 9000 : 6000;
  const sampleLimit = exact ? 45000 : level >= 18 ? 144 : level >= 16 ? 96 : 48;
  const heat = new Float64Array(SIZE * SIZE);
  const follow = new Float64Array(SIZE * SIZE);
  const hits = [];
  for (let i = 0; i < shots.length; i++) if (shots[i] === "hit") hits.push(i);
  const picked = [];
  let nodes = 0, solutions = 0, stopped = false;

  function search(left, blocked, covered) {
    if (++nodes > nodeLimit || (nodes & 31) === 0 && Date.now() >= deadline) {
      stopped = true;
      return false;
    }
    if (left.length === 0) {
      if (covered !== active) return false;
      solutions++;
      for (const ship of picked) {
        let revealed = 0;
        for (const cell of ship.cells) if (shots[cell] === "hit") revealed++;
        for (const cell of ship.cells) if (shots[cell] === null) {
          heat[cell]++;
          if (revealed) follow[cell] += revealed;
        }
      }
      return true;
    }
    const uncovered = active & ~covered;
    let options = [], fewest = Infinity;
    if (uncovered !== 0n) {
      // Cover the most constrained revealed hit first; never return a fleet
      // that leaves an observed hit unassigned to a compatible live ship.
      for (const hit of hits) {
        if ((uncovered & AI_BITS[hit]) === 0n) continue;
        const choices = [];
        for (const size of new Set(left)) {
          const slot = left.indexOf(size);
          for (const ship of placements[size]) {
            if ((ship.mask & AI_BITS[hit]) !== 0n && (ship.mask & blocked) === 0n)
              choices.push([slot,ship]);
          }
        }
        if (choices.length < fewest) { fewest = choices.length; options = choices; }
        if (!fewest) return false;
      }
    } else {
      const size = left[0];
      for (const ship of placements[size])
        if ((ship.mask & blocked) === 0n) options.push([0,ship]);
    }
    if (!options.length) return false;
    const start = exact ? 0 : Math.floor(Math.random() * options.length);
    const step = exact || Math.random() < 0.5 ? 1 : -1;
    const cap = exact ? options.length : Math.min(options.length, 42);
    let completed = false;
    for (let n = 0; n < cap; n++) {
      if (stopped || solutions >= sampleLimit || Date.now() >= deadline) {
        stopped = true;
        break;
      }
      const choice = options[(start + step * n + options.length * 2) % options.length];
      const [slot,ship] = choice;
      picked.push(ship);
      const found = search(left.filter((_,i) => i !== slot),blocked | ship.halo,
        covered | (ship.mask & active));
      picked.pop();
      if (found) {
        completed = true;
        if (!exact) return true;
      }
    }
    return completed;
  }

  const ordered = lengths.slice().sort((a,b) => b-a);
  if (exact) search(ordered,0n,0n);
  else while (!stopped && solutions < sampleLimit && Date.now() < deadline)
    search(ordered,0n,0n);
  if (exact && stopped) return null;
  return solutions ? {heat,follow,solutions,exact:exact && !stopped} : null;
}

function aiJointShot(shots, open, lengths, legal, active, level) {
  const posterior = aiJointPosterior(shots,lengths,legal,active,level);
  if (!posterior) return null;
  const frontier = active === 0n ? [] : open.filter(i =>
    neighbors(i,false).some(j => shots[j] === "hit"));
  const options = frontier.length ? frontier : open;
  const local = new Float64Array(SIZE * SIZE);
  let total = 0;
  if (!posterior.exact && active === 0n) {
    for (const size of lengths) for (const ship of legal[size])
      for (const cell of ship.cells) if (shots[cell] === null) {
        local[cell]++;
        total++;
      }
  }
  const liveCells = lengths.reduce((sum,n) => sum+n,0);
  const share = posterior.exact ? 1 : level >= 18 ? 0.68 : level >= 16 ? 0.54 : 0.4;
  let best = -Infinity;
  const score = new Float64Array(SIZE * SIZE);
  for (const cell of options) {
    const occupancy = posterior.heat[cell] / posterior.solutions;
    const probability = active !== 0n || posterior.exact ? occupancy :
      share * occupancy + (1-share) * (total ? local[cell]*liveCells/total : 0);
    // A hit keeps the turn: modestly prefer shots that expose an extension
    // of an already damaged ship, without treating the score as calibrated.
    const follow = active ? posterior.follow[cell] / posterior.solutions : 0;
    score[cell] = probability + Math.min(0.2,0.06*follow) +
      (active ? 0 : 0.045*probability*(1-probability));
    if (score[cell] > best) best = score[cell];
  }
  if (!(best > 0)) return null;
  const tolerance = posterior.exact ? 0.000001 : level >= 18 ? 0.003 : 0.008;
  return randomFrom(options.filter(cell => score[cell] >= best-tolerance));
}

    function aiChooseShot(board, level = 12) {
      level = Math.max(1, Math.min(19, Number.isInteger(level) ? level : 12));
      if (level <= 2) return aiNoviceShot(board.shots, level);
      const shots = board.shots;
      const open = [];
      let forbidden = 0n, active = 0n, edgeHits = 0, innerHits = 0;
      let edgeShots = 0, innerShots = 0;
      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        if (shot === null) { open.push(i); continue; }
        const [x, y] = xy(i);
        const edge = x === 0 || x === 9 || y === 0 || y === 9;
        if (shot !== "blocked") {
          if (edge) { edgeShots++; if (shot === "hit" || shot === "sunk") edgeHits++; }
          else { innerShots++; if (shot === "hit" || shot === "sunk") innerHits++; }
        }
        if (shot === "hit") active |= AI_BITS[i];
        else forbidden |= AI_BITS[i];
      }
      if (!open.length) return null;
      const lengths = board.ships.filter(ship => !ship.sunk).map(ship => ship.size);
      const legal = [[], [], [], [], []];
      for (const length of new Set(lengths)) {
        legal[length] = AI_PLACEMENTS[length].filter(p =>
          (p.mask & forbidden) === 0n && (p.halo & active) === (p.mask & active));
      }

      if (level >= 13 && active !== 0n && lengths.length <= 2) {
        const joint = aiJointShot(shots,open,lengths,legal,active,level);
        if (joint !== null) return joint;
      }

      // Finish revealed ships first. Non-touching ships cannot share a hit's halo.
      if (active) {
        const target = new Float64Array(SIZE * SIZE);
        for (const length of new Set(lengths)) for (const p of legal[length]) {
          const hits = p.cells.filter(i => shots[i] === "hit").length;
          if (!hits) continue;
          const weight = hits * hits / Math.max(1, legal[length].length);
          for (const cell of p.cells) {
            if (shots[cell] === null && neighbors(cell, false).some(i => shots[i] === "hit")) target[cell] += weight;
          }
        }
        const best = Math.max(...open.map(i => target[i]));
        if (best > 0) return randomFrom(open.filter(i => target[i] >= best * 0.995));
      }

      // Gradually enable bounded full-fleet sampling as ranks increase.
      // All levels respect public evidence; bounded local probability is the fallback.
      const heat = new Float64Array(SIZE * SIZE);
      let samples = 0;
      const skill = (level-3)/16;
      const sampleLimit = Math.round(2.5*(level-3)+0.172*(level-3)**2);
      const timeBudget = Math.round(9+14*skill);
      const nodeLimit = Math.round(900+400*skill);
      const deadline = Date.now() + timeBudget;
      const ordered = [...lengths].sort((a, b) => b - a);
      for (let attempt = 0; attempt < sampleLimit && Date.now() < deadline; attempt++) {
        const chosen = [];
        let nodes = 0;
        const style = attempt % 4 === 0 ? 1 : attempt % 4 === 1 ? -1 : 0;
        const place = (depth, blocked) => {
          if (depth === ordered.length) return true;
          if (++nodes > nodeLimit || Date.now() >= deadline) return false;
          const length = ordered[depth];
          const options = legal[length];
          if (!options.length) return false;
          const start = Math.floor(Math.random() * options.length);
          const step = Math.random() < 0.5 ? 1 : -1;
          const limit = Math.min(options.length, 55);
          for (let n = 0; n < limit; n++) {
            const p = options[(start + step * n + options.length * 2) % options.length];
            if ((p.mask & blocked) !== 0n) continue;
            if (style !== 0 && Math.random() < (style > 0 ? (length - p.edge) : p.edge) / (length * 1.35)) continue;
            chosen.push(p);
            if (place(depth + 1, blocked | p.halo)) return true;
            chosen.pop();
            if (nodes > nodeLimit || Date.now() >= deadline) return false;
          }
          return false;
        };
        if (place(0, 0n)) {
          samples++;
          for (const p of chosen) for (const i of p.cells) heat[i]++;
        }
      }

      // Marginal fallback covers late-game states where constrained sampling is costly.
      const local = new Float64Array(SIZE * SIZE);
      let localSum = 0;
      for (const length of lengths) for (const p of legal[length]) for (const i of p.cells) {
        if (shots[i] === null) { local[i]++; localSum++; }
      }
      const liveCells = lengths.reduce((sum, length) => sum + length, 0);
      const edgeRate = (edgeHits + 2) / (edgeShots + 10);
      const innerRate = (innerHits + 2) / (innerShots + 10);
      // Introduce positional adaptation gradually, rather than abruptly at rank 9.
      const adaptationStrength = Math.min(1,Math.max(0,(level-3)/13));
      const adaptation = adaptationStrength *
        Math.max(-0.09, Math.min(0.09, (edgeRate - innerRate) * 0.3));
      let best = -Infinity;
      const scores = new Float64Array(SIZE * SIZE);
      const sampleShare = samples >= 3 ? Math.min(0.88,0.052*(level-3)+0.0002*(level-3)**2) : 0;
      for (const i of open) {
        const p = samples ? heat[i] / samples : 0;
        const base = localSum ? (local[i] * liveCells / localSum) : 0;
        const probability = sampleShare * p + (1 - sampleShare) * base;
        const [x, y] = xy(i);
        const edge = x === 0 || x === 9 || y === 0 || y === 9;
        const information = (0.06+0.04*skill)*probability*(1-probability);
        const score = probability + information + (edge ? adaptation : 0);
        scores[i] = score;
        if (score > best) best = score;
      }
      const exploration = 0.78*Math.exp(-0.3*(level-3))*((19-level)/16);
      // Every straight ship of length N covers each diagonal residue mod N.
      // Search one covering residue while multi-cell ships survive; restore
      // the full board for single-cell endgames or revealed targets.
      const minLong = lengths.filter(size => size > 1).reduce((a,b) => Math.min(a,b),Infinity);
      const stride = active === 0n ? minLong : Infinity;
      const covering = Number.isFinite(stride) ?
        open.filter(i => (Math.floor(i / SIZE) + i % SIZE) % stride === 0) : open;
      const coverWeight = ((level-2)/17)**2;
      const hunt = covering.length && (coverWeight>=1 || Math.random()<coverWeight) ? covering : open;
      if (!active && Math.random() < exploration) return randomFrom(hunt);
      const bestHunt = Math.max(...hunt.map(i => scores[i]));
      return randomFrom(hunt.filter(i => scores[i] >= bestHunt - (level >= 16 ? 0.002 : 0.004)));
    }
