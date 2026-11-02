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
      const sampleLimit = level === 3 ? 0 : level <= 9 ? 3 * (level - 3) :
        level <= 12 ? 18 + (level - 9) * 6 :
        level <= 15 ? 40 + (level - 13) * 8 : 60 + (level - 16) * 8;
      const timeBudget = level <= 6 ? 9 : level <= 8 ? 11 :
        level <= 15 ? 14 : 17 + (level - 16) * 2;
      const nodeLimit = level <= 12 ? 900 : level <= 15 ? 1100 : 1300;
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
      const adaptationStrength = level <= 3 ? 0 : level <= 9 ? (level - 3) / 10 :
        Math.min(1, 0.6 + (level - 9) * 0.04);
      const adaptation = adaptationStrength *
        Math.max(-0.09, Math.min(0.09, (edgeRate - innerRate) * 0.3));
      let best = -Infinity;
      const scores = new Float64Array(SIZE * SIZE);
      const sampleShare = samples >= 3 ? Math.min(0.88, 0.08 * (level - 3)) : 0;
      for (const i of open) {
        const p = samples ? heat[i] / samples : 0;
        const base = localSum ? (local[i] * liveCells / localSum) : 0;
        const probability = sampleShare * p + (1 - sampleShare) * base;
        const [x, y] = xy(i);
        const edge = x === 0 || x === 9 || y === 0 || y === 9;
        const information = level >= 16 ? 0.1 * probability * (1 - probability) : 0.06 * probability * (1 - probability);
        const score = probability + information + (edge ? adaptation : 0);
        scores[i] = score;
        if (score > best) best = score;
      }
      const exploration = level <= 8 ? [0,0,0,0.78,0.6,0.45,0.32,0.20,0.12][level] :
        level <= 12 ? 0.08 - (level - 9) * 0.015 :
        level <= 16 ? 0.026 - (level - 13) * 0.006 : Math.max(0, 0.008 - (level - 17) * 0.004);
      if (!active && Math.random() < exploration) return randomFrom(open);
      return randomFrom(open.filter(i => scores[i] >= best - (level >= 16 ? 0.002 : 0.004)));
    }
