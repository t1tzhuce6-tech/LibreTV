/* LibreTV + drpyS dual portal: connects to an independently hosted DrPlayer UI. */
(function(root){
 'use strict';
 const KEY='libretv:dr-service-url:v1';
 const PATH='/apps/drplayer/';
 function canonicalize(value){
   if(typeof value!=='string'||!value.trim())throw new Error('请填写 DR 服务地址。');
   let url;
   try{url=new URL(value.trim());}catch{throw new Error('请输入完整的 http:// 或 https:// 网址。');}
   if(url.protocol!=='https:'&&url.protocol!=='http:')throw new Error('只允许 HTTP 或 HTTPS 服务地址。');
   if(url.username||url.password||url.search||url.hash)throw new Error('请移除网址中的账号、密码、参数和 # 片段。');
   const hostname=url.hostname.toLowerCase();
   const privateHost=['localhost','127.0.0.1','[::1]'].includes(hostname)||/^(?:10\.\d+|192\.168\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+)\.\d+$/.test(hostname);
   if(url.protocol==='http:'&&!privateHost)throw new Error('公网 DR 服务请使用 HTTPS；HTTP 仅允许本机或局域网。');
   if(url.pathname!=='/'&&url.pathname!=='/apps/drplayer'&&url.pathname!==PATH)throw new Error('只允许服务首页或 /apps/drplayer/ 地址。');
   url.pathname=PATH;url.search='';url.hash='';
   return url.href;
 }
 function bootstrap(doc,store,config){
   const el=id=>doc.getElementById(id);
   const input=el('dr-url'),frame=el('dr-frame'),empty=el('dr-empty'),badge=el('dr-state'),state=el('dr-indicator'),err=el('dr-error'),open=el('dr-open'),reload=el('dr-reload');
   let current=null;
   function message(value,error=false){badge.textContent=value;badge.className='dr-state'+(error?' is-error':' is-ready');}
   function error(value){err.hidden=false;err.textContent=value;message('地址不可用',true);}
   function hideError(){err.hidden=true;err.textContent='';}
   function display(url){
     current=url;input.value=url;hideError();open.disabled=false;reload.disabled=false;
     if(root.location?.protocol==='https:'&&url.startsWith('http:')){
       frame.hidden=true;frame.removeAttribute('src');empty.hidden=false;
       state.textContent='当前服务使用 HTTP，无法嵌入 HTTPS 页面';message('已配置 · 仅可单独打开');
     }else{
       empty.hidden=true;frame.hidden=false;frame.src=url;
       state.textContent='正在尝试嵌入 DR。如显示空白，请在新标签页打开';message('尝试连接中');
     }
   }
   function clear(){
     current=null;input.value='';frame.removeAttribute('src');frame.hidden=true;empty.hidden=false;open.disabled=true;reload.disabled=true;state.textContent='等待连接';hideError();badge.textContent='未配置';badge.className='dr-state';
     try{store.removeItem(KEY)}catch{}
   }
   el('dr-form').addEventListener('submit',ev=>{
     ev.preventDefault();
     try{const url=canonicalize(input.value);store.setItem(KEY,url);display(url);}catch(e){error(e.message);}
   });
   open.addEventListener('click',()=>{if(current)root.open(current,'_blank','noopener,noreferrer');});
   reload.addEventListener('click',()=>{if(current)display(current);});
   el('dr-clear').addEventListener('click',clear);
   let saved;try{saved=store.getItem(KEY);}catch{}
   const preset=config?.defaultUrl||'';
   const initial=saved||(!preset.includes('{{')?preset:'');
   if(initial){try{display(canonicalize(initial));}catch{clear();}}
   return {display,clear,getCurrent:()=>current};
 }
 root.DrPortal={canonicalize,bootstrap};
 if(typeof document!=='undefined'){
   const load=()=>bootstrap(document,root.localStorage,{defaultUrl:root.__DR_DEFAULT_URL__});
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});
   else load();
 }
})(typeof window!=='undefined'?window:globalThis);
