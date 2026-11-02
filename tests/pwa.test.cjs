'use strict';
const assert = require('node:assert/strict');
const {readFileSync, existsSync} = require('node:fs');
const {join} = require('node:path');
const test = require('node:test');
const root=join(__dirname,'..');
const read=path=>readFileSync(join(root,path),'utf8');
const manifest=JSON.parse(read('manifest.webmanifest'));
const sw=read('sw.js');
const html=read('index.html');
const workflow=read('.github/workflows/ci.yml');
const scripts=require('./source.cjs').paths;

test('manifest stays within the Pages project subpath and provides installable icons',()=>{
  assert.equal(manifest.start_url,'./');
  assert.equal(manifest.scope,'./');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.theme_color,'#081522');
  assert.match(html,/<link rel="manifest" href="manifest\.webmanifest">/);
  for(const icon of manifest.icons){
    assert.ok(!/^https?:|^\//.test(icon.src));
    assert.ok(existsSync(join(root,icon.src)),icon.src);
    if(icon.type==='image/png'){
      const bytes=readFileSync(join(root,icon.src));
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      const size=Number(icon.sizes.split('x')[0]);
      assert.equal(bytes.readUInt32BE(16),size);
      assert.equal(bytes.readUInt32BE(20),size);
    }
  }
  assert.ok(manifest.icons.find(x=>x.sizes==='192x192'));
  assert.ok(manifest.icons.find(x=>x.sizes==='512x512'));
});

test('published PWA icons contain valid decoded indexed pixel data',()=>{
  const {inflateSync}=require('node:zlib');
  for(const size of [192,512]){
    const image=readFileSync(join(root,'assets','icon-'+size+'.png'));
    let pos=8,parts=[],palette=false,transparency=false;
    while(pos<image.length){
      const length=image.readUInt32BE(pos),type=image.toString('ascii',pos+4,pos+8);
      if(type==='IDAT')parts.push(image.subarray(pos+8,pos+8+length));
      if(type==='PLTE')palette=true;
      if(type==='tRNS')transparency=true;
      pos+=12+length;
      if(type==='IEND')break;
    }
    assert.ok(palette&&transparency,'Indexed images must contain color palette and alpha');
    const raw=inflateSync(Buffer.concat(parts));
    assert.equal(raw.length,size*(1+size/2),'4-bit indexed image has complete rows');
    for(let row=0;row<size;row++)assert.equal(raw[row*(1+size/2)],0,'PNG scanlines must use filter type 0');
    assert.ok(raw.some(x=>x!==0),'Image cannot be empty');
  }
});

test('offline cache covers all first-party runtime modules and manifest entries',()=>{
  assert.match(sw,/cache\.addAll\(SHELL\)/);
  assert.match(sw,/caches\.open\(CACHE_NAME\)/);
  assert.match(sw,/request\.method !== "GET"/);
  assert.match(sw,/url\.origin !== self\.location\.origin/);
  assert.match(sw,/new URL\(self\.registration\.scope\)\.pathname/);
  assert.match(sw,/request\.mode === "navigate"/);
  assert.doesNotMatch(sw,/importScripts|https?:\/\/|indexedDB|localStorage|XMLHttpRequest/);
  for(const src of scripts)assert.ok(sw.includes('./'+src),src);
  for(const name of ['manifest.webmanifest','index.html','favicon.ico','assets/seabattle-icon.svg','assets/icon-192.png','assets/icon-512.png'])
    assert.ok(sw.includes('./'+name),name);
  assert.match(read('js/ui.js'),/serviceWorker\.register\("\.\/sw\.js", \{scope:"\.\/"\}\)/);
});

test('Pages publishes all offline shell files with strict test gate',()=>{
  assert.match(workflow,/needs: test/);
  assert.match(workflow,/cp -R js dist\/js/);
  assert.match(workflow,/cp manifest\.webmanifest sw\.js dist\//);
  assert.match(workflow,/cp assets\/icon-192\.png assets\/icon-512\.png dist\/assets\//);
  for(const path of scripts)assert.ok(existsSync(join(root,path)));
});
