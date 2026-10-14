import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {normalizeDirectoryPage,mergeDirectory,onRequestGet as getDirectory} from '../functions/curated-directory.js';
import {normalizeCollection,onRequestGet as getList} from '../functions/curated-list.js';
const root=fileURLToPath(new URL('../',import.meta.url));
test('directory filters empty and generic watchlists, preserves actual community topics',()=>{
  const data=normalizeDirectoryPage({total:541,lists:[
    {name:'Airing Next',creator:'abc',slug:'airing-next',itemCount:0},
    {name:'Watchlist',creator:'abc',slug:'watchlist',itemCount:30},
    {name:'Mystery and Sci-Fi',creator:'abc',slug:'mystery-and-sci-fi',itemCount:18,type:'series',updatedAt:100},
    {name:'Horror Essentials',creator:'other',slug:'horror-essentials',itemCount:35,type:'movie',updatedAt:200},
    {name:'Open Proxy',creator:'https://bad',slug:'anything',itemCount:25},
    {name:'Erotic Adult',creator:'other',slug:'adult',itemCount:50},
  ]});
  assert.equal(data.total,541);
  assert.deepEqual(data.lists.map(x=>x.name),['Mystery and Sci-Fi','Horror Essentials']);
  assert.equal(mergeDirectory([data,data]).usableCount,2);
});
test('directory can read multiple remote pages and supports no fixed five-collection limit',async()=>{
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{
    calls.push(String(url));
    const offset=new URL(String(url)).searchParams.get('offset');
    const start=Number(offset)||0;
    return Response.json({total:210,lists:Array.from({length:start===200?10:100},(_,i)=>({
      name:'Collection '+(start+i),creator:'creator'+(start+i),
      slug:'curated-'+(start+i),itemCount:14,type:'movie',updatedAt:10
    }))});
  };
  try{
    const res=await getDirectory();
    assert.equal(res.status,200);
    const body=await res.json();
    assert.equal(body.totalPublished,210);
    assert.equal(body.usableCount,210);
    assert.equal(body.lists.length,210);
    assert.equal(calls.length,3);
  }finally{globalThis.fetch=original;}
});
test('collection route is restricted to fixed public origin and safe creator/slug',async()=>{
  const r=await getList({request:new Request('https://site.example/curated-list?creator=https:%2F%2F127.0.0.1&slug=evil')});
  assert.equal(r.status,400);
  const orig=globalThis.fetch;
  let actualUrl='';
  globalThis.fetch=async url=>{
    actualUrl=String(url);
    return Response.json([{id:'tt123',title:'The Good Movie',poster:'https://example.com/image.jpg',year:'2022',type:'movie'},
      {id:'a',title:'Porn Special',poster:'https://example.com/p.jpg'},
      {id:'b',title:'Another Film',poster:'https://example.com/p.jpg'}]);
  };
  try{
    const response=await getList({request:new Request('https://site.example/curated-list?creator=example&slug=mystery')});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.items.length,2);
    assert.equal(actualUrl,'https://mylistsaddon.com/lists/example/mystery.json');
  }finally{globalThis.fetch=orig;}
});
test('front end is directory-driven, searchable, paginated, and copies titles rather than playing',()=>{
  const content=fs.readFileSync(root+'js/curated-lists.js','utf8');
  const main=fs.readFileSync(root+'js/hot-list.js','utf8');
  assert.match(content,/fetch\('\/curated-directory'/);
  assert.match(content,/itemsVisible\(\)/);
  assert.match(content,/pageSize=18/);
  assert.match(content,/navigator\.clipboard\.writeText\(title\)/);
  assert.match(content,/window\.prompt/);
  assert.doesNotMatch(content,/QuickPlay\.open/);
  assert.doesNotMatch(content,/\{id:'horror',title/);
  assert.match(main,/ltCuratedContent/);
});
