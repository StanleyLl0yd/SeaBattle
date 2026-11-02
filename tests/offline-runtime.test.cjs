'use strict';
const assert=require('node:assert/strict');
const {readFileSync,existsSync}=require('node:fs');
const {join}=require('node:path');
const test=require('node:test');
const vm=require('node:vm');

test('installed shell opens all runtime assets with network disconnected',async()=>{
  const root=join(__dirname,'..');
  const code=readFileSync(join(root,'sw.js'),'utf8');
  const scope='https://stanleyll0yd.github.io/SeaBattle/';
  const handlers=new Map(),buckets=new Map();
  const toUrl=item=>new URL(typeof item==='string'?item:item.url,scope).href;
  const cacheFor=name=>{
    if(!buckets.has(name))buckets.set(name,new Map());
    const entries=buckets.get(name);
    return {
      async addAll(paths){
        for(const path of paths){
          const absolute=toUrl(path);
          const file=path==='./'?'index.html':path.replace(/^\.\//,'');
          assert.ok(existsSync(join(root,file)),file);
          entries.set(absolute,{url:absolute,body:readFileSync(join(root,file))});
        }
      },
      async match(request){
        return entries.get(toUrl(request)) ?? null;
      }
    };
  };
  const caches={
    async open(name){return cacheFor(name);},
    async keys(){return [...buckets.keys()];},
    async delete(name){return buckets.delete(name);}
  };
  const self={
    location:{origin:new URL(scope).origin},
    registration:{scope},
    clients:{async claim(){}},
    async skipWaiting(){},
    addEventListener(name,callback){handlers.set(name,callback);}
  };
  let internet=false,fetches=0;
  const offlineFetch=async req=>{
    fetches++;
    if(!internet)throw new Error('offline');
    return {url:toUrl(req),body:Buffer.from('online')};
  };
  vm.runInNewContext(code,{self,caches,fetch:offlineFetch,URL},{filename:'sw.js'});
  const dispatch=async(name,request)=>{
    let result;
    const event={request,waitUntil(p){result=p;},respondWith(p){result=p;}};
    handlers.get(name)(event);
    return result && await result;
  };
  await dispatch('install');
  await dispatch('activate');
  for(const file of ['index.html','js/config.js','js/career.js','js/ui-state.js','js/engine.js','js/ai.js','js/daily.js','js/tactics.js','js/ui.js','manifest.webmanifest','assets/icon-512.png']){
    const response=await dispatch('fetch',{method:'GET',url:toUrl(file),mode:file==='index.html'?'navigate':'same-origin'});
    assert.ok(response?.body?.length>0,'Offline cached file '+file);
  }
  assert.equal(fetches,0,'All shell files must be served offline from cache');
  const offScope=await dispatch('fetch',{method:'GET',url:'https://stanleyll0yd.github.io/other-project/',mode:'navigate'});
  assert.equal(offScope,undefined,'Do not intercept other GitHub Pages project paths');
});
