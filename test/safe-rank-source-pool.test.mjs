import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {convertHealthyFeed,isAdultManagedSource} from '../functions/managed-sources.js';

const root=fileURLToPath(new URL('../',import.meta.url));
function policy(selected, visible, registry){
  const store=new Map([['selectedAPIs',JSON.stringify(selected)]]);
  const win={
    API_SITES:registry,
    DEFAULT_SELECTED_APIS:['ffzy','guangsu'],
    LibreProfiles:{visibleIds:()=>visible},
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
    getCustomApiInfo:()=>null
  };
  vm.runInNewContext(fs.readFileSync(root+'js/content-policy.js','utf8'),{window:win,URL});
  return {policy:win.LibreContentPolicy,store};
}
test('managed feed filters explicit and aliased adult sources before registration',()=>{
  const cases=[
    {name:'杏吧',api:'https://xingba222.com/api.php/provide/vod'},
    {name:'155 | 采集',api:'https://155api.com/api.php/provide/vod'},
    {name:'lsb',api:'https://apilsbzy1.com/api.php/provide/vod'},
    {name:'jkun(直连)',api:'https://jkunzyapi.com/api.php/provide/vod'},
    {name:'ckzyCK资源',api:'https://ckzy.me/api.php/provide/vod'},
    {name:'大众',api:'https://cdn.dzzyapi.com/api.php/provide/vod'},
    {name:'光速',api:'https://api.guangsuapi.com/api.php/provide/vod'}
  ];
  const result=convertHealthyFeed({sites:cases.map(s=>({...s,type:1}))});
  assert.equal(result.sources.length,2);
  assert.deepEqual(result.sources.map(x=>x.name),['大众','光速']);
  assert.equal(isAdultManagedSource('普通','https://apilsbzy1.com/api.php/provide/vod'),true);
});
test('rank safe-all searches nonselected safe sources only inside current preset',()=>{
  const entries={
    ffzy:{name:'非凡',api:'https://ffzy.example/provide/vod'},
    guangsu:{name:'光速',api:'https://guangsu.example/provide/vod'},
    managed_safe:{name:'大众',api:'https://dz.example/provide/vod'},
    managed_bad:{name:'lsb',api:'https://apilsbzy1.com/provide/vod'},
    managed_disabled:{name:'离线',api:'https://offline.example/provide/vod',searchable:false}
  };
  const {policy:p,store}=policy(['ffzy','managed_bad','managed_disabled'],['ffzy','guangsu'],entries);
  assert.deepEqual(Array.from(p.safeSourceIds(true)),['ffzy','guangsu']);
  assert.equal(store.get('yellowFilterEnabled'),'true');
  const {policy:q}=policy(['ffzy','managed_safe','managed_bad'],['managed_safe','managed_bad','managed_disabled'],entries);
  assert.deepEqual(Array.from(q.safeSourceIds(true)),['managed_safe']);
});
test('ordinary drama source survives adult category filtering',()=>{
  const {policy:p}=policy([],[],{});
  assert.equal(p.isAdultSource({name:'大众',api:'https://cdn.dzzyapi.com/provide/vod'}),false);
  assert.equal(p.isAdultSource({name:'普通',api:'https://jkunzyapi.com/provide/vod'}),true);
  assert.deepEqual(Array.from(p.filterVideos([
    {title:'战神戚继光之不让江山',type_name:'动作片'},
    {title:'战神戚继光之不让江山',type_name:'伦理片'}
  ]),x=>x.type_name),['动作片']);
});
test('iQIYI uses full safe source scope through player and keeps source switching on the page',()=>{
  const rank=fs.readFileSync(root+'js/iqiyi-ranks.js','utf8');
  const quick=fs.readFileSync(root+'js/quick-play.js','utf8');
  const player=fs.readFileSync(root+'js/player.js','utf8');
  assert.ok(rank.includes("LibreRankBridge?.register('iqiyi'"));
  assert.match(quick,/url.searchParams.set\('scope', request.scope \|\| 'safe-all'\)/);
  assert.match(quick,/safeSourceIds\?\.\(broaden\)/);
  assert.match(player,/safeSourceIds\?\.\(urlParams.get\('scope'\) === 'safe-all'\)/);
  assert.match(player,/destination.searchParams.set\(key, currentParams.get\(key\)\)/);
});