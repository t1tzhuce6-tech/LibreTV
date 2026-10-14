import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {normalizeHotList,onRequestGet} from '../functions/hot-list.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const front=fs.readFileSync(root+'js/hot-list.js','utf8');
test('official LibreTV 60s weekly format normalizes ranks, rating, year, and movie kind',()=>{
  const v=normalizeHotList({data:[
    {id:'321',title:'正常电影',cover:'https://img.example.org/film.jpg',rank:2,rating:8.6,card_subtitle:'2026 / 中国 / 剧情'},
    {title:'没有封面'},
    {title:'不允许的封面',cover:'javascript:alert(1)'}
  ]},'douban_movie_weekly');
  assert.equal(v.length,1);
  assert.equal(v[0].rank,2);
  assert.equal(v[0].rating,8.6);
  assert.equal(v[0].kind,'movie');
  assert.equal(v[0].year,'2026');
});
test('Baidu list has TV playback kind, does not claim nonexistent ratings',()=>{
  const v=normalizeHotList({data:[{title:'热播剧',cover:'https://a.example.com/a.jpg'}]},'baidu_teleplay');
  assert.equal(v[0].kind,'tv');
  assert.equal(v[0].rating,null);
  assert.equal(v[0].rank,1);
});
test('fixed whitelist rejects arbitrary upstream paths',async()=>{
  assert.equal((await onRequestGet({request:new Request('https://site.example/hot-list?id=https://internal.invalid')})).status,400);
});
test('route returns normalized real chart shape with no second player',async()=>{
  const old=globalThis.fetch;
  let requested='';
  globalThis.fetch=async url=>{
    requested=String(url);
    return Response.json({code:200,data:[{title:'测试剧情',cover:'https://cdn.example.com/cover.jpg',rating:7.8}]});
  };
  try{
    const r=await onRequestGet({request:new Request('https://site.example/hot-list?id=douban_tv_global')});
    assert.equal(r.status,200);
    const j=await r.json();
    assert.equal(j.items.length,1);
    assert.equal(j.items[0].kind,'tv');
    assert.match(requested,/\/v2\/douban\/weekly\/tv_global$/);
    assert.match(r.headers.get('Cache-Control'),/max-age/);
  }finally{globalThis.fetch=old;}
});
test('front end has six original chart IDs and reuses existing QuickPlay only',()=>{
  for(const id of ['douban_movie_weekly','douban_tv_chinese','douban_tv_global','douban_show_chinese','douban_show_global','baidu_teleplay']){
    assert.ok(front.includes(id));
  }
  assert.match(front,/window\.QuickPlay\.open\(/);
  assert.doesNotMatch(front,/new Artplayer\(|new Hls\(/);
  assert.match(front,/LibreContentPolicy\?\.isAdultVideo/);
  const page=fs.readFileSync(root+'index.html','utf8');
  assert.match(page,/js\/hot-list\.js\?v=20261015b/);
  assert.match(page,/css\/hot-list\.css\?v=20261014long1/);
  assert.ok(page.indexOf('quick-play.js')<page.indexOf('hot-list.js'));
});
