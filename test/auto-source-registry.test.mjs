import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const registrySource=fs.readFileSync(root+'js/auto-source-registry.js','utf8');
const policySource=fs.readFileSync(root+'js/content-policy.js','utf8');
const snapshot=JSON.parse(fs.readFileSync(root+'data/auto-source-directory.json','utf8'));

function setup(entries){
 const sites={local:{name:'同名影视源',api:'https://same.example/api.php/provide/vod'}};
 const custom=[{name:'手工来源',url:'https://manual.example/api.php/provide/vod/'},{name:'本地重复',url:'https://custom.example/api.php/provide/vod/'}];
 const values=new Map([['customAPIs',JSON.stringify(custom)],['selectedAPIs',JSON.stringify(['local'])]]);
 const window={API_SITES:sites,LibreAutoSourcesData:{schema:1,entries},DEFAULT_SELECTED_APIS:['local'],
 localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
 getCustomApiInfo:id=>custom[Number(id)],extendAPISites:x=>Object.assign(sites,x)};
 vm.runInNewContext(policySource,{window,URL,Set,RegExp});
 vm.runInNewContext(registrySource,{window,URL,Set,RegExp});
 return {window,sites,custom,values};
}

test('source directory snapshot is a structured, sanitized and link-unique CMS catalog',()=>{
 assert.equal(snapshot.schema,1);
 assert.ok(snapshot.entries.length>=8);
 assert.equal(snapshot.entries.length,new Set(snapshot.entries.map(x=>x.api)).size);
 assert.ok(snapshot.entries.every(x=>x.id.startsWith('auto_')&&/^https?:\/\//.test(x.api)&&x.name));
 assert.ok(!snapshot.entries.some(x=>/155api|jkunzyapi|porn/i.test(x.api)));
});
test('registry deduplicates by canonical URL, NOT by name; manual and existing sources have precedence',()=>{
 const {window,sites}=setup([
  {id:'auto_11111111111111',name:'另一个名称',api:'https://same.example/api.php/provide/vod/'},
  {id:'auto_22222222222222',name:'又一个别名',api:'https://custom.example/api.php/provide/vod'},
  {id:'auto_33333333333333',name:'同名影视源',api:'https://different.example/api.php/provide/vod/'},
  {id:'auto_44444444444444',name:'新资源',api:'https://different.example/api.php/provide/vod'},
  {id:'auto_55555555555555',name:'示例非法',api:'http://localhost/api.php/provide/vod'}
 ]);
 assert.deepEqual(Object.keys(sites).sort(),['auto_33333333333333','local']);
 assert.equal(window.LibreAutoSourceStats.imported,1);
 assert.equal(window.LibreAutoSourceStats.duplicates,3);
 assert.equal(window.LibreAutoSourceStats.blocked,1);
 assert.equal(window.LibreAutoSourceRegistry.label('auto_33333333333333'),'[自动接入] 同名影视源');
 assert.equal(window.LibreAutoSourceRegistry.label('local'),'[本地源] 同名影视源');
 const ids=Array.from(window.LibreContentPolicy.safeSourceIds(true));
 assert.ok(ids.includes('custom_0')&&ids.includes('custom_1')&&ids.includes('auto_33333333333333')&&ids.includes('local'));
});
test('both homepage and player synchronously register feed before app initialization',()=>{
 for(const page of ['index.html','player.html']){
  const html=fs.readFileSync(root+page,'utf8');
  assert.ok(html.indexOf('auto-source-feed.js')>html.indexOf('customer_site.js'));
  assert.ok(html.indexOf('auto-source-registry.js')>html.indexOf('auto-source-feed.js'));
  assert.ok(html.indexOf('auto-source-registry.js')<html.indexOf('js/app.js')||page==='player.html');
 }
 const app=fs.readFileSync(root+'js/app.js','utf8');
 assert.match(app,/unifiedSearchIds=window\.LibreContentPolicy\?\.safeSourceIds\?\.\(true\)/);
 assert.match(app,/Math\.min\(5,searchableApiIds\.length\)/);
 assert.match(fs.readFileSync(root+'js/browse-live.js','utf8'),/LibreAutoSourceRegistry\?\.label/);
 assert.match(fs.readFileSync(root+'js/rank-source-prefs.js','utf8'),/LibreAutoSourceRegistry\?\.label/);
});
