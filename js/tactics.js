"use strict";
// Public-information heuristic snapshots are descriptive, not a proof of optimal play.
function tacticalSnapshot(board, chosen) {
  const shots = board.shots;
  const active = shots.map((v,i)=>v === "hit" ? i : -1).filter(i=>i>=0);
  const scores = new Uint16Array(100);
  let mode = "hunt";
  if (active.length) {
    mode = "target";
    for (const i of active) for (const neighbor of neighbors(i,false))
      if (shots[neighbor] === null) scores[neighbor] += 1;
  } else {
    const lengths = board.ships.filter(ship=>!ship.sunk).map(ship=>ship.size);
    for (const length of lengths) for (const placement of AI_PLACEMENTS[length]) {
      if (placement.cells.every(i=>shots[i]===null))
        for (const i of placement.cells) scores[i]++;
    }
  }
  const open = scores.map((v,i)=>shots[i]===null ? v : 0);
  const max = Math.max(0,...open);
  const selected = scores[chosen] || 0;
  return { mode, chosen, selected, max, promising:max>0 && selected>=max*0.9 };
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
