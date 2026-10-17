import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root),'utf8');
const data=JSON.parse(read('data/auto-source-directory.json'));
test('full published directory keeps review entries and multiple CMS paths',()=>{
 assert.equal(data.sourceCount,data.entries.length);
 assert.ok(data.entries.length>=45);
 assert.equal(data.readyCount+data.reviewCount,data.sourceCount);
 assert.ok(data.entries.some(s=>s.mode==='review'));
 assert.ok(data.entries.some(s=>s.api.includes('/api/json.php')));
 assert.equal(new Set(data.entries.map(s=>s.api)).size,data.entries.length);
});
test('review entries visible in source library but not sent to automatic search',()=>{
 const sites={};let values=new Map();const w={API_SITES:sites,LibreAutoSourcesData:{schema:1,entries:[{id:'auto_11111111111111',name:'Ready',api:'https://ready.example/api.php/provide/vod',mode:'ready'},{id:'auto_22222222222222',name:'Review',api:'https://review.example/api/json.php',mode:'review'}]},getCustomApiInfo(){return null},extendAPISites(x){Object.assign(sites,x)},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},DEFAULT_SELECTED_APIS:[]};
 vm.runInNewContext(read('js/content-policy.js'),{window:w,URL});
 vm.runInNewContext(read('js/auto-source-registry.js'),{window:w,URL});
 assert.ok(w.LibreAutoSourceRegistry.catalogIds().includes('auto_22222222222222'));
 assert.ok(!w.LibreContentPolicy.safeSourceIds(true).includes('auto_22222222222222'));
 assert.ok(w.LibreContentPolicy.safeSourceIds(true).includes('auto_11111111111111'));
 assert.match(w.LibreAutoSourceRegistry.label('auto_22222222222222'),/待验证/);
});
