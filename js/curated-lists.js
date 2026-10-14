/* Public, author-maintained My Lists collections, offered as an optional copy-title fallback.
 * No Stremio runtime, playback integration, third-party account or new backend required.
 */
(function(){
  'use strict';
  const lists=[
    {id:'scifi',title:'科幻与悬疑剧',author:'13dot09'},
    {id:'comedy',title:'喜剧与高分剧集',author:'13dot09'},
    {id:'a24',title:'A24 电影专题',author:'bdubz'},
    {id:'bond',title:'007 电影全集',author:'kokkedorus'},
    {id:'horror',title:'恐怖片入门',author:'stream4me'}
  ];
  let active='scifi',requestNo=0;
  const q=id=>document.getElementById(id);
  const make=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n;};
  const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
  const store=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
  function status(text){if(q('ltCuratedStatus'))q('ltCuratedStatus').textContent=text;}
  async function copyTitle(title){
    try{
      if(!navigator.clipboard?.writeText)throw Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(title);
      status('✓ 已复制《'+title+'》，现在可以在本站搜索框粘贴。');
    }catch{
      // Never claim copy succeeded if browser denied clipboard access.
      window.prompt('自动复制失败。请手动复制这部影片的名称：',title);
      status('浏览器未允许自动复制，请在弹出的窗口手动复制片名。');
    }
  }
  function render(data){
    const box=q('ltCuratedCards');box.replaceChildren();
    const policy=window.LibreContentPolicy;
    const filtered=(Array.isArray(data.items)?data.items:[]).filter(item=>
      item&&item.title&&!policy?.isAdultVideo({vod_name:item.title})
    );
    for(const item of filtered){
      const card=make('button','lt-rank-card lt-curated-card');card.type='button';
      card.title='点击复制片名：'+item.title;
      const cover=make('div','lt-rank-poster');
      const img=make('img','lt-rank-cover');img.loading='lazy';img.alt=item.title;img.referrerPolicy='no-referrer';
      if(item.cover)img.src=item.cover;
      else img.alt='无封面：'+item.title;
      cover.appendChild(img);
      card.append(cover,make('span','lt-rank-name',item.title));
      const hint=make('span','lt-curated-copy','点击复制片名');
      card.append(hint);
      if(item.year)card.appendChild(make('span','lt-rank-subtitle',item.year));
      card.addEventListener('click',()=>copyTitle(item.title));
      box.appendChild(card);
    }
    if(!filtered.length)box.appendChild(make('p','lt-rank-empty','该专题暂时没有可展示影片。'));
    const source=q('ltCuratedAttribution');
    if(source&&/^https:\/\/mylistsaddon\.com\/lists\//.test(data.sourceUrl||'')){
      source.href=data.sourceUrl;
      source.textContent='原作者 '+(data.author||'社区')+' · 查看原始片单';
    }
  }
  async function load(id,force=false){
    if(!lists.some(x=>x.id===id))return;
    active=id;store('libretv:curated:selected',id);
    document.querySelectorAll('[data-lt-curated-id]').forEach(b=>{
      b.classList.toggle('active',b.dataset.ltCuratedId===id);
    });
    const key='libretv:curated:cache:'+id;
    if(!force){
      try{
        const cached=JSON.parse(read(key)||'null');
        if(cached&&Date.now()-cached.time<30*60*1000&&cached.payload?.items?.length){
          render(cached.payload);status('作者维护的主题片单 · 已读取缓存 · 点击海报复制片名');
          return;
        }
      }catch{}
    }
    const seq=++requestNo;status('正在读取作者的公开主题片单…');
    try{
      const response=await fetch('/curated-list?id='+encodeURIComponent(id),{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(seq!==requestNo)return;
      render(data);store(key,JSON.stringify({time:Date.now(),payload:data}));
      status('原作者：'+data.author+' · '+data.items.length+' 部 · 点击海报复制片名，在本站搜索');
    }catch{
      if(seq!==requestNo)return;
      try{
        const saved=JSON.parse(read(key)||'null');
        if(saved?.payload?.items?.length){
          render(saved.payload);status('订阅暂时不可用，已显示上次缓存的片单。');
          return;
        }
      }catch{}
      q('ltCuratedCards').replaceChildren(make('p','lt-rank-empty','专题暂时无法加载，可切回真实影视榜单。'));
      status('远程片单暂时不可用。');
    }
  }
  function init(container){
    const bar=make('div','lt-hotlist-boardbar');
    const tabs=make('div','lt-hotlist-choices');
    lists.forEach(list=>{
      const b=make('button','',list.title);b.type='button';b.dataset.ltCuratedId=list.id;
      b.title='片单来自 My Lists 社区用户 '+list.author;
      b.addEventListener('click',()=>load(list.id));
      tabs.appendChild(b);
    });
    bar.appendChild(tabs);
    const note=make('p','lt-hotlist-status','独立维护的主题片单 · 点击影片复制英文片名');
    note.id='ltCuratedStatus';
    const cards=make('div','lt-hotlist-grid');cards.id='ltCuratedCards';
    const attribution=make('a','lt-curated-source','查看原作者片单');
    attribution.id='ltCuratedAttribution';attribution.target='_blank';attribution.rel='noopener noreferrer';
    attribution.href='https://mylistsaddon.com';
    const tip=make('p','lt-hotlist-credits','内容来自 My Lists 社区，使用原作者公布的公开数据；本页不负责播放。');
    container.append(bar,note,cards,attribution,tip);
    const remembered=read('libretv:curated:selected');
    if(lists.some(x=>x.id===remembered))active=remembered;
  }
  window.LibreCurated={init,show(){load(active)}};
})();