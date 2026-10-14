import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {convertHealthyFeed} from '../functions/managed-sources.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const code=fs.readFileSync(root+'js/profile-manager.js','utf8');
function setup(store,cache={}){
  let reloads=0;const callbacks={};
  const API_SITES={ffzy:{name:'非凡',api:'https://ffzy.example/api.php/provide/vod'}};
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)
  };
  const window={dispatchEvent(){}};
  vm.runInNewContext(code,{
    window,document:{addEventListener:(n,fn)=>{callbacks[n]=fn;},getElementById:()=>null},
    localStorage,API_SITES,DEFAULT_SELECTED_APIS:['ffzy','guangsu'],
    URL,location:{reload:()=>{reloads++;}},console,Date,
    CustomEvent:class{constructor(name,options){this.type=name;this.detail=options?.detail;}}
  });
  return {window,API_SITES,getReloads:()=>reloads};
}
test('source adapter accepts usable CMS URLs, removes duplicates and query actions, ignores Spider JAR',()=>{
  const data=convertHealthyFeed({updated_at:'today',sites:[
    {type:1,name:'通用源',api:'https://example.org/api.php/provide/vod/?ac=list',searchable:1},
    {type:1,name:'重复源',api:'https://example.org/api.php/provide/vod/',searchable:1},
    {type:3,name:'Spider',api:'csp_Drpy'},
    {type:1,name:'分类源',api:'https://example.net/api/provide/vod?ac=detail'},
    {type:1,name:'其他内容',api:'https://example.com/api.php/provide/vod'}
  ]});
  assert.equal(data.sources.length,3);
  assert.ok(data.sources.every(s=>s.id.startsWith('managed_')));
  assert.ok(data.sources.every(s=>!s.api.includes('?')));
  assert.ok(data.sources.some(s=>s.name==='其他内容'),'does not filter sources by content category');
});
test('each preset has independent selected APIs and switching restores the prior scheme',()=>{
  const store=new Map([['selectedAPIs','["ffzy","guangsu"]'],
    ['customAPIs','[{"name":"original"}]'],
    ['libretvBrowseSource','ffzy']]);
  const first=setup(store);
  assert.equal(first.window.LibreProfiles.active,'local');
  assert.deepEqual(Array.from(first.window.LibreProfiles.visibleIds()),['ffzy','guangsu']);
  first.window.LibreProfiles.switchTo('managed');
  assert.equal(first.getReloads(),1);
  assert.equal(store.get('libretv:active-preset'),'managed');
  assert.equal(store.get('selectedAPIs'),'[]');
  assert.equal(store.get('customAPIs'),undefined);
  store.set('selectedAPIs','["managed_abcd"]');
  const next=setup(store);
  assert.equal(next.window.LibreProfiles.active,'managed');
  next.window.LibreProfiles.switchTo('local');
  assert.equal(store.get('libretv:active-preset'),'local');
  assert.equal(store.get('selectedAPIs'),'["ffzy","guangsu"]');
  assert.equal(store.get('customAPIs'),'[{"name":"original"}]');
  assert.equal(store.get('libretvBrowseSource'),'ffzy');
  const saved=JSON.parse(store.get('libretv:preset:managed'));
  assert.equal(saved.selectedAPIs,'["managed_abcd"]');
});
test('malformed or untrusted remote sources are rejected before adding to browser registry',()=>{
  const store=new Map([['libretv:managed-cache:v1',JSON.stringify({
    sources:[
      {id:'managed_ab',name:'合法',api:'https://cdn.example.org/api.php/provide/vod'},
      {id:'evil',name:'危险',api:'javascript:alert(1)'},
      {id:'managed_cd',name:'localhost',api:'http://localhost/provide/vod'}
    ],syncedAt:Date.now()
  })]]);
  const setupResult=setup(store);
  assert.ok(setupResult.API_SITES.managed_ab);
  assert.equal(setupResult.API_SITES.evil,undefined);
  assert.equal(setupResult.window.LibreProfiles.managedCount(),2);
});
test('both home and video page import profile manager before app/player code',()=>{
  const home=fs.readFileSync(root+'index.html','utf8');
  const player=fs.readFileSync(root+'player.html','utf8');
  assert.ok(home.indexOf('profile-manager.js')<home.indexOf('js/app.js'));
  assert.ok(player.indexOf('profile-manager.js')<player.indexOf('js/player.js'));
  assert.ok(home.includes('browse-live.css'));
});
test('cached remote subscription initializes first-time selection without network call',async()=>{
  const rows=[{id:'managed_abc',name:'360资源',api:'https://360.example.org/api.php/provide/vod',searchable:true},
    {id:'managed_def',name:'大众',api:'https://dz.example.org/api.php/provide/vod',searchable:true}];
  const store=new Map([
    ['libretv:active-preset','managed'],
    ['selectedAPIs','[]'],
    ['libretv:managed-cache:v1',JSON.stringify({sources:rows,syncedAt:Date.now()})]
  ]);
  const {window}=setup(store);
  await window.LibreProfiles.refresh();
  assert.deepEqual(JSON.parse(store.get('selectedAPIs')),['managed_abc','managed_def']);
  assert.equal(store.get('libretv:preset-managed-initialized'),'yes');
});
test('mobile preset has its own versioned stylesheet and distinct accessible buttons',()=>{
  const html=fs.readFileSync(root+'index.html','utf8');
  const css=fs.readFileSync(root+'css/profile-schemes.css','utf8');
  const worker=fs.readFileSync(root+'service-worker.js','utf8');
  assert.match(html,/profile-schemes\.css\?v=20261014b/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(code,/aria-pressed/);
  assert.match(code,/lt-preset-button-title/);
  assert.match(worker,/20261014-profile-v2/);
});
