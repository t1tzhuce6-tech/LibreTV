import {extractLd,readNexus} from './nexus-directory.js';
const poster=/^https:\/\/image\.tmdb\.org\/t\/p\/w[0-9]+\//;
const blocked=/(?:色情|成人短片|无码|av女优|\bporn\b|\bxxx\b)/i;
export function normalizeList(html,slug){
  const schema=extractLd(html,'ItemList');
  const raw=Array.isArray(schema.itemListElement)?schema.itemListElement:[];
  const items=raw.slice(0,350).map((row,i)=>{
    const title=String(row?.name||'').trim().slice(0,130);
    const cover=String(row?.image||'');
    const source=String(row?.url||'');
    if(!title||blocked.test(title))return null;
    return {id:source.slice(0,190)||slug+'-'+i,title,
      cover:poster.test(cover)?cover:'',rank:Number(row.position)||i+1,
      kind:/^https:\/\/nexusfilmx\.com\/tv\//.test(source)?'tv':'movie'};
  }).filter(Boolean);
  if(!items.length)throw Error('No films in published list');
  return {slug,title:String(schema.name||slug).slice(0,100),
    description:String(schema.description||'').slice(0,190),
    totalPublished:Number(schema.numberOfItems)||raw.length,items,
    sourceUrl:'https://nexusfilmx.com/rankings/'+slug,
    source:'Nexus 中文精选片单'};
}
export async function onRequestGet({request}){
  const slug=new URL(request.url).searchParams.get('slug')||'';
  if(!/^[a-z0-9-]{3,90}$/.test(slug)||
     /(?:erotic|horror|thriller)/.test(slug))
    return Response.json({error:'Unsupported topic'},{status:400});
  try{
    const result=normalizeList(await readNexus('/rankings/'+slug),slug);
    return Response.json(result,{headers:{
      'Cache-Control':'public, max-age=1800, stale-while-revalidate=7200'
    }});
  }catch{
    return Response.json({error:'中文专题暂时无法读取'},{status:502,
      headers:{'Cache-Control':'no-store'}});
  }
}
