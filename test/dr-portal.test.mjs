import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {onRequestGet,backend,safeSites,cleanVideo,cleanCategories,normalizeDetail,normalizePlayable} from '../functions/dr-data.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const env={DR_BACKEND_URL:'https://dr.example.com/',DR_API_PWD:'very-private-dr-secret',DR_SOURCE_ALLOWLIST:'good,adult,foreign,other'};
const catalog={sites:[
  {key:'good',name:'优质影视源',type:4,api:'https://dr.example.com/api/good?pwd=oldsecret&do=ds',ext:'extended-data',searchable:1},
  {key:'adult',name:'AV资源合集',type:4,api:'https://dr.example.com/api/adult',searchable:1},
  {key:'foreign',name:'外部影视',type:4,api:'https://untrusted.example/api/evil',searchable:1},
  {key:'other',name:'普通资源站Type1',type:1,api:'https://dr.example.com/api/other',searchable:1},
  {key:'unknown',name:'不在许可名单',type:4,api:'https://dr.example.com/api/unknown',searchable:1},
]};
const home={class:[{type_id:'movie',type_name:'电影'},{type_id:'a',type_name:'成人视频'},{type_id:'tv',type_name:'电视剧'}],list:[
  {vod_id:'1',vod_name:'正常电影',vod_pic:'https://images.example/film.jpg',vod_year:'2026',vod_remarks:'高清'},
  {vod_id:'2',vod_name:'成人无码影片',vod_pic:'https://images.example/adult.jpg'},
  {vod_id:'3',vod_name:'好剧',vod_pic:'javascript:alert(1)'},
],page:1,pagecount:2};
function mockUpstream(t,seen){
  t.mock.method(globalThis,'fetch',async(u)=>{
    const x=new URL(String(u));seen.push(x);
    assert.equal(x.origin,'https://dr.example.com');
    assert.equal(x.searchParams.get('pwd'),'very-private-dr-secret');
    if(x.pathname==='/config/1')return Response.json(catalog);
    if(x.pathname==='/api/good')return Response.json(home);
    throw Error('unapproved path');
  });
}
const req=params=>new Request('https://libretv.example/dr-data'+(params?'?'+new URLSearchParams(params):''));
test('DR page is native LibreTV UI without old iframe, iQIYI content or old origin URL editor',()=>{
  const html=fs.readFileSync(root+'dr.html','utf8');
  assert.match(html,/js\/dr-native\.js/);
  assert.match(html,/id="dr-source"/);
  assert.match(html,/id="dr-categories"/);
  assert.match(html,/id="dr-search-form"/);
  assert.doesNotMatch(html,/iframe|DrPlayer|iqiyi|爱奇艺|dr-url|__DR_DEFAULT_URL__/i);
  const sw=fs.readFileSync(root+'service-worker.js','utf8');
  assert.match(sw,/'\/dr.html'/);
  assert.match(sw,/'\/js\/dr-native.js'/);
  assert.match(sw,/20261016-dr-native-v8/);
  assert.doesNotMatch(sw,/'\/js\/dr-portal.js'/);
  const index=fs.readFileSync(root+'index.html','utf8');
  assert.match(index,/href="dr.html"/);
});
test('DR backend must be a fixed HTTPS origin without credentials',()=>{
  assert.equal(backend({DR_BACKEND_URL:'https://dr.example.com/'}).origin,'https://dr.example.com');
  for(const url of ['http://dr.example.com/','https://user:secret@dr.example.com/','https://dr.example.com/path','https://dr.example.com/?pwd=secret','file:///file']){
    assert.equal(backend({DR_BACKEND_URL:url}),null,url);
  }
});
test('DR only accepts specifically approved native T4 sources at the configured backend origin',()=>{
  const rows=safeSites(catalog,new URL('https://dr.example.com/'),new Set(['good','adult','foreign','other']));
  assert.deepEqual(rows.map(x=>x.key),['good']);
  assert.deepEqual(rows.map(x=>x.name),['优质影视源']);
  assert.equal(rows[0].api,'/api/good');
});
test('DR strips adult-labeled content, category and hostile poster protocol',()=>{
  assert.equal(cleanVideo({vod_name:'成人无码'}),null);
  assert.equal(cleanVideo({vod_name:'正常作品',vod_pic:'javascript:alert(1)'}).poster,'');
  assert.deepEqual(cleanCategories(home.class).map(x=>x.id),['movie','tv']);
});
test('without DR origin or an approved source list the server fails explicitly without fetching',async t=>{
  const seen=[];
  t.mock.method(globalThis,'fetch',()=>{seen.push('called');throw Error('should not fetch');});
  const r1=await onRequestGet({request:req({op:'sources'}),env:{}});
  assert.equal(r1.status,503);
  assert.equal((await r1.json()).code,'DR_NOT_CONFIGURED');
  const r2=await onRequestGet({request:req({op:'sources'}),env:{DR_BACKEND_URL:'https://dr.example.com/'}});
  assert.equal(r2.status,503);
  assert.equal((await r2.json()).code,'DR_SOURCES_NOT_APPROVED');
  assert.deepEqual(seen,[]);
});
test('approved DR source discovery returns names without exposing private API password',async t=>{
  const seen=[];mockUpstream(t,seen);
  const response=await onRequestGet({request:req({op:'sources'}),env});
  const raw=await response.text();
  assert.equal(response.status,200);
  assert.deepEqual(JSON.parse(raw).sources,[{key:'good',name:'优质影视源'}]);
  assert.equal(raw.includes('very-private-dr-secret'),false);
  assert.equal(raw.includes('oldsecret'),false);
  assert.equal(seen[0].pathname,'/config/1');
  assert.equal(seen[0].searchParams.get('sub'),'green');
});
test('DR native home/category/search query only whitelisted source and never returns adult entries',async t=>{
  const seen=[];mockUpstream(t,seen);
  for(const params of [{op:'home',source:'good'},{op:'search',source:'good',q:'好剧',page:'2'},{op:'category',source:'good',cat:'movie'}]){
    const r=await onRequestGet({request:req(params),env});
    assert.equal(r.status,200);
    const raw=await r.text();
    assert.equal(raw.includes('very-private-dr-secret'),false);
    const data=JSON.parse(raw);
    assert.equal(data.items.length,2);
    assert.deepEqual(data.categories.map(x=>x.id),['movie','tv']);
  }
  const calls=seen.filter(x=>x.pathname==='/api/good');
  assert.equal(calls.length,3);
  assert.equal(calls[1].searchParams.get('wd'),'好剧');
  assert.equal(calls[1].searchParams.get('pg'),'2');
  assert.equal(calls[2].searchParams.get('t'),'movie');
  assert.equal(calls[0].searchParams.get('extend'),'extended-data');
  assert.equal(calls[0].searchParams.get('pwd'),'very-private-dr-secret');
});
test('unknown DR source key cannot call an arbitrary API and unsupported operations are blocked',async t=>{
  const seen=[];mockUpstream(t,seen);
  const r=await onRequestGet({request:req({op:'home',source:'foreign'}),env});
  assert.equal(r.status,404);
  assert.equal(seen.filter(x=>x.pathname.startsWith('/api/')).length,0);
  const invalid=await onRequestGet({request:req({op:'proxy',source:'good',url:'https://bad.example'}),env});
  assert.equal(invalid.status,400);
});

