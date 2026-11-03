'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const html=readFileSync(join(root,'index.html'),'utf8');
const cfg=readFileSync(join(root,'js/multiplayer-config.js'),'utf8');
const code=readFileSync(join(root,'js/multiplayer.js'),'utf8');
const CODE='ABCDEFGHJKLM';
const TOKEN='X'.repeat(48);
function view(extra={}){
  return {code:CODE,role:'host',phase:'waiting',version:1,round:1,
    opponentName:null,opponentOnline:false,turn:null,winner:null,finishReason:null,
    myFleet:null,myReady:false,opponentReady:false,own:Array(100).fill(null),
    enemy:Array(100).fill(null),ownAfloat:10,enemyAfloat:10,ownShots:0,enemyShots:0,
    myRematch:false,opponentRematch:false,claimAvailable:false,reconnectSeconds:null,...extra};
}
function boot(url='',respond=()=>view()){
  const nodes=new Map(),stored=new Map(),requests=[],state={classes:new Set(),timers:0};
  const node=()=>({hidden:false,disabled:false,readOnly:false,textContent:'',value:'',
    dataset:{},handlers:{},innerHTML:'',style:{},classList:{toggle(){},add(){},remove(){}},
    addEventListener(key,fn){this.handlers[key]=fn;},
    click(){this.handlers.click?.();},
    querySelector(){return null;},select(){this.selected=true;}});
  for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes.set(m[1],node());
  const document={
    body:{classList:{toggle(name,flag){if(flag)state.classes.add(name);else state.classes.delete(name);}}},
    getElementById:id=>nodes.get(id),querySelector:()=>null,querySelectorAll:()=>[],activeElement:null,hidden:false
  };
  const location={href:'https://stanleyll0yd.github.io/SeaBattle/'};
  const fetch=async(path,request)=>{
    const body=JSON.parse(request.body);requests.push({path,body});
    const result=respond(body);
    return new Response(JSON.stringify(result),{status:body.action==='create'?201:200});
  };
  const context=vm.createContext({window:{location},document,location,fetch,
    localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},
    navigator:{clipboard:{writeText:async()=>{}}},
    URL,Response,AbortController,
    setTimeout:()=>++state.timers,clearTimeout:()=>{},confirm:()=>true,
    randomFleet:()=>({ships:[[0,1,2,3],[20,21,22],[40,41,42],[60,61],[64,65],[80,81],[6],[8],[26],[28]].map(cells=>({cells})),cells:Array(100).fill(-1)}),
    createBoard:()=>({ships:[],cells:Array(100).fill(-1)}),
    candidate:()=>({valid:false}),placeShip(){},
    LETTERS:{en:['A','B','C','D','E','F','G','H','I','J'],ru:['А','Б','В','Г','Д','Е','Ж','З','И','К']},
    FLEET:[4,3,3,2,2,2,1,1,1,1],language:'en'
  });
  vm.runInContext(cfg.replace('const ONLINE_API = "";','const ONLINE_API = '+JSON.stringify(url)+';')+'\n'+code,context);
  return {nodes,stored,requests,state,eval:s=>vm.runInContext(s,context)};
}
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
test('multiplayer remains hidden and makes no external calls without dedicated endpoint',()=>{
  const b=boot();
  assert.equal(b.nodes.get('online-open').hidden,true);
  assert.equal(b.requests.length,0);
  assert.equal(b.stored.size,0);
  assert.match(cfg,/ONLINE_API = ""/);
  assert.doesNotMatch(cfg,/sb_secret_|service_role|eyJ/);
});
test('online room invitation only carries a code, and local reconnect stores no fleets',async()=>{
  const api='https://seabattleexample.supabase.co/functions/v1/seabattle-multiplayer';
  const b=boot(api,body=>body.action==='create'?{...view(),token:TOKEN}:view());
  assert.equal(b.nodes.get('online-open').hidden,false);
  b.nodes.get('online-open').click();
  b.nodes.get('online-create').click();
  await settle();
  assert.equal(b.requests[0].body.action,'create');
  assert.equal(b.nodes.get('online-game').hidden,false);
  const link=b.nodes.get('online-invitation').value;
  assert.equal(new URL(link).searchParams.get('room'),CODE);
  assert.equal(link.includes(TOKEN),false);
  assert.equal(link.includes('fleet'),false);
  assert.deepEqual(JSON.parse(b.stored.get('seabattle.online.session.v1')),{code:CODE,token:TOKEN});
  b.eval('onlinePoll()');
  await settle();
  assert.equal(b.requests.some(x=>x.body.action==='state'),true);
  b.eval('language="ru";renderMultiplayerLocale()');
  assert.equal(b.nodes.get('online-open').textContent,'К одиночной игре');
});
test('client renders only server-reported visible shots and pauses targeting when friend is offline',()=>{
  const api='https://seabattleexample.supabase.co/functions/v1/seabattle-multiplayer';
  const b=boot(api);
  b.eval('onlineSession={code:"'+CODE+'",token:"'+TOKEN+'"};onlineActive=true;');
  b.eval('onlineFleet=randomFleet()');
  b.eval('onlineView='+JSON.stringify(view({phase:'playing',turn:'host',opponentOnline:true,
    enemy:Object.assign(Array(100).fill(null),{0:'hit',1:'blocked'})})));
  b.eval('onlineRender(true)');
  let board=b.nodes.get('online-their-grid').innerHTML;
  assert.match(board,/<button[^>]+class="cell hit fired enemy-cell" data-i="0"[^>]+disabled/);
  assert.match(board,/<button[^>]+class="cell blocked fired enemy-cell" data-i="1"[^>]+disabled/);
  assert.match(board,/<button[^>]+data-i="2" aria-label="C1"><\/button>/);
  b.eval('onlineView.opponentOnline=false;onlineView.reconnectSeconds=60;onlineRender(true)');
  board=b.nodes.get('online-their-grid').innerHTML;
  assert.match(board,/<button[^>]+data-i="2"[^>]+disabled/);
  assert.match(b.nodes.get('online-status').textContent,/paused/);
});
