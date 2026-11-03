import {validFleet,fire,memberView} from "./rules.mjs";

const ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_BODY=4096;
async function readLimited(req){
  if(!req.body)throw bad("INVALID_REQUEST");
  const reader=req.body.getReader(),chunks=[];
  let length=0;
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    length+=value.byteLength;
    if(length>MAX_BODY){await reader.cancel();throw bad("INVALID_REQUEST",413);}
    chunks.push(value);
  }
  const raw=new Uint8Array(length);
  let position=0;
  for(const chunk of chunks){raw.set(chunk,position);position+=chunk.byteLength;}
  return new TextDecoder().decode(raw);
}
const DAY=86400000;
const GRACE=120000;
const bad=(code,status=400)=>Object.assign(new Error(code),{code,status});
const randomText=(length,alphabet)=>{
  const bytes=crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes,x=>alphabet[x%alphabet.length]).join("");
};
const randomCode=()=>randomText(12,ALPHABET);
const randomToken=()=>randomText(48,"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_");
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))))
  .map(x=>x.toString(16).padStart(2,"0")).join("");
const iso=ms=>new Date(ms).toISOString();
const nickname=value=>typeof value==="string"&&value.trim().length>0&&value.trim().length<=24?
  value.trim():"Captain";
const roleFor=(room,hash)=>hash===room.host_token_hash?"host":
  hash===room.guest_token_hash&&room.guest_token_hash?"guest":null;
