/* One LibreTV site, two independently addressable discovery views. */
(function(root){
 'use strict';
 const VIEW_KEY='libretv:discovery-view';
 function readView(){
   const q=new URL(root.location.href).searchParams.get('view');
   if(q==='sources'||q==='ranks')return q;
   try{return root.localStorage.getItem(VIEW_KEY)==='sources'?'sources':'ranks'}catch{return 'ranks'}
 }
 function init(){
   const search=root.document.getElementById('searchArea');
   const hot=root.document.getElementById('ltHotList');
   const library=root.document.getElementById('ltExplore');
   if(!search||!hot||!library)return;
   const bar=root.document.createElement('nav');bar.className='lt-discovery-nav';bar.id='ltDiscoveryNav';
   bar.setAttribute('aria-label','影视内容页面');
   const buttons={};
   for(const [key,label,description] of [['sources','片源库','按每个来源自己的目录浏览'],['ranks','热榜发现','按真实榜单找片']]){
     const a=root.document.createElement('a');a.href='?view='+key;a.className='lt-discovery-link';
     const strong=root.document.createElement('strong');strong.textContent=label;
     const sub=root.document.createElement('small');sub.textContent=description;
     a.append(strong,sub);
     a.addEventListener('click',event=>{
       if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
       event.preventDefault();select(key,true);
     });
     buttons[key]=a;bar.append(a);
   }
   // True homepage order: search and history, two navigation cards, then selected content.
   search.insertAdjacentElement('afterend',bar);
   bar.insertAdjacentElement('afterend',hot);
   hot.insertAdjacentElement('afterend',library);
   const history=root.document.getElementById('ltInlineHistory');
   const continueWatching=root.document.getElementById('continueWatching');
   if(history&&continueWatching)history.append(continueWatching);
   function select(value,push){
     const view=value==='sources'?'sources':'ranks';
     root.document.body.classList.toggle('lt-view-sources',view==='sources');
     root.document.body.classList.toggle('lt-view-ranks',view==='ranks');
     for(const [key,a] of Object.entries(buttons)){
       a.classList.toggle('is-current',key===view);
       if(key===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
     }
     try{root.localStorage.setItem(VIEW_KEY,view)}catch{}
     if(push){const u=new URL(root.location.href);u.searchParams.set('view',view);root.history.pushState({view},'',u.pathname+u.search+u.hash)}
     // Keep the same global search and history above both views.
     // The ranking/source sections remain live and retain their own selections.
   }
   root.addEventListener('popstate',()=>select(readView(),false));
   select(readView(),false);
 }
 root.document?.addEventListener('DOMContentLoaded',init);
})(typeof window!=='undefined'?window:globalThis);
