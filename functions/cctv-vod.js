/* CCTV dynamic read-only catalog API. Single fixed upstream domain.
   Content is fetched live; no third-party executable rules or video relay. */
const API='https://api.cntv.cn';
export const CATEGORIES=Object.freeze({
 documentary:{label:'纪录片',channelid:'CHAL1460955924871139',fc:'纪录片',channel:''},
 tv:{label:'电视剧',channelid:'CHAL1460955853485115',fc:'电视剧',area:''},
 animation:{label:'动画片',channelid:'CHAL1460955899450127',fc:'动画片',area:''},
 special:{label:'特别节目',channelid:'CHAL1460955953877151',fc:'特别节目',channel:''}
});
export const COLUMNS=Object.freeze({
 xwlb:{label:'新闻联播',id:'TOPC1451528971114112'},
 xwzk:{label:'新闻周刊',id:'TOPC1451559180488841'},
 jrsf:{label:'今日说法',id:'TOPC1451464665008914'},
 bjjt:{label:'百家讲坛',id:'TOPC1451557052519584'},
 tsfx:{label:'探索·发现',id:'TOPC1451557893544236'},
 jjxxll:{label:'经济信息联播',id:'TOPC1451533782742171'}
});
const clean=(x,n=170)=>String(x??'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n);
const httpsUrl=x=>{try{const u=new URL(String(x||''));return u.protocol==='https:'&&u.username===''&&u.password===''?u.href:''}catch{return''}};
const response=(body,status=200,ttl=0)=>Response.json(body,{status,headers:{'Cache-Control':ttl?'public, max-age='+ttl+', stale-while-revalidate=120':'no-store','X-Content-Type-Options':'nosniff'}});
async function getJson(path,parameters){
 const u=new URL(path,API);
 for(const [k,v] of Object.entries(parameters))u.searchParams.set(k,String(v));
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
 try{
  const r=await fetch(u,{signal:ctl.signal,redirect:'error',headers:{Accept:'application/json',Referer:'https://tv.cctv.com/'}});
  if(!r.ok||Number(r.headers.get('content-length'))>1400000)throw Error('Upstream unavailable');
  const t=await r.text();if(t.length>1400000)throw Error('Upstream oversized');
  const j=JSON.parse(t);
  if(!j?.data||!Array.isArray(j.data.list))throw Error('Upstream schema changed');
  return j.data;
 }finally{clearTimeout(timer)}
}
const contentItem=(r)=>({
 id:clean(r.id||r.vsetid||r.guid,85),
 title:clean(r.title,150),poster:httpsUrl(r.image||r.image3||r.image2),
 description:clean(r.brief,600),year:clean(r.year,9),
 episodes:Number(r.count)||null,officialUrl:httpsUrl(r.url),kind:'work'
});
const episode=(r)=>({
 id:clean(r.guid||r.id||r.video?.id,90),
 title:clean(r.title,170),officialUrl:httpsUrl(r.url),
 poster:httpsUrl(r.image),duration:clean(r.length,25),time:clean(r.time,40)
});
const validPage=p=>Number.isSafeInteger(p)&&p>=1&&p<=100;
export async function onRequestGet({request}){
 const q=new URL(request.url).searchParams,op=q.get('op')||'categories',page=Number(q.get('page')||1);
 if(!['categories','list','detail','column'].includes(op))return response({error:'Unsupported operation'},400);
 if(!validPage(page))return response({error:'Invalid page'},400);
 if(op==='categories')return response({
  source:'cctv',name:'央视大全',
  categories:Object.entries(CATEGORIES).map(([id,v])=>({id,name:v.label})),
  columns:Object.entries(COLUMNS).map(([id,v])=>({id,name:v.label}))
 },200,600);
 try{
  if(op==='list'){
   const key=q.get('cat')||'documentary',category=CATEGORIES[key];
   if(!category)return response({error:'Unknown category'},400);
   const params={channelid:category.channelid,fc:category.fc,sc:'',year:'',letter:'',p:page,n:24,serviceId:'tvcctv',topv:1,t:'json'};
   if('channel'in category)params.channel='';else params.area='';
   const data=await getJson('/list/getVideoAlbumList',params);
   const items=data.list.map(contentItem).filter(v=>v.id&&v.title);
   return response({source:'cctv',category:key,page,total:Number(data.total)||0,
    more:items.length===24&&page*24<(Number(data.total)||Infinity),items},200,480);
  }
  if(op==='detail'){
   const id=q.get('id')||'';
   if(!/^VID[A-Za-z0-9]{15,48}$/.test(id))return response({error:'Invalid album ID'},400);
   const data=await getJson('/NewVideo/getVideoListByAlbumIdNew',
    {id,serviceId:'tvcctv',p:page,n:100,mode:0,pub:1});
   return response({source:'cctv',id,page,total:Number(data.total)||0,
    episodes:data.list.map(episode).filter(v=>v.id&&v.title),
    playbackStatus:'unverified',playback:'official-page-only'},200,300);
  }
  const key=q.get('column')||'xwlb',column=COLUMNS[key];
  if(!column)return response({error:'Unknown column'},400);
  const data=await getJson('/NewVideo/getVideoListByColumn',
   {id:column.id,n:20,p:page,sort:'desc',mode:0,serviceId:'tvcctv'});
  return response({source:'cctv',column:key,name:column.label,page,total:Number(data.total)||0,
   episodes:data.list.map(episode).filter(v=>v.id&&v.title)},200,300);
 }catch(e){return response({error:'CCTV upstream temporarily unavailable or changed',code:'CCTV_UPSTREAM'},502)}
}
