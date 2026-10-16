/* Native LibreTV DR page. All data comes from the fixed /dr-data drpyS bridge.
   No iQIYI ranks, no old LibreTV VOD pool, no external iframe. */
(function(root){
  'use strict';
  const state={sources:[],source:'',category:'',categories:[],mode:'home',query:'',page:1,more:false,items:[],currentRequest:null};
  const el=id=>document.getElementById(id);
  function text(id,value){el(id).textContent=value;}
  function status(message,error=false){const node=el('dr-status');node.textContent=message;node.classList.toggle('is-error',error);}
  async function get(params,signal){
    const url=new URL('/dr-data',location.origin);
    Object.entries(params).forEach(([key,value])=>{if(value!=null&&value!=='')url.searchParams.set(key,String(value));});
    const r=await fetch(url,{signal,credentials:'same-origin',cache:'no-store'});
    let data;
    try{data=await r.json();}catch{throw new Error('DR 返回的不是有效 JSON');}
    if(!r.ok){
      if(data?.code==='DR_NOT_CONFIGURED')throw new Error('DR 后端尚未部署或配置；需要先设置服务端 DR_BACKEND_URL。');
      if(data?.code==='DR_SOURCES_NOT_APPROVED')throw new Error('DR 尚未配置审核通过的影视源；不会直接混入未审查的来源。');
      throw new Error(data?.error||'DR 数据获取失败');
    }
    return data;
  }
  function make(tag,cls,value){
    const node=document.createElement(tag);if(cls)node.className=cls;
    if(value!=null)node.textContent=String(value);return node;
  }
  function empty(message){
    const node=make('div','dr-empty');
    node.append(make('strong','',message),make('p','','这里仅展示 DR 服务提供的数据。'));
    el('dr-grid').replaceChildren(node);
  }
  let detailRequest=null;
  async function resolveEpisode(source,flag,playId,title){
    const statusEl=el('dr-play-status');
    statusEl.textContent='正在调用 DR 解析当前选集……';
    statusEl.classList.remove('is-error');
    try{
      const data=await get({op:'play',source,play:playId,flag});
      if(data.status!=='ready'||!data.url)throw new Error(data.reason||'该线路暂时无法直接播放');
      const url=new URL('player.html',location.origin);
      url.searchParams.set('dr','1');url.searchParams.set('source','DR影视');
      url.searchParams.set('url',data.url);
      url.searchParams.set('title',title);
      url.searchParams.set('returnUrl',location.href);
      location.assign(url.href);
    }catch(e){
      statusEl.textContent=e.message||'DR 播放解析失败';
      statusEl.classList.add('is-error');
    }
  }
  async function openDetail(item){
    if(!item.id)return;
    detailRequest?.abort();
    const controller=new AbortController();detailRequest=controller;
    const dialog=el('dr-detail'),content=el('dr-detail-content');
    text('dr-detail-title',item.title);
    content.replaceChildren(make('p','', '正在从 DR 读取详情与剧集……'));
    text('dr-play-status','请选择一集播放。');
    el('dr-play-status').classList.remove('is-error');
    if(!dialog.open)dialog.showModal();
    const selectedSource=state.source;
    try{
      const data=await get({op:'detail',source:selectedSource,id:item.id},controller.signal);
      if(detailRequest!==controller||!dialog.open)return;
      content.replaceChildren();
      if(data.description)content.append(make('p','',data.description));
      for(const line of data.lines||[]){
        const group=make('section','dr-line'),heading=make('h3','',line.name);
        const episodes=make('div','dr-episodes');
        for(const episode of line.episodes){
          const btn=make('button','dr-episode',episode.name);
          btn.type='button';
          btn.addEventListener('click',()=>resolveEpisode(selectedSource,line.flag,episode.id,item.title));
          episodes.append(btn);
        }
        group.append(heading,episodes);content.append(group);
      }
      if(!data.lines?.length)content.append(make('p','','DR 没有提供可选择的播放线路。'));
    }catch(e){
      if(controller.signal.aborted)return;
      content.replaceChildren(make('p','',e.message||'DR 影片详情暂时不可用'));
    }
  }

  function renderCards(items,append=false){
    const grid=el('dr-grid');
    if(!append)grid.replaceChildren();
    for(const item of items){
      const card=make('button','dr-film dr-film-button');
      card.type='button';card.addEventListener('click',()=>openDetail(item));
      const cover=make('div','dr-film-cover');
      if(item.poster){
        const img=make('img');img.src=item.poster;img.alt='';img.loading='lazy';
        img.referrerPolicy='no-referrer';img.addEventListener('error',()=>{img.remove();cover.textContent='DR';},{once:true});cover.append(img);
      }else cover.textContent='DR';
      const copy=make('div','dr-film-copy');
      copy.append(make('h3','dr-film-title',item.title),make('div','dr-film-meta',[item.year,item.type,item.remarks].filter(Boolean).join(' · ')));
      card.append(cover,copy);grid.append(card);
    }
    if(!grid.childElementCount)empty('本分类暂无可展示的 DR 影片');
  }
  function categoriesUI(){
    const wrap=el('dr-categories');wrap.replaceChildren();
    if(!state.categories.length)return;
    const rows=[{id:'',name:'推荐'},...state.categories];
    for(const category of rows){
      const btn=make('button','dr-category'+(category.id===state.category&&state.mode!=='search'?' is-current':''),category.name);
      btn.type='button';
      btn.addEventListener('click',()=>{
        if(category.id)load('category',{category:category.id,page:1});
        else load('home',{page:1});
      });
      wrap.append(btn);
    }
  }
  function heading(){
    const source=state.sources.find(x=>x.key===state.source)?.name||'DR';
    const name=state.mode==='search'?'搜索：“'+state.query+'”':state.mode==='category'?(state.categories.find(c=>c.id===state.category)?.name||'DR 分类'):'DR 首页推荐';
    text('dr-heading',name);
    text('dr-mode-label',source);
    el('dr-home').disabled=!state.source;
    el('dr-more').hidden=!state.more;
    categoriesUI();
  }
  async function load(mode,{category='',query='',page=1}={}){
    if(!state.source)return;
    state.currentRequest?.abort();
    const controller=new AbortController();state.currentRequest=controller;
    const continuing=page>1&&state.mode===mode;
    if(!continuing){
      state.mode=mode;state.category=category;state.query=query;state.items=[];
      empty('正在读取 DR 内容……');
    }
    state.page=page;state.more=false;
    heading();
    status('正在获取 '+(mode==='search'?'DR 搜索结果':mode==='category'?'DR 分类内容':'DR 首页推荐')+'……');
    try{
      const params={op:mode,source:state.source,page};
      if(mode==='search')params.q=query||state.query;
      if(mode==='category')params.cat=category||state.category;
      const data=await get(params,controller.signal);
      if(state.currentRequest!==controller)return;
      if(mode==='home')state.categories=data.categories||[];
      state.items.push(...data.items);
      state.more=Boolean(data.more)&&state.items.length<400;
      renderCards(data.items,continuing);
      status(state.items.length?'已展示 '+state.items.length+' 部 DR 影片':'当前 DR 源没有返回内容');
      heading();
    }catch(e){
      if(controller.signal.aborted)return;
      state.more=false;heading();
      if(!continuing)empty('DR 内容暂时不可用');
      status(e?.message||'DR 服务错误',true);
    }
  }
  async function refresh(){
    state.currentRequest?.abort();
    const controller=new AbortController();state.currentRequest=controller;
    const selection=state.source;state.sources=[];state.source='';state.categories=[];
    const select=el('dr-source');select.disabled=true;
    select.replaceChildren(new Option('正在获取 DR 源……',''));
    empty('正在连接 DR 服务……');status('正在检查 DR 服务与影视源审核名单……');
    el('dr-home').disabled=true;el('dr-more').hidden=true;
    try{
      const result=await get({op:'sources'},controller.signal);
      if(state.currentRequest!==controller)return;
      state.sources=result.sources||[];
      select.replaceChildren();
      if(!state.sources.length){
        select.append(new Option('暂无审核通过的 DR 影视源',''));
        empty('没有可以显示的 DR 源');
        status('DR 后端已响应，但没有进入审核名单的影视源。',true);return;
      }
      for(const s of state.sources)select.append(new Option(s.name,s.key));
      select.disabled=false;
      state.source=state.sources.some(s=>s.key===selection)?selection:state.sources[0].key;
      select.value=state.source;
      const initialQuery=new URLSearchParams(location.search).get('q')?.trim().slice(0,85);
      if(initialQuery){el('dr-search-input').value=initialQuery;await load('search',{query:initialQuery});}
      else await load('home');
    }catch(e){
      if(controller.signal.aborted)return;
      select.replaceChildren(new Option('DR 服务未连接',''));
      empty('DR 尚未接通');
      status(e.message,true);
    }
  }
  function init(){
    el('dr-source').addEventListener('change',ev=>{
      const query=state.mode==='search'?state.query:'';
      state.source=ev.target.value;state.categories=[];
      if(query)load('search',{query});else load('home');
    });
    el('dr-reload').addEventListener('click',refresh);
    el('dr-detail-close').addEventListener('click',()=>el('dr-detail').close());
    el('dr-detail').addEventListener('close',()=>detailRequest?.abort());
    el('dr-home').addEventListener('click',()=>load('home'));
    el('dr-search-form').addEventListener('submit',ev=>{
      ev.preventDefault();const query=el('dr-search-input').value.trim();
      if(query&&state.source)load('search',{query,page:1});
      else if(!state.source)status('需要先连接 DR 服务，再进行搜索。',true);
    });
    el('dr-more').addEventListener('click',()=>{
      if(!state.more)return;
      load(state.mode,{page:state.page+1,query:state.query,category:state.category});
    });
    refresh();
  }
  root.DrNative={state,load,refresh};
  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
    else init();
  }
})(typeof window!=='undefined'?window:globalThis);
