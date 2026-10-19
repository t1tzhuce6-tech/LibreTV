/* Source: public chart categories documented by LibreSpark/LibreTV.
 * Charts supplied by 60s API; search & playback use this site's existing QuickPlay.
 * This is a thin integration layer, not a second video engine.
 */
(function(){
  'use strict';
  const charts=[
    {id:'douban_movie_weekly',name:'电影周榜',type:'movie'},
    {id:'douban_tv_chinese',name:'国产剧周榜',type:'tv'},
    {id:'douban_tv_global',name:'海外剧周榜',type:'tv'},
    {id:'douban_show_chinese',name:'国内综艺',type:'tv'},
    {id:'douban_show_global',name:'海外综艺',type:'tv'},
    {id:'baidu_teleplay',name:'百度热播剧',type:'tv'}
  ];
  const longBoards=[
    {id:'browse_movie',name:'热门电影 · 往下翻',type:'movie'},
    {id:'browse_tv',name:'热门电视剧 · 往下翻',type:'tv'}
  ];
  const isLongBoard=id=>longBoards.some(x=>x.id===id);
  const storeKey='libretv:home-recommendation-mode';
  const boardKey='libretv:hot-list-board';
  const ttl=45*60*1000;
  let mode='hotlist', current='browse_movie',seq=0;
  let discovery={offset:0,items:[],seen:new Set(),loading:false,more:true};
  const el=(name,cls,text)=>{
    const n=document.createElement(name);
    if(cls)n.className=cls;
    if(text!=null)n.textContent=text;
    return n;
  };
  function read(key){try{return localStorage.getItem(key);}catch{return null;}}
  function save(key,value){try{localStorage.setItem(key,value);}catch{}}
  function adult(item){
    if(window.LibreContentPolicy?.isAdultVideo(item))return true;
    return typeof matchesYellowContent==='function'&&matchesYellowContent({vod_name:item.title,type_name:''});
  }
  function validItems(data){
    return (Array.isArray(data?.items)?data.items:[]).filter(item=>
      item&&typeof item.title==='string'&&item.title.trim()&&typeof item.cover==='string'&&!adult(item)
    );
  }
  function setStatus(msg){
    const target=document.getElementById('ltHotListStatus');
    if(target)target.textContent=msg;
  }
  // Douban poster CDN requires a Douban Referer; the browser cannot set that header.
  // The restricted same-origin image function supplies it while leaving other cover hosts untouched.
  function posterUrl(raw){
    const normalized=typeof normalizeImageUrl==='function'?normalizeImageUrl(raw):String(raw||'');
    try{
      const parsed=new URL(normalized);
      if(/^img\d+\.doubanio\.com$/i.test(parsed.hostname)&&parsed.protocol==='https:')
        return '/poster-image?url='+encodeURIComponent(normalized);
    }catch{}
    return normalized;
  }
  function render(items,append=false){
    const area=document.getElementById('ltHotListCards');if(!append)area.replaceChildren();
    const frag=document.createDocumentFragment();
    items.forEach(item=>{
      const card=el('button','lt-rank-card');
      card.type='button';card.title='点击查找并播放《'+item.title+'》';
      const art=el('div','lt-rank-poster');
      const image=el('img','lt-rank-cover');
      image.loading='lazy';image.alt=item.title;image.referrerPolicy='no-referrer';
      image.src=posterUrl(item.cover);
      image.onerror=()=>{
        image.onerror=null;
        if(typeof createImagePlaceholder==='function')image.src=createImagePlaceholder('暂无封面');
        else image.style.opacity='.2';
      };
      art.append(image);
      if(item.rank)art.appendChild(el('span','lt-rank-number','#'+item.rank));
      if(item.rating){art.appendChild(el('span','lt-rank-rating','★ '+Number(item.rating).toFixed(1)));}
      card.appendChild(art);
      card.appendChild(el('span','lt-rank-name',item.title));
      if(item.subtitle||item.year)card.appendChild(el('span','lt-rank-subtitle',item.year||item.subtitle));
      card.addEventListener('click',()=>{
        if(!window.QuickPlay?.open){setStatus('播放器暂不可用，请刷新页面后重试。');return;}
        window.QuickPlay.open({title:item.title,kind:item.kind==='movie'?'movie':'tv',scope:'rank-selected'});
      });
      frag.appendChild(card);
    });
    area.appendChild(frag);
    if(!items.length&&!append)area.appendChild(el('p','lt-rank-empty','没有可展示的榜单内容。'));
  }
  async function loadBrowseMore(){
    if(!isLongBoard(current)||discovery.loading||!discovery.more||mode!=='hotlist')return;
    const mySeq=seq,button=document.getElementById('ltHotListMore');
    discovery.loading=true;
    if(button){button.disabled=true;button.textContent='正在加载下一批…';}
    try{
      if(typeof fetchDoubanData!=='function')throw new Error('豆瓣推荐模块尚未准备好');
      const kind=current==='browse_movie'?'movie':'tv';
      const url='https://movie.douban.com/j/search_subjects?type='+kind+'&tag='+encodeURIComponent('热门')
        +'&sort=recommend&page_limit=20&page_start='+discovery.offset;
      const response=await fetchDoubanData(url);
      if(mySeq!==seq||mode!=='hotlist'||!isLongBoard(current))return;
      if(!Array.isArray(response.subjects))throw new Error('返回格式不正确');
      const page=response.subjects,additions=[];
      for(const row of page){
        const title=String(row?.title||'').trim();
        const id=String(row?.id||title);
        if(!title||discovery.seen.has(id))continue;
        discovery.seen.add(id);
        const item={id,title,cover:String(row.cover||''),rating:Number(row.rate)||null,
          kind,rank:null,year:String(row.year||''),subtitle:String(row.subtitle||'')};
        if(!adult(item))additions.push(item);
      }
      discovery.offset+=20;discovery.items.push(...additions);
      render(additions,true);
      discovery.more=page.length===20&&discovery.offset<400;
      if(button)button.hidden=!discovery.more;
      setStatus('豆瓣热门推荐 · 已显示 '+discovery.items.length+' 部 · 点击海报自动找片'
        +(discovery.more?' · 可向下继续浏览':' · 已到当前可用列表末尾'));
    }catch(error){
      if(mySeq!==seq)return;
      setStatus('下一批加载失败：'+error.message+'。可以点击下方按钮重试，已显示的影片不会丢失。');
    }finally{
      if(mySeq===seq){discovery.loading=false;if(button){button.disabled=false;button.textContent='继续加载 20 部 ↓';}}
    }
  }
  function showBrowse(id){
    discovery={offset:0,items:[],seen:new Set(),loading:false,more:true};
    document.getElementById('ltHotListCards').replaceChildren();
    setStatus('正在获取豆瓣热门影片（每次 20 部）…');
    const button=document.getElementById('ltHotListMore');
    if(button){button.hidden=false;button.disabled=false;}
    loadBrowseMore();
  }
  async function loadChart(id,force=false){
    current=id;save(boardKey,id);
    const seqNow=++seq;
    const isBrowse=isLongBoard(id);
    const shortLists=document.getElementById('ltHotListShortBoards');
    if(shortLists)shortLists.open=!isBrowse;
    const more=document.getElementById('ltHotListMore');
    if(more)more.hidden=!isBrowse;
    document.querySelectorAll('[data-lt-hot-chart]').forEach(button=>{
      const selected=button.dataset.ltHotChart===id;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    if(isBrowse){showBrowse(id);return;}
    discovery.more=false;
    const key='libretv:chart-cache:'+id;
    if(!force){
      try{
        const cache=JSON.parse(read(key)||'null');
        if(cache&&Date.now()-cache.time<ttl&&Array.isArray(cache.items)){
          render(validItems(cache));setStatus('数据来源：'+(id.startsWith('douban_')?'豆瓣周榜':'百度热播榜')+' · 缓存有效');
          return;
        }
      }catch{}
    }
    setStatus('正在加载真实影视榜单…');
    try{
      const response=await fetch('/hot-list?id='+encodeURIComponent(id),{cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(seqNow!==seq||mode!=='hotlist')return;
      const items=validItems(data);
      if(!items.length)throw Error('榜单内容为空');
      render(items);
      save(key,JSON.stringify({time:Date.now(),items}));
      setStatus((data.source||'第三方榜单')+' · 按原榜单排名 · 点击海报自动找片');
    }catch(error){
      if(seqNow!==seq)return;
      setStatus('榜单暂时不可用（'+error.message+'），可切到原豆瓣推荐或稍后重试。');
      const grid=document.getElementById('ltHotListCards');
      if(!grid.children.length)grid.appendChild(el('p','lt-rank-empty','榜单加载失败，请点右上角重试。'));
    }
  }
  function setMode(value){
    mode=['douban','curated','iqiyi'].includes(value)?value:'hotlist';save(storeKey,mode);
    document.body.classList.toggle('lt-rank-active',mode!=='douban');
    if(mode!=='iqiyi')window.LibreIqi?.hide();
    if(mode!=='curated')window.LibreNexus?.hide();
    const section=document.getElementById('ltHotListContent');
    if(section)section.hidden=mode!=='hotlist';
    const curated=document.getElementById('ltCuratedContent');
    if(curated)curated.hidden=true;
    const nexus=document.getElementById('ltNexusContent');
    if(nexus)nexus.hidden=mode!=='curated';
    const official=document.getElementById('ltIqiContent');
    if(official)official.hidden=mode!=='iqiyi';
    document.querySelectorAll('[data-lt-recommend-mode]').forEach(button=>{
      const selected=button.dataset.ltRecommendMode===mode;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    if(mode==='hotlist')loadChart(current);
    else if(mode==='curated')window.LibreNexus?.show();
    else if(mode==='iqiyi')window.LibreIqi?.show();
    else if(typeof enableHomeRecommendations==='function'&&read('doubanEnabled')!=='true')enableHomeRecommendations();
  }
  function init(){
    const target=document.getElementById('doubanArea');
    if(!target)return;
    const container=el('section','lt-hotlist');container.id='ltHotList';
    const head=el('div','lt-hotlist-head');
    const title=el('div','lt-hotlist-title','发现值得看的影视');
    const modes=el('div','lt-hotlist-modes');
    for(const item of [{id:'iqiyi',name:'爱奇艺风云榜'},{id:'hotlist',name:'豆瓣榜单'},{id:'curated',name:'中文精选片单'},{id:'douban',name:'原豆瓣推荐'}]){
      const button=el('button','',item.name);button.type='button';button.dataset.ltRecommendMode=item.id;
      button.addEventListener('click',()=>setMode(item.id));modes.appendChild(button);
    }
    head.append(title,modes);
    const body=el('div','lt-hotlist-content');body.id='ltHotListContent';
    const bar=el('div','lt-hotlist-boardbar');
    const featured=el('div','lt-hotlist-featured');
    for(const entry of longBoards){
      const button=el('button','lt-hotlist-feature-button',entry.name);
      button.type='button';button.dataset.ltHotChart=entry.id;
      button.addEventListener('click',()=>loadChart(entry.id));featured.appendChild(button);
    }
    const shortLists=el('details','lt-hotlist-short-boards');shortLists.id='ltHotListShortBoards';
    shortLists.append(el('summary','','其他六个每周精选小榜'));
    const choices=el('div','lt-hotlist-choices');
    charts.forEach(chart=>{
      const b=el('button','',chart.name);b.type='button';b.dataset.ltHotChart=chart.id;
      b.addEventListener('click',()=>loadChart(chart.id));choices.appendChild(b);
    });
    shortLists.append(choices);
    const refresh=el('button','lt-hotlist-refresh','↻ 刷新当前列表');
    refresh.type='button';refresh.addEventListener('click',()=>{loadChart(current,true);});
    bar.append(featured,shortLists,refresh);
    const status=el('p','lt-hotlist-status','来自豆瓣周榜与百度热播榜');status.id='ltHotListStatus';
    const cards=el('div','lt-hotlist-grid');cards.id='ltHotListCards';
    const more=el('button','lt-hotlist-more','继续加载 20 部 ↓');
    more.id='ltHotListMore';more.type='button';more.hidden=true;
    more.addEventListener('click',loadBrowseMore);
    const credits=el('p','lt-hotlist-credits');
    const source=el('a','', '数据：豆瓣热门推荐 / LibreTV 官方周榜');
    source.href='https://github.com/LibreSpark/LibreTV/wiki/Recommendations';
    source.target='_blank';source.rel='noopener noreferrer';
    credits.append(source,' · 播放使用热榜页面勾选的合格片源');
    body.append(bar,status,cards,more,credits);
    if('IntersectionObserver' in window){
      const observer=new IntersectionObserver(entries=>{
        if(entries.some(e=>e.isIntersecting)&&mode==='hotlist'&&isLongBoard(current))loadBrowseMore();
      },{rootMargin:'80px'});
      observer.observe(more);
    }
    const curated=el('div','lt-hotlist-content');curated.id='ltCuratedContent';curated.hidden=true;
    window.LibreCurated?.init(curated);
    const iqiyi=el('div','lt-hotlist-content');iqiyi.id='ltIqiContent';iqiyi.hidden=true;
    window.LibreIqi?.init(iqiyi);
    curated.hidden=true;
    const nexus=el('div','lt-hotlist-content');nexus.id='ltNexusContent';nexus.hidden=true;
    window.LibreNexus?.init(nexus,curated);
    container.append(head,body,curated,iqiyi,nexus);
    // Rankings must precede the long source-browse card grid, or they are buried below it.
    const search=document.getElementById('searchArea');
    if(search){
      search.insertAdjacentElement('beforebegin',container);
      container.insertAdjacentElement('afterend',target);
    }else target.insertAdjacentElement('beforebegin',container);
    const results=document.getElementById('resultsArea');
    if(results){
      const observe=()=>{
        container.hidden=!results.classList.contains('hidden');
      };
      new MutationObserver(observe).observe(results,{attributes:true,attributeFilter:['class']});
      observe();
    }
    window.LibreRankSources?.initPanel();
    const saved=read(boardKey);
    if([...charts,...longBoards].some(c=>c.id===saved))current=saved;
    if(read('libretv:long-browse-introduced')!=='yes'){
      current='browse_movie';save('libretv:long-browse-introduced','yes');
    }
    const savedMode=read(storeKey);
    setMode(['douban','curated','iqiyi'].includes(savedMode)?savedMode:'hotlist');
  }
  document.addEventListener('DOMContentLoaded',init);
})();
