import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {normalizePosterUrl,onRequestGet} from '../functions/poster-image.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const source='https://img3.doubanio.com/view/photo/m_ratio_poster/public/p2935294362.jpg';
test('only Douban static film posters are eligible for image relay',()=>{
  assert.equal(normalizePosterUrl(source),source);
  for(const invalid of [
    'https://www.google.com/view/photo/m_ratio_poster/public/p2935294362.jpg',
    'http://img3.doubanio.com/view/photo/m_ratio_poster/public/p2935294362.jpg',
    'https://img3.doubanio.com/admin/secrets.jpg',
    'https://img3.doubanio.com/view/photo/m_ratio_poster/public/p2935294362.mp4',
    'https://img3.doubanio.com.evil.com/view/photo/m_ratio_poster/public/p2935294362.jpg'
  ])assert.equal(normalizePosterUrl(invalid),null);
});
test('image function adds Douban Referer and returns actual JPEG bytes',async()=>{
  const original=globalThis.fetch;
  let options=null;
  globalThis.fetch=async (_url,opt)=>{
    options=opt;
    return new Response(new Uint8Array([255,216,255,224,1,2,255,217]),{status:200,
      headers:{'content-type':'image/jpeg','content-length':'8'}});
  };
  try{
    const res=await onRequestGet({request:new Request('https://test.example/poster-image?url='+encodeURIComponent(source))});
    assert.equal(res.status,200);
    assert.equal(res.headers.get('content-type'),'image/jpeg');
    assert.equal(res.headers.get('x-content-type-options'),'nosniff');
    assert.match(res.headers.get('cache-control'),/max-age=86400/);
    assert.equal(options.headers.Referer,'https://movie.douban.com/');
    assert.equal((await res.arrayBuffer()).byteLength,8);
  }finally{globalThis.fetch=original;}
});
test('rejects rejected, redirect, nonimage and over-limit upstream responses',async()=>{
  const original=globalThis.fetch;
  const input={request:new Request('https://test.example/poster-image?url='+encodeURIComponent(source))};
  try{
    for(const response of [
      new Response('blocked',{status:418,headers:{'content-type':'image/jpeg'}}),
      new Response(null,{status:302,headers:{Location:'https://evil.example/'}}),
      new Response('<html/>',{status:200,headers:{'content-type':'text/html'}}),
      new Response('too large',{status:200,headers:{'content-type':'image/jpeg','content-length':'2000000'}})
    ]){
      globalThis.fetch=async()=>response.clone();
      const res=await onRequestGet(input);
      assert.ok(res.status>=400);
    }
    assert.equal((await onRequestGet({request:new Request('https://test.example/poster-image?url=https://evil.invalid/a.jpg')})).status,400);
  }finally{globalThis.fetch=original;}
});
test('hot-list poster cards use the restricted same-origin relay, and cached PWA JS is refreshed',()=>{
  const js=fs.readFileSync(root+'js/hot-list.js','utf8');
  const html=fs.readFileSync(root+'index.html','utf8');
  const worker=fs.readFileSync(root+'service-worker.js','utf8');
  assert.match(js,/return '\/poster-image\?url='\+encodeURIComponent\(normalized\)/);
  assert.match(js,/image.src=posterUrl\(item.cover\)/);
  assert.match(html,/js\/hot-list\.js\?v=20261016dual1/);
  assert.match(worker,/20261017-clean-home-v1/);
});
