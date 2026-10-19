import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const script=fs.readFileSync(root+'js/dr-portal.js','utf8');
function load(){
  const sandbox={URL,location:{protocol:'https:'},openCalls:[],open(...args){this.openCalls.push(args)}};
  sandbox.window=sandbox;
  vm.runInNewContext(script,sandbox,{filename:'js/dr-portal.js'});
  return sandbox;
}
function ui(){
  const ids=['dr-url','dr-frame','dr-empty','dr-state','dr-indicator','dr-error','dr-open','dr-reload','dr-clear','dr-form'];
  const elements=Object.fromEntries(ids.map(id=>[id,{
    hidden: id==='dr-frame'||id==='dr-error',
    disabled: ['dr-open','dr-reload'].includes(id),
    value:'',textContent:'',className:'',src:'',
    listeners:{},addEventListener(type,fn){this.listeners[type]=fn},
    removeAttribute(attr){delete this[attr]},
  }]));
  const store=new Map();
  const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  const doc={getElementById:k=>elements[k]};
  return {elements,store,storage,doc};
}
test('new DR page is separate, linked from main site and not merged into existing VOD list',()=>{
  const home=fs.readFileSync(root+'index.html','utf8');
  const page=fs.readFileSync(root+'dr.html','utf8');
  const sw=fs.readFileSync(root+'service-worker.js','utf8');
  assert.match(home,/<a href="dr\.html" class="lt-dual-link">DR影视/);
  assert.match(page,/href="\.\/">◀ LibreTV 主站/);
  assert.match(page,/id="dr-frame"/);
  assert.match(page,/id="dr-form"/);
  assert.match(page,/不会假装有可播放片源/);
  assert.match(sw,/'\/dr\.html'/);
  assert.match(sw,/'\/js\/dr-portal\.js'/);
  assert.match(sw,/20261019-cctv-official-v1/);
});
test('DR url canonicalization allows only server root and DrPlayer path',()=>{
  const {DrPortal}=load();
  assert.equal(DrPortal.canonicalize('https://dr.example.com'),'https://dr.example.com/apps/drplayer/');
  assert.equal(DrPortal.canonicalize('https://dr.example.com/apps/drplayer'),'https://dr.example.com/apps/drplayer/');
  assert.equal(DrPortal.canonicalize('http://127.0.0.1:5757'),'http://127.0.0.1:5757/apps/drplayer/');
  assert.equal(DrPortal.canonicalize('http://192.168.1.5:5757'),'http://192.168.1.5:5757/apps/drplayer/');
});
test('DR url rejects injected credentials, arbitrary paths, insecure public origins and malformed schemes',()=>{
  const {DrPortal}=load();
  const bad=[
    'javascript:alert(1)','data:text/html,a','file:///etc/passwd',
    'https://bob:secret@dr.example.com/',
    'https://dr.example.com/?pwd=token',
    'https://dr.example.com/#cookie',
    'https://dr.example.com/admin',
    'http://dr.example.com/',
    'https://dr.example.com.evil.invalid/foo'
  ];
  for(const u of bad)assert.throws(()=>DrPortal.canonicalize(u),/允许|移除/,u);
});
test('unconfigured page shows pending backend instead of loading a demo or arbitrary source',()=>{
  const sandbox=load(),x=ui();
  const controller=sandbox.DrPortal.bootstrap(x.doc,x.storage,{defaultUrl:'{{DR_PUBLIC_URL}}'});
  assert.equal(controller.getCurrent(),null);
  assert.equal(x.elements['dr-frame'].hidden,true);
  assert.equal(x.elements['dr-open'].disabled,true);
  assert.equal(x.elements['dr-state'].textContent,'');
});
test('configured HTTPS DR URL opens in iframe; reset removes it completely',()=>{
  const sandbox=load(),x=ui();
  const c=sandbox.DrPortal.bootstrap(x.doc,x.storage,{});
  x.elements['dr-url'].value='https://dr.example.com/';
  x.elements['dr-form'].listeners.submit({preventDefault(){}});
  assert.equal(c.getCurrent(),'https://dr.example.com/apps/drplayer/');
  assert.equal(x.elements['dr-frame'].src,'https://dr.example.com/apps/drplayer/');
  assert.equal(x.elements['dr-frame'].hidden,false);
  assert.equal(x.elements['dr-open'].disabled,false);
  assert.equal(x.store.get('libretv:dr-service-url:v1'),'https://dr.example.com/apps/drplayer/');
  x.elements['dr-open'].listeners.click();
  assert.equal(sandbox.openCalls.length,1);
  x.elements['dr-clear'].listeners.click();
  assert.equal(c.getCurrent(),null);
  assert.equal(x.elements['dr-frame'].src,undefined);
  assert.equal(x.store.size,0);
});
test('HTTP LAN DR URL is not embedded in the HTTPS LibreTV page',()=>{
  const sandbox=load(),x=ui();
  const c=sandbox.DrPortal.bootstrap(x.doc,x.storage,{defaultUrl:'http://192.168.1.5:5757'});
  assert.equal(c.getCurrent(),'http://192.168.1.5:5757/apps/drplayer/');
  assert.equal(x.elements['dr-frame'].hidden,true);
  assert.equal(x.elements['dr-open'].disabled,false);
  assert.match(x.elements['dr-indicator'].textContent,/无法嵌入/);
});
test('middleware only publishes validated HTTPS DR origin without credentials',()=>{
  const source=fs.readFileSync(root+'functions/_middleware.js','utf8');
  assert.match(source,/env\.DR_PUBLIC_URL/);
  assert.match(source,/candidate\.protocol === 'https:'/);
  assert.match(source,/!candidate\.username && !candidate\.password/);
  assert.match(source,/JSON\.stringify\(drPublicUrl\)/);
  assert.match(fs.readFileSync(root+'dr.html','utf8'),/window\.__DR_DEFAULT_URL__ = "\{\{DR_PUBLIC_URL\}\}";/);
});
