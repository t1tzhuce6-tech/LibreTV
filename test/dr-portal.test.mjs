import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {onRequestGet,backend,safeSites,cleanVideo,cleanCategories} from '../functions/dr-data.js';

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
  assert.match(sw,/20261016-dr-native-v7/);
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
