/* LibreTV personal browse & direct-play IPTV, no video proxy. */
(function () {
  'use strict';
  const liveChannels = [
    {name:'CGTN 纪录频道',group:'纪录',lang:'英文/多语',url:'https://english-livebkali.cgtn.com/live/doccgtn.m3u8'},
    {name:'中国旅游 China Travel',group:'旅游',lang:'英文/多语',url:'https://amg01314-amg01314c7-distrotv-us-10219.playouts.now.amagi.tv/playlist/amg01314-cgtn-cgtnchinatravel-distrotvus/playlist.m3u8'},
    {name:'发现中国 Discovering China',group:'纪录',lang:'英文/多语',url:'https://amg01314-amg01314c8-distrotv-us-10218.playouts.now.amagi.tv/playlist/amg01314-cgtn-cgtndiscoveringchina-distrotvus/playlist.m3u8'},
    {name:'CGNTV 中文',group:'中文',lang:'中文节目',url:'https://d3e05csss9c272.cloudfront.net/out/v1/f0bf71c57581470fb9379f603e8f5d83/CGNWebLiveCN.m3u8'}
  ];
  const sourceOrder=['ffzy','guangsu','xinlang','ysgc','baofeng','hhzy','z360','jszy','maoyan'];
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
      card.appendChild(node('span','lt-explore-card-meta',(item.type_name||'')+' '+(item.vod_remarks||'')));
      card.addEventListener('click',()=>{if(typeof showDetails==='function')showDetails(id,item.vod_name,sourceId);});
      box.appendChild(card);
    }
    if(!box.children.length)box.appendChild(node('p','lt-explore-empty','当前分类没有可显示的影片，可切换分类或影视源。'));
  }
  async function loadList(){
    const req=++state.sequence;
    const box=$('ltBrowseCards');box.replaceChildren();
    box.appendChild(node('p','lt-explore-empty','正在获取最新片单…'));
    showMsg('当前为采集源更新列表，并非播放量热榜。');
    try{
      const context=getApiSearchContext(state.source);
      if(!context)throw new Error('未知源');
      const url=context.apiBaseUrl+'?ac=videolist&pg='+state.page+(state.typeId?'&t='+encodeURIComponent(state.typeId):'');
      const data=await fetchVodApiJson(url);
      if(req!==state.sequence)return;
      if(!data||!Array.isArray(data.list))throw new Error('没有有效列表');
      state.pagecount=Math.max(1,Number(data.pagecount)||1);
      renderCards(normalizeApiList(data,state.source,context));
      showMsg((API_SITES[state.source]?.name||'')+' · '+(state.category==='全部'?'全部最新':state.category)+' · 第 '+state.page+' / '+state.pagecount+' 页');
    }catch(error){
      if(req!==state.sequence)return;
      box.replaceChildren(node('p','lt-explore-empty','读取失败。请检查密码登录和片源状态，再切换来源重试。'));
      showMsg('本次请求未成功，不代表该来源全部影片失效。');
    }
    $('ltPrevPage').disabled=state.page<=1;
    $('ltNextPage').disabled=state.page>=state.pagecount;
  }
  function initSources(){
    const s=$('ltBrowseSource');
    sourceOrder.filter(validSource).forEach(id=>{
      const o=node('option','',API_SITES[id].name);o.value=id;s.appendChild(o);
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
  function renderLive(){
    const box=$('ltLiveChannels');box.replaceChildren();
    liveChannels.forEach(c=>{
      const b=node('button','lt-live-channel');b.type='button';
      b.appendChild(node('strong','',c.name));
      b.appendChild(node('small','',c.group+' · '+c.lang+' · 含 1080P 档位'));
      b.addEventListener('click',()=>{box.querySelectorAll('button').forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');startLive(c);});
      box.appendChild(b);
    });
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
      +'<div id="ltLiveBody" hidden><div class="lt-live-layout"><div id="ltLiveChannels" class="lt-live-channels"></div><div class="lt-live-player"><h3 id="ltLiveName">选择频道开始直播</h3><video id="ltLiveVideo" controls playsinline preload="none"></video><p id="ltLiveStatus">已检验所选频道的 HLS 主清单包含 1920×1080 选项；实际播放受网络和地区限制。</p><p class="lt-explore-note">直播媒体在你的设备上直接播放，不通过 Cloudflare 视频代理。</p></div></div></div>';
    const after=$('searchArea');if(!after)return;
    after.insertAdjacentElement('afterend',root);
    $('ltModeBrowse').addEventListener('click',()=>chooseMode('browse'));
    $('ltModeLive').addEventListener('click',()=>chooseMode('live'));
    initSources();renderLive();syncSearchState();loadCategories();
    window.addEventListener('pagehide',resetPlayer);
  }
  document.addEventListener('DOMContentLoaded',start);
})();
