/* Dynamic directory of public, author-maintained My Lists collections.
 * Only public names/metadata, not video streams or user credentials.
 */
const ORIGIN='https://mylistsaddon.com';
const LIMIT=100;
const MAX_PAGES=12;
const TIMEOUT=10500;
const skipTitle=/^(airing next|watchlist|watched|watch history|continue watching)$/i;
const adult=/\b(?:porn|xxx|adult|sex|erotic|nsfw)\b|色情|情色|成人视频|无码|成人短片/i;
export function normalizeDirectoryPage(raw){
  if(!raw||!Array.isArray(raw.lists))throw Error('Invalid public directory');
  return {
    total:Number.isSafeInteger(raw.total)?raw.total:raw.lists.length,
    lists:raw.lists.map((x)=>{
      const name=String(x?.name||'').trim().slice(0,110);
      const creator=String(x?.creator||'').trim();
      const slug=String(x?.slug||'').trim();
      const itemCount=Number(x?.itemCount)||0;
      if(!name||!(/^[a-zA-Z0-9_\\-]{1,64}$/.test(creator))||!(/^[a-zA-Z0-9_\\-]{1,100}$/.test(slug))||itemCount<1||adult.test(name)||skipTitle.test(name))return null;
      return {name,creator,slug,itemCount,updatedAt:Number(x.updatedAt)||0,
        type:['movie','series','mixed'].includes(x.type)?x.type:'mixed'};
    }).filter(Boolean)
  };
}
async function readPage(offset){
  const url=ORIGIN+'/lists/public.json?sort=popular&offset='+offset;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),TIMEOUT);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('List directory unavailable');
    if(Number(response.headers.get('content-length'))>350000)throw Error('List page too large');
    return normalizeDirectoryPage(await response.json());
  }finally{clearTimeout(timeout);}
}
export function mergeDirectory(pages){
  const unique=new Map();
  for(const page of pages)for(const x of page.lists)unique.set(x.creator+'/'+x.slug,x);
  const lists=[...unique.values()].sort((a,b)=>{
    const generic=/^(shows|movies|all|imdb|my list|test|favorites?|favourites?)$/i;
    const sa=generic.test(a.name)?0:1,sb=generic.test(b.name)?0:1;
    return sb-sa||b.updatedAt-a.updatedAt||b.itemCount-a.itemCount;
  });
  return {totalPublished:Math.max(...pages.map(p=>p.total)),usableCount:lists.length,lists};
}
export async function onRequestGet(){
  try{
    const first=await readPage(0);
    const pages=[first];
    const count=Math.min(MAX_PAGES,Math.ceil(first.total/LIMIT));
    // External endpoint normally returns 100 per page, cap to at most 1,200 entries.
    const others=await Promise.allSettled(Array.from({length:count-1},(_,i)=>readPage((i+1)*LIMIT)));
    for(const result of others)if(result.status==='fulfilled')pages.push(result.value);
    if(pages.length<Math.max(1,Math.ceil(count*.6)))throw Error('Too many directory pages missing');
    const result=mergeDirectory(pages);
    if(!result.lists.length)throw Error('No public collections found');
    return Response.json({...result,pagesRead:pages.length,pagesExpected:count,source:'My Lists community'},
      {headers:{'Cache-Control':'public, max-age=1200, stale-while-revalidate=3600'}});
  }catch{
    return Response.json({error:'公开片单目录暂时不可用'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
