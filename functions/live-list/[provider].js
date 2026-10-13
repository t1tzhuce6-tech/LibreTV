// Fetch only the small M3U channel *index* over Pages. Media URLs remain browser-direct.
const PLAYLISTS=Object.freeze({
  iptvorg:'https://iptv-org.github.io/iptv/languages/zho.m3u',
  guovin:'https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/result.m3u',
  bestfan:'https://raw.githubusercontent.com/best-fan/iptv-sources/main/cn_all.m3u8',
  freetv:'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8'
});
export async function onRequestGet({params}) {
  const id=String(params.provider||'');
  if(!Object.hasOwn(PLAYLISTS,id))return new Response('Unknown playlist provider',{status:404});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),9000);
  try{
    const result=await fetch(PLAYLISTS[id],{
      signal:controller.signal,
      headers:{'Accept':'text/plain,application/x-mpegURL;q=0.9,*/*;q=0.5'}
    });
    if(!result.ok)return new Response('Playlist unavailable: '+result.status,{status:502});
    if(Number(result.headers.get('content-length'))>1200000)
      return new Response('Playlist exceeds size limit',{status:413});
    const content=await result.text();
    if(content.length>1200000||!content.trimStart().startsWith('#EXTM3U'))
      return new Response('Invalid playlist',{status:502});
    return new Response(content,{status:200,headers:{
      'Content-Type':'text/plain; charset=utf-8',
      'Cache-Control':'public, max-age=180',
      'X-LibreTV-Playlist-Only':'1'
    }});
  }catch(error){
    return new Response('Playlist fetch failed',{status:502});
  }finally{clearTimeout(timer);}
}
