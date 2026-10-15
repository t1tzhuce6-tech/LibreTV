/* iQIYI official Fengyun hot rankings, paginated via same-origin read-only JSON.
 * Uses existing QuickPlay for click-to-search, never embeds iQIYI playback.
 */
(function(){
  'use strict';
  const channels=[
    ['-1','总榜'],['2','电视剧'],['1','电影'],['10010','中剧'],
    ['35','短剧'],['6','综艺'],['4','动漫'],['3','纪录片'],
    ['15','少儿'],['37','漫剧'],['912','知识'],['17','体育']
  ];
  const $=id=>document.getElementById(id);
  const node=(tag,cls,text)=>{
    const x=document.createElement(tag);
    if(cls)x.className=cls;
    if(text!=null)x.textContent=text;
    return x;
  };
  const key='libretv:iqiyi:channel';
  let channel='-1',page=0,loading=false,more=true,active=false;
  let token=0,ids=new Set(),num=0;
  const read=()=>{try{return localStorage.getItem(key);}catch{return null;}};
  const persist=value=>{try{localStorage.setItem(key,value);}catch{}};
  const message=s=>{if($('ltIqiStatus'))$('ltIqiStatus').textContent=s;};
  function contentAllowed(item){
    return !window.LibreContentPolicy?.isAdultVideo({
      vod_name:item.title,type_name:item.details,vod_class:item.subtitle
    });
  }
  function updateButtons(){
    document.querySelectorAll('[data-lt-iqi-channel]').forEach(b=>{
      const yes=b.dataset.ltIqiChannel===channel;
      b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));
    });
  }
  function appendCards(items){
    const frag=document.createDocumentFragment();
    for(const item of items){
      if(!item.title||!contentAllowed(item)||ids.has(item.id))continue;
      ids.add(item.id);num++;
      const button=node('button','lt-rank-card lt-iqi-card');
      button.type='button';button.title='点击在当前片源中寻找《'+item.title+'》';
      const art=node('div','lt-rank-poster');
      const image=node('img','lt-rank-cover');
      image.alt=item.title;image.loading='lazy';image.referrerPolicy='no-referrer';
      if(/^https:\/\//.test(item.cover||''))image.src=item.cover;
      art.append(image,node('span','lt-rank-number','#'+item.rank));
      if(item.heat)art.append(node('span','lt-iqi-heat','热度 '+item.heat));
      button.append(art,node('span','lt-rank-name',item.title));
      if(item.subtitle)button.append(node('span','lt-rank-subtitle',item.subtitle));
      button.addEventListener('click',()=>{
        if(window.QuickPlay?.open)
          window.QuickPlay.open({title:item.title,kind:item.kind==='movie'?'movie':'tv',
            year:String(item.details||'').match(/(?:19|20)\d{2}/)?.[0]||'',scope:'safe-all'});
        else message('当前播放器尚未加载，请刷新页面。');
      });
      frag.append(button);
    }
    $('ltIqiCards').append(frag);
  }
  async function loadMore(){
    if(!active||loading||!more)return;
    const me=token,next=page+1,btn=$('ltIqiMore');
    loading=true;btn.disabled=true;btn.textContent='正在加载第 '+next+' 批…';
    try{
      const url='/iqiyi-rank?channel='+encodeURIComponent(channel)+'&page='+next;
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(me!==token||!active)return;
      if(!Array.isArray(data.items))throw Error('榜单格式不正确');
      appendCards(data.items);page=next;
      more=!!data.more&&page<40&&data.items.length>0;
      btn.hidden=!more;
      message('爱奇艺风云榜 · '+channels.find(c=>c[0]===channel)?.[1]
        +' · 已展示 '+num+' 部 · 实时热度排名 · 点击海报在本站找片');
      if(!num&&!more)$('ltIqiCards').append(node('p','lt-rank-empty','当前榜单暂无可展示影片。'));
    }catch(e){
      if(me===token)message('第 '+next+' 批暂时无法加载：'+e.message+'，可再次点击重试。');
    }finally{
      if(me===token){loading=false;btn.disabled=false;btn.textContent='继续加载 25 部 ↓';}
    }
  }
  function changeChannel(id){
    if(!channels.some(c=>c[0]===id))return;
    channel=id;persist(id);token++;page=0;num=0;ids=new Set();more=true;loading=false;
    $('ltIqiCards').replaceChildren();$('ltIqiMore').hidden=false;
    updateButtons();message('正在加载 '+channels.find(c=>c[0]===id)?.[1]+' 热播榜…');
    if(active)loadMore();
  }
  function show(){
    active=true;
    if(!page)changeChannel(channel);
    else message('爱奇艺风云榜 · 已加载 '+num+' 部，可继续往下翻。');
  }
  function hide(){active=false;token++;loading=false;}
  function init(root){
    root.className='lt-iqi-content';
    const header=node('div','lt-iqi-heading');
    header.append(node('h3','','爱奇艺风云榜'));
    header.append(node('p','','真实热播排名，按官方频道切换，每次加载25部，向下继续浏览。'));
    const tabs=node('div','lt-iqi-channels');
    for(const [id,name] of channels){
      const button=node('button','',name);button.type='button';
      button.dataset.ltIqiChannel=id;button.addEventListener('click',()=>changeChannel(id));
      tabs.append(button);
    }
    const status=node('p','lt-hotlist-status','');status.id='ltIqiStatus';
    const cards=node('div','lt-hotlist-grid');cards.id='ltIqiCards';
    const moreButton=node('button','lt-hotlist-more','继续加载 25 部 ↓');
    moreButton.id='ltIqiMore';moreButton.type='button';moreButton.addEventListener('click',loadMore);
    const source=node('a','lt-iqi-attribution','查看爱奇艺风云榜原站');
    source.href='https://www.iqiyi.com/ranks1/-1/0';source.target='_blank';source.rel='noopener noreferrer';
    root.append(header,tabs,status,cards,moreButton,source);
    const remembered=read();if(channels.some(c=>c[0]===remembered))channel=remembered;
    updateButtons();
    if('IntersectionObserver' in window){
      new IntersectionObserver(entries=>{
        if(entries.some(e=>e.isIntersecting)&&active)loadMore();
      },{rootMargin:'80px'}).observe(moreButton);
    }
  }
  window.LibreIqi={init,show,hide};
})();
