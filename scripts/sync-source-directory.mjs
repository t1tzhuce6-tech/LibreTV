import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const api='https://www.ziyuanzu.com/api/v1/sources?limit=100';
const outFile=path.join(root,'js','auto-source-feed.js');
const jsonFile=path.join(root,'data','auto-source-directory.json');
const adultName=/(?:成人|色情|情色|无码|伦理片?|福利|番号|有码|国产自拍|自拍|AV资源站|AV资源|AV采集|porn|xxx|18禁|色仓|黄色仓库|老牌X|老牌x|155资源站|色站|麻豆|奶香香|大X子|精品X|黑料|涩|黄色|情色)/i;
const adultHosts=new Set(['155api.com','apilj.com','shayuapi.com','xxavs.com','api.ddapi.cc','hsckzy.vip','jipinvip.com','yutuzy10.com','siwazyw.tv','ckzy.me','ckzy1.com','www.ckzy1.com','jkunzyapi.com','api.bwzyz.com','www.heiliaozyapi.com','heiliaozyapi.com','api.heiapi.cc','fqzy.me','www.jingpinx.com','jingpinx.com','naixxzy.com','apidanaizi.com','jipinvip1.com']);
function canonical(value){
 try{
  const u=new URL(String(value||'').trim());
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.hash||u.search)return null;
  if(!u.hostname||u.hostname==='localhost'||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.test')||u.hostname.endsWith('.example')||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(u.hostname)||u.hostname.includes(':'))return null;
  if(u.port&&!((u.protocol==='https:'&&u.port==='443')||(u.protocol==='http:'&&u.port==='80')))return null;
  if(!u.pathname||u.pathname==='/')return null;
  return u.origin.toLowerCase()+u.pathname.replace(/\/+$/,'');
 }catch{return null}
}
function safeStatus(raw){
 const code=String(raw||'').trim().toLowerCase();
 return code==='ok'||code==='online'?'online':'pending';
}
async function main(){
 const res=await fetch(api,{signal:AbortSignal.timeout(15000),headers:{accept:'application/json'}});
 if(!res.ok)throw Error('Catalog HTTP '+res.status);
 const response=await res.json(),rows=response?.data;
 if(!Array.isArray(rows)||rows.length<40||rows.length>1000)throw Error('Catalog shape changed or too few records');
 const entries=[],used=new Set(),excluded={unsafe:0,invalid:0,duplicates:0};
 for(let i=0;i<rows.length;i++){
  const row=rows[i],name=String(row?.name||'').trim().slice(0,65),url=canonical(row?.api);
  if(!name||!url){excluded.invalid++;continue}
  const host=new URL(url).hostname;
  if(adultName.test(name)||adultHosts.has(host)){excluded.unsafe++;continue}
  if(used.has(url)){excluded.duplicates++;continue}
  used.add(url);
  const status=safeStatus(row?.status),protocol=new URL(url).protocol;
  const isKnownCms=/(?:\/api\.php\/provide\/vod|\/provide\/vod|\/inc\/api\.php|\/api\.php|\/api\/json\.php)$/i.test(new URL(url).pathname);
  const isAutoEnabled=status==='online'&&protocol==='https:'&&isKnownCms&&String(row.apiType||'json').toLowerCase()==='json';
  const mode=isAutoEnabled?'ready':'review';
  const reason=isAutoEnabled?'catalog_online':protocol!=='https:'?'http_mixed_content':status!=='online'?'catalog_pending':'nonstandard_interface';
  entries.push({id:'auto_'+createHash('sha256').update(url).digest('hex').slice(0,14),name,api:url,apiType:row.apiType||'unknown',
    mode,reason,status,origin:'ziyuanzu/top',rank:i+1,uptime:row.uptime??null,responseTime:row.responseTime??null,totalResources:row.totalResources??null});
 }
 const ready=entries.filter(x=>x.mode==='ready').length;
 if(entries.length<25||ready<12)throw Error('Abnormal catalog result: total '+entries.length+' ready '+ready+'; preserve old snapshot');
 const payload={schema:1,upstream:api,generatedAt:new Date().toISOString(),sourceCount:entries.length,readyCount:ready,reviewCount:entries.length-ready,excluded,entries};
 const json=JSON.stringify(payload,null,2)+'\n';
 const js='/* Generated source directory, not executable third-party rules. */\nwindow.LibreAutoSourcesData='+JSON.stringify(payload).replace(/</g,'\\u003c')+';\n';
 await fs.mkdir(path.dirname(jsonFile),{recursive:true});
 await fs.writeFile(jsonFile+'.new',json,'utf8');
 await fs.writeFile(outFile+'.new',js,'utf8');
 await fs.rename(jsonFile+'.new',jsonFile);
 await fs.rename(outFile+'.new',outFile);
 console.log('SYNC_RESULT',JSON.stringify({reported:rows.length,safe:entries.length,ready,review:entries.length-ready,excluded,updated:payload.generatedAt}));
}
main().catch(e=>{console.error('SYNC_FAILED',e.message);process.exitCode=1});
