/* Read-only adapter for the real paginated iQIYI Fengyun ranking API.
 * Fixed upstream host, fixed category whitelist, no video or user data proxied.
 * Pagination observed through the official website's network traffic.
 */
export const CHANNELS=Object.freeze({
  '-1':'总榜','2':'电视剧','10010':'中剧','35':'短剧','1':'电影',
  '6':'综艺','4':'动漫','15':'少儿','37':'漫剧','3':'纪录片',
  '912':'知识','17':'体育'
});
const API='https://mesh.if.iqiyi.com/portal/pcw/rankList/comSecRankList';
const POSTER=/^https:\/\/pic\d+\.iqiyipic\.com\/image\//i;
const adult=/(?:色情|情色|成人短片|无码|麻豆|AV女优|\bporn\b|\bxxx\b)/i;
export function normalizeRank(raw,channel,page){
  if(!raw||Number(raw.code)!==0)throw Error('Upstream ranking error');
  const group=raw.data?.items?.[0];
  if(!group||!Array.isArray(group.contents))throw Error('Invalid ranking payload');
  const entries=group.contents.slice(0,25);
  const items=entries.map((item,index)=>{
    const title=String(item?.title||'').trim().slice(0,130);
    if(!title||adult.test(title))return null;
    const cover=String(item.img||'');
    const meta=String(item.tags||'').slice(0,180);
    return {id:String(item.id||channel+'-'+page+'-'+index).slice(0,100),
      title,cover:POSTER.test(cover)?cover:'',rank:(page-1)*25+index+1,
      heat:Number(item.mainIndex)||null,subtitle:String(item.promptDesc||meta).slice(0,120),
      details:meta,description:String(item.desc||'').slice(0,500),
      kind:/电影/.test(meta)||channel==='1'?'movie':'tv'};
  }).filter(Boolean);
  return {items,more:entries.length===25,channel,page,source:'爱奇艺风云榜（实时热度）'};
}
export async function onRequestGet({request}){
  const query=new URL(request.url).searchParams;
  const channel=query.get('channel')||'-1';
  const page=Number(query.get('page')||1);
  if(!Object.hasOwn(CHANNELS,channel)||!Number.isInteger(page)||page<1||page>40)
    return Response.json({error:'无效榜单或页码'},{status:400});
  const upstream=new URL(API);
  upstream.searchParams.set('category_id',channel);
  upstream.searchParams.set('tag','0'); // Only the confirmed hot-ranking subtype.
  upstream.searchParams.set('pg_num',String(page));
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(upstream,{signal:controller.signal,
      headers:{Accept:'application/json'}});
    if(!response.ok||Number(response.headers.get('content-length'))>800000)
      throw Error('Unavailable upstream ranking');
    const raw=await response.text();
    if(raw.length>800000)throw Error('Ranking too large');
    const data=normalizeRank(JSON.parse(raw),channel,page);
    return Response.json(data,{headers:{
      'Cache-Control':'public, max-age=600, stale-while-revalidate=1800'
    }});
  }catch{
    return Response.json({error:'爱奇艺榜单暂时不可用'},{status:502,
      headers:{'Cache-Control':'no-store'}});
  }finally{clearTimeout(timeout);}
}
