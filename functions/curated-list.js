/* Generic public My Lists collection reader. No Stremio runtime, no credentials. */
const HOST='https://mylistsaddon.com';
const goodPart=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
const blocked=/\b(?:porn|xxx|adult|erotic|nsfw)\b|色情|情色|成人短片|无码视频/i;
export function normalizeCollection(raw){
  if(!Array.isArray(raw))throw Error('Invalid public collection');
  return raw.slice(0,250).map((x,i)=>{
    const title=String(x?.title||x?.name||'').trim().slice(0,170);
    if(!title||blocked.test(title))return null;
    return {id:String(x?.id||i).slice(0,90),title,
      year:String(x.year||'').trim().slice(0,8),
      cover:/^https:\/\//.test(x.poster||'')?String(x.poster).slice(0,550):'',
      kind:x.type==='series'?'tv':'movie',rank:i+1};
  }).filter(Boolean);
}
export async function onRequestGet({request}){
  const params=new URL(request.url).searchParams;
  const creator=params.get('creator'),slug=params.get('slug');
  if(!goodPart(creator)||!goodPart(slug))return Response.json({error:'Invalid public collection ID'},{status:400});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),11000);
  try{
    const res=await fetch(HOST+'/lists/'+encodeURIComponent(creator)+'/'+encodeURIComponent(slug)+'.json',
      {signal:controller.signal,headers:{Accept:'application/json'}});
    if(!res.ok)throw Error('Source unavailable');
    if(Number(res.headers.get('content-length'))>1200000)throw Error('Collection too large');
    const s=await res.text();
    if(s.length>1200000)throw Error('Collection too large');
    const items=normalizeCollection(JSON.parse(s));
    if(!items.length)throw Error('Empty collection');
    return Response.json({creator,slug,sourceUrl:HOST+'/lists/'+creator+'/'+slug,
      items,source:'My Lists community'},
      {headers:{'Cache-Control':'public, max-age=1200, stale-while-revalidate=3600'}});
  }catch{
    return Response.json({error:'片单暂时无法获取'},{status:502,headers:{'Cache-Control':'no-store'}});
  }finally{clearTimeout(timer);}
}
