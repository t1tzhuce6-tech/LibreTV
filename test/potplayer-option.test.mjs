import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const js=fs.readFileSync(root+'js/potplayer-launch.js','utf8');
function browser(userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64)'){
  const links=[];
  const body={appendChild(el){links.push(el)}};
  const window={navigator:{userAgent},document:{body,createElement(){
    const el={style:{},setAttribute(){},click(){el.clicked=true},remove(){el.removed=true}};return el;
  }}};
  vm.runInNewContext(js,{window,URL});
  return {api:window.LibreExternalPlayer,links};
}
test('adds a passive Windows-only PotPlayer button to the existing player, not replacing web playback',()=>{
 const page=fs.readFileSync(root+'player.html','utf8');
 const player=fs.readFileSync(root+'js/player.js','utf8');
 assert.match(page,/potplayer-launch\.js/);
 assert.ok(page.indexOf('potplayer-launch.js')<page.indexOf('js/player.js'));
 assert.match(player,/id="potPlayerButton"/);
 assert.match(player,/onclick="launchCurrentInPotPlayer\(\)"/);
 assert.match(player,/const url = currentVideoUrl \|\| currentEpisodes\[currentEpisodeIndex\]/);
 assert.ok(!page.includes('autolaunch=potplayer'));
 const worker=fs.readFileSync(root+'service-worker.js','utf8');
 assert.match(worker,/\/js\/potplayer-launch\.js/);
});
test('PotPlayer protocol is constructed from direct signed media URL, preserving query parameters',()=>{
 const {api,links}=browser();
 const url='https://cdn.example.org/path/video.m3u8?token=abc123&quality=1080';
 assert.equal(api.protocolUrl(url),'potplayer://'+url);
 assert.equal(links.length,0,'no browser launch on page load or URL building');
 assert.equal(api.launch(url).ok,true);
 assert.equal(links.length,1);
 assert.equal(links[0].href,'potplayer://'+url);
 assert.equal(links[0].clicked,true);
 assert.equal(links[0].removed,true);
});
test('external play refuses page links, local network, unsafe schemes and mobile',()=>{
 const {api,links}=browser();
 for(const value of ['javascript:alert(1)','file:///c:/secret','https://example.com/watch?id=1',
   'https://127.0.0.1/private.m3u8','http://192.168.0.1/stream.m3u8',
   'http://localhost/movie.mp4','https://user:pass@example.org/movie.mp4', 'magnet:?xt=urn:btih:fake']){
    assert.equal(api.protocolUrl(value),null,value);
    assert.equal(api.launch(value).ok,false);
 }
 assert.equal(links.length,0);
 const mobile=browser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
 assert.equal(mobile.api.isWindows(),false);
 assert.equal(mobile.api.launch('https://cdn.example.org/movie.mp4').ok,false);
 assert.equal(mobile.links.length,0);
});
