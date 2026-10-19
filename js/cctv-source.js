/* One official CCTV source inside the existing LibreTV source registry.
   No DR, no separate catalog page, no media encryption bypass. */
(function(root){
 'use strict';
 const ID='cctv_official';
 const origin=root.location?.origin||'';
 if(!/^https?:\/\//.test(origin))return;
 const api=origin+'/cctv-vod';
 root.extendAPISites?.({[ID]:{
  name:'🌟央视大全',api,searchable:true,official:true,
  origin:'official',description:'央视官方动态点播；官网观看'
 }});
 const safeLink=x=>{try{
  const u=new URL(String(x||''));
  return u.protocol==='https:'&&u.hostname==='tv.cctv.com'&&
   /^\/\d{4}\/\d{2}\/\d{2}\//.test(u.pathname)&&u.pathname.endsWith('.shtml')?u.href:'';
 }catch{return''}};
 const get=(id)=>fetch(api+'?ac=detail&ids='+encodeURIComponent(id),{credentials:'same-origin'});
 const el=(tag,txt,css)=>{const n=root.document.createElement(tag);if(txt)n.textContent=txt;if(css)n.className=css;return n};
 function parseEpisodes(vod){
  return String(vod?.vod_play_url||'').split('#').map(x=>{
   const pos=x.indexOf('$');if(pos<0)return null;
   const link=safeLink(x.slice(pos+1));if(!link)return null;
   return {title:x.slice(0,pos).trim().slice(0,160),link};
  }).filter(Boolean).sort((a,b)=>{
   const aa=a.title.match(/第\s*(\d+)\s*集/),bb=b.title.match(/第\s*(\d+)\s*集/);
   return aa&&bb?Number(aa[1])-Number(bb[1]):0;
  });
 }
 async function openDetail(id,title){
  const modal=root.document.getElementById('modal'),
        content=root.document.getElementById('modalContent'),
        head=root.document.getElementById('modalTitle');
  if(!modal||!content||!head)return;
  head.textContent=(title||'央视节目')+'（🌟央视大全）';
  content.replaceChildren(el('p','正在加载央视官方分集…','text-gray-300'));
  modal.classList.remove('hidden');
  try{
   const r=await get(id),data=await r.json();
   if(!r.ok)throw Error(data?.error||'官方接口暂不可用');
   const episodes=parseEpisodes(data?.list?.[0]);
   if(!episodes.length)throw Error('这部作品暂未提供可用的官网分集地址');
   const container=el('div','', 'cctv-official-episodes');
   const note=el('p','央视官方视频页面播放；LibreTV 暂不宣称站内1080P/4K直连。','cctv-official-hint');
   container.append(note);
   const grid=el('div','','cctv-official-grid');
   for(const ep of episodes){
    const a=el('a',ep.title||'观看','cctv-official-episode');
    a.href=ep.link;a.target='_blank';a.rel='noopener noreferrer';
    grid.append(a);
   }
   container.append(grid);content.replaceChildren(container);
  }catch(err){content.replaceChildren(el('p',err.message||'获取央视分集失败','text-red-400'))}
 }
 root.CctvSource=Object.freeze({ID,api,isOfficial:id=>id===ID,parseEpisodes,openDetail,safeLink});
})(typeof window!=='undefined'?window:globalThis);
