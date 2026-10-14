/* Bounded poster-only fetch for Douban's image Referer restriction (HTTP 418).
 * Never allows arbitrary hostnames, other file types, redirects or video streams.
 */
const HOST=/^img\d+\.doubanio\.com$/i;
const PHOTO=/^\/view\/photo\/(?:m_ratio_poster|l_ratio_poster|s_ratio_poster|photo|raw)\/public\/p\d+\.(?:jpg|jpeg|png|webp)$/i;
const MAX_BYTES=1600000;
export function normalizePosterUrl(raw){
  let url;
  try{url=new URL(String(raw||''));}catch{return null;}
  if(url.protocol!=='https:'||!HOST.test(url.hostname)||!PHOTO.test(url.pathname)||url.username||url.password)return null;
  url.search='';url.hash='';
  return url.href;
}
export async function onRequestGet({request}){
  const value=new URL(request.url).searchParams.get('url');
  const source=normalizePosterUrl(value);
  if(!source)return Response.json({error:'Invalid poster URL'},{status:400});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9500);
  try{
    const r=await fetch(source,{signal:controller.signal,redirect:'manual',headers:{
      'Referer':'https://movie.douban.com/','Accept':'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.8',
      'User-Agent':'Mozilla/5.0 (compatible; LibreTVPoster/1.0)'
    }});
    if(!r.ok||r.status>=300)return Response.json({error:'Poster source rejected request'},{status:502});
    const mime=(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!['image/jpeg','image/png','image/webp'].includes(mime))return Response.json({error:'Not a supported image'},{status:502});
    if(Number(r.headers.get('content-length'))>MAX_BYTES)return Response.json({error:'Poster exceeds size limit'},{status:413});
    const reader=r.body?.getReader();
    if(!reader)throw Error('No poster body');
    const chunks=[];
    let size=0;
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_BYTES){await reader.cancel();return Response.json({error:'Poster exceeds size limit'},{status:413});}
      chunks.push(value);
    }
    const data=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
    return new Response(data,{headers:{'Content-Type':mime,
      'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options':'nosniff'}});
  }catch{return Response.json({error:'Poster temporarily unavailable'},{status:503});}
  finally{clearTimeout(timeout);}
}
