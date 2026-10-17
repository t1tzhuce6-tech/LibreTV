/* Runtime import of static, prevalidated directory feed; no Worker fetches. */
(function(root){
'use strict';
const data=root.LibreAutoSourcesData;
function key(raw){
 try{const u=new URL(String(raw||'').trim());if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;
 return u.origin.toLowerCase()+u.pathname.replace(/\/+$/,'')+u.search;
 }catch{return null}
}
function apply(feed=data){
 const all=feed?.entries;if(feed?.schema!==1||!Array.isArray(all))return {imported:0,error:'feed_missing'};
 const used=new Set();
 for(const source of Object.values(root.API_SITES||{})){const k=key(source?.api||source?.url);if(k)used.add(k)}
 try{
  const custom=JSON.parse(root.localStorage?.getItem('customAPIs')||'[]');
  if(Array.isArray(custom))for(const source of custom){const k=key(source?.api||source?.url);if(k)used.add(k)}
 }catch{}
 let imported=0,duplicates=0,blocked=0;
 const additions={};
 for(const entry of all){
  if(!entry||!/^auto_[a-f0-9]{14}$/.test(entry.id)||typeof entry.name!=='string'||entry.name.length>75){blocked++;continue}
  const api=String(entry.api||'').trim(),k=key(api);
  if(!k||!api.startsWith('https://')||!/^https:\/\/[^/?#]+\/api\.php\/provide\/vod\/?$/i.test(api)){blocked++;continue}
  const info={api,name:entry.name,origin:'auto',directory:'ziyuanzu/top',uptime:entry.uptime,responseTime:entry.responseTime,totalResources:entry.totalResources};
  if(root.LibreContentPolicy?.isAdultSource?.(info)){blocked++;continue}
  if(used.has(k)){duplicates++;continue}
  used.add(k);additions[entry.id]=info;imported++;
 }
 if(typeof root.extendAPISites==='function')root.extendAPISites(additions);
 root.LibreAutoSourceRegistry={stats:{imported,duplicates,blocked,total:all.length},key,kind(id){return (root.API_SITES?.[id]?.origin==='auto'?'auto':id?.startsWith?.('custom_')?'manual':'local')}, label(id){const name=id?.startsWith?.('custom_')?root.getCustomApiInfo?.(id.slice(7))?.name:root.API_SITES?.[id]?.name;return '['+(this.kind(id)==='auto'?'自动接入':'本地源')+'] '+(name||id)}};
 return root.LibreAutoSourceRegistry.stats;
}
const result=apply();root.LibreAutoSourceStats=result;
})(typeof window!=='undefined'?window:globalThis);
