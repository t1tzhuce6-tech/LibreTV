import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,CATEGORIES,COLUMNS} from '../functions/cctv-vod.js';
const run=async(q)=>onRequestGet({request:new Request('https://libretv.test/cctv-vod?'+q)});
test('one CCTV source exposes documentary, TV, animation and columns',async()=>{
 const response=await run('op=categories'),j=await response.json();
 assert.equal(response.status,200);assert.equal(j.source,'cctv');
 assert.equal(Object.keys(CATEGORIES).length,4);assert.equal(Object.keys(COLUMNS).length,6);
 assert.equal(j.categories.find(x=>x.id==='documentary').name,'纪录片');
});
test('rejects unknown operations, categories, unsafe IDs and pages before fetching',async()=>{
 assert.equal((await run('op=other')).status,400);
 assert.equal((await run('op=list&cat=unknown')).status,400);
 assert.equal((await run('op=detail&id=https://malicious.example/path')).status,400);
 assert.equal((await run('op=list&page=999999')).status,400);
 assert.equal((await run('op=column&column=unknown')).status,400);
});
