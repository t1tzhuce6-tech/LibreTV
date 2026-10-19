/* CCTV official dynamic VOD -> LibreTV's existing MacCMS catalog contract.
   Fixed official upstream hosts only; no arbitrary proxy, DRM or stream relay. */
const CNTV='https://api.cntv.cn',SEARCH='https://search.cctv.com';
export const CATS=Object.freeze({
 documentary:{title:'纪录片',channelid:'CHAL1460955924871139',fc:'纪录片'},
 tv:{title:'电视剧',channelid:'CHAL1460955853485115',fc:'电视剧'},
 animation:{title:'动画片',channelid:'CHAL1460955899450127',fc:'动画片'},
 special:{title:'特别节目',channelid:'CHAL1460955953877151',fc:'特别节目'}
});
export const COLUMNS=Object.freeze({
 xwlb:{title:'新闻联播',id:'TOPC1451528971114112'},
 xwzk:{title:'新闻周刊',id:'TOPC1451559180488841'},
 jrsf:{title:'今日说法',id:'TOPC1451464665008914'},
 bjjt:{title:'百家讲坛',id:'TOPC1451557052519584'},
 tsfx:{title:'探索·发现',id:'TOPC1451557893544236'},
 jjxxll:{title:'经济信息联播',id:'TOPC1451533782742171'}
});
const clean=(v,n=170)=>String(v??'').replace(/<[^>]*>/g,'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,n);
const official=(v)=>{try{const u=new URL(String(v||''));return u.protocol==='https:'&&u.hostname==='tv.cctv.com'&&/^\/\d{4}\/\d{2}\/\d{2}\//.test(u.pathname)&&u.pathname.endsWith('.shtml')?u.href:''}catch{return''}};
const poster=(v)=>{try{const u=new URL(String(v||''));return u.protocol==='https:'&&u.hostname.endsWith('.cctvpic.com')?u.href:''}catch{return''}};
const reply=(obj,status=200)=>Response.json(obj,{status,headers:{'Cache-Control':status===200?'public, max-age=240, stale-while-revalidate=300':'no-store','X-Content-Type-Options':'nosniff'}});
const PAGE_SIZE=24;
async function fetchOfficial(base,path,params,signal){
 const u=new URL(path,base);
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
 const controller=new AbortController(),abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),base===SEARCH?16000:10000);
 try{
  const r=await fetch(u,{signal:controller.signal,redirect:'error',headers:{Accept:'application/json',Referer:'https://tv.cctv.com/'}});
  if(!r.ok||Number(r.headers.get('content-length'))>1300000)throw Error('upstream '+r.status);
  const body=await r.text();if(body.length>1300000)throw Error('upstream too large');
  const data=JSON.parse(body);return data;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
}
const asWork=(x)=>({
 vod_id:clean(x.id,95),vod_name:clean(x.title,180),vod_pic:poster(x.image||x.image3),
 vod_year:clean(x.year,12),vod_remarks:x.count?'共'+clean(x.count,5)+'集':'央视节目',
 vod_content:clean(x.brief,600),type_name:clean(x.fc||x.channel,70),
 vod_time:clean(x.focus_date||'',45),vod_play_from:'央视官网'
});
const asEpisode=(x,prefix)=>({
 vod_id:prefix+clean(x.guid||x.id,90),vod_name:clean(x.title,180),
 vod_pic:poster(x.image||x.imglink),type_name:'央视往期',
 vod_time:clean(x.time||x.uploadtime||'',35),
 vod_remarks:'央视官网',officialUrl:official(x.url||x.urllink)
});
const classList=()=>[
 ...Object.entries(CATS).map(([id,v])=>({type_id:'work:'+id,type_pid:0,type_name:v.title})),
 ...Object.entries(COLUMNS).map(([id,v])=>({type_id:'column:'+id,type_pid:0,type_name:v.title}))
];
const listReply=(list,pg,total,limit=PAGE_SIZE)=>({code:1,msg:'success',page:pg,pagecount:Math.max(1,Math.ceil((Number(total)||0)/limit)),limit,total:Number(total)||0,list});
const vidFromUrl=(link)=>{const url=official(link);if(!url)return '';const m=new URL(url).pathname.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/(VIDE[A-Za-z0-9]+)\.shtml$/);return m?'s_'+m[1]+m[2]+m[3]+'_'+m[4]:''};
const urlFromVid=(id)=>{const m=String(id).match(/^s_(\d{4})(\d{2})(\d{2})_(VIDE[A-Za-z0-9]{15,50})$/);return m?official('https://tv.cctv.com/'+m[1]+'/'+m[2]+'/'+m[3]+'/'+m[4]+'.shtml'):''};
async function catalog(type,page,signal){
 if(type.startsWith('column:')){
  const entry=COLUMNS[type.slice(7)];if(!entry)return null;
  const raw=await fetchOfficial(CNTV,'/NewVideo/getVideoListByColumn',{id:entry.id,d:'',p:page,n:20,sort:'desc',mode:0,serviceId:'tvcctv',t:'json'},signal);
  const rows=raw?.data?.list;if(!Array.isArray(rows))throw Error('column schema');
  return listReply(rows.map(x=>{
   const id=vidFromUrl(x.url);
   return id?{vod_id:id,vod_name:clean(x.title),vod_pic:poster(x.image),
     vod_remarks:'央视官网',type_name:entry.title,vod_time:clean(x.time||'',50)}:null;
  }).filter(Boolean),page,raw.data.total,20);
 }
 const entry=CATS[type.startsWith('work:')?type.slice(5):'documentary'];
 if(!entry)return null;
 const params={channelid:entry.channelid,fc:entry.fc,sc:'',year:'',letter:'',p:page,n:PAGE_SIZE,serviceId:'tvcctv',topv:1,t:'json'};
 if(type==='work:tv'||type==='work:animation')params.area='';else params.channel='';
 const raw=await fetchOfficial(CNTV,'/list/getVideoAlbumList',params,signal);
 if(!Array.isArray(raw?.data?.list))throw Error('catalog schema');
 return listReply(raw.data.list.map(asWork).filter(x=>x.vod_id&&x.vod_name),page,raw.data.total);
}
async function searchCctv(query,signal){
 const p={page:1,qtext:query,sort:'relevance',pageSize:20,type:'video',vtime:-1,datepid:1,channel:'',pageflag:0,qtext_str:query};
 const raw=await fetchOfficial(SEARCH,'/ifsearch.php',p,signal);
 if(!Array.isArray(raw?.list))throw Error('search schema');
 const list=raw.list.map(x=>{const id=vidFromUrl(x.urllink);return id?{
  vod_id:id,vod_name:clean(x.all_title||x.title),
  vod_pic:poster(x.imglink),vod_official_url:urlFromVid(id),vod_year:clean(x.uploadtime,10),
  vod_time:clean(x.uploadtime,30),type_name:clean(x.channel,45),vod_remarks:'央视官网'
 }:null}).filter(x=>x?.vod_name);
 return {...listReply(list,1,list.length,20),pagecount:1};
}
async function detail(id,signal){
 if(urlFromVid(id)){
  const link=urlFromVid(id);
  const video={vod_id:id,vod_name:'央视节目',vod_play_from:'央视官网',vod_play_url:'在央视官网观看$'+link,
   vod_remarks:'官网观看；非LibreTV直链'};
  return {list:[video],playback:'official-page-only'};
 }
 if(!/^VIDA[A-Za-z0-9]{15,50}$/.test(id))return null;
 const params={id,serviceId:'tvcctv',p:1,n:100,mode:0,pub:1};
 const raw=await fetchOfficial(CNTV,'/NewVideo/getVideoListByAlbumIdNew',params,signal);
 const data=raw?.data;if(!Array.isArray(data?.list))throw Error('detail schema');
 const pages=Math.min(5,Math.ceil((Number(data.total)||data.list.length)/100));
 let episodes=[...data.list];
 for(let n=2;n<=pages;n++){
  const extra=await fetchOfficial(CNTV,'/NewVideo/getVideoListByAlbumIdNew',{...params,p:n},signal);
  if(!Array.isArray(extra?.data?.list))break;
  episodes.push(...extra.data.list);
 }
 const valid=episodes.map(x=>({title:clean(x.title,150),link:official(x.url)})).filter(x=>x.title&&x.link);
 const first=valid[0]?.title||'央视作品';
 return {list:[{vod_id:id,vod_name:first.replace(/\s*(?:第\s*\d+\s*集).*$/,''),
   vod_remarks:'央视官网播放',vod_play_from:'央视官网',
   vod_play_url:valid.map(x=>x.title.replace(/[$#]/g,'')+'$'+x.link).join('#'),
   vod_content:'节目视频使用央视官方观看页面；尚未验证站内高清媒体解码。'}],playback:'official-page-only',episodeCount:valid.length};
}
export async function onRequestGet({request}){
 const q=new URL(request.url).searchParams;
 const ac=q.get('ac')||'list',page=Number(q.get('pg')||'1');
 if(!['list','videolist','detail'].includes(ac))return reply({error:'Unsupported action'},400);
 if(!Number.isSafeInteger(page)||page<1||page>100)return reply({error:'Invalid page'},400);
 if(ac==='list')return reply({class:classList(),...listReply([],1,0)});
 try{
  if(ac==='detail'){
   const id=q.get('ids')||q.get('id')||'';
   if(id.length>110)return reply({error:'Invalid ID'},400);
   const d=await detail(id,request.signal);
   return d?reply(d):reply({error:'Unknown video ID'},404);
  }
  const wd=clean(q.get('wd')||'',55);
  if(wd.length>0)return reply(await searchCctv(wd,request.signal));
  const t=q.get('t')||'work:documentary';
  if(!Object.hasOwn(CATS,t.slice(5))&&!Object.hasOwn(COLUMNS,t.slice(7)))
   return reply({error:'Unknown category'},400);
  const list=await catalog(t,page,request.signal);
  return list?reply(list):reply({error:'Unknown category'},400);
 }catch{return reply({error:'CCTV upstream temporarily unavailable',code:'CCTV_UPSTREAM'},502)}
}
