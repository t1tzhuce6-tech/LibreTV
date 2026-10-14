import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CHANNELS,normalizeRank,onRequestGet} from '../functions/iqiyi-rank.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const site=fs.readFileSync(root+'js/iqiyi-ranks.js','utf8');
const host=fs.readFileSync(root+'js/hot-list.js','utf8');
test('official channels include film, TV, animation, documentary and more',()=>{
  assert.ok(Object.keys(CHANNELS).length>=11);
  for(const channel of ['-1','1','2','4','3','6','35','10010','15']){
    assert.ok(CHANNELS[channel]);
  }
});
test('rank data retains official heat, cover and true page order',()=>{
  const payload={code:0,data:{items:[{contents:[
    {id:'123',title:'国产悬疑剧',img:'https://pic8.iqiyipic.com/image/1/p.jpg',mainIndex:'6927',tags:'电视剧 / 2026',promptDesc:'精彩'},
    {id:'124',title:'测试色情片',img:'https://pic8.iqiyipic.com/image/2/p.jpg',mainIndex:'123'}
  ]}]}};
  const result=normalizeRank(payload,'2',3);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].rank,51);
  assert.equal(result.items[0].heat,6927);
  assert.equal(result.items[0].kind,'tv');
  assert.match(result.items[0].cover,/^https:\/\/pic8\.iqiyipic\.com/);
  assert.equal(result.more,false);
});
test('server allows only fixed categories and page ranges',async()=>{
  for(const url of [
    'https://site.example/iqiyi-rank?channel=9999&page=1',
    'https://site.example/iqiyi-rank?channel=-1&page=0',
    'https://site.example/iqiyi-rank?channel=1&page=100'
  ]){
    assert.equal((await onRequestGet({request:new Request(url)})).status,400);
  }
});
test('fetches real iQIYI structured data from bounded upstream, not HTML scraping',async()=>{
  const original=globalThis.fetch;let upstream='';
  globalThis.fetch=async url=>{
    upstream=String(url);
    return Response.json({code:0,data:{items:[{contents:Array.from({length:25},(_,i)=>({
      id:String(i+1),title:'电视电影'+(i+1),
      img:'https://pic7.iqiyipic.com/image/'+i+'/a.jpg',mainIndex:'3600',tags:'电影 / 2026'
    }))}]}});
  };
  try{
    const res=await onRequestGet({request:new Request('https://site.example/iqiyi-rank?channel=1&page=2')});
    assert.equal(res.status,200);
    const payload=await res.json();
    assert.equal(payload.items.length,25);
    assert.equal(payload.items[0].rank,26);
    assert.equal(payload.items[24].rank,50);
    assert.equal(payload.more,true);
    assert.match(upstream,/mesh\.if\.iqiyi\.com/);
    assert.match(upstream,/category_id=1/);
    assert.match(upstream,/pg_num=2/);
  }finally{globalThis.fetch=original;}
});
test('front end isolates own rankings, appends and reuses QuickPlay',()=>{
  assert.match(site,/window\.QuickPlay\.open\(/);
  assert.match(site,/ltIqiMore/);
  assert.match(site,/IntersectionObserver/);
  assert.match(site,/ids\.has\(item\.id\)/);
  assert.match(site,/channel=id/);
  assert.match(site,/ltIqiCards/);
  assert.match(host,/ltIqiContent/);
  assert.match(host,/mode==='iqiyi'/);
  const html=fs.readFileSync(root+'index.html','utf8');
  assert.ok(html.indexOf('js/iqiyi-ranks.js')<html.indexOf('js/hot-list.js'));
  assert.match(html,/css\/iqiyi-ranks\.css/);
});