test('DR T4 detail decodes selectable lines and episodes without mixing old source names',()=>{
  const row={vod_id:'film1',vod_name:'DR 电影',vod_play_from:'线路一$$$线路二',vod_play_url:'正片$ep_1#第二集$ep_2$$$正片$ep_alt',vod_content:'简介'};
  const d=normalizeDetail({list:[row]});
  assert.equal(d.info.title,'DR 电影');
  assert.deepEqual(d.lines.map(x=>x.flag),['线路一','线路二']);
  assert.equal(d.lines[0].episodes[1].name,'第二集');
  assert.equal(d.lines[0].episodes[1].id,'ep_2');
  assert.equal(d.lines[1].episodes[0].id,'ep_alt');
  assert.equal(normalizeDetail({list:[{vod_name:'成人无码',vod_play_url:'正片$bad'}]}),null);
});
test('DR playback accepts direct HTTPS media, rejects secret, headers, parsing and backend proxy links',()=>{
  const base=new URL('https://dr.example.com/');
  assert.equal(normalizePlayable({url:'https://cdn.example/film.m3u8?token=public',parse:0},base,'secret').status,'ready');
  for(const payload of [
    {url:'http://cdn.example/film.m3u8'},
    {url:'https://cdn.example/film.m3u8',headers:{Referer:'https://special'}},
    {url:'https://cdn.example/film.m3u8',parse:1},
    {url:'https://dr.example.com/proxy/film.m3u8?pwd=secret'},
    {url:'https://cdn.example/film.m3u8?pwd=secret'},
    {url:'javascript:alert(1)'},
    {url:'https://cdn.example/watch?id=1'}
  ]) assert.equal(normalizePlayable(payload,base,'secret').status,'unsupported',JSON.stringify(payload));
});
test('DR T4 detail and play API are routed exclusively through approved DR sources',async t=>{
  const seen=[];
  t.mock.method(globalThis,'fetch',async url=>{
    const u=new URL(String(url));seen.push(u);
    if(u.pathname==='/config/1')return Response.json(catalog);
    if(u.pathname==='/api/good'){
      if(u.searchParams.get('ac')==='detail')return Response.json({list:[{vod_id:'1',vod_name:'好电影',vod_play_from:'DR影视',vod_play_url:'第1集$movie-1'}]});
      if(u.searchParams.get('play'))return Response.json({url:'https://media.example/movie.m3u8'});
    }
    throw Error('Unexpected upstream');
  });
  const detail=await onRequestGet({request:req({op:'detail',source:'good',id:'1'}),env});
  assert.equal(detail.status,200);
  assert.equal((await detail.json()).lines[0].episodes[0].id,'movie-1');
  const play=await onRequestGet({request:req({op:'play',source:'good',play:'movie-1',flag:'DR影视'}),env});
  assert.deepEqual(await play.json(),{status:'ready',url:'https://media.example/movie.m3u8',kind:'hls'});
  const apiCalls=seen.filter(u=>u.pathname==='/api/good');
  assert.equal(apiCalls[0].searchParams.get('ids'),'1');
  assert.equal(apiCalls[1].searchParams.get('play'),'movie-1');
  assert.equal(apiCalls[1].searchParams.get('flag'),'DR影视');
  for(const u of seen)assert.equal(u.searchParams.get('pwd'),'very-private-dr-secret');
});
test('DR-only playback redirects source switching back to DR instead of old source pool',()=>{
  const player=fs.readFileSync(root+'js/player.js','utf8');
  assert.match(player,/get\('dr'\) === '1'/);
  assert.match(player,/new URL\('dr.html', location.origin\)/);
  assert.match(player,/urlParams.get\('dr'\) !== '1'/);
  const page=fs.readFileSync(root+'dr.html','utf8');
  assert.match(page,/id="dr-detail"/);
  assert.match(page,/id="dr-play-status"/);
  const native=fs.readFileSync(root+'js/dr-native.js','utf8');
  assert.match(native,/op:'detail'/);
  assert.match(native,/op:'play'/);
  assert.match(native,/new URL\('player.html',location.origin\)/);
});
