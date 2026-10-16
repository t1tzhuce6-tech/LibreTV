import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {onRequestGet} from '../functions/live-list/[provider].js';
const root=fileURLToPath(new URL('../',import.meta.url));
const script=fs.readFileSync(root+'js/browse-live.js','utf8');
const adapter=fs.readFileSync(root+'js/catalog-adapter.js','utf8');
function harness(extra={}){
  const window={};
  const document={addEventListener(){}};
  const context={window,document,console,...extra};
  vm.runInNewContext(adapter,context);
  const source=script.replace("document.addEventListener('DOMContentLoaded',start);",
    "window.__exploreTest={parseM3U,leafCategories,requestedCategories,loadList,state,liveProviders,sourceOrder};");
  assert.notEqual(source,script,'test injection anchor must exist');
  vm.runInNewContext(source,context);
  return {api:window.LibreCatalog,ctl:window.__exploreTest,window,context};
}
test('unified VOD adapter wraps source-agnostic result arrays correctly',()=>{
  const {api}=harness();
  const list=[{vod_id:123,vod_name:'测试电影'}];
  assert.equal(api.asVodPayload(list).list.length,1);
  assert.equal(api.asVodPayload({list}).list[0].vod_id,123);
  assert.equal(api.asVodPayload(null).list.length,0);
});
test('parent categories expand to leaves across provider category naming',()=>{
  const {api,ctl}=harness();
  const classes=api.normalClasses([
    {type_id:1,type_pid:0,type_name:'电影片'},
    {type_id:6,type_pid:1,type_name:'动作片'},
    {type_id:7,type_pid:1,type_name:'喜剧片'},
    {type_id:2,type_pid:0,type_name:'连续剧'},
    {type_id:13,type_pid:2,type_name:'国产剧'}
  ]);
  ctl.state.classes=classes;ctl.state.typeId='1';
  assert.deepEqual(Array.from(ctl.requestedCategories()),['6','7']);
  ctl.state.typeId='';
  const ids=Array.from(ctl.requestedCategories());
  assert.ok(ids.includes('6')&&ids.includes('13'),'all includes both film and TV');
});
test('real browse page combines returned child films and does not drop lists during normalize',async()=>{
  const elements={
    ltBrowseCards:{replaceChildren(){},appendChild(){}},
    ltBrowseStatus:{textContent:''},
    ltPrevPage:{disabled:false},
    ltNextPage:{disabled:false}
  };
  const window={};
  const context={
    window,console,
    document:{
      addEventListener(){},
      getElementById(id){return elements[id];},
      createElement(){return {textContent:''};}
    },
    getApiSearchContext(){return {apiBaseUrl:'https://api.test/api',apiName:'片源'};},
    async fetchVodApiJson(url){
      const id=new URL(url).searchParams.get('t');
      return {list:id==='6'?[{vod_id:11,vod_name:'动作片',vod_time:'2026-10-14'}]:
        [{vod_id:12,vod_name:'喜剧片',vod_time:'2026-10-13'}],pagecount:3};
    },
    normalizeApiList(data){return Array.isArray(data.list)?data.list:[];},
    API_SITES:{ffzy:{name:'片源'}},
    selectedAPIs:['ffzy']
  };
  vm.runInNewContext(adapter,context);
  const src=script.replace('  function renderCards(items){',
    "  function renderCards(items){ window.__cards=items; return; ")
    .replace("document.addEventListener('DOMContentLoaded',start);",
      "window.__ctl={state,loadList};");
  vm.runInNewContext(src,context);
  window.__ctl.state.classes=window.LibreCatalog.normalClasses([
    {type_id:1,type_pid:0,type_name:'电影'},
    {type_id:6,type_pid:1,type_name:'动作片'},
    {type_id:7,type_pid:1,type_name:'喜剧片'}
  ]);
  window.__ctl.state.typeId='1';
  await window.__ctl.loadList();
  assert.deepEqual(Array.from(window.__cards,item=>item.vod_name),['喜剧片']);
  assert.equal(elements.ltNextPage.disabled,false);
});
test('M3U parser excludes HTTP channels and translates common English groups',()=>{
  const {api,ctl}=harness();
  const out=ctl.parseM3U('#EXTM3U\n#EXTINF:-1 group-title="News",新闻联播\nhttps://test.example/live.m3u8\n#EXTINF:-1 group-title="Sports",体育台\nhttp://test.example/live.m3u8\n');
  assert.equal(out.results.length,1);
  assert.equal(out.results[0].group,'新闻');
  assert.equal(out.skipped,1);
  assert.equal(api.displayGroup('Entertainment'),'娱乐');
  assert.equal(api.displayGroup('中央频道'),'中央频道');
  assert.ok(ctl.liveProviders.every(p=>!p.id.startsWith('fty')));
});
test('live-list function only allows configured playlist providers',async()=>{
  const r=await onRequestGet({params:{provider:'https://evil.invalid'}});
  assert.equal(r.status,404);
  const original=globalThis.fetch;
  let origin='';
  globalThis.fetch=async url=>{
    origin=url;
    return new Response('#EXTM3U\n#EXTINF:-1,示例\nhttps://stream.example/live.m3u8',
      {status:200,headers:{'content-type':'text/plain'}});
  };
  try{
    const result=await onRequestGet({params:{provider:'iptvorg'}});
    assert.equal(result.status,200);
    assert.equal(result.headers.get('X-LibreTV-Playlist-Only'),'1');
    assert.match(await result.text(),/^#EXTM3U/);
    assert.equal(new URL(origin).hostname,'iptv-org.github.io');
  }finally{globalThis.fetch=original;}
});
test('no FanTaiYing Spider-only directory remains and stream playback is browser-direct',()=>{
  assert.match(script,/hls\.loadSource\(src\)/);
  assert.match(script,/video\.src=src/);
  const live=script.split('function startLive(channel)')[1].split('function parseM3U')[0];
  assert.doesNotMatch(live,/\/proxy\//);
  const page=fs.readFileSync(root+'index.html','utf8');
  assert.match(page,/js\/browse-live\.js/);
  assert.match(page,/js\/catalog-adapter\.js/);
  assert.doesNotMatch(page,/fty-config\.js/);
});
