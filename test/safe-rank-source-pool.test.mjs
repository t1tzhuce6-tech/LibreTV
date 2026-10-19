import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
function policy(selected, visible, registry, customSources=[]){
  const store=new Map([['selectedAPIs',JSON.stringify(selected)],['customAPIs',JSON.stringify(customSources)]]);
  const win={
    API_SITES:registry,
    DEFAULT_SELECTED_APIS:['ffzy','guangsu'],
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))},
    getCustomApiInfo:i=>customSources[Number(i)]||null
  };
  vm.runInNewContext(fs.readFileSync(root+'js/content-policy.js','utf8'),{window:win,URL});
  return {policy:win.LibreContentPolicy,store};
}
test('rank safe-all includes all registered safe sources across presets',()=>{
  const entries={
    ffzy:{name:'非凡',api:'https://ffzy.example/provide/vod'},
    guangsu:{name:'光速',api:'https://guangsu.example/provide/vod'},
    managed_safe:{name:'大众',api:'https://dz.example/provide/vod'},
    managed_bad:{name:'lsb',api:'https://apilsbzy1.com/provide/vod'},
    managed_disabled:{name:'离线',api:'https://offline.example/provide/vod',searchable:false}
  };
  const {policy:p,store}=policy(['ffzy','managed_bad','managed_disabled'],['ffzy','guangsu'],entries);
  assert.deepEqual(Array.from(p.safeSourceIds(true)),['ffzy','guangsu','managed_safe']);
  assert.equal(store.get('yellowFilterEnabled'),'true');
  const {policy:q}=policy(['ffzy','managed_safe','managed_bad'],['managed_safe','managed_bad','managed_disabled'],entries);
  assert.deepEqual(Array.from(q.safeSourceIds(true)),['ffzy','managed_safe','guangsu']);
  assert.deepEqual(Array.from(q.safeSourceIds(false)),['ffzy','managed_safe']);
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
  assert.match(player,/safeSourceIds\?\.\(true\)/);
  assert.match(player,/destination.searchParams.set\(key, currentParams.get\(key\)\)/);
});
test('one hundred sources, disabled source, adult host, duplicate and unselected custom',()=>{
  const registry={};
  for(let i=0;i<100;i++)registry['safe_'+i]={name:'影视源'+i,api:'https://vod'+i+'.example/api.php/provide/vod'};
  registry.copy={name:'重复别名',api:'https://vod0.example/api.php/provide/vod/'};
  registry.offline={name:'暂停',api:'https://offline.example/api.php/provide/vod',searchable:false};
  registry.adult={name:'普通',api:'https://jkunzyapi.com/api.php/provide/vod'};
  const custom=[{name:'自定义普通源',url:'https://custom.example/api.php/provide/vod'},{
    name:'自定义成人源',url:'https://apilsbzy1.com/api.php/provide/vod',isAdult:true
  }];
  const {policy:p,store}=policy(['safe_17'],['safe_0'],registry,custom);
  const ids=Array.from(p.safeSourceIds(true));
  assert.equal(ids.length,101);
  assert.equal(ids[0],'custom_0');
  assert.ok(ids.includes('safe_17'));
  assert.ok(ids.includes('safe_99'));
  assert.ok(ids.includes('custom_0'));
  assert.ok(!ids.includes('copy')&&!ids.includes('offline')&&!ids.includes('adult')&&!ids.includes('custom_1'));
  assert.deepEqual(JSON.parse(store.get('selectedAPIs')),['safe_17']);
});
test('one hundred eligible source registrations are supported without legacy subscriptions',()=>{
 const registry={};for(let i=0;i<100;i++)registry['s'+i]={name:'安全影视'+i,api:'https://api'+i+'.example/provide/vod'};
 const {policy:p}=policy([],[],registry);
 assert.equal(p.safeSourceIds(true).length,100);
});
test('adult-only APIs under neutral names cannot reenter from remote subscriptions or stale browser presets',()=>{
  const adultHosts=[
    'heiliaozyapi.com','www.heiliaozyapi.com','api.ddapi.cc','api.heiapi.cc',
    'www.jingpinx.com','naixxzy.com','apilj.com','shayuapi.com','fqzy.me'
  ];
  const sites=adultHosts.map((host,i)=>({
    type:1,name:'普通影音站'+i,api:'https://'+host+'/api.php/provide/vod'
  }));
  sites.push({type:1,name:'光速资源',api:'https://api.guangsuapi.com/api.php/provide/vod'});
  sites.push({type:1,name:'非凡资源',api:'https://cj.ffzyapi.com/api.php/provide/vod'});
  const registry=Object.fromEntries(sites.map((s,i)=>['s'+i,{name:s.name,api:s.api}]));
  const {policy:p}=policy(Object.keys(registry),Object.keys(registry),registry,[
    {name:'伪装自定义正常源',url:'https://api.ddapi.cc/api.php/provide/vod'}
  ]);
  assert.deepEqual(Array.from(p.safeSourceIds(true)),['s9','s10']);
  assert.equal(p.isAdultSource({name:'正常名称',api:'https://fqzy.me/api.php/provide/vod'}),true);
  assert.equal(p.isAdultSource({name:'非凡资源',api:'https://cj.ffzyapi.com/api.php/provide/vod'}),false);
});
