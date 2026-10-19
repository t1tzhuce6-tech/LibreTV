import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {onRequestGet} from '../functions/cctv-vod.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=fs.readFileSync(root+'js/cctv-browse.js','utf8');
test('official CCTV source registers inside native LibreTV without DR dependency',async()=>{
 const registered={},calls=[];
 const win={location:{origin:'https://libretv.example'},extendAPISites:o=>Object.assign(registered,o)};
 const network=async(u)=>{
  calls.push(new URL(u).pathname);
  const q=new URL(u).searchParams;
  if(q.get('op')==='categories')return onRequestGet({request:new Request(u)});
  if(q.get('op')==='list')return Response.json({items:[{
    id:'VIDAXeXruD1w9V5VtnMGjipL261016',title:'测试纪录片',
    poster:'https://p1.img.cctvpic.com/image.jpg',episodes:4,
    officialUrl:'https://tv.cctv.com/2026/10/16/VIDAXeXruD1w9V5VtnMGjipL261016.shtml'
  }],total:1});
  if(q.get('op')==='detail')return Response.json({episodes:[
    {title:'第1集',officialUrl:'https://tv.cctv.com/2026/10/16/VIDEabc.shtml'},
    {title:'伪造链接',officialUrl:'https://evil.example/movie.m3u8'}
  ],total:2});
  throw Error('Unexpected endpoint');
 };
 const ctx={window:win,fetch:network,URL,Request,Response,AbortController,console};
 class El{
  constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.open=false;this.textContent='';}
  append(...nodes){this.children.push(...nodes)}
  appendChild(node){this.children.push(node);return node}
  replaceChildren(...nodes){this.children=[...nodes]}
  addEventListener(event,cb){this.handlers[event]=cb}
  showModal(){this.open=true}
  close(){this.open=false;this.handlers.close?.()}
 }
 const body=new El('body');
 const doc={body,createElement:tag=>new El(tag)};
 ctx.document=doc;
 vm.runInNewContext(source,ctx);
 assert.equal(registered.cctv_official.name,'央视大全（官方动态）');
 assert.equal(registered.cctv_official.official,true);
 assert.equal(win.CctvBrowse.isSource('cctv_official'),true);
 const cats=await win.CctvBrowse.categories();
 assert(cats.some(x=>x.type_id==='work:documentary'));
 assert(cats.some(x=>x.type_id==='column:jrsf'));
 const result=await win.CctvBrowse.list('work:documentary',1);
 assert.equal(result.list.length,1);assert.equal(result.list[0].vod_remarks,'共4集');
 await win.CctvBrowse.openDetail(result.list[0]);
 const dialog=body.children[0];assert.equal(dialog.open,true);
 const anchor=(function walk(x){return x.tag==='a'?[x]:x.children.flatMap(walk)})(dialog);
 assert.equal(anchor.length,1);assert.match(anchor[0].href,/^https:\/\/tv\.cctv\.com\//);
 assert(!calls.includes('/dr-data'));
 const page=fs.readFileSync(root+'index.html','utf8');
 assert(page.includes('js/cctv-browse.js'));
 const native=fs.readFileSync(root+'js/browse-live.js','utf8');
 assert(native.includes('window.CctvBrowse.openDetail(item)'));
});
test('native browsing source selector puts CCTV next to existing LibreTV sources',()=>{
 const browse=fs.readFileSync(root+'js/browse-live.js','utf8');
 const anchor="  document.addEventListener('DOMContentLoaded',start);";
 assert(browse.includes(anchor));
 const script=browse.replace(anchor,"  window.__cctvNativeSourceOrder=sourceOrder;");
 const fakeSites={ffzy:{name:'非凡'},cctv_official:{name:'央视大全'}};
 const win={CctvBrowse:{KEY:'cctv_official',isSource:x=>x==='cctv_official'},
   LibreProfiles:{visibleIds:()=>['ffzy']}};
 vm.runInNewContext(script,{window:win,document:{addEventListener(){}},
   API_SITES:fakeSites,DEFAULT_SELECTED_APIS:['ffzy'],console});
 assert.deepEqual(Array.from(win.__cctvNativeSourceOrder()),['cctv_official','ffzy']);
 assert(!browse.includes("new URL('/dr-data'"),'native CCTV should not use DR API');
});
