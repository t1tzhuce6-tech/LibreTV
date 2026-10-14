import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {normalizeCollection,onRequestGet} from '../functions/curated-list.js';
import {normalizeDirectoryPage} from '../functions/curated-directory.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const ui=fs.readFileSync(root+'js/curated-lists.js','utf8');
const home=fs.readFileSync(root+'js/hot-list.js','utf8');
test('imports publicly shared lists dynamically instead of fixed IDs',()=>{
  const p=normalizeDirectoryPage({total:541,lists:[
    {name:'Horror 101',slug:'horror-101',creator:'stream4me',itemCount:35},
    {name:'More Sci-Fi',slug:'sci-fi',creator:'example',itemCount:19},
    {name:'Empty',slug:'empty',creator:'noone',itemCount:0}]});
  assert.equal(p.lists.length,2);
  assert.equal(p.total,541);
  assert.doesNotMatch(ui,/const lists=\[/);
  assert.match(ui,/curated-directory/);
});
test('normalizes poster title and year from My Lists native arrays',()=>{
  const items=normalizeCollection([
    {title:'Silo',poster:'https://image.tmdb.org/t/p/w200/poster.jpg',type:'series',year:'2023'},
    {name:'The Bear',poster:'javascript:evil()',type:'series'},
    {title:'',poster:'https://image.tmdb.org/empty.jpg'}
  ]);
  assert.equal(items.length,2);
  assert.equal(items[0].title,'Silo');
  assert.equal(items[0].kind,'tv');
  assert.equal(items[0].year,'2023');
  assert.equal(items[1].cover,'');
  assert.equal(items[1].title,'The Bear');
});
test('rejects arbitrary URLs and proxies metadata only, not playback',async()=>{
  assert.equal((await onRequestGet({request:new Request('https://site.example/curated-list?creator=https:%2F%2Fprivate.invalid&slug=x')})).status,400);
  const orig=globalThis.fetch;
  let called='';
  globalThis.fetch=async url=>{
    called=String(url);
    return Response.json([{title:'Film One',poster:'https://image.tmdb.org/one.jpg',type:'movie'},
      {title:'Film Two',poster:'https://image.tmdb.org/two.jpg',type:'movie'},
      {title:'Film Three',poster:'https://image.tmdb.org/three.jpg',type:'movie'}]);
  };
  try{
    const r=await onRequestGet({request:new Request('https://site.example/curated-list?creator=bdubz&slug=a24')});
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(body.items.length,3);
    assert.match(called,/mylistsaddon.com\/lists\/bdubz\/a24\.json$/);
    assert.match(r.headers.get('cache-control'),/max-age=1200/);
  }finally{globalThis.fetch=orig;}
});
test('UI copies a title on direct user click and remains an optional third tab',()=>{
  assert.match(ui,/navigator\.clipboard\.writeText\(title\)/);
  assert.match(ui,/window\.prompt\(/);
  assert.match(home,/ltCuratedContent/);
  assert.match(home,/\{id:'curated',name:'中文精选片单'\}/);
  assert.match(home,/window\.LibreCurated\?\.init\(curated\)/);
  assert.match(fs.readFileSync(root+'js/nexus-lists.js','utf8'),/window\.LibreCurated\?\.show\(\)/);
  assert.doesNotMatch(ui,/new Hls\(|new Artplayer\(|QuickPlay\.open/);
  const index=fs.readFileSync(root+'index.html','utf8');
  assert.ok(index.indexOf('curated-lists.js')<index.indexOf('hot-list.js'));
  assert.match(index,/curated-lists\.css\?v=20261014seed2/);
});