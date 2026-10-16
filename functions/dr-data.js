/* Read-only Cloudflare adapter: drpyS T4 data -> LibreTV native DR page.
   No public arbitrary proxy: a fixed HTTPS backend and exact source allowlist.
   DR_BACKEND_URL, DR_API_PWD and DR_SOURCE_ALLOWLIST are secret/server env settings. */
const adult=/(?:色情|情色|成人|福利|无码|有码|麻豆|女优|女优|成人视频|AV资源|写真|伦理|激情|里番|黄(?:片|色)|私房|裸聊|18\+|porn|xxx|hentai|xvideos|sexvideo)/i;
const limit=(v,n=130)=>String(v==null?'':v).replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n);
const badName=x=>adult.test(String(x||''));
const DEFAULT_HEADERS={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>Response.json(data,{status,headers:DEFAULT_HEADERS});
function backend(env){
  const raw=String(env?.DR_BACKEND_URL||'').trim();
  if(!raw)return null;
  let url;try{url=new URL(raw);}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')return null;
  return url;
}
function allowlist(env){
  return new Set(String(env?.DR_SOURCE_ALLOWLIST||'').split(/[,;\n]/).map(s=>s.trim()).filter(Boolean));
}
function safeImage(v){
  try{const u=new URL(String(v||''));return u.protocol==='https:'&&u.username===''&&u.password===''&&u.href.length<1000?u.href:'';}catch{return''}
}
function cleanVideo(raw){
  const name=limit(raw?.vod_name,130);
  if(!name||badName([name,raw?.type_name,raw?.vod_remarks,raw?.vod_content].join(' ')))return null;
  return {id:limit(raw?.vod_id,240),title:name,poster:safeImage(raw?.vod_pic),remarks:limit(raw?.vod_remarks,85),type:limit(raw?.type_name,65),year:limit(raw?.vod_year,18)};
}
function cleanCategories(rows){
  return (Array.isArray(rows)?rows:[]).slice(0,120).map(row=>({id:limit(row?.type_id,100),name:limit(row?.type_name,55)})).filter(row=>row.id&&row.name&&!badName(row.name)).slice(0,50);
}
function responseData(raw){
  return {items:(Array.isArray(raw?.list)?raw.list:[]).slice(0,70).map(cleanVideo).filter(Boolean),categories:cleanCategories(raw?.class),page:Number.isInteger(Number(raw?.page))?Number(raw.page):1,more:(Number(raw?.pagecount)||0)>(Number(raw?.page)||1)};
}
function safeSites(raw,base,whitelist){
  const seen=new Set();
  return (Array.isArray(raw?.sites)?raw.sites:[]).filter(row=>{
    if(!whitelist.has(String(row?.key)))return false;
    if(Number(row?.type)!==4||row?.searchable===0)return false;
    if(badName([row?.name,row?.key].join(' ')))return false;
    return true;
  }).map(row=>{
    const key=limit(row.key,160),name=limit(row.name||row.key,85);
    if(!key||!name||seen.has(key))return null;
    let api;
    try{api=new URL(String(row.api||''),base);}catch{return null;}
    if(api.origin!==base.origin||!api.pathname.startsWith('/api/')||api.pathname.length>380)return null;
    if(api.username||api.password||api.hash)return null;
    seen.add(key);
    return {key,name,api:api.pathname,ext:typeof row.ext==='string'?row.ext.slice(0,450):'',do:limit(api.searchParams.get('do')||'',12)};
  }).filter(Boolean).slice(0,150);
}
async function loadJson(url,timeoutMs=9500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{signal:controller.signal,redirect:'error',headers:{Accept:'application/json'}});
    if(!r.ok)throw Error('upstream '+r.status);
    const bytes=Number(r.headers.get('content-length'));
    if(bytes>1200000)throw Error('upstream response too large');
    const txt=await r.text();
    if(txt.length>1200000)throw Error('upstream response too large');
    return JSON.parse(txt);
  }finally{clearTimeout(timer);}
}
async function remoteSources(base,env,whitelist){
  const url=new URL('/config/1',base);url.searchParams.set('sub','green');url.searchParams.set('healthy','1');
  if(env?.DR_API_PWD)url.searchParams.set('pwd',String(env.DR_API_PWD));
  const payload=await loadJson(url);
  return safeSites(payload,base,whitelist);
}
export {backend,safeSites,cleanVideo,cleanCategories,responseData,allowlist};
export async function onRequestGet({request,env}){
  const base=backend(env);
  const whitelist=allowlist(env);
  if(!base)return reply({error:'DR 后端尚未配置',code:'DR_NOT_CONFIGURED'},503);
  if(!whitelist.size)return reply({error:'DR 尚未设置审核通过的源名单',code:'DR_SOURCES_NOT_APPROVED'},503);
  const params=new URL(request.url).searchParams;
  const op=params.get('op')||'sources';
  if(!['sources','home','search','category','detail','play'].includes(op))return reply({error:'Invalid operation'},400);
  try{
    const sources=await remoteSources(base,env,whitelist);
    if(op==='sources')return reply({sources:sources.map(({key,name})=>({key,name})),count:sources.length});
    const source=sources.find(x=>x.key===params.get('source'));
    if(!source)return reply({error:'源未进入审核名单或不存在'},404);
    const upstream=new URL(source.api,base);
    if(source.do)upstream.searchParams.set('do',source.do);
    if(source.ext)upstream.searchParams.set('extend',source.ext);
    if(env?.DR_API_PWD)upstream.searchParams.set('pwd',String(env.DR_API_PWD));
    let page=Number(params.get('page')||1);
    if(!Number.isInteger(page)||page<1||page>40)return reply({error:'Invalid page'},400);
    if(op==='detail'){
      const id=limit(params.get('id')||'',240);
      if(!id)return reply({error:'Missing video ID'},400);
      upstream.searchParams.set('ac','detail');upstream.searchParams.set('ids',id);
      const detail=normalizeDetail(await loadJson(upstream));
      return detail?reply({source:{key:source.key,name:source.name},...detail}):reply({error:'内容不在允许范围或不可用'},404);
    }
    if(op==='play'){
      const id=limit(params.get('play')||'',1400);
      if(!id)return reply({error:'Missing play ID'},400);
      const flag=limit(params.get('flag')||'',100);
      upstream.searchParams.set('play',id);if(flag)upstream.searchParams.set('flag',flag);
      return reply(normalizePlayable(await loadJson(upstream),base,String(env?.DR_API_PWD||'')));
    }
    if(op==='search'){
      const wd=limit(params.get('q')||'',85);
      if(wd.length<1)return reply({error:'Missing search query'},400);
      upstream.searchParams.set('wd',wd);upstream.searchParams.set('pg',String(page));
    }else if(op==='category'){
      const cat=limit(params.get('cat')||'',100);
      if(!cat)return reply({error:'Missing category'},400);
      upstream.searchParams.set('ac','list');upstream.searchParams.set('t',cat);upstream.searchParams.set('pg',String(page));
    }
    const result=responseData(await loadJson(upstream));
    return reply({source:{key:source.key,name:source.name},...result});
  }catch{
    return reply({error:'DR 服务暂时无法返回数据',code:'DR_UPSTREAM_ERROR'},502);
  }
}

