// Read-only adapter for published My Lists community collections.
// These lists contain movie metadata only. LibreTV video/search APIs are unaffected.
export const CURATED=Object.freeze({
  scifi:{title:'科幻与悬疑剧',author:'13dot09',url:'https://mylistsaddon.com/lists/13dot09/13dot09-sci-fi-mystery.json'},
  comedy:{title:'喜剧、情景喜剧与剧情',author:'13dot09',url:'https://mylistsaddon.com/lists/13dot09/13dot09-comedy-sitcom-drama.json'},
  a24:{title:'A24 电影专题',author:'bdubz',url:'https://mylistsaddon.com/lists/bdubz/a24.json'},
  bond:{title:'007 詹姆斯·邦德电影合集',author:'kokkedorus',url:'https://mylistsaddon.com/lists/kokkedorus/james-bond.json'},
  horror:{title:'恐怖片入门精选',author:'stream4me',url:'https://mylistsaddon.com/lists/stream4me/horror-essentials-gateway-horror.json'}
});
export function normalizeCollection(raw, id){
  if(!Array.isArray(raw))throw Error('Invalid public list payload');
  return raw.slice(0,95).map((row,i)=>({
    id:String(row?.id||id+'_'+i).slice(0,90),
    title:String(row?.title||row?.name||'').trim().slice(0,140),
    year:String(row?.year||'').trim().slice(0,8),
    cover:/^https:\/\//i.test(row?.poster||'')?String(row.poster).slice(0,550):'',
    kind:row?.type==='series'?'tv':'movie',
    rank:i+1
  })).filter(row=>row.title);
}
export async function onRequestGet({request}){
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!Object.hasOwn(CURATED,id))return Response.json({error:'Unknown collection'},{status:400});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10500);
  try{
    const res=await fetch(CURATED[id].url,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!res.ok)throw Error('Upstream failed');
    if(Number(res.headers.get('content-length'))>300000)throw Error('Collection too large');
    const body=await res.text();
    if(body.length>300000)throw Error('Collection too large');
    const items=normalizeCollection(JSON.parse(body),id);
    if(items.length<3)throw Error('No usable items');
    return Response.json({id,title:CURATED[id].title,author:CURATED[id].author,
      source:'My Lists community',sourceUrl:CURATED[id].url.replace(/\.json$/,''),items},
      {headers:{'Cache-Control':'public, max-age=1800, stale-while-revalidate=7200'}});
  }catch{
    return Response.json({error:'Collection temporarily unavailable'},{status:502,headers:{'Cache-Control':'no-store'}});
  }finally{clearTimeout(timer);}
}
