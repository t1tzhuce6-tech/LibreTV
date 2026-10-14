import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=fs.readFileSync(root+'js/content-policy.js','utf8');
const browse=fs.readFileSync(root+'js/browse-live.js','utf8');
function policy(){
  const saved=new Map([['yellowFilterEnabled','false']]);
  const window={localStorage:{setItem:(k,v)=>saved.set(k,v)}};
  vm.runInNewContext(source,{window});
  return {api:window.LibreContentPolicy,saved};
}
test('filter is enabled across previously permissive settings',()=>{
  const {api,saved}=policy();
  assert.equal(saved.get('yellowFilterEnabled'),'true');
  assert.equal(api.isAdultSource({name:'杏吧'}),true);
  assert.equal(api.isAdultSource({name:'情色资源'}),true);
  assert.equal(api.isAdultSource({name:'大众资源'}),false);
});
test('normal movies remain, clearly adult videos and classes are removed before rendering posters',()=>{
  const {api}=policy();
  assert.equal(api.isAdultCategory('伦理片'),true);
  assert.equal(api.isAdultCategory('剧情片'),false);
  const rows=[
    {vod_id:1,vod_name:'正常的悬疑电影',type_name:'剧情片'},
    {vod_id:2,vod_name:'成人短片',type_name:'伦理片'},
    {vod_id:3,vod_name:'喜剧',type_name:'伦理片'},
    {vod_id:4,vod_name:'电视剧',type_name:'国产剧'}];
  assert.deepEqual(Array.from(api.filterVideos(rows),r=>r.vod_id),[1,4]);
  assert.match(browse,/LibreContentPolicy\?\.filterVideos\(items\)/);
  assert.match(browse,/LibreContentPolicy\?\.isAdultCategory\(c\.type_name\)/);
});
test('live TV is removed from the rendered discovery page, but profile source selection remains',()=>{
  const start=browse.split('  function start(){')[1].split("  document.addEventListener('DOMContentLoaded',start);")[0];
  assert.doesNotMatch(start,/ltLiveBody|ltModeLive|initLive\(\)/);
  assert.match(start,/ltBrowseSource/);
  assert.match(start,/ltBrowseCategory/);
  const html=fs.readFileSync(root+'index.html','utf8');
  const player=fs.readFileSync(root+'player.html','utf8');
  assert.ok(html.indexOf('content-policy.js')<html.indexOf('profile-manager.js'));
  assert.ok(player.indexOf('content-policy.js')<player.indexOf('profile-manager.js'));
});