function normalizeDetail(payload){
  const row=Array.isArray(payload)?payload[0]:Array.isArray(payload?.list)?payload.list[0]:payload;
  const info=cleanVideo(row);
  if(!info)return null;
  const flags=String(row?.vod_play_from||'').split('$$$').map(s=>limit(s,100));
  const groups=String(row?.vod_play_url||'').split('$$$');
  const lines=groups.slice(0,18).map((group,index)=>{
    const episodes=group.split('#').slice(0,320).map((part,n)=>{
      const at=part.indexOf('$');
      return at>=0?{name:limit(part.slice(0,at),80)||String(n+1),id:limit(part.slice(at+1),1400)}:
        {name:String(n+1),id:limit(part,1400)};
    }).filter(ep=>ep.id);
    return {flag:flags[index]||'',name:flags[index]||('线路'+(index+1)),episodes};
  }).filter(line=>line.episodes.length);
  return {info,lines,description:limit(row?.vod_content,500)};
}
function normalizePlayable(payload,base,secret){
  let raw=payload?.url;
  if(Array.isArray(raw))raw=raw[0];
  if(typeof raw!=='string')return {status:'unsupported',reason:'DR 暂未返回直接视频地址'};
  if(Number(payload?.parse||0)!==0)return {status:'unsupported',reason:'该线路需要额外解析，当前不支持'};
  if(payload?.headers&&Object.keys(payload.headers).length)return {status:'unsupported',reason:'该线路需要专用请求头与媒体代理'};
  let url;try{url=new URL(raw);}catch{return {status:'unsupported',reason:'播放地址格式不正确'};}
  if(url.protocol!=='https:')return {status:'unsupported',reason:'该线路未提供 HTTPS 视频地址'};
  if(url.username||url.password||url.origin===base.origin||(secret&&raw.includes(secret)))
    return {status:'unsupported',reason:'该线路需要 DR 专用媒体代理'};
  if(!/\.(?:m3u8|mp4|webm|m4v|mov|ts)(?:$|[?#])/i.test(url.pathname+url.search))
    return {status:'unsupported',reason:'该线路返回的不是可识别的直接视频地址'};
  return {status:'ready',url:url.href,kind:/\.m3u8(?:$|[?#])/i.test(url.pathname+url.search)?'hls':'video'};
}
export {normalizeDetail,normalizePlayable};
