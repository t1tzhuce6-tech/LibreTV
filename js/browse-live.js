/* LibreTV personal browse & direct-play IPTV, no video proxy. */
(function () {
  'use strict';

  const sourceOrder=()=>window.LibreContentPolicy?.safeSourceIds?.(true) || DEFAULT_SELECTED_APIS;
  const liveProviders=[
    {id:'iptvorg',name:'IPTV-org 中文频道',url:'https://iptv-org.github.io/iptv/languages/zho.m3u'},
    {id:'guovin',name:'Guovin 央视／卫视',url:'https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/result.m3u'},
    {id:'bestfan',name:'best-fan 高清候选',url:'https://raw.githubusercontent.com/best-fan/iptv-sources/main/cn_all.m3u8'},
    {id:'freetv',name:'Free-TV 国际直播',url:'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'},
    {id:'custom',name:'自定义 M3U 订阅',url:''}
  ];
  const liveState={provider:'iptvorg',all:[],group:'',query:'',loaded:false,token:0,skipped:0};
  let state={source:'ffzy',category:'全部',typeId:'',page:1,pagecount:1,classes:[],mode:'browse',loading:false,sequence:0,hls:null};
  const $=id=>document.getElementById(id);
  function node(tag,cls,label){const e=document.createElement(tag);if(cls)e.className=cls;if(label!==undefined)e.textContent=label;return e;}
  function setting(key,value){try{if(value===undefined)return localStorage.getItem(key);localStorage.setItem(key,value);}catch(e){return null;}}
  function validSource(source){return typeof API_SITES!=='undefined'&&!!API_SITES[source];}
  function showMsg(message){$('ltBrowseStatus').textContent=message;}
  function appendButton(target,label,callback,selected){
    const b=node('button','lt-explore-btn'+(selected?' is-active':''),label);b.type='button';b.addEventListener('click',callback);target.appendChild(b);return b;
  }
  function resetPlayer(){
    if(state.hls){state.hls.destroy();state.hls=null;}
    const video=$('ltLiveVideo');if(video){video.pause();video.removeAttribute('src');video.load();}
  }
  function chooseMode(mode){
    state.mode=mode;
    $('ltBrowseBody').hidden=mode!=='browse';$('ltLiveBody').hidden=mode!=='live';
    $('ltModeBrowse').classList.toggle('is-active',mode==='browse');
    $('ltModeLive').classList.toggle('is-active',mode==='live');
    if(mode!=='live')resetPlayer();
    if(mode==='live'&&!liveState.loaded)loadLiveProvider();
  }
  function updateCategories(){
    const byId=new Map(state.classes.map(c=>[String(c.type_id),c]));
    if(state.typeId&&!byId.has(String(state.typeId)))state.typeId='';
    const select=$('ltBrowseCategory');select.replaceChildren();
    const all=node('option','','源首页 / 最新');all.value='';select.append(all);
    for(const c of state.classes){
      const option=node('option','',(!['0',''].includes(String(c.type_pid))?'↳ ':'')+c.type_name);
      option.value=String(c.type_id);select.append(option);
    }
    select.value=state.typeId;
    const roots=state.classes.filter(c=>['0',''].includes(String(c.type_pid))||!byId.has(String(c.type_pid)));
    const tabs=$('ltBrowseCats'),levels=$('ltBrowseSubcats');tabs.replaceChildren();levels.replaceChildren();
    const choose=(id)=>{
      state.typeId=id;state.category=byId.get(id)?.type_name||'全部';
      state.page=1;updateCategories();loadList();
    };
    appendButton(tabs,'源首页 / 最新',()=>choose(''),!state.typeId);
    const chain=[];let next=state.typeId,guard=new Set();
    while(next&&byId.has(next)&&!guard.has(next)){
      guard.add(next);chain.unshift(next);
      const parent=String(byId.get(next).type_pid);next=parent==='0'?'':parent;
    }
    const activeRoot=chain[0]||'';
    for(const c of roots)appendButton(tabs,c.type_name,()=>choose(String(c.type_id)),String(c.type_id)===activeRoot);
    let parent=null;
    for(let depth=0;depth<chain.length;depth++){
      parent=chain[depth];
      const children=state.classes.filter(c=>String(c.type_pid)===parent);
      if(!children.length)continue;
      const section=node('div','lt-explore-level');
      section.append(node('small','','分类 · '+byId.get(parent)?.type_name));
      const line=node('div','lt-explore-cats');
      const active=chain[depth+1]||'';
      appendButton(line,'全部'+byId.get(parent)?.type_name,()=>choose(parent),!active);
      for(const c of children)appendButton(line,c.type_name,()=>choose(String(c.type_id)),String(c.type_id)===active);
      section.append(line);levels.append(section);
    }
    if(state.typeId&&!state.classes.some(c=>String(c.type_pid)===state.typeId)){
      // Leaf selected: keep the parent choices visible for switching siblings.
      const leaf=byId.get(state.typeId),parentId=String(leaf?.type_pid||'');
      if(parentId&&parentId!=='0'&&!chain.slice(0,-1).includes(parentId)){
        const siblings=state.classes.filter(c=>String(c.type_pid)===parentId);
        if(siblings.length){
          const section=node('div','lt-explore-level');
          section.append(node('small','','分类 · '+(byId.get(parentId)?.type_name||'')));
          const line=node('div','lt-explore-cats');
          for(const c of siblings)appendButton(line,c.type_name,()=>choose(String(c.type_id)),String(c.type_id)===state.typeId);
          section.append(line);levels.append(section);
        }
      }
    }
  }
  async function loadCategories(){
    const req=++state.sequence;
    showMsg('正在读取影视源分类…');state.classes=[];
    try{
      const context=getApiSearchContext(state.source);
      if(!context)throw new Error('未知来源');
      const data=await fetchVodApiJson(context.apiBaseUrl+'?ac=list');
      if(req!==state.sequence)return;
      if(!data||!Array.isArray(data.class))throw new Error('分类接口未返回有效数据');
      state.classes=window.LibreCatalog.normalClasses(data.class)
        .filter(c=>!window.LibreContentPolicy?.isAdultCategory(c.type_name));
    }catch(error){
      if(req!==state.sequence)return;
      showMsg('分类读取失败。可尝试切换源，或确认已输入网站密码。');
    }
    updateCategories();loadList();
  }
  function renderCards(items){
    const box=$('ltBrowseCards');box.replaceChildren();
    const safe=window.LibreContentPolicy?.filterVideos(items)||items;
    const visible=typeof filterYellowContentResults==='function'?filterYellowContentResults(safe):safe;
    for(const item of visible){
      const id=String(item.vod_id||'');if(!id)continue;
      const sourceId=state.source;
      const card=node('button','lt-explore-card');card.type='button';
      const img=node('img','lt-explore-cover');img.loading='lazy';img.alt=String(item.vod_name||'影片');
      img.referrerPolicy='no-referrer';
      const pic=normalizeImageUrl(item.vod_pic||'',API_SITES[sourceId]?.api||'');
      img.src=pic||createImagePlaceholder('暂无封面');
      img.onerror=()=>{img.onerror=null;img.src=createImagePlaceholder('暂无封面');};
      card.appendChild(img);
      card.appendChild(node('span','lt-explore-card-title',item.vod_name||'未命名'));
      card.appendChild(node('span','lt-explore-card-meta',(item.type_name||'')+' · '+(item.vod_year||'')+' · '+(item.vod_remarks||'')));
      card.addEventListener('click',()=>{if(typeof showDetails==='function')showDetails(id,item.vod_name,sourceId);});
      box.appendChild(card);
    }
    if(!box.children.length)box.appendChild(node('p','lt-explore-empty','当前分类没有可显示的影片，可切换分类或影视源。'));
  }
  function leafCategories(parentId){ return window.LibreCatalog.childIds(state.classes,parentId); }
  function requestedCategories(){ return window.LibreCatalog.categoryIds(state.classes,state.typeId); }
  async function loadList(){
    const req=++state.sequence;
    const box=$('ltBrowseCards');box.replaceChildren();
    box.appendChild(node('p','lt-explore-empty','正在汇总子分类片单…'));
    showMsg('按片源更新时间显示，不是播放量热榜；父分类自动汇总子分类。');
    try{
      const context=getApiSearchContext(state.source);
      if(!context)throw new Error('未知源');
      // Query exactly the selected source category. Do not synthesize source hierarchy.
      const endpoints=[context.apiBaseUrl+'?ac=videolist&pg='+state.page+(state.typeId?'&t='+encodeURIComponent(state.typeId):'')];
      const responses=await Promise.all(endpoints.map(url=>fetchVodApiJson(url).catch(()=>null)));
      if(req!==state.sequence)return;
      const good=responses.filter(data=>data&&Array.isArray(data.list));
      if(!good.length)throw new Error('未收到有效分类结果');
      const dataLists=good.filter(data=>data.list.length>0);
      state.pagecount=Math.max(1,...dataLists.map(data=>Number(data.pagecount)||1));
      const seen=new Set();const rows=[];
      for(const data of dataLists)for(const item of data.list){
        const id=String(item.vod_id||'');
        if(!id||seen.has(id))continue;
        seen.add(id);rows.push(item);
      }
      rows.sort((a,b)=>String(b.vod_time||'').localeCompare(String(a.vod_time||'')));
      renderCards(normalizeApiList(window.LibreCatalog.asVodPayload(rows.slice(0,84)),state.source,context));
      showMsg((API_SITES[state.source]?.name||'')+' · '+(state.category==='全部'?'源首页最新':state.category)
        +' · 本页 '+rows.length+' 条 · 第 '+state.page+' / '+state.pagecount+' 页（更新排序，非热榜）');
    }catch(error){
      if(req!==state.sequence)return;
      box.replaceChildren(node('p','lt-explore-empty','分类读取失败。切换来源、子分类或刷新后重试。'));
      showMsg('该分类请求未成功，无法据此判定整个片源无影片。');
    }
    $('ltPrevPage').disabled=state.page<=1;
    $('ltNextPage').disabled=state.page>=state.pagecount;
  }
  function initSources(){
    const s=$('ltBrowseSource');
    const refreshSources=()=>{
      const ids=sourceOrder().filter(validSource);
      s.replaceChildren();
      ids.forEach(id=>{
        const o=node('option','',API_SITES[id].name);
        o.value=id;s.appendChild(o);
      });
      const remembered=setting('libretvBrowseSource');
      if(remembered&&ids.includes(remembered))state.source=remembered;
      else if(!ids.includes(state.source))state.source=ids[0]||'';
      s.value=state.source;
      if(state.source)loadCategories();
      else showMsg('还没有可用的片源，请在设置中添加。');
    };
    refreshSources();
    s.addEventListener('change',()=>{state.source=s.value;state.page=1;state.category='全部';state.typeId='';setting('libretvBrowseSource',state.source);loadCategories();});
    $('ltBrowseCategory').addEventListener('change',e=>{
      state.typeId=e.target.value;
      state.category=state.classes.find(c=>String(c.type_id)===state.typeId)?.type_name||'全部';
      updateCategories();
      if(!state.typeId)state.category='全部';
      state.page=1;loadList();
    });
    $('ltPrevPage').addEventListener('click',()=>{if(state.page>1){state.page--;loadList();}});
    $('ltNextPage').addEventListener('click',()=>{if(state.page<state.pagecount){state.page++;loadList();}});
  }
  function startLive(channel){
    resetPlayer();
    const video=$('ltLiveVideo');
    $('ltLiveStatus').textContent='正在直连 '+channel.name+'（不经 Cloudflare 视频代理）…';
    $('ltLiveName').textContent=channel.name;
    const src=channel.url;
    if(video.canPlayType('application/vnd.apple.mpegurl')){
      video.src=src;
      video.play().catch(()=>{$('ltLiveStatus').textContent='请点击播放器播放按钮。';});
    }else if(window.Hls&&Hls.isSupported()){
      const hls=new Hls({enableWorker:true,maxBufferLength:16});
      state.hls=hls;
      hls.loadSource(src);hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED,()=>{
        const levels=hls.levels||[];const high=levels.filter(l=>l.width>=1900).length;
        $('ltLiveStatus').textContent=high?'已加载，提供 1080P 档位（播放中可自适应）':'已加载，实际清晰度由直播源决定';
        video.play().catch(()=>{$('ltLiveStatus').textContent+='；点击播放按钮开始';});
      });
      hls.on(Hls.Events.ERROR,(_e,data)=>{
        if(data&&data.fatal)$('ltLiveStatus').textContent='直播失败：可能是地区限制、跨域策略或源站故障。可以切换频道。';
      });
    }else $('ltLiveStatus').textContent='此浏览器不支持播放 HLS 直播。';
  }
  function parseM3U(raw){ return window.LibreCatalog.parseM3U(raw); }
  function renderLive(){
    const box=$('ltLiveChannels');box.replaceChildren();
    const group=$('ltLiveGroup');const groups=[...new Set(liveState.all.map(c=>c.group||'其他频道'))].sort();
    group.replaceChildren();
    const all=node('option','','全部分组');all.value='';group.appendChild(all);
    groups.forEach(g=>{const o=node('option','',g);o.value=g;group.appendChild(o);});
    if(groups.includes(liveState.group))group.value=liveState.group;
    else {liveState.group='';group.value='';}
    const term=liveState.query.trim().toLowerCase();
    const filtered=liveState.all.filter(c=>(!liveState.group||c.group===liveState.group)
      &&(!term||c.name.toLowerCase().includes(term)||c.group.toLowerCase().includes(term)));
    const maxShow=220;
    filtered.slice(0,maxShow).forEach(c=>{
      const b=node('button','lt-live-channel');b.type='button';
      b.appendChild(node('strong','',c.name));
      b.appendChild(node('small','',(c.group||'其他')+' · '+(c.lang||'HTTPS 频道')+' · 清晰度以播放为准'));
      b.addEventListener('click',()=>{box.querySelectorAll('button').forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');startLive(c);});
      box.appendChild(b);
    });
    if(!filtered.length)box.appendChild(node('p','lt-explore-empty','没有匹配的 HTTPS 频道，尝试其他订阅或关键词。'));
    $('ltLiveCount').textContent='共 '+liveState.all.length+' 条 HTTPS 线路，匹配 '+filtered.length
      +' 条；显示前 '+Math.min(maxShow,filtered.length)+' 条。已排除 '+liveState.skipped+' 条非 HTTPS 线路。';
  }
  async function loadLiveProvider(){
    const seq=++liveState.token;
    resetPlayer();
    const chosen=liveProviders.find(p=>p.id===liveState.provider);
    liveState.all=[];liveState.group='';liveState.skipped=0;liveState.loaded=false;
    $('ltLiveCount').textContent='正在从订阅提供者下载频道列表（不经你的 CF）…';
    try{
      {
        const url=chosen.id==='custom'?$('ltLiveCustomUrl').value.trim():'/live-list/'+encodeURIComponent(chosen.id);
        if(!url.startsWith('/live-list/')&&!/^https:\/\//i.test(url))throw new Error('订阅地址必须为 HTTPS');
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),12000);
        let response;
        try{response=await fetch(url,{signal:controller.signal,cache:'no-store'});}
        finally{clearTimeout(timeout);}
        if(!response.ok)throw new Error('HTTP '+response.status);
        const raw=await response.text();
        if(seq!==liveState.token)return;
        if(!raw.startsWith('#EXTM3U'))throw new Error('不是标准 M3U 格式');
        const parsed=parseM3U(raw);
        liveState.all=parsed.results;liveState.skipped=parsed.skipped;
      }
      if(seq!==liveState.token)return;
      liveState.loaded=true;
      renderLive();
    }catch(error){
      if(seq!==liveState.token)return;
      $('ltLiveChannels').replaceChildren(node('p','lt-explore-empty','订阅加载失败。可能是 CORS、地区网络或订阅失效。切换其他提供者试试。'));
      $('ltLiveCount').textContent='失败：'+error.message+'。播放器不会使用 CF 视频代理。';
    }
  }
  function initLive(){
    const select=$('ltLiveProvider');
    for(const p of liveProviders){const o=node('option','',p.name);o.value=p.id;select.appendChild(o);}
    const savedProvider=setting('libretvLiveProvider');
    liveState.provider=liveProviders.some(p=>p.id===savedProvider)?savedProvider:
      'iptvorg';
    select.value=liveState.provider;
    select.addEventListener('change',()=>{
      liveState.provider=select.value;
      setting('libretvLiveProvider',liveState.provider);
      $('ltLiveCustomUrl').hidden=liveState.provider!=='custom';
      $('ltLiveReload').hidden=liveState.provider!=='custom';
      loadLiveProvider();
    });
    $('ltLiveGroup').addEventListener('change',e=>{liveState.group=e.target.value;renderLive();});
    $('ltLiveQuery').addEventListener('input',e=>{liveState.query=e.target.value;renderLive();});
    $('ltLiveReload').addEventListener('click',loadLiveProvider);
  }
  function syncSearchState(){
    const r=$('resultsArea');const root=$('ltExplore');
    if(!r||!root)return;
    const update=()=>{const isSearch=!r.classList.contains('hidden');root.hidden=isSearch;if(isSearch)resetPlayer();};
    new MutationObserver(update).observe(r,{attributes:true,attributeFilter:['class']});update();
  }
  function start(){
    const root=node('section','lt-explore');root.id='ltExplore';
    root.innerHTML='<div class="lt-explore-top"><div><h2>按片源分类浏览</h2><p>各影视源独立分类与片单。已过滤成人内容。</p></div></div>'
      +'<div id="ltBrowseBody"><div class="lt-explore-controls"><label>影视源 <select id="ltBrowseSource"></select></label><label>细分类 <select id="ltBrowseCategory"></select></label></div><div id="ltBrowseCats" class="lt-explore-cats"></div><div id="ltBrowseSubcats" class="lt-explore-subcats"></div><p id="ltBrowseStatus" class="lt-explore-status"></p><div id="ltBrowseCards" class="lt-explore-grid"></div><div class="lt-explore-paging"><button id="ltPrevPage" type="button">上一页</button><button id="ltNextPage" type="button">下一页</button></div></div>'
;
    const after=$('searchArea');if(!after)return;
    after.insertAdjacentElement('afterend',root);
    initSources();syncSearchState();loadCategories();
  }
  document.addEventListener('DOMContentLoaded',start);
})();
