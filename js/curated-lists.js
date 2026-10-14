/* My Lists public community collection directory -> item names + copy.
 * Completely separate from video sources and the QuickPlay playback path.
 */
(function(){
  'use strict';
  const q=id=>document.getElementById(id);
  const make=(tag,cls,txt)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!=null)e.textContent=txt;
    return e;
  };
  const cacheKey='libretv:curated-directory:v2';
  const pageSize=18;
  let directory=[],publishedTotal=0,selection=null,page=1,filter='',kind='all',requestNo=0,hasLoaded=false;
  const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
  const store=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
  const status=s=>{if(q('ltCuratedStatus'))q('ltCuratedStatus').textContent=s;};
  const safeTitle=t=>!window.LibreContentPolicy?.isAdultVideo({vod_name:t});
  const safeEntry=e=>!window.LibreContentPolicy?.isAdultSource({name:e.name});
  async function copyTitle(title){
    try{
      if(!navigator.clipboard?.writeText)throw Error('Clipboard not supported');
      await navigator.clipboard.writeText(title);
      status('✓ 已复制《'+title+'》。可以在本站搜索框粘贴片名。');
    }catch{
      // On iOS/private mode clipboard writes can be blocked.
      window.prompt('自动复制不可用，请手动复制以下片名：',title);
      status('浏览器未授予剪贴板权限，请手动复制弹窗里的片名。');
    }
  }
  function itemsVisible(){
    return directory.filter(x=>{
      if(kind!=='all'&&x.type!==kind)return false;
      if(!filter)return true;
      const haystack=(x.name+' '+x.creator).toLocaleLowerCase();
      return haystack.includes(filter);
    });
  }
  function renderDirectory(){
    q('ltCuratedDirectory').hidden=false;
    q('ltCuratedDetail').hidden=true;
    const matches=itemsVisible();
    const pageCount=Math.max(1,Math.ceil(matches.length/pageSize));
    page=Math.min(page,pageCount);
    const chunk=matches.slice((page-1)*pageSize,page*pageSize);
    const cards=q('ltCuratedDirectoryCards');
    cards.replaceChildren();
    for(const item of chunk){
      const button=make('button','lt-curated-topic-card');
      button.type='button';button.title='打开作者的专题：'+item.name;
      button.append(make('span','lt-curated-topic-title',item.name));
      button.append(make('span','lt-curated-topic-meta','作者 '+item.creator+' · '+item.itemCount+' 部'));
      button.append(make('span','lt-curated-topic-cta','查看专题  →'));
      button.addEventListener('click',()=>openCollection(item));
      cards.appendChild(button);
    }
    if(!chunk.length)cards.append(make('p','lt-rank-empty','没有符合条件的专题，请尝试换一个关键词。'));
    q('ltCuratedPage').textContent=page+' / '+pageCount;
    q('ltCuratedPrev').disabled=page<=1;
    q('ltCuratedNext').disabled=page>=pageCount;
    q('ltCuratedDirectoryCount').textContent='社区公开 '+publishedTotal+' 份 · 过滤空清单后 '+directory.length+' 份 · 当前匹配 '+matches.length+' 份';
    status('从他人维护的专题目录中选一份，打开后点击影片即可复制片名。');
  }
  function populate(raw){
    if(!Array.isArray(raw?.lists))throw Error('Invalid directory data');
    const seen=new Set();
    directory=raw.lists.filter(x=>{
      if(!x||typeof x.name!=='string'||!x.name.trim()||typeof x.creator!=='string'||typeof x.slug!=='string'||!(Number(x.itemCount)>0))return false;
      if(!/^[\w-]{1,64}$/.test(x.creator)||!/^[\w-]{1,100}$/.test(x.slug))return false;
      if(!safeEntry(x))return false;
      const key=x.creator+'/'+x.slug;
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
    publishedTotal=Number(raw.totalPublished)||directory.length;
    hasLoaded=true;
    renderDirectory();
  }
  async function loadDirectory(force=false){
    if(!force&&hasLoaded){renderDirectory();return;}
    if(!force){
      try{
        const cached=JSON.parse(read(cacheKey)||'null');
        if(cached&&Date.now()-cached.time<20*60*1000&&cached.payload?.lists?.length){
          populate(cached.payload);return;
        }
      }catch{}
    }
    status('正在获取整个公开主题片单目录…');
    try{
      const response=await fetch('/curated-directory',{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      populate(data);
      store(cacheKey,JSON.stringify({time:Date.now(),payload:data}));
      if(data.pagesRead<data.pagesExpected)status('部分目录页暂时未返回，已展示可用专题。');
    }catch{
      try{
        const cached=JSON.parse(read(cacheKey)||'null');
        if(cached?.payload?.lists?.length){
          populate(cached.payload);
          status('远程目录暂时不可用，已使用上一次成功缓存。');
          return;
        }
      }catch{}
      status('片单目录暂时无法加载，请稍后重试。');
    }
  }
  async function openCollection(item,force=false){
    selection=item;
    q('ltCuratedDirectory').hidden=true;
    q('ltCuratedDetail').hidden=false;
    q('ltCuratedTopicTitle').textContent=item.name;
    q('ltCuratedTopicInfo').textContent='作者 '+item.creator+' · '+item.itemCount+' 部';
    const cache='libretv:curated-collection:'+item.creator+'/'+item.slug;
    const display=payload=>{
      q('ltCuratedCards').replaceChildren();
      const valid=(Array.isArray(payload?.items)?payload.items:[]).filter(x=>x?.title&&safeTitle(x.title));
      for(const movie of valid){
        const button=make('button','lt-rank-card lt-curated-card');
        button.type='button';button.title='复制片名：'+movie.title;
        const art=make('div','lt-rank-poster');
        const image=make('img','lt-rank-cover');
        image.loading='lazy';image.referrerPolicy='no-referrer';image.alt=movie.title;
        if(/^https:\/\//.test(movie.cover||''))image.src=movie.cover;
        art.appendChild(image);
        button.append(art,make('span','lt-rank-name',movie.title),make('span','lt-curated-copy','点击复制片名'));
        if(movie.year)button.append(make('span','lt-rank-subtitle',movie.year));
        button.addEventListener('click',()=>copyTitle(movie.title));
        q('ltCuratedCards').append(button);
      }
      if(!valid.length)q('ltCuratedCards').append(make('p','lt-rank-empty','本专题暂时没有符合过滤规则的影片。'));
      const link=q('ltCuratedAttribution');
      link.href='https://mylistsaddon.com/lists/'+encodeURIComponent(item.creator)+'/'+encodeURIComponent(item.slug);
      link.textContent='查看作者原始片单';
      q('ltCuratedTopicInfo').textContent='作者 '+item.creator+' · 展示 '+valid.length+' 部 · 点击海报复制片名';
    };
    if(!force){
      try{
        const cached=JSON.parse(read(cache)||'null');
        if(cached&&Date.now()-cached.time<30*60*1000&&cached.payload?.items?.length){
          display(cached.payload);return;
        }
      }catch{}
    }
    const seq=++requestNo;
    q('ltCuratedCards').replaceChildren();
    status('正在加载「'+item.name+'」…');
    try{
      const response=await fetch('/curated-list?creator='+encodeURIComponent(item.creator)+'&slug='+encodeURIComponent(item.slug),{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(seq!==requestNo)return;
      display(data);store(cache,JSON.stringify({time:Date.now(),payload:data}));
      status('来自 '+item.creator+' 的公开专题。点击影片复制名称，在 LibreTV 搜索框粘贴。');
    }catch{
      if(seq!==requestNo)return;
      try{
        const cached=JSON.parse(read(cache)||'null');
        if(cached?.payload?.items?.length){display(cached.payload);status('已显示上次缓存的影片列表。');return;}
      }catch{}
      q('ltCuratedCards').append(make('p','lt-rank-empty','片单暂时读取失败，请返回目录选择其他专题。'));
      status('片单上游暂时不可用。');
    }
  }
  function init(container){
    const directorySection=make('div','lt-curated-directory');directorySection.id='ltCuratedDirectory';
    const intro=make('p','lt-hotlist-status','支持查询其他作者分享的完整专题目录，不需要逐个手动添加。');
    const input=make('input','lt-curated-search');input.id='ltCuratedSearch';input.type='search';
    input.placeholder='搜索专题或作者（例如 horror / mystery / drama）';
    input.addEventListener('input',()=>{filter=input.value.trim().toLocaleLowerCase();page=1;renderDirectory();});
    const types=make('select','lt-curated-type');types.id='ltCuratedType';
    for(const [id,title] of [['all','全部类型'],['movie','电影'],['series','电视剧'],['mixed','混合专题']]){
      const option=make('option','',title);option.value=id;types.append(option);
    }
    types.addEventListener('change',()=>{kind=types.value;page=1;renderDirectory();});
    const controls=make('div','lt-curated-directory-controls');controls.append(input,types);
    const count=make('p','lt-hotlist-status','');count.id='ltCuratedDirectoryCount';
    const cards=make('div','lt-curated-directory-grid');cards.id='ltCuratedDirectoryCards';
    const prev=make('button','lt-curated-page-button','上一页');prev.id='ltCuratedPrev';prev.type='button';
    prev.addEventListener('click',()=>{page=Math.max(1,page-1);renderDirectory();});
    const label=make('span','','1 / 1');label.id='ltCuratedPage';
    const next=make('button','lt-curated-page-button','下一页');next.id='ltCuratedNext';next.type='button';
    next.addEventListener('click',()=>{page++;renderDirectory();});
    const pager=make('div','lt-curated-pager');pager.append(prev,label,next);
    const refresh=make('button','lt-curated-page-button','↻ 更新片单目录');
    refresh.type='button';refresh.addEventListener('click',()=>loadDirectory(true));
    directorySection.append(intro,controls,count,cards,pager,refresh);
    const detail=make('div','lt-curated-detail');detail.id='ltCuratedDetail';detail.hidden=true;
    const back=make('button','lt-curated-page-button','← 返回片单目录');back.type='button';
    back.addEventListener('click',()=>{requestNo++;renderDirectory();});
    const title=make('h3','lt-curated-topic-title','');title.id='ltCuratedTopicTitle';
    const info=make('p','lt-hotlist-status','');info.id='ltCuratedTopicInfo';
    const movieCards=make('div','lt-hotlist-grid');movieCards.id='ltCuratedCards';
    const author=make('a','lt-curated-source','查看作者原始片单');author.id='ltCuratedAttribution';author.target='_blank';author.rel='noopener noreferrer';
    detail.append(back,title,info,movieCards,author);
    const statusElement=make('p','lt-hotlist-status','');statusElement.id='ltCuratedStatus';
    container.append(directorySection,detail,statusElement);
  }
  window.LibreCurated={init,show(){if(selection)renderDirectory();loadDirectory();}};
})();