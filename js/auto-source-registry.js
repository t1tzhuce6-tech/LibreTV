/* Loads a non-executable, vetted static directory snapshot before app initialization. */
(function(root){
'use strict';
const data=root.LibreAutoSourcesData;
function key(raw){
 try{const u=new URL(String(raw||'').trim());if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;
 return u.origin.toLowerCase()+u.pathname.replace(/\/+$/,'')+u.search;
 }catch{return null}
}
function apply(feed=data){
 const all=feed?.entries;
 if(feed?.schema!==1||!Array.isArray(all))return {imported:0,error:'feed_missing'};
 const used=new Set();
 for(const source of Object.values(root.API_SITES||{})){const k=key(source?.api||source?.url);if(k)used.add(k)}
 try{
  const custom=JSON.parse(root.localStorage?.getItem('customAPIs')||'[]');
  if(Array.isArray(custom))for(const source of custom){const k=key(source?.api||source?.url);if(k)used.add(k)}
 }catch{}
 let imported=0,duplicates=0,blocked=0,ready=0,review=0;
 const additions={};
 for(const entry of all){
  if(!entry||!/^auto_[a-f0-9]{14}$/.test(entry.id)||typeof entry.name!=='string'||entry.name.length>75){blocked++;continue}
  const api=String(entry.api||'').trim(),k=key(api);
  let host='';try{host=new URL(api).hostname.toLowerCase()}catch{}
  const safeHost=!!host&&host!=='localhost'&&!host.endsWith('.localhost')&&!host.endsWith('.local')&&!host.endsWith('.internal')&&!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  const isValid=!!k&&safeHost&&/^https?:\/\/[^/?#]+\/(?:api\.php\/provide\/vod|provide\/vod|inc\/api\.php|api\.php|api\/json\.php)\/?$/i.test(api);
  if(!isValid){blocked++;continue}
  const mode=entry.mode==='review'?'review':'ready';
  const allowedSearch=mode==='ready'&&api.startsWith('https://');
  const info={api,name:entry.name,origin:'auto',directory:'ziyuanzu/top',directoryStatus:entry.status||'unknown',
    searchable:allowedSearch,mode,reason:entry.reason||'',uptime:entry.uptime,responseTime:entry.responseTime,totalResources:entry.totalResources};
  if(root.LibreContentPolicy?.isAdultSource?.(info)){blocked++;continue}
  if(used.has(k)){duplicates++;continue}
  used.add(k);additions[entry.id]=info;imported++;if(allowedSearch)ready++;else review++;
 }
 if(typeof root.extendAPISites==='function')root.extendAPISites(additions);
 const catalogIds=()=>{
  const active=root.LibreContentPolicy?.safeSourceIds?.(true)||[];
  const usedKeys=new Set(active.map(id=>{const info=id.startsWith('custom_')?root.getCustomApiInfo?.(id.slice(7)):root.API_SITES?.[id];return key(info?.api||info?.url)}).filter(Boolean));
  const pending=[];
  for(const [id,info] of Object.entries(root.API_SITES||{})){
   if(info.origin!=='auto'||info.searchable!==false||root.LibreContentPolicy?.isAdultSource?.(info))continue;
   const u=key(info.api);if(!u||usedKeys.has(u))continue;
   usedKeys.add(u);pending.push(id);
  }
  return [...active,...pending];
 };
 root.LibreAutoSourceRegistry={stats:{imported,duplicates,blocked,ready,review,total:all.length},key,catalogIds,
  kind(id){return root.API_SITES?.[id]?.origin==='auto'?'auto':id?.startsWith?.('custom_')?'manual':'local'},
  label(id){
   const name=id?.startsWith?.('custom_')?root.getCustomApiInfo?.(id.slice(7))?.name:root.API_SITES?.[id]?.name;
   const type=this.kind(id);
   const tag=type==='auto'?(root.API_SITES?.[id]?.searchable===false?'自动接入·待验证':'自动接入'):'本地源';
   return '['+tag+'] '+(name||id);
  }
 };
 return root.LibreAutoSourceRegistry.stats;
}
root.LibreAutoSourceStats=apply();
})(typeof window!=='undefined'?window:globalThis);
