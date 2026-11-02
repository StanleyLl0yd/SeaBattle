"use strict";
// Use only shot evidence and public remaining ship lengths, never hidden cells.
function tacticalSnapshot(board, chosen) {
  const shots = board.shots;
  let active = 0n, forbidden = 0n;
  for (let i = 0; i < shots.length; i++) {
    if (shots[i] === "hit") active |= AI_BITS[i];
    else if (shots[i] !== null) forbidden |= AI_BITS[i];
  }
  const mode = active === 0n ? "hunt" : "target";
  const scores = new Uint16Array(100);
  for (const ship of board.ships) {
    if (ship.sunk) continue;
    for (const placement of AI_PLACEMENTS[ship.size]) {
      if ((placement.mask & forbidden) !== 0n ||
          (placement.halo & active) !== (placement.mask & active)) continue;
      const hits = placement.cells.filter(i => shots[i] === "hit").length;
      if (active !== 0n && !hits) continue;
      const weight = active === 0n ? 1 : hits * hits;
      for (const cell of placement.cells)
        if (shots[cell] === null) scores[cell] += weight;
    }
  }
  const max = Math.max(0, ...scores);
  const selected = Number.isInteger(chosen) && chosen >= 0 && chosen < 100 &&
    shots[chosen] === null ? scores[chosen] : 0;
  const bestCell = max > selected ? scores.findIndex((v, i) => shots[i] === null && v === max) : null;
  return { mode, chosen, bestCell, selected, max, promising: max > 0 && selected >= max * 0.9 };
}
function summarizeTactics(trace) {
  const hunt = trace.filter(x=>x.mode==="hunt");
  const target = trace.filter(x=>x.mode==="target");
  const countHits = xs=>xs.filter(x=>x.outcome==="hit"||x.outcome==="sunk").length;
  const top = trace.filter(x=>x.promising).length;
  return {
    shots:trace.length, huntShots:hunt.length, huntHits:countHits(hunt),
    targetShots:target.length, targetHits:countHits(target),
    promising:top, alternatives:trace.filter(x=>x.max>x.selected).length,
    misses:trace.filter(x=>x.outcome==="miss").length
  };
}
