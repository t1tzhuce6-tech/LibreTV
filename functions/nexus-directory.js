/* Chinese editorial lists from public Nexus Schema.org CollectionPage.
 * Read only published titles, slugs and counts. No site-private APIs.
 */
const HOST='https://nexusfilmx.com';
const blocked=/^(?:douban-genre-erotic|douban-genre-horror|douban-genre-thriller)$/;
export function extractLd(html,type){
  if(typeof html!=='string')throw Error('Invalid HTML');
  const regex=/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for(const match of html.matchAll(regex)){
    try{const item=JSON.parse(match[1]);if(item['@type']===type)return item;}catch{}
  }
  throw Error('Schema.org '+type+' unavailable');
}
export function normalizeDirectory(html){
  const schema=extractLd(html,'CollectionPage');
  const names=schema.hasPart?.itemListElement||[];
  const urls=[...html.matchAll(/href=["']\/rankings\/([a-z0-9-]{3,90})["']/g)]
    .map(x=>x[1]);
  const slugs=[...new Set(urls)];
  if(slugs.length!==names.length||slugs.length<10)throw Error('Topic directory mismatch');
  const lists=slugs.map((slug,i)=>({
    slug,title:String(names[i]?.name||'').trim().slice(0,95)
  })).filter(x=>x.title&&!blocked.test(x.slug)&&
    !/(?:色情|情色|成人影片|恐怖片)/.test(x.title));
  return {source:'Nexus 中文影视精选',totalPublished:slugs.length,
    items:lists,updatedAt:new Date().toISOString()};
}
export async function readNexus(path){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),14000);
  try{
    const r=await fetch(HOST+path,{signal:controller.signal,
      headers:{Accept:'text/html'}});
    if(!r.ok||Number(r.headers.get('content-length'))>2200000)
      throw Error('Nexus upstream unavailable');
    const html=await r.text();
    if(html.length>2200000)throw Error('Nexus HTML too large');
    return html;
  }finally{clearTimeout(timeout);}
}
export async function onRequestGet(){
  try{
    const data=normalizeDirectory(await readNexus('/rankings'));
    return Response.json(data,{headers:{
      'Cache-Control':'public, max-age=1800, stale-while-revalidate=7200'
    }});
  }catch{
    return Response.json({error:'中文专题目录暂不可用'},{status:502,
      headers:{'Cache-Control':'no-store'}});
  }
}
