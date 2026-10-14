/* LibreTV configuration presets. Each preset owns sources, selections, browse preference & display style. */
(function(){
  'use strict';
  const PROFILE_KEY='libretv:active-preset';
  const FIELDS=['selectedAPIs','customAPIs','libretvBrowseSource','libretvLiveProvider','doubanEnabled','yellowFilterEnabled'];
  const presets=[
    {id:'local',title:'方案一 · 原有配置',description:'原来的七个默认源，保留原界面与设置',theme:'classic'},
    {id:'managed',title:'方案二 · 自动维护订阅',description:'维护者健康源，打开网站时自动检查更新',theme:'mint'}
  ];
  const cacheKey='libretv:managed-cache:v1',refreshEvery=6*3600000;
  const get=(k)=>{try{return localStorage.getItem(k);}catch{return null;}};
  const set=(k,v)=>{try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{}};
  let active=get(PROFILE_KEY)==='managed'?'managed':'local';
  let remote=[];
  let lastSync=null;
  function valid(entry){
    if(!entry||!/^managed_[a-z0-9]+$/.test(entry.id)||typeof entry.api!=='string'||typeof entry.name!=='string')return false;
    try{
      const url=new URL(entry.api);
      return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password
        &&/\/(?:api\.php\/)?provide\/vod\/?$/i.test(url.pathname)&&url.hostname.length>3;
    }catch{return false;}
  }
  function install(rows){
    for(const entry of remote)delete API_SITES[entry.id];
    const unique=new Set();
    remote=(Array.isArray(rows)?rows:[]).filter(valid).filter(e=>{if(unique.has(e.id))return false;unique.add(e.id);return true;}).slice(0,75);
    for(const entry of remote)API_SITES[entry.id]={name:entry.name.slice(0,65),api:entry.api,managed:true};
  }
  function loadCache(){
    try{
      const cached=JSON.parse(get(cacheKey)||'null');
      if(cached&&Array.isArray(cached.sources)){install(cached.sources);lastSync=cached.syncedAt||null;}
    }catch{}
  }
  function visibleIds(){
    return active==='managed'?remote.map(e=>e.id):[...DEFAULT_SELECTED_APIS];
  }
  function storeSnapshot(id){
    const snapshot={};
    for(const key of FIELDS)snapshot[key]=get(key);
    set('libretv:preset:'+id,JSON.stringify(snapshot));
  }
  function applySnapshot(id){
    let obj={};try{obj=JSON.parse(get('libretv:preset:'+id)||'{}')||{};}catch{}
    for(const key of FIELDS){
      if(Object.hasOwn(obj,key))set(key,obj[key]);
      else if(id==='managed')set(key,key==='selectedAPIs'?'[]':null);
    }
  }
  function switchTo(id){
    if(!presets.some(p=>p.id===id)||id===active)return;
    storeSnapshot(active);
    applySnapshot(id);
    set(PROFILE_KEY,id);
    location.reload();
  }
  function chooseManagedDefaults(){
    // Keep concurrent searches small. These two standard JSON sources answered the initial smoke test.
    const preferred=['360','大众'].map(name=>remote.find(e=>
      e.searchable!==false && e.api.startsWith('https:') && e.name.includes(name)
    )).filter(Boolean);
    const chosen=preferred.length?preferred:remote.filter(e=>e.searchable!==false).slice(0,2);
    return chosen.slice(0,2).map(e=>e.id);
  }
  function updateSelection(previous){
    if(active!=='managed')return;
    const existing=new Set(remote.map(s=>s.id));
    let saved=[];
    try{saved=JSON.parse(get('selectedAPIs')||'[]');}catch{}
    if(!Array.isArray(saved))saved=[];
    const firstTime=get('libretv:preset-managed-initialized')!=='yes';
    // Preserve explicit deselection and manual choices. Only seed on the first successful subscription.
    const next=firstTime?chooseManagedDefaults():saved.filter(id=>existing.has(id));
    if(JSON.stringify(saved)!==JSON.stringify(next)){set('selectedAPIs',JSON.stringify(next));}
    set('libretv:preset-managed-initialized','yes');
    if(document.getElementById('apiCheckboxes')&&typeof selectedAPIs!=='undefined')selectedAPIs=next;
    if(typeof initAPICheckboxes==='function')initAPICheckboxes();
    if(typeof updateSelectedApiCount==='function')updateSelectedApiCount();
  }
  function dispatch(){
    window.dispatchEvent(new CustomEvent('libretv:preset-data',{detail:{id:active,count:remote.length}}));
    const info=document.getElementById('ltPresetStatus');
    if(info&&active==='managed')info.textContent=remote.length
       ?'维护者订阅：'+remote.length+' 个兼容候选 · '+(lastSync?'最近同步 '+new Date(lastSync).toLocaleString('zh-CN'):'已读取缓存')
       :'正在加载订阅源…';
  }
  async function refresh(force=false){
    if(!force&&lastSync&&Date.now()-lastSync<refreshEvery){
      updateSelection(remote);
      dispatch();return;
    }
    try{
      const response=await fetch('/managed-sources',{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(!Array.isArray(data.sources)||!data.sources.length)throw Error('空片源配置');
      const previous=remote;
      install(data.sources);
      lastSync=Date.now();
      set(cacheKey,JSON.stringify({sources:remote,syncedAt:lastSync,upstreamUpdated:data.updated_at||''}));
      updateSelection(previous);
      dispatch();
    }catch(err){
      const info=document.getElementById('ltPresetStatus');
      if(info&&active==='managed')info.textContent=remote.length
        ?'远程暂不可用，沿用上次已缓存的 '+remote.length+' 个源'
        :'订阅加载失败，请稍后刷新重试';
      dispatch();
    }
  }
  function render(){
    const target=document.getElementById('searchArea');
    if(!target)return;
    const bar=document.createElement('section');bar.className='lt-preset-bar';
    const header=document.createElement('div');header.className='lt-preset-header';
    const heading=document.createElement('strong');heading.className='lt-preset-heading';heading.textContent='网站配置方案';
    const hint=document.createElement('span');hint.className='lt-preset-hint';hint.textContent='点击切换';
    header.append(heading,hint);
    const tabs=document.createElement('div');tabs.className='lt-preset-tabs';
    tabs.setAttribute('role','group');tabs.setAttribute('aria-label','切换网站配置方案');
    for(const item of presets){
      const selected=item.id===active;
      const b=document.createElement('button');b.type='button';
      b.className=selected?'active':'';
      b.setAttribute('aria-pressed',String(selected));
      const name=document.createElement('span');name.className='lt-preset-button-title';name.textContent=(item.id==='local'?'📺 ':'🔄 ')+item.title;
      const desc=document.createElement('span');desc.className='lt-preset-button-desc';desc.textContent=item.description;
      const mark=document.createElement('span');mark.className='lt-preset-button-state';mark.textContent=selected?'✓ 当前使用':'点击启用';
      b.append(name,desc,mark);
      b.addEventListener('click',()=>switchTo(item.id));
      tabs.appendChild(b);
    }
    const future=document.createElement('span');future.className='lt-preset-future';future.textContent='方案三、四可以继续添加其他作者的配置';
    const note=document.createElement('p');note.id='ltPresetStatus';
    note.textContent=active==='local'?'原有默认配置，未接入远程更新。':'正在读取维护者的健康源…';
    bar.append(header,tabs,future,note);
    target.insertAdjacentElement('beforebegin',bar);
    document.body.classList.toggle('lt-preset-managed',active==='managed');
    dispatch();
  }
  loadCache();
  window.LibreProfiles={active,visibleIds,switchTo,refresh,presets,managedCount:()=>remote.length};
  document.addEventListener('DOMContentLoaded',()=>{
    render();
    if(active==='managed'&&document.getElementById('searchArea'))refresh();
  });
})();