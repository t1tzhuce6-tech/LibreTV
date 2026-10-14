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
  const storeKey='libretv:home-recommendation-mode';
  const boardKey='libretv:hot-list-board';
  const ttl=45*60*1000;
  let mode='hotlist', current='douban_movie_weekly',seq=0;
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
  function render(items){
    const area=document.getElementById('ltHotListCards');area.replaceChildren();
    const frag=document.createDocumentFragment();
    items.forEach(item=>{
      const card=el('button','lt-rank-card');
      card.type='button';card.title='点击查找并播放《'+item.title+'》';
      const art=el('div','lt-rank-poster');
      const image=el('img','lt-rank-cover');
      image.loading='lazy';image.alt=item.title;image.referrerPolicy='no-referrer';
      image.src=typeof normalizeImageUrl==='function'?normalizeImageUrl(item.cover):item.cover;
      image.onerror=()=>{
        image.onerror=null;
        if(typeof createImagePlaceholder==='function')image.src=createImagePlaceholder('暂无封面');
        else image.style.opacity='.2';
      };
      const badge=el('span','lt-rank-number','#'+(Number(item.rank)||'?'));
      art.append(image,badge);
      if(item.rating){art.appendChild(el('span','lt-rank-rating','★ '+Number(item.rating).toFixed(1)));}
      card.appendChild(art);
      card.appendChild(el('span','lt-rank-name',item.title));
      if(item.subtitle||item.year)card.appendChild(el('span','lt-rank-subtitle',item.year||item.subtitle));
      card.addEventListener('click',()=>{
        if(!window.QuickPlay?.open){setStatus('播放器暂不可用，请刷新页面后重试。');return;}
        window.QuickPlay.open({title:item.title,kind:item.kind==='movie'?'movie':'tv'});
      });
      frag.appendChild(card);
    });
    area.appendChild(frag);
    if(!items.length)area.appendChild(el('p','lt-rank-empty','没有可展示的榜单内容。'));
  }
  async function loadChart(id,force=false){
    current=id;save(boardKey,id);
    const seqNow=++seq;
    document.querySelectorAll('[data-lt-hot-chart]').forEach(button=>{
      const selected=button.dataset.ltHotChart===id;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
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
    mode=value==='douban'?'douban':'hotlist';save(storeKey,mode);
    document.body.classList.toggle('lt-rank-active',mode==='hotlist');
    const section=document.getElementById('ltHotListContent');
    if(section)section.hidden=mode!=='hotlist';
    document.querySelectorAll('[data-lt-recommend-mode]').forEach(button=>{
      const selected=button.dataset.ltRecommendMode===mode;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    if(mode==='hotlist')loadChart(current);
    else if(typeof enableHomeRecommendations==='function'&&read('doubanEnabled')!=='true')enableHomeRecommendations();
  }
  function init(){
    const target=document.getElementById('doubanArea');
    if(!target)return;
    const container=el('section','lt-hotlist');container.id='ltHotList';
    const head=el('div','lt-hotlist-head');
    const title=el('div','lt-hotlist-title','发现值得看的影视');
    const modes=el('div','lt-hotlist-modes');
    for(const item of [{id:'hotlist',name:'真实影视榜单'},{id:'douban',name:'原豆瓣推荐'}]){
      const button=el('button','',item.name);button.type='button';button.dataset.ltRecommendMode=item.id;
      button.addEventListener('click',()=>setMode(item.id));modes.appendChild(button);
    }
    head.append(title,modes);
    const body=el('div','lt-hotlist-content');body.id='ltHotListContent';
    const bar=el('div','lt-hotlist-boardbar');
    const choices=el('div','lt-hotlist-choices');
    charts.forEach(chart=>{
      const b=el('button','',chart.name);b.type='button';b.dataset.ltHotChart=chart.id;
      b.addEventListener('click',()=>loadChart(chart.id));choices.appendChild(b);
    });
    const refresh=el('button','lt-hotlist-refresh','↻ 刷新榜单');
    refresh.type='button';refresh.addEventListener('click',()=>{const grid=document.getElementById('ltHotListCards');grid.replaceChildren();loadChart(current,true);});
    bar.append(choices,refresh);
    const status=el('p','lt-hotlist-status','来自豆瓣周榜与百度热播榜');status.id='ltHotListStatus';
    const cards=el('div','lt-hotlist-grid');cards.id='ltHotListCards';
    const credits=el('p','lt-hotlist-credits');
    const source=el('a','', '数据：LibreTV 官方榜单流程 / 60s API');
    source.href='https://github.com/LibreSpark/LibreTV/wiki/Recommendations';
    source.target='_blank';source.rel='noopener noreferrer';
    credits.append(source,' · 播放使用当前方案中已选的片源');
    body.append(bar,status,cards,credits);
    container.append(head,body);
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
    const saved=read(boardKey);
    if(charts.some(c=>c.id===saved))current=saved;
    setMode(read(storeKey)==='douban'?'douban':'hotlist');
  }
  document.addEventListener('DOMContentLoaded',init);
})();
