/* Chinese curated rankings provided as public Schema.org metadata by Nexus.
 * Search and playback reuse LibreTV QuickPlay; backup English lists stay optional.
 */
(function(){
  'use strict';
  const el=(tag,cls,text)=>{
    const e=document.createElement(tag);
    if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;
  };
  const $=id=>document.getElementById(id);
  const read=k=>{try{return localStorage.getItem(k);}catch{return null;}};
  const save=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
  let root,all=[],picked=null,active=false,nonce=0;
  const dirCache='libretv:nexus:directory:v1';
  const note=text=>{if($('ltNexusStatus'))$('ltNexusStatus').textContent=text;};
  const allowed=item=>!window.LibreContentPolicy?.isAdultVideo({
    vod_name:item.title,type_name:item.title
  });
  function showDirectory(){
    $('ltNexusDirectory').hidden=false;$('ltNexusDetail').hidden=true;
  }
  function renderTopics(query=''){
    const grid=$('ltNexusTopics');grid.replaceChildren();
    const match=all.filter(x=>x.title.toLowerCase().includes(query.toLowerCase()));
    for(const item of match){
      const b=el('button','lt-nexus-topic');
      b.type='button';b.append(el('span','lt-nexus-topic-name',item.title));
      b.append(el('span','lt-nexus-topic-arrow','查看完整片单 →'));
      b.addEventListener('click',()=>openTopic(item));grid.append(b);
    }
    if(!match.length)grid.append(el('p','lt-rank-empty','没有匹配的中文专题'));
    $('ltNexusCount').textContent='共 '+all.length+' 个中文专题 · 当前匹配 '+match.length+' 个';
  }
  function renderItems(data){
    const list=$('ltNexusItems');list.replaceChildren();
    $('ltNexusTitle').textContent=data.title;
    $('ltNexusSummary').textContent=(data.description||'作者维护的影视专题')+
      ' · '+data.items.length+' 部 · 点击海报在本站查找播放';
    $('ltNexusOriginal').href=data.sourceUrl;
    let count=0;
    for(const film of data.items){
      if(!allowed(film))continue;
      count++;
      const wrap=el('article','lt-nexus-film');
      const button=el('button','lt-rank-card');
      button.type='button';button.title='查找《'+film.title+'》的播放线路';
      const poster=el('div','lt-rank-poster');
      const img=el('img','lt-rank-cover');img.alt=film.title;img.loading='lazy';img.referrerPolicy='no-referrer';
      if(/^https:\/\//.test(film.cover||''))img.src=film.cover;
      poster.append(img,el('span','lt-rank-number','#'+film.rank));
      button.append(poster,el('span','lt-rank-name',film.title));
      button.addEventListener('click',()=>{
        if(window.QuickPlay?.open)window.QuickPlay.open({title:film.title,kind:film.kind});
        else note('播放器未加载，请刷新页面。');
      });
      const copy=el('button','lt-nexus-copy','复制片名');
      copy.type='button';copy.addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(film.title);note('已复制《'+film.title+'》');}
        catch{window.prompt('请手动复制片名：',film.title);note('浏览器未授权复制，请使用弹窗中的片名。');}
      });
      wrap.append(button,copy);list.append(wrap);
    }
    note('中文精选专题 · 展示 '+count+' 部 · 源数据：Nexus');
  }
  async function openTopic(item){
    picked=item;
    $('ltNexusDirectory').hidden=true;$('ltNexusDetail').hidden=false;
    $('ltNexusTitle').textContent=item.title;
    $('ltNexusItems').replaceChildren();
    note('正在读取 '+item.title+' 的完整片单…');
    const cacheKey='libretv:nexus:list:'+item.slug;
    try{
      const cache=JSON.parse(read(cacheKey)||'null');
      if(cache?.data?.items?.length&&Date.now()-cache.time<30*60*1000){
        renderItems(cache.data);return;
      }
    }catch{}
    const seq=++nonce;
    try{
      const r=await fetch('/nexus-list?slug='+encodeURIComponent(item.slug),{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      const data=await r.json();
      if(seq!==nonce)return;
      renderItems(data);save(cacheKey,JSON.stringify({time:Date.now(),data}));
    }catch{
      if(seq!==nonce)return;
      try{
        const cache=JSON.parse(read(cacheKey)||'null');
        if(cache?.data?.items?.length){renderItems(cache.data);note('使用上次成功保存的专题内容');return;}
      }catch{}
      note('暂时无法获取该片单，请返回目录选择其他专题。');
    }
  }
  async function loadDirectory(){
    if(all.length){renderTopics($('ltNexusSearch')?.value||'');return;}
    try{
      const cached=JSON.parse(read(dirCache)||'null');
      if(cached?.data?.items?.length&&Date.now()-cached.time<30*60*1000){
        all=cached.data.items;renderTopics();return;
      }
    }catch{}
    note('正在获取中文专题目录…');
    try{
      const r=await fetch('/nexus-directory',{cache:'no-store'});
      if(!r.ok)throw Error('HTTP '+r.status);
      const data=await r.json();
      if(!Array.isArray(data.items)||!data.items.length)throw Error('目录为空');
      all=data.items;save(dirCache,JSON.stringify({time:Date.now(),data}));
      renderTopics($('ltNexusSearch')?.value||'');
      note('来自 Nexus 的中文专题 · 请选择题材');
    }catch{
      try{const cached=JSON.parse(read(dirCache)||'null');
        if(cached?.data?.items?.length){all=cached.data.items;renderTopics();note('使用缓存目录');return;}
      }catch{}
      note('中文专题目录暂时不可用，请稍后重试。');
    }
  }
  function show(){
    active=true;showDirectory();loadDirectory();
  }
  function hide(){active=false;nonce++;}
  function init(target,englishNode){
    root=target;root.className='lt-nexus-content';
    const header=el('div','lt-nexus-header');
    header.append(el('h3','','中文精选片单'));
    header.append(el('p','','其他作者维护的整套中文专题 · 海报 · 排名 · 片名 · 一键找片'));
    const directory=el('div','lt-nexus-directory');directory.id='ltNexusDirectory';
    const search=el('input','lt-nexus-search');search.id='ltNexusSearch';
    search.placeholder='搜索题材：国产剧 / 欧美剧 / 科幻 / 纪录片';
    search.addEventListener('input',()=>renderTopics(search.value));
    const count=el('p','lt-hotlist-status','');count.id='ltNexusCount';
    const topics=el('div','lt-nexus-topics');topics.id='ltNexusTopics';
    directory.append(search,count,topics);
    const detail=el('div','lt-nexus-detail');detail.id='ltNexusDetail';detail.hidden=true;
    const back=el('button','lt-nexus-back','← 返回中文片单目录');back.type='button';
    back.addEventListener('click',()=>{nonce++;showDirectory();});
    const title=el('h3','','');title.id='ltNexusTitle';
    const summary=el('p','lt-hotlist-status','');summary.id='ltNexusSummary';
    const list=el('div','lt-nexus-items');list.id='ltNexusItems';
    const attribution=el('a','lt-nexus-original','查看原作者完整片单');attribution.id='ltNexusOriginal';
    attribution.target='_blank';attribution.rel='noopener noreferrer';attribution.href='https://nexusfilmx.com/rankings';
    detail.append(back,title,summary,list,attribution);
    const status=el('p','lt-hotlist-status','');status.id='ltNexusStatus';
    root.append(header,directory,detail,status);
    const backup=el('button','lt-nexus-back','其他社区英文片单（备用）');
    backup.type='button';backup.addEventListener('click',()=>{
      root.hidden=true;
      const english=$('ltCuratedContent');if(english)english.hidden=false;
      window.LibreCurated?.show();
    });
    root.append(backup);
    const english=englishNode;
    if(english){
      const returnButton=el('button','lt-nexus-back','← 返回中文精选片单');
      returnButton.type='button';returnButton.addEventListener('click',()=>{
        english.hidden=true;root.hidden=false;show();
      });
      english.prepend(returnButton);
    }
  }
  window.LibreNexus={init,show,hide};
})();
