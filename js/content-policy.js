/* One content filtering policy shared by search, rankings and source library. */
(function(root){
  'use strict';
  const blockedSource=/(?:色情|成人|情色|三级|福利|麻豆|杏吧|蝙蝠|桃花|色逼|极品|av资源|成人资源|18\+|porn|xxx|explicit|\bsex\b|\badult\b)/i;
  const blockedCategory=/(?:色情|成人|情色|伦理(?:片|电影)?|福利|写真|无码|有码|激情|三级片|肉番|\bav\b|porn|xxx|18\+)/i;
  const blockedTitle=/(?:色情|成人短片|无码|有码|激情|av女(?:优|優)|成人影片|成人视频|三级(?:片|电影)|自慰|强奸|乱伦|成人视频|porn|xxx)/i;
  const knownAdultHosts=new Set([
    'www.ckzy1.com','ckzy.me','jkunzyapi.com','api.bwzyz.com','155api.com',
    'hsckzy.vip','yutuzy10.com','siwazyw.tv','xingba222.com','jipinvip.com',
    'thzy1.me','api.11bat.com','apilsbzy1.com',
    'heiliaozyapi.com','www.heiliaozyapi.com','api.ddapi.cc','api.heiapi.cc',
    'www.jingpinx.com','jingpinx.com','naixxzy.com','apilj.com','shayuapi.com','fqzy.me'
  ]);
  const knownAdultAliases=/(?:ckzy|jkun|^155\s*(?:\||资源))/i;
  function isAdultSource(info){
    if(info?.adult||info?.isAdult)return true;
    const name=String(info?.name||info?.source_name||'').trim();
    if(blockedSource.test(name)||knownAdultAliases.test(name))return true;
    try{
      return knownAdultHosts.has(new URL(String(info?.api||info?.url||'')).hostname.toLowerCase());
    }catch{return false;}
  }
  function isAdultCategory(name){return blockedCategory.test(String(name||''));}
  function isAdultVideo(item){
    if(isAdultSource(item))return true;
    return isAdultCategory(item?.type_name)||isAdultCategory(item?.vod_class)
      ||[item?.vod_name,item?.title,item?.name,item?.vod_remarks,item?.vod_sub].some(v=>blockedTitle.test(String(v||'')));
  }
  function filterVideos(items){
    return (Array.isArray(items)?items:[]).filter(item=>!isAdultVideo(item));
  }
  // The viewer requested an always-on content filter (including historical local preferences).
  try{root.localStorage?.setItem('yellowFilterEnabled','true');}catch{}
  // Playback uses every registered safe source, regardless of checkbox state.
  // User checkboxes still set search priority and remain user configurable.
  function safeSourceIds(includeAvailable=false){
    let selected=[],custom=[];
    try{
      const raw=root.localStorage?.getItem('selectedAPIs');
      const stored=raw==null?(root.DEFAULT_SELECTED_APIS||[]):JSON.parse(raw);
      if(Array.isArray(stored))selected=stored;
    }catch{}
    if(includeAvailable){
      try{
        const stored=JSON.parse(root.localStorage?.getItem('customAPIs')||'[]');
        if(Array.isArray(stored))custom=stored.map((_,i)=>'custom_'+i);
      }catch{}
    }
    const registered=includeAvailable?Object.keys(root.API_SITES||{}):[];
    // Manual URLs take precedence over preinstalled and directory entries on link duplicates.
    const candidates=includeAvailable?[...custom,...selected,...registered]:selected;
    const used=new Set();
    return [...new Set(candidates)].filter(id=>{
      if(typeof id!=='string')return false;
      const info=id.startsWith('custom_')
        ?root.getCustomApiInfo?.(id.slice(7)):root.API_SITES?.[id];
      if(!info||info.searchable===false||isAdultSource(info))return false;
      const api=String(info.api||info.url||'').trim();
      if(!api)return false;
      let key;
      try{
        const url=new URL(api);
        if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return false;
        key=(url.origin+url.pathname.replace(new RegExp('/+$'),'')+url.search).toLowerCase();
      }catch{return false;}
      if(used.has(key))return false;
      used.add(key);
      return true;
    });
  }
  root.LibreContentPolicy=Object.freeze({
    isAdultSource,isAdultCategory,isAdultVideo,filterVideos,safeSourceIds
  });
})(typeof window!=='undefined'?window:globalThis);
