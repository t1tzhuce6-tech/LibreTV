// A fixed, read-only adapter for a maintainer-updated TVBox health subscription.
// Only the configuration JSON passes through Cloudflare; media is never fetched here.
const UPSTREAM='https://raw.githubusercontent.com/hebijunge/tvbox-config/main/exports/healthy.json';
const allowed=/\/(?:api\.php\/)?provide\/vod\/?$/i;
const blockedAdultNames=/(?:色情|成人|情色|三级|福利|麻豆|杏吧|蝙蝠|桃花|色逼|极品|av资源|成人资源|18\+|porn|xxx|explicit|\bsex\b|\badult\b|ckzy|jkun|^155\s*(?:\||资源))/i;
const blockedAdultHosts=new Set([
  'www.ckzy1.com','ckzy.me','jkunzyapi.com','api.bwzyz.com','155api.com',
  'hsckzy.vip','yutuzy10.com','siwazyw.tv','xingba222.com','jipinvip.com',
  'thzy1.me','api.11bat.com','apilsbzy1.com'
]);
export function isAdultManagedSource(name,api){
  if(blockedAdultNames.test(String(name||'')))return true;
  try{return blockedAdultHosts.has(new URL(api).hostname.toLowerCase());}
  catch{return true;}
}
function normalizeApi(raw){
  if(typeof raw!=='string'||raw.length>600)return null;
  let url;try{url=new URL(raw.trim());}catch{return null;}
  if(!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password)return null;
  if(!allowed.test(url.pathname))return null;
  // Some TVBox configurations have a fixed ?ac=list / ?ac=detail; LibreTV appends its own operation.
  url.search='';url.hash='';
  return url.toString();
}
function idFor(url){
  let n=2166136261;
  for(let i=0;i<url.length;i++){n^=url.charCodeAt(i);n=Math.imul(n,16777619);}
  return 'managed_'+(n>>>0).toString(36);
}
export function convertHealthyFeed(feed){
  const seen=new Set(),sources=[];
  for(const row of Array.isArray(feed?.sites)?feed.sites:[]){
    if(Number(row?.type)!==1)continue;
    const api=normalizeApi(row.api);if(!api||seen.has(api))continue;
    seen.add(api);
    const name=String(row.name||row.key||'未命名源').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,65);
    if(isAdultManagedSource(name,api))continue;
    sources.push({id:idFor(api),name:name||'未命名源',api,searchable:row.searchable!==0});
    if(sources.length>=300)break;
  }
  return {provider:'hebijunge/tvbox-config',updated_at:String(feed?.updated_at||''),sources};
}
export async function onRequestGet(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(UPSTREAM,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!r.ok)return Response.json({error:'Upstream not available'},{status:502});
    if(Number(r.headers.get('content-length'))>1200000)return Response.json({error:'Subscription too large'},{status:502});
    const raw=await r.text();
    if(raw.length>1200000)return Response.json({error:'Subscription too large'},{status:502});
    const body=convertHealthyFeed(JSON.parse(raw));
    if(!body.sources.length)throw new Error('No supported MacCMS sources');
    return Response.json(body,{headers:{'Cache-Control':'public, max-age=900, stale-while-revalidate=3600'}});
  }catch{
    return Response.json({error:'Subscription temporarily unavailable'},{status:503});
  }finally{clearTimeout(timer);}
}
