import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {onRequestGet,CATS,COLUMNS} from '../functions/cctv-vod.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const req=q=>onRequestGet({request:new Request('https://libretv.example/cctv-vod?'+q)});
test('CCTV exposes one catalog source with ten native categories and validates parameters',async()=>{
 const r=await req('ac=list'),data=await r.json();
 assert.equal(r.status,200);assert.equal(data.class.length,10);
 assert.equal(data.class.find(c=>c.type_id==='work:documentary').type_name,'纪录片');
 assert.equal(Object.keys(CATS).length,4);assert.equal(Object.keys(COLUMNS).length,6);
 assert.equal((await req('ac=invalid')).status,400);
 assert.equal((await req('ac=videolist&t=bad')).status,400);
 assert.equal((await req('ac=detail&ids=https://evil.example/foo')).status,404);
 assert.equal((await req('ac=videolist&pg=999')).status,400);
});
test('official CCTV source registers into the existing global source, rank and search pool',()=>{
 const registered={},window={location:{origin:'https://libretv.example'},
  extendAPISites:x=>Object.assign(registered,x),document:{}};
 vm.runInNewContext(fs.readFileSync(root+'js/cctv-source.js','utf8'),
  {window,URL,console});
 assert.equal(registered.cctv_official.name,'🌟央视大全');
 assert.equal(registered.cctv_official.api,'https://libretv.example/cctv-vod');
 assert.equal(registered.cctv_official.searchable,true);
 assert.equal(window.CctvSource.isOfficial('cctv_official'),true);
 assert.equal(window.CctvSource.safeLink('https://evil.example/2026/10/19/VIDEabc.shtml'),'');
 const html=fs.readFileSync(root+'index.html','utf8');
 assert(html.includes('js/cctv-source.js'));
 assert(html.includes('js/rank-source-prefs.js'));
 assert(html.includes('js/discovery-views.js'));
 assert(html.indexOf('js/cctv-source.js')<html.indexOf('js/auto-source-registry.js'));
});
test('CCTV official results convert into MacCMS shape for browse, global search and detail',async t=>{
 const calls=[];
 const url='https://tv.cctv.com/2026/10/18/VIDEtpz2SWWMfPJ6NslmktdQ261018.shtml';
 t.mock.method(globalThis,'fetch',async input=>{
  const u=new URL(String(input));calls.push(u);
  assert(['api.cntv.cn','search.cctv.com'].includes(u.hostname));
  if(u.pathname==='/list/getVideoAlbumList')return Response.json({data:{total:1,list:[{
   id:'VIDAXeXruD1w9V5VtnMGjipL261016',title:'广济沧海',year:'2026',image:'https://p1.img.cctvpic.com/a.jpg',count:'4'
  }]}});
  if(u.pathname==='/ifsearch.php')return Response.json({total:1,list:[{
   title:'<font>广济沧海</font>',all_title:'《广济沧海》 第4集',urllink:url,
   imglink:'https://p1.img.cctvpic.com/cover.jpg',uploadtime:'2026-10-18'
  }]});
  if(u.pathname==='/NewVideo/getVideoListByAlbumIdNew')return Response.json({data:{total:1,list:[{
   title:'第一集',url},{title:'假节目',url:'https://evil.example/2026/10/18/VIDEabc.shtml'}]}});
  if(u.pathname==='/NewVideo/getVideoListByColumn')return Response.json({data:{total:1,list:[{title:'某一期',url}]}});
  throw Error('Unexpected CCTV path');
 });
 const catalog=await(await req('ac=videolist&t=work:documentary&pg=1')).json();
 assert.equal(catalog.list[0].vod_name,'广济沧海');assert.equal(catalog.pagecount,1);
 const search=await(await req('ac=videolist&wd=广济沧海')).json();
 assert.equal(search.list.length,1);assert.equal(search.pagecount,1);
 assert.equal(search.list[0].vod_official_url,url);
 const episode=await(await req('ac=detail&ids='+search.list[0].vod_id)).json();
 assert.match(episode.list[0].vod_play_url,/央视官网/);
 assert(!episode.list[0].vod_play_url.includes('evil.example'));
 const album=await(await req('ac=detail&ids=VIDAXeXruD1w9V5VtnMGjipL261016')).json();
 assert.equal(album.episodeCount,1);assert.equal(album.playback,'official-page-only');
 const columns=await(await req('ac=videolist&t=column:jrsf&pg=1')).json();
 assert.equal(columns.list.length,1);assert(columns.list[0].vod_id.startsWith('s_'));
 assert(calls.every(x=>x.protocol==='https:'));
});
test('🌟央视大全 is selectable by both native source library and ranked source preferences',()=>{
 const sites={ffzy:{api:'https://ordinary.example/api.php/provide/vod',name:'普通源'}};
 const state=new Map();
 const window={location:{origin:'https://libretv.example'},API_SITES:sites,DEFAULT_SELECTED_APIS:['ffzy'],
  localStorage:{getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,v)},
  extendAPISites:add=>Object.assign(sites,add),document:{addEventListener(){}},getCustomApiInfo:()=>null};
 const ctx={window,URL,console};
 vm.runInNewContext(fs.readFileSync(root+'js/cctv-source.js','utf8'),ctx);
 vm.runInNewContext(fs.readFileSync(root+'js/content-policy.js','utf8'),ctx);
 vm.runInNewContext(fs.readFileSync(root+'js/rank-source-prefs.js','utf8'),{...ctx,Event:class{}});
 assert(Array.from(window.LibreContentPolicy.safeSourceIds(true)).includes('cctv_official'));
 assert(Array.from(window.LibreRankSources.available()).includes('cctv_official'));
 assert(Array.from(window.LibreRankSources.selected()).includes('cctv_official'));
});
test('CCTV catalog calls bypass third-party proxy, other source calls keep original proxy',async()=>{
 const requests=[],origin='https://libretv.example';
 const window={location:{origin},CctvSource:{api:origin+'/cctv-vod'},
  ProxyAuth:{addAuthToProxyUrl:async u=>u}};
 const ctx={window,URL,AbortController,setTimeout,clearTimeout,console,PROXY_URL:'/proxy/',API_CONFIG:{search:{headers:{}}},
  fetch:async input=>{requests.push(String(input));return Response.json({list:[]})}};
 vm.runInNewContext(fs.readFileSync(root+'js/search.js','utf8'),ctx);
 await ctx.fetchVodApiJson(origin+'/cctv-vod?ac=videolist&wd=央视');
 await ctx.fetchVodApiJson('https://ordinary.example/api.php/provide/vod?ac=list');
 assert(requests[0].startsWith(origin+'/cctv-vod?'));
 assert(requests[1].startsWith('/proxy/'));
});
