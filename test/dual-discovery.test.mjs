import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const code=fs.readFileSync(root+'js/rank-source-prefs.js','utf8');
const view=fs.readFileSync(root+'js/discovery-views.js','utf8');
function fixture(){
  const data=new Map(),notified=[],sites={
    a:{name:'A',api:'https://a.test/api.php/provide/vod',searchable:true},
    b:{name:'B',api:'https://b.test/api.php/provide/vod',searchable:true},
    c:{name:'C',api:'https://c.test/api.php/provide/vod',searchable:true}
  };
  const window={
    API_SITES:sites,
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
    LibreContentPolicy:{safeSourceIds:()=>Object.keys(sites),isAdultSource:x=>!!x.adult},
    dispatchEvent:event=>notified.push(event.type),
    document:{addEventListener(){}}
  };
  vm.runInNewContext(code,{window,Event:class{constructor(type){this.type=type}}});
  return {api:window.LibreRankSources,window,data,sites,notified};
}
test('rank source preferences default to every eligible source, allow full inversion and persist manual order',()=>{
  const {api,data,sites,notified}=fixture();
  assert.deepEqual(Array.from(api.selected()),['a','b','c']);
  api.update({order:['c','a','b'],excluded:['a']});
  assert.deepEqual(Array.from(api.selected()),['c','b']);
  assert.deepEqual(Array.from(api.ordered()),['c','a','b']);
  assert.ok(data.has('libretv:rank-sources:v1'));
  api.update({order:api.ordered(),excluded:api.selected()});
  assert.deepEqual(Array.from(api.selected()),['a']);
  api.update({order:[],excluded:[]});
  assert.deepEqual(Array.from(api.selected()),['a','b','c']);
  sites.d={name:'D',api:'https://d.test/api.php/provide/vod',searchable:true};
  assert.ok(api.selected().includes('d'),'new eligible sources must appear automatically');
  sites.b.adult=true;
  assert.ok(!api.selected().includes('b'),'adult source must not be selectable');
  assert.ok(notified.length>=3);
});
test('the two content views reuse the existing site while preserving distinct route and hiding behavior',()=>{
  const index=fs.readFileSync(root+'index.html','utf8');
  const player=fs.readFileSync(root+'player.html','utf8');
  const css=fs.readFileSync(root+'css/dual-discovery.css','utf8');
  assert.match(index,/js\/discovery-views\.js/);
  assert.match(index,/js\/rank-source-prefs\.js/);
  assert.match(player,/js\/rank-source-prefs\.js/);
  assert.match(view,/\?view=/);
  assert.match(css,/body\.lt-view-sources #ltHotList/);
  assert.match(css,/body\.lt-view-ranks #ltExplore/);
  const browse=fs.readFileSync(root+'js/browse-live.js','utf8');
  assert.ok(!browse.includes("['全部','电影','电视剧','国产剧','美剧'"),'no fixed classification tabs');
  assert.match(browse,/type_pid/);
  assert.match(browse,/state\.typeId\?'&t='/);
  const quick=fs.readFileSync(root+'js/quick-play.js','utf8');
  assert.match(quick,/window\.LibreRankSources\.selected\(\)/);
  const hot=fs.readFileSync(root+'js/hot-list.js','utf8');
  assert.match(hot,/LibreRankSources\?\.initPanel\(\)/);
});
