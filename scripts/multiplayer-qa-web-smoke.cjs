'use strict';
const assert=require('node:assert/strict');

const site='https://seabattle-multiplayer-qa.vercel.app';
const endpoint=process.env.SEABATTLE_MULTIPLAYER_API;
assert.match(endpoint||'',/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/seabattle-multiplayer$/);

async function textAt(path){
  const url=site+path;
  const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,path+': expected HTTP 200, got '+response.status);
  assert.equal(response.url,url,'unexpected redirect '+path);
  return await response.text();
}
async function main(){
  const html=await textAt('/');
  assert.match(html,/<title>Sea Battle/);
  assert.match(html,/id="online-open"/);
  assert.doesNotMatch(html,/Authentication Required|Vercel Login/);
  const config=await textAt('/js/multiplayer-config.js');
  assert.ok(config.includes(JSON.stringify(endpoint)),'QA frontend points at isolated server');
  assert.doesNotMatch(config,/sb_secret_|service_role|eyJ[A-Za-z0-9_-]{40}/);
  const client=await textAt('/js/multiplayer.js');
  assert.match(client,/function onlineInit\(/);
  await textAt('/manifest.webmanifest');
  await textAt('/sw.js');
  const options=async origin=>fetch(endpoint,{
    method:'OPTIONS',headers:{
      origin,'access-control-request-method':'POST',
      'access-control-request-headers':'content-type'
    },signal:AbortSignal.timeout(20000)
  });
  const accepted=await options(site);
  assert.equal(accepted.status,200,'QA preflight');
  assert.equal(accepted.headers.get('access-control-allow-origin'),site);
  const denied=await options('https://untrusted.vercel.app');
  assert.equal(denied.status,403,'unapproved preview origin');
  console.log('Public QA site smoke: PASS (HTML, assets, endpoint, preflight, origin isolation).');
}
main().catch(e=>{console.error('QA site smoke failed:',e.stack||e);process.exitCode=1;});
