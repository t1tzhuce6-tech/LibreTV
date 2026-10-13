/* LibreTV personal browse & direct-play IPTV, no video proxy. */
(function () {
  'use strict';
  const liveChannels = [
    {name:'CGTN 纪录频道',group:'纪录',lang:'英文/多语',url:'https://english-livebkali.cgtn.com/live/doccgtn.m3u8'},
    {name:'中国旅游 China Travel',group:'旅游',lang:'英文/多语',url:'https://amg01314-amg01314c7-distrotv-us-10219.playouts.now.amagi.tv/playlist/amg01314-cgtn-cgtnchinatravel-distrotvus/playlist.m3u8'},
    {name:'发现中国 Discovering China',group:'纪录',lang:'英文/多语',url:'https://amg01314-amg01314c8-distrotv-us-10218.playouts.now.amagi.tv/playlist/amg01314-cgtn-cgtndiscoveringchina-distrotvus/playlist.m3u8'},
    {name:'CGNTV 中文',group:'中文',lang:'中文节目',url:'https://d3e05csss9c272.cloudfront.net/out/v1/f0bf71c57581470fb9379f603e8f5d83/CGNWebLiveCN.m3u8'}
  ];
  const sourceOrder=(typeof DEFAULT_SELECTED_APIS!=='undefined'?DEFAULT_SELECTED_APIS:['ffzy','guangsu','xinlang','ysgc','baofeng','hhzy','z360']);
  const liveProviders=[
    {id:'iptvorg',name:'IPTV-org 中文频道',url:'https://iptv-org.github.io/iptv/languages/zho.m3u'},
    {id:'guovin',name:'Guovin 央视／卫视',url:'https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/result.m3u'},
    {id:'bestfan',name:'best-fan 高清候选',url:'https://raw.githubusercontent.com/best-fan/iptv-sources/main/cn_all.m3u8'},
    {id:'freetv',name:'Free-TV 国际直播',url:'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'},
    // Live-only, taken from the public FanTaiYing/TVBox 0826.json mirror; type-3 VOD requires a separate Spider JAR runtime.
    {id:'fty-v4',name:'饭太硬 · V4 聚合直播（镜像）',url:'https://raw.githubusercontent.com/wwb521/live/main/tv.m3u'},
    {id:'fty-v6',name:'饭太硬 · V6 范明明（IPv6）',url:'https://raw.githubusercontent.com/fanmingming/live/refs/heads/main/tv/m3u/ipv6.m3u'},
    {id:'fty-platform',name:'饭太硬 · 平台直播（HTTP）',url:'http://tv.iill.top/m3u/Live'},
    {id:'original',name:'基础公开频道（4 台）',url:''},
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
  function categoryMatches(name,key){
    const rules={
      '电影':/电影|电影片/,
      '电视剧':/连续剧|电视剧/,
      '国产剧':/大陆剧|国产剧/,
      '美剧':/欧美剧/,
      '短剧':/短剧/,
      '动漫':/动漫|动画/,
      '综艺':/综艺/
    };
    return rules[key]&&rules[key].test(name);
  }
  function updateCategories(){
    const select=$('ltBrowseCategory');select.replaceChildren();
    state.classes.forEach(c=>{const o=node('option','',c.type_name);o.value=String(c.type_id);if(String(c.type_pid)!=='0')o.textContent='　'+c.type_name;select.appendChild(o);});
    const all=node('option','','全部最新');all.value='';select.insertBefore(all,select.firstChild);
    let typeId='';
    if(state.category!=='全部'){
      const exact=state.classes.find(c=>c.type_name===state.category);
      const match=exact||state.classes.find(c=>categoryMatches(c.type_name,state.category));
      if(match)typeId=String(match.type_id);
    }
    state.typeId=typeId;select.value=typeId;
    const tabs=$('ltBrowseCats');tabs.replaceChildren();
    ['全部','电影','电视剧','国产剧','美剧','短剧','动漫','综艺'].forEach(key=>{
      appendButton(tabs,key,()=>{state.category=key;state.page=1;updateCategories();loadList();},state.category===key);
    });
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
      state.classes=data.class.filter(c=>c&&c.type_id!==undefined&&c.type_name);
    }catch(error){
      if(req!==state.sequence)return;
      showMsg('分类读取失败。可尝试切换源，或确认已输入网站密码。');
    }
    updateCategories();loadList();
  }
  function renderCards(items){
    const box=$('ltBrowseCards');box.replaceChildren();
    for(const item of items){
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
  function leafCategories(parentId){
    const children=state.classes.filter(c=>String(c.type_pid)===String(parentId));
    if(!children.length)return [String(parentId)];
    return children.flatMap(c=>leafCategories(c.type_id));
  }
  function requestedCategories(){
    if(state.typeId){
      return [...new Set(leafCategories(state.typeId))].slice(0,12);
    }
    // An unfiltered newest page may be dominated by a single genre.
    // Mix leaf categories from distinct parent groups instead.
    const top=state.classes.filter(c=>String(c.type_pid)==='0'
      && /电影|连续剧|电视剧|综艺|动漫|动画|短剧/.test(c.type_name));
    const result=[];
    top.forEach(c=>{
      const leaves=leafCategories(c.type_id);
      result.push(...leaves.slice(0,c.type_name.includes('电影')?3:2));
    });
    return [...new Set(result)].slice(0,10);
  }
  async function loadList(){
    const req=++state.sequence;
    const box=$('ltBrowseCards');box.replaceChildren();
    box.appendChild(node('p','lt-explore-empty','正在汇总子分类片单…'));
    showMsg('按片源更新时间显示，不是播放量热榜；父分类自动汇总子分类。');
    try{
      const context=getApiSearchContext(state.source);
      if(!context)throw new Error('未知源');
      const ids=requestedCategories();
      const endpoints=ids.length?ids.map(id=>context.apiBaseUrl+'?ac=videolist&pg='+state.page+'&t='+encodeURIComponent(id))
        :[context.apiBaseUrl+'?ac=videolist&pg='+state.page];
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
      renderCards(normalizeApiList(rows.slice(0,84),state.source,context));
      showMsg((API_SITES[state.source]?.name||'')+' · '+(state.category==='全部'?'多分类最新':state.category)
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
    sourceOrder.filter(validSource).forEach(id=>{
      const o=node('option','','✅ 默认 · '+API_SITES[id].name);o.value=id;s.appendChild(o);
    });
    const remembered=setting('libretvBrowseSource');
    if(remembered&&validSource(remembered)&&sourceOrder.includes(remembered))state.source=remembered;
    s.value=state.source;
    s.addEventListener('change',()=>{state.source=s.value;state.page=1;state.category='全部';setting('libretvBrowseSource',state.source);loadCategories();});
    $('ltBrowseCategory').addEventListener('change',e=>{
      state.typeId=e.target.value;
      state.category=e.target.selectedOptions[0]?.textContent.trim()||'全部';
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
    if(/^http:\/\//i.test(src) && location.protocol==='https:') {
      $('ltLiveStatus').textContent='这是 HTTP 直播线路。已按要求保留，但 HTTPS 网页可能被浏览器阻止加载；视频不会转经 CF。';
    }
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
  function parseM3U(raw){
    const lines=String(raw||'').split(/\r?\n/);
    const results=[];const seen=new Set();
    let pending=null;let skipped=0;
    for(const rawLine of lines){
      const line=rawLine.trim();
      if(line.startsWith('#EXTINF')){
        const comma=line.lastIndexOf(',');
        const title=comma>=0?line.slice(comma+1).trim():'未命名频道';
        const group=/group-title="([^"]*)"/i.exec(line)?.[1]||'其他频道';
        pending={name:title||'未命名频道',group,lang:''};
      }else if(line&&!line.startsWith('#')&&pending){
        if(/^https?:\/\//i.test(line)){
          const key=pending.name+'|'+line;
          if(!seen.has(key)){results.push({...pending,url:line});seen.add(key);}
        }else skipped++;
        pending=null;
      }
    }
    return {results:results.slice(0,5000),skipped};
  }
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
      b.appendChild(node('small','',(c.group||'其他')+' · '+(c.url.startsWith('http://')?'HTTP · 浏览器可能拦截':(c.lang||'HTTPS'))+' · 清晰度以播放为准'));
      b.addEventListener('click',()=>{box.querySelectorAll('button').forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');startLive(c);});
      box.appendChild(b);
    });
    if(!filtered.length)box.appendChild(node('p','lt-explore-empty','没有匹配的频道，尝试其他订阅或关键词。'));
    $('ltLiveCount').textContent='共 '+liveState.all.length+' 条 HTTP/HTTPS 线路，匹配 '+filtered.length
      +' 条；显示前 '+Math.min(maxShow,filtered.length)+' 条。已忽略 '+liveState.skipped+' 条不支持的协议。';
  }
  async function loadLiveProvider(){
    const seq=++liveState.token;
    resetPlayer();
    const chosen=liveProviders.find(p=>p.id===liveState.provider);
    liveState.all=[];liveState.group='';liveState.skipped=0;liveState.loaded=false;
    $('ltLiveCount').textContent='正在从订阅提供者下载频道列表（不经你的 CF）…';
    try{
      if(chosen.id==='original'){liveState.all=liveChannels;}
      else {
        const url=chosen.id==='custom'?$('ltLiveCustomUrl').value.trim():chosen.url;
        if(!/^https?:\/\//i.test(url))throw new Error('只接受 HTTP 或 HTTPS M3U 地址');
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
    select.value=liveState.provider;
    select.addEventListener('change',()=>{
      liveState.provider=select.value;
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
    root.innerHTML='<div class="lt-explore-top"><div><h2>发现影片与高清电视</h2><p>切换资源浏览分类片单；直播直接连接频道源，视频不经 CF 中转。</p></div><div class="lt-explore-modes"><button id="ltModeBrowse" class="is-active" type="button">分类逛片</button><button id="ltModeLive" type="button">高清电视直播</button></div></div>'
      +'<div id="ltBrowseBody"><div class="lt-explore-controls"><label>影视源 <select id="ltBrowseSource"></select></label><label>细分类 <select id="ltBrowseCategory"></select></label></div><div id="ltBrowseCats" class="lt-explore-cats"></div><p id="ltBrowseStatus" class="lt-explore-status"></p><div id="ltBrowseCards" class="lt-explore-grid"></div><div class="lt-explore-paging"><button id="ltPrevPage" type="button">上一页</button><button id="ltNextPage" type="button">下一页</button></div></div>'
      +'<div id="ltLiveBody" hidden><div class="lt-live-sourcebar"><label>直播订阅 <select id="ltLiveProvider"></select></label><label>频道分组 <select id="ltLiveGroup"></select></label><label>搜索 <input id="ltLiveQuery" placeholder="例如 CCTV、卫视、电影" type="search"></label><input id="ltLiveCustomUrl" hidden placeholder="填写 HTTPS M3U 订阅链接" type="url"><button id="ltLiveReload" hidden type="button">读取订阅</button><span id="ltLiveCount"></span></div><div class="lt-live-layout"><div id="ltLiveChannels" class="lt-live-channels"></div><div class="lt-live-player"><h3 id="ltLiveName">选择频道开始直播</h3><video id="ltLiveVideo" controls playsinline preload="none"></video><p id="ltLiveStatus">已检验所选频道的 HLS 主清单包含 1920×1080 选项；实际播放受网络和地区限制。</p><p class="lt-explore-note">直播媒体在你的设备上直接播放，不通过 Cloudflare 视频代理。</p></div></div></div>';
    const after=$('searchArea');if(!after)return;
    after.insertAdjacentElement('afterend',root);
    $('ltModeBrowse').addEventListener('click',()=>chooseMode('browse'));
    $('ltModeLive').addEventListener('click',()=>chooseMode('live'));
    initSources();initLive();syncSearchState();loadCategories();
    window.addEventListener('pagehide',resetPlayer);
  }
  document.addEventListener('DOMContentLoaded',start);
})();
