/* Portability adapter for LibreSpark/LibreTV's 60s-backed hot-list categories.
 * The upstream project documents six boards: https://github.com/LibreSpark/LibreTV/wiki/Recommendations
 * 60s API is provided by https://github.com/vikiboss/60s.
 * No playback server here: clicking a chart item uses existing LibreTV QuickPlay.
 */
const PATHS=Object.freeze({
  douban_movie_weekly:'/v2/douban/weekly/movie',
  douban_tv_chinese:'/v2/douban/weekly/tv_chinese',
  douban_tv_global:'/v2/douban/weekly/tv_global',
  douban_show_chinese:'/v2/douban/weekly/show_chinese',
  douban_show_global:'/v2/douban/weekly/show_global',
  baidu_teleplay:'/v2/baidu/teleplay'
});
const BASES=['https://60s.crystelf.top','https://60s.viki.moe'];
export function normalizeHotList(data,id){
  if(!data||!Array.isArray(data.data))throw Error('榜单上游返回内容异常');
  const items=data.data.slice(0,40).map((row,i)=>{
    const title=String(row?.title||'').trim().slice(0,140);
    const cover=String(row?.cover||row?.cover_proxy||'').trim();
    if(!title||!/^https:\/\//.test(cover))return null;
    const rating=Number(row.rating)||0;
    const subtitle=String(row.card_subtitle||'').slice(0,180);
    const year=/\b(?:19|20)\d{2}\b/.exec(subtitle)?.[0]||'';
    return {
      id:String(row.id||id+'_'+i),title,cover,
      rank:Number.isInteger(Number(row.rank))&&Number(row.rank)>0?Number(row.rank):i+1,
      rating:rating>0&&rating<=10?rating:null,
      year,subtitle,
      kind:id==='douban_movie_weekly'?'movie':'tv',
      chart:id
    };
  }).filter(Boolean);
  if(!items.length)throw Error('榜单暂时无可展示影片');
  return items;
}
async function fetchBoard(path){
  let last;
  for(const base of BASES){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),7500);
    try{
      const res=await fetch(base+path,{signal:controller.signal,headers:{Accept:'application/json'}});
      if(!res.ok)throw Error('上游 HTTP '+res.status);
      return await res.json();
    }catch(err){last=err;}
    finally{clearTimeout(timer);}
  }
  throw last||Error('上游暂时不可用');
}
export async function onRequestGet({request}){
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!Object.hasOwn(PATHS,id))return Response.json({error:'不支持该榜单'},{status:400});
  try{
    const data=await fetchBoard(PATHS[id]);
    const items=normalizeHotList(data,id);
    return Response.json({id,items,source:id.startsWith('douban_')?'豆瓣周榜':'百度热播榜',
      attribution:'60s API / LibreTV 官方榜单数据流程'},{
      headers:{'Cache-Control':'public, max-age=1800, stale-while-revalidate=3600'}
    });
  }catch(e){
    return Response.json({error:'榜单暂时不可用，请稍后重试'},{status:502,
      headers:{'Cache-Control':'no-store'}});
  }
}