const cors=origin=>!origin||origin==="https://stanleyll0yd.github.io"||
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(origin);
const response=(value,status=200,origin=null)=>new Response(JSON.stringify(value),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
  "referrer-policy":"no-referrer","access-control-allow-origin":origin||"https://stanleyll0yd.github.io",
  "access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type",
  "vary":"origin"}
});
const nextVersion=(room,values,at)=>({...values,version:room.version+1,updated_at:iso(at)});
export function createHandler(store,now=()=>Date.now()){
  return async function handler(req){
    const origin=req.headers.get("origin");
    if(!cors(origin))return response({error:"ORIGIN_DENIED"},403);
    if(req.method==="OPTIONS")return response({ok:true},200,origin);
    if(req.method!=="POST")return response({error:"METHOD_NOT_ALLOWED"},405,origin);
    try {
      const size=Number(req.headers.get("content-length")||0);
      if(size>MAX_BODY)throw bad("INVALID_REQUEST",413);
      const text=await readLimited(req);
      let request;
      try{request=JSON.parse(text);}catch{throw bad("INVALID_REQUEST");}
      if(!request||typeof request!=="object"||Array.isArray(request))throw bad("INVALID_REQUEST");
      const action=request.action;
      const at=now(),seen=iso(at),expiry=iso(at+DAY);
      if(action==="create"){
        await store.cleanup(seen);
        const token=randomToken(),hash=await digest(token),name=nickname(request.name);
        let row=null;
        for(let i=0;i<4&&!row;i++){
          const candidate={
            code:randomCode(),host_token_hash:hash,guest_token_hash:null,
            host_name:name,guest_name:null,host_fleet:null,guest_fleet:null,
            host_shots:[],guest_shots:[],host_ready:false,guest_ready:false,
            host_seen:seen,guest_seen:null,host_rematch:false,guest_rematch:false,
            phase:"waiting",round:1,turn:null,winner:null,finish_reason:null,
            created_at:seen,updated_at:seen,expires_at:expiry,version:1
          };
          row=await store.insert(candidate);
        }
        if(!row)throw bad("ROOM_UNAVAILABLE",503);
        return response({token,...memberView(row,"host",at)},201,origin);
      }
      const code=typeof request.code==="string"?request.code.toUpperCase():"";
      if(!/^[A-HJ-NP-Z2-9]{12}$/.test(code))throw bad("INVALID_CODE");
      let room=await store.get(code);
      if(!room)throw bad("ROOM_NOT_FOUND",404);
      if(Date.parse(room.expires_at)<=at)throw bad("ROOM_EXPIRED",410);
      if(action==="join"){
        if(room.guest_token_hash||room.phase!=="waiting")throw bad("ROOM_FULL",409);
        const token=randomToken(),hash=await digest(token);
        const update=nextVersion(room,{guest_token_hash:hash,guest_name:nickname(request.name),
          guest_seen:seen,phase:"placement"},at);
        room=await store.cas(code,room.version,update);
        if(!room)throw bad("RETRY",409);
        return response({token,...memberView(room,"guest",at)},200,origin);
      }
      if(typeof request.token!=="string"||request.token.length!==48)throw bad("NOT_AUTHORIZED",403);
      const role=roleFor(room,await digest(request.token));
      if(!role)throw bad("NOT_AUTHORIZED",403);
      if(at-Date.parse(room[role+"_seen"]||0)>=5000){
        await store.touch(code,role,seen);
        room[role+"_seen"]=seen;
      }
      if(action==="state")return response(memberView(room,role,at),200,origin);
      const other=role==="host"?"guest":"host";
      let update;
      if(action==="ready"){
        if(!["waiting","placement"].includes(room.phase)||room[role+"_ready"])throw bad("INVALID_PHASE",409);
        if(!validFleet(request.fleet))throw bad("INVALID_FLEET");
        const both=Boolean(room[other+"_ready"]);
        update=nextVersion(room,{[role+"_fleet"]:request.fleet,[role+"_ready"]:true,
          phase:both?"playing":room.phase,
          turn:both?(crypto.getRandomValues(new Uint8Array(1))[0]&1?"host":"guest"):null},at);
      }else if(action==="fire"){
        if(room.phase!=="playing")throw bad("INVALID_PHASE",409);
        if(room.turn!==role)throw bad("NOT_YOUR_TURN",409);
        const opponentTime=room[other+"_seen"]?Date.parse(room[other+"_seen"]):0;
        if(at-opponentTime>15000)throw bad("OPPONENT_OFFLINE",409);
        let outcome;
        try{outcome=fire(room[other+"_fleet"],room[role+"_shots"],request.cell);}
        catch(error){throw bad(error.message==="INVALID_CELL"?"INVALID_CELL":"CELL_UNAVAILABLE",409);}
        update=nextVersion(room,{[role+"_shots"]:outcome.events,
          turn:outcome.won?null:outcome.extraTurn?role:other,
          phase:outcome.won?"finished":"playing",
          winner:outcome.won?role:null,
          finish_reason:outcome.won?"sunk":null},at);
      }else if(action==="surrender"){
        if(room.phase!=="playing")throw bad("INVALID_PHASE",409);
        update=nextVersion(room,{phase:"finished",turn:null,winner:other,finish_reason:"surrender"},at);
      }else if(action==="leave"){
        if(!["waiting","placement"].includes(room.phase))throw bad("INVALID_PHASE",409);
        update=nextVersion(room,{phase:"finished",turn:null,
          winner:room[other+"_name"]?other:null,finish_reason:"left"},at);
      }else if(action==="claim"){
        const otherTime=room[other+"_seen"]?Date.parse(room[other+"_seen"]):0;
        if(room.phase!=="playing"||!room[other+"_name"]||at-otherTime<GRACE)
          throw bad("CANNOT_CLAIM",409);
        update=nextVersion(room,{phase:"finished",turn:null,winner:role,finish_reason:"disconnect"},at);
      }else if(action==="rematch"){
        if(room.phase!=="finished"||!room.guest_token_hash)throw bad("INVALID_PHASE",409);
        const both=room[other+"_rematch"];
        update=nextVersion(room,both?{
          host_fleet:null,guest_fleet:null,host_shots:[],guest_shots:[],
          host_ready:false,guest_ready:false,host_rematch:false,guest_rematch:false,
          phase:"placement",turn:null,winner:null,finish_reason:null,round:room.round+1
        }:{[role+"_rematch"]:true},at);
      }else throw bad("INVALID_REQUEST");
      room=await store.cas(code,room.version,update);
      if(!room)throw bad("RETRY",409);
      return response(memberView(room,role,at),200,origin);
    }catch(error){
      if(error&&typeof error.status==="number")return response({error:error.code},error.status,origin);
      return response({error:"SERVER_UNAVAILABLE"},503,origin);
    }
  };
}
export class PostgrestStore{
  constructor(url,key){
    if(!/^https:\/\//.test(url)||!key)throw Error("Missing Supabase Edge environment");
    this.url=url.replace(/\/$/,"")+"/rest/v1/seabattle_rooms";
    this.key=key;
  }
  async query(method,suffix="",body=null){
    const headers={"apikey":this.key,"accept":"application/json"};
    if(this.key.startsWith("eyJ"))headers.authorization="Bearer "+this.key;
    if(body!==null)headers["content-type"]="application/json";
    if(method==="POST"||method==="PATCH")headers.prefer="return=representation";
    const result=await fetch(this.url+suffix,{method,headers,
      body:body===null?undefined:JSON.stringify(body),cache:"no-store"});
    if(!result.ok)throw Error("Database request failed ("+result.status+")");
    if(result.status===204)return [];
    return await result.json();
  }
  async get(code){
    const rows=await this.query("GET","?code=eq."+encodeURIComponent(code)+"&select=*");
    return rows[0]||null;
  }
  async insert(room){
    try{const rows=await this.query("POST","?select=*",room);return rows[0]||null;}
    catch(error){if(/409/.test(error.message))return null;throw error;}
  }
  async cas(code,version,change){
    const rows=await this.query("PATCH","?code=eq."+encodeURIComponent(code)+
      "&version=eq."+version+"&select=*",change);
    return rows[0]||null;
  }
  async touch(code,role,seen){
    await this.query("PATCH","?code=eq."+encodeURIComponent(code)+"&select=code",
      {[role+"_seen"]:seen});
  }
  async cleanup(now){
    await this.query("DELETE","?expires_at=lte."+encodeURIComponent(now));
  }
}
if(typeof Deno!=="undefined"){
  const url=Deno.env.get("SUPABASE_URL")||"";
  const secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  const key=secrets.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  Deno.serve(createHandler(new PostgrestStore(url,key)));
}
