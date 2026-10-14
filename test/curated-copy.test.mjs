import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CURATED,normalizeCollection,onRequestGet} from '../functions/curated-list.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const ui=fs.readFileSync(root+'js/curated-lists.js','utf8');
const home=fs.readFileSync(root+'js/hot-list.js','utf8');
test('curated copies real community lists using a fixed no-auth allowlist',()=>{
  assert.equal(Object.keys(CURATED).length,5);
  assert.ok(Object.values(CURATED).every(x=>x.url.startsWith('https://mylistsaddon.com/lists/')));
  assert.ok(Object.values(CURATED).every(x=>x.author&&x.title));
});
test('normalizes poster title and year from My Lists native arrays',()=>{
  const items=normalizeCollection([
    {title:'Silo',poster:'https://image.tmdb.org/t/p/w200/poster.jpg',type:'series',year:'2023'},
    {name:'The Bear',poster:'javascript:evil()',type:'series'},
    {title:'',poster:'https://image.tmdb.org/empty.jpg'}
  ],'scifi');
  assert.equal(items.length,2);
  assert.equal(items[0].title,'Silo');
  assert.equal(items[0].kind,'tv');
  assert.equal(items[0].year,'2023');
  assert.equal(items[1].cover,'');
  assert.equal(items[1].title,'The Bear');
});
test('rejects arbitrary URLs/ids and proxies data only, not playback',async()=>{
  assert.equal((await onRequestGet({request:new Request('https://site.example/curated-list?id=https://private.invalid/')})).status,400);
  const orig=globalThis.fetch;
  let called='';
  globalThis.fetch=async url=>{
    called=String(url);
    return Response.json([
      {title:'Film One',poster:'https://image.tmdb.org/one.jpg',type:'movie'},
      {title:'Film Two',poster:'https://image.tmdb.org/two.jpg',type:'movie'},
      {title:'Film Three',poster:'https://image.tmdb.org/three.jpg',type:'movie'}
    ]);
  };
  try{
    const r=await onRequestGet({request:new Request('https://site.example/curated-list?id=a24')});
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(body.items.length,3);
    assert.equal(body.title,'A24 电影专题');
    assert.match(called,/mylistsaddon.com\/lists\/bdubz\/a24\.json$/);
    assert.match(r.headers.get('cache-control'),/max-age=1800/);
  }finally{globalThis.fetch=orig;}
});
test('UI copies a title on direct user click and remains an optional third tab',()=>{
  assert.match(ui,/navigator\.clipboard\.writeText\(title\)/);
  assert.match(ui,/window\.prompt\('自动复制失败/);
  assert.match(home,/ltCuratedContent/);
  assert.match(home,/\{id:'curated',name:'主题片单（复制搜索）'\}/);
  assert.match(home,/window\.LibreCurated\?\.init\(curated\)/);
  assert.match(home,/window\.LibreCurated\?\.show\(\)/);
  assert.doesNotMatch(ui,/new Hls\(|new Artplayer\(|QuickPlay\.open/);
  const index=fs.readFileSync(root+'index.html','utf8');
  assert.ok(index.indexOf('curated-lists.js')<index.indexOf('hot-list.js'));
  assert.match(index,/curated-lists\.css\?v=20261014seed1/);
});
