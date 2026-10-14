import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extractLd,normalizeDirectory,onRequestGet as getDir} from '../functions/nexus-directory.js';
import {normalizeList,onRequestGet as getList} from '../functions/nexus-list.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const schema=(object)=>'<script type="application/ld+json">'+JSON.stringify(object)+'</script>';
test('Nexus directory reads published Chinese names and skips adult/horror topics',()=>{
  const slugs=['douban-hot','douban-top','douban-genre-scifi','douban-genre-mystery',
   'douban-hot-tv-american','douban-hot-tv-domestic','douban-genre-erotic',
   'douban-genre-horror','douban-hot-tv-documentary','douban-genre-animation',
   'douban-genre-comedy','douban-genre-adventure'];
  const ld={'@type':'CollectionPage',hasPart:{itemListElement:
    slugs.map((slug,i)=>({position:i+1,name:slug==='douban-hot'?'最热电影榜':slug}))}};
  const html=slugs.map(slug=>'<a href="/rankings/'+slug+'">条目</a>').join('')+schema(ld);
  const parsed=normalizeDirectory(html);
  assert.equal(parsed.totalPublished,12);
  assert.equal(parsed.items.length,10);
  assert.equal(parsed.items[0].title,'最热电影榜');
  assert.ok(!parsed.items.some(x=>/erotic|horror/.test(x.slug)));
});
test('Nexus ItemList supplies real positions, Mandarin film names and TMDB artwork',()=>{
  const ld={'@type':'ItemList',name:'高分悬疑电影榜',description:'值得一看的悬疑电影',
    numberOfItems:100,itemListElement:[
      {position:1,name:'控方证人',image:'https://image.tmdb.org/t/p/w500/a.jpg',url:'https://nexusfilmx.com/movie/961834-witness'},
      {position:2,name:'绝命毒师',image:'https://image.tmdb.org/t/p/w500/b.jpg',url:'https://nexusfilmx.com/tv/15143-breaking'},
      {position:3,name:'成人短片',image:'https://image.tmdb.org/t/p/w500/c.jpg',url:'https://nexusfilmx.com/movie/991'},
      {position:4,name:'第三方错误封面',image:'https://evil.example/p.jpg',url:'https://nexusfilmx.com/movie/99'}
    ]};
  const out=normalizeList(schema(ld),'douban-genre-mystery');
  assert.equal(out.totalPublished,100);
  assert.equal(out.items.length,3);
  assert.equal(out.items[0].rank,1);
  assert.equal(out.items[1].kind,'tv');
  assert.equal(out.items[2].cover,'');
});
test('routes fetch fixed host and reject unsupported horror/erotic slug',async()=>{
  assert.equal((await getList({request:new Request('https://site.test/nexus-list?slug=douban-genre-erotic')})).status,400);
  assert.equal((await getList({request:new Request('https://site.test/nexus-list?slug=../../private')})).status,400);
  const original=globalThis.fetch;
  let called='';
  globalThis.fetch=async url=>{called=String(url);return new Response(schema({
    '@type':'ItemList',name:'电影榜',numberOfItems:1,
    itemListElement:[{position:1,name:'电影',image:'https://image.tmdb.org/t/p/w500/1.jpg'}]
  }),{headers:{'Content-Type':'text/html'}});};
  try{
    const response=await getList({request:new Request('https://site.test/nexus-list?slug=douban-top')});
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.items[0].title,'电影');
    assert.equal(called,'https://nexusfilmx.com/rankings/douban-top');
  }finally{globalThis.fetch=original;}
});
test('Chinese topic interface reuses QuickPlay and hides old English lists by default',()=>{
  const main=fs.readFileSync(root+'js/hot-list.js','utf8');
  const module=fs.readFileSync(root+'js/nexus-lists.js','utf8');
  const html=fs.readFileSync(root+'index.html','utf8');
  assert.match(main,/中文精选片单/);
  assert.match(main,/curated.hidden=true/);
  assert.match(main,/ltNexusContent/);
  assert.match(module,/window\.QuickPlay\.open/);
  assert.match(module,/navigator\.clipboard\.writeText/);
  assert.match(module,/其他社区英文片单（备用）/);
  assert.ok(html.indexOf('nexus-lists.js')<html.indexOf('hot-list.js'));
});
