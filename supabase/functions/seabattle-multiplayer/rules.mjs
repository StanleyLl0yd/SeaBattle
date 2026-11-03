// Authoritative, dependency-free game rules shared by the server and Node tests.
export const FLEET_LENGTHS = [4,3,3,2,2,2,1,1,1,1];
const SIZE=10;
const neighbors = at => {
  const x=at%SIZE,y=Math.floor(at/SIZE),out=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    const nx=x+dx,ny=y+dy;
    if(nx>=0&&nx<SIZE&&ny>=0&&ny<SIZE)out.push(ny*SIZE+nx);
  }
  return out;
};
export function validFleet(fleet){
  if(!Array.isArray(fleet)||fleet.length!==10)return false;
  const occupied=new Map(), lengths=[];
  for(let id=0;id<fleet.length;id++){
    const ship=fleet[id];
    if(!Array.isArray(ship)||ship.length<1||ship.length>4)return false;
    const cells=[...ship].sort((a,b)=>a-b);
    if(cells.some(x=>!Number.isInteger(x)||x<0||x>=100))return false;
    if(new Set(cells).size!==cells.length)return false;
    if(cells.length>1){
      const horizontal=cells.every(x=>Math.floor(x/SIZE)===Math.floor(cells[0]/SIZE));
      const vertical=cells.every(x=>x%SIZE===cells[0]%SIZE);
      if(!horizontal&&!vertical)return false;
      if(cells.some((x,i)=>i>0&&x-cells[i-1]!==(horizontal?1:SIZE)))return false;
    }
    lengths.push(cells.length);
    for(const at of cells){
      if(occupied.has(at))return false;
      occupied.set(at,id);
    }
  }
  if(lengths.sort((a,b)=>b-a).some((x,i)=>x!==FLEET_LENGTHS[i]))return false;
  for(const [at,id] of occupied)
    if(neighbors(at).some(other=>occupied.has(other)&&occupied.get(other)!==id))return false;
  return true;
}
export function shotMap(events){
  const grid=Array(100).fill(null);
  for(const e of events){
    if(e.kind==="sunk"){
      for(const at of e.ship){
        grid[at]="sunk";
        for(const n of neighbors(at))if(grid[n]===null)grid[n]="blocked";
      }
    }else if(grid[e.at]!=="sunk")grid[e.at]=e.kind;
  }
  return grid;
}
export function fire(fleet,events,at){
  if(!Number.isInteger(at)||at<0||at>=100)throw Error("INVALID_CELL");
  if(shotMap(events)[at]!==null)throw Error("CELL_UNAVAILABLE");
  const ship=fleet.find(cells=>cells.includes(at));
  if(!ship){
    const event={at,kind:"miss"};
    return {events:[...events,event],event,won:false,extraTurn:false};
  }
  const seen=new Set(events.filter(e=>e.kind!=="miss").map(e=>e.at));
  seen.add(at);
  const sunk=ship.every(cell=>seen.has(cell));
  const event=sunk?{at,kind:"sunk",ship:[...ship]}:{at,kind:"hit"};
  const won=fleet.every(cells=>cells.every(cell=>seen.has(cell)));
  return {events:[...events,event],event,won,extraTurn:true};
}
export function memberView(room,role,now=Date.now()){
  const other=role==="host"?"guest":"host";
  const myFleet=room[role+"_fleet"],myShots=room[role+"_shots"];
  const otherShots=room[other+"_shots"];
  const seen=room[other+"_seen"]?Date.parse(room[other+"_seen"]):0;
  const seconds=seen?Math.max(0,Math.ceil((now-seen)/1000)):null;
  return {
    code:room.code,role,phase:room.phase,round:room.round,version:room.version,
    myName:room[role+"_name"],opponentName:room[other+"_name"]||null,
    myReady:room[role+"_ready"],opponentReady:room[other+"_ready"],
    myFleet:myFleet||null,
    own:shotMap(otherShots),enemy:shotMap(myShots),
    ownShots:otherShots.length,enemyShots:myShots.length,
    ownAfloat:10-otherShots.filter(x=>x.kind==="sunk").length,
    enemyAfloat:10-myShots.filter(x=>x.kind==="sunk").length,
    turn:room.turn,winner:room.winner,finishReason:room.finish_reason,
    myRematch:room[role+"_rematch"],opponentRematch:room[other+"_rematch"],
    opponentOnline:Boolean(room[other+"_name"]&&seconds!==null&&seconds<12),
    claimAvailable:room.phase==="playing"&&Boolean(room[other+"_name"])&&(seconds===null||seconds>=120),
    reconnectSeconds:room.phase==="playing"&&room[other+"_name"]&&seconds!==null?Math.max(0,120-seconds):null
  };
}
