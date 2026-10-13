import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const script=fs.readFileSync(root+'js/browse-live.js','utf8');
function harness(){
  const window={};
  const document={addEventListener(){}};
  const context={window,document,console};
  const source=script.replace("document.addEventListener('DOMContentLoaded',start);",
    "window.__exploreTest={parseM3U,leafCategories,requestedCategories,state,liveProviders,sourceOrder};");
  assert.notEqual(source,script,'test injection anchor must exist');
  vm.runInNewContext(source,context);
  return window.__exploreTest;
}
test('film parent class expands into working leaf classes',()=>{
  const h=harness();
  h.state.classes=[{type_id:1,type_pid:0,type_name:'电影片'},
    {type_id:6,type_pid:1,type_name:'动作片'},
    {type_id:7,type_pid:1,type_name:'喜剧片'},
    {type_id:2,type_pid:0,type_name:'连续剧'},
    {type_id:13,type_pid:2,type_name:'国产剧'}];
  h.state.typeId='1';
  assert.deepEqual(Array.from(h.requestedCategories()),['6','7']);
  h.state.typeId='';
  const ids=Array.from(h.requestedCategories());
  assert.ok(ids.includes('6')&&ids.includes('13'),'all includes both film and TV');
});
test('M3U parser recognizes provider channels and blocks HTTP/mixed content',()=>{
  const h=harness();
  const out=h.parseM3U('#EXTM3U\n#EXTINF:-1 group-title="央视",CCTV-1 高清\nhttps://test.example/live.m3u8\n#EXTINF:-1 group-title="卫视",北京卫视\nhttp://test.example/live.m3u8\n');
  assert.equal(out.results.length,1);
  assert.equal(out.results[0].name,'CCTV-1 高清');
  assert.equal(out.results[0].group,'央视');
  assert.equal(out.skipped,1);
  assert.ok(h.liveProviders.length>=4);
});
test('live player is browser-direct without injected Cloudflare media proxy',()=>{
  assert.match(script,/hls\.loadSource\(src\)/);
  assert.match(script,/video\.src=src/);
  const live=script.split('function startLive(channel)')[1].split('function parseM3U')[0];
  assert.doesNotMatch(live,/\/proxy\//);
  const page=fs.readFileSync(root+'index.html','utf8');
  assert.match(page,/js\/browse-live\.js/);
});
