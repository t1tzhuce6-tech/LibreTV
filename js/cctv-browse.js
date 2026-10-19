/* Official CCTV VOD as one native LibreTV browse source; no DR dependency.
   Catalog data from same-origin /cctv-vod; playback stays on official CCTV pages
   until a real permitted media stream is verified. */
(function(root){
  'use strict';
  const KEY='cctv_official',BASE='/cctv-vod';
  const adult=/(色情|成人|无码|AV女优|\bporn\b|\bxxx\b)/i;
  const safeText=(x,n=180)=>String(x??'').trim().slice(0,n);
  const officialLink=x=>{
    try{const u=new URL(x);return u.protocol==='https:'&&u.hostname==='tv.cctv.com'&&
      /^\/\d{4}\/\d{2}\/\d{2}\//.test(u.pathname)&&u.pathname.endsWith('.shtml')?u.href:'';}
    catch{return''}
  };
  const register=()=>root.extendAPISites?.({[KEY]:{name:'央视大全（官方动态）',api:BASE,official:true,searchable:false}});
  async function request(query,signal){
    const u=new URL(BASE,root.location.origin);
    for(const [k,v] of Object.entries(query))u.searchParams.set(k,String(v));
    const r=await fetch(u,{signal,credentials:'same-origin'});
    let data;try{data=await r.json();}catch{throw Error('央视接口未返回有效数据');}
    if(!r.ok)throw Error(data?.error||'央视节目接口暂时不可用');
    return data;
  }
  const categories=async(signal)=>{
    const data=await request({op:'categories'},signal);
    return [...data.categories.map(x=>({type_id:'work:'+x.id,type_name:x.name,type_pid:0})),
      ...data.columns.map(x=>({type_id:'column:'+x.id,type_name:x.name,type_pid:0}))];
  };
  const asVod=(x,kind)=>({
    vod_id:safeText(x.id,95),vod_name:safeText(x.title,170),
    vod_pic:x.poster||'',vod_year:safeText(x.year||'',12),
    vod_remarks:kind==='column'?'往期节目':(x.episodes?'共'+x.episodes+'集':'央视节目'),
    type_name:kind==='column'?'栏目回看':'央视作品',
    _cctv_kind:kind,_cctv_url:x.officialUrl||'',_cctv_brief:x.description||''
  });
  async function list(typeId,page,signal){
    const isColumn=typeId.startsWith('column:');
    const key=typeId.slice(isColumn?7:5);
    if(!key||(!isColumn&&!typeId.startsWith('work:')))throw Error('请选择央视分类');
    const data=await request(isColumn?{op:'column',column:key,page}:{op:'list',cat:key,page},signal);
    const rows=isColumn?data.episodes:data.items;
    if(!Array.isArray(rows))throw Error('央视节目列表格式异常');
    return {list:rows.filter(x=>x.id&&x.title&&!adult.test(x.title)).map(x=>asVod(x,isColumn?'column':'work')),
      pagecount:Math.max(1,Math.ceil((Number(data.total)||0)/(isColumn?20:24)))};
  }
  let dialog,body,title,status,closeButton,abort;
  const make=(tag,cls,label)=>{
    const n=document.createElement(tag);if(cls)n.className=cls;
    if(label!=null)n.textContent=String(label);return n;
  };
  function ensureDialog(){
    if(dialog)return;
    dialog=make('dialog','cctv-dialog');
    const header=make('div','cctv-dialog-head');
    title=make('h2','cctv-dialog-title','央视作品');
    closeButton=make('button','cctv-dialog-close','关闭');closeButton.type='button';
    closeButton.addEventListener('click',()=>dialog.close());
    header.append(title,closeButton);
    status=make('p','cctv-dialog-status','通过央视官方页面播放，站内高清解码仍在验证。');
    body=make('div','cctv-dialog-body');
    dialog.append(header,status,body);document.body.appendChild(dialog);
    dialog.addEventListener('close',()=>{abort?.abort();abort=null;});
  }
  const addEpisode=(target,row)=>{
    const href=officialLink(row.officialUrl);
    if(!href)return false;
    const a=make('a','cctv-episode',safeText(row.title,150)||'播放节目');
    a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.title='在央视官网观看';
    target.append(a);return true;
  };
  async function openDetail(item){
    ensureDialog();abort?.abort();const ctl=new AbortController();abort=ctl;
    title.textContent=safeText(item.vod_name);body.replaceChildren(make('p','','正在获取央视分集…'));
    status.textContent='节目通过央视官方页面观看；站内4K/1080P直连尚未验证。';
    if(!dialog.open)dialog.showModal();
    if(item._cctv_kind==='column'){
      body.replaceChildren();
      const wrap=make('div','cctv-episode-grid');body.append(wrap);
      if(!addEpisode(wrap,{title:item.vod_name,officialUrl:item._cctv_url}))
        body.replaceChildren(make('p','','该期暂未提供有效官方播放页面。'));
      return;
    }
    let page=1,loaded=0,total=0;
    const grid=make('div','cctv-episode-grid');
    const note=make('p','cctv-episode-count','');
    const more=make('button','cctv-more','继续加载选集');more.type='button';
    body.replaceChildren();
    if(item._cctv_brief)body.append(make('p','cctv-description',item._cctv_brief));
    body.append(note,grid,more);
    const load=async()=>{
      more.disabled=true;more.textContent='正在加载…';
      try{
        const data=await request({op:'detail',id:item.vod_id,page},ctl.signal);
        if(ctl.signal.aborted||abort!==ctl)return;
        total=Number(data.total)||0;
        for(const ep of data.episodes||[])if(addEpisode(grid,ep))loaded++;
        note.textContent='已显示 '+loaded+' / '+(total||loaded)+' 集';
        page++;
        const canMore=total>page*100-100&&(data.episodes||[]).length>0&&page<=100;
        more.hidden=!canMore;more.disabled=!canMore;more.textContent='加载更多集数';
        if(!loaded)note.textContent='当前未获得可用的官方分集播放页';
      }catch(e){
        if(ctl.signal.aborted)return;
        more.disabled=false;more.textContent='重试加载';
        note.textContent=e.message||'获取分集失败';
      }
    };
    more.addEventListener('click',load);
    await load();
  }
  register();
  root.CctvBrowse=Object.freeze({KEY,register,isSource:id=>id===KEY,categories,list,openDetail});
})(window);
