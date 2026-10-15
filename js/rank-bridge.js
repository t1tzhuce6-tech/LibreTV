/* Extension boundary: official rankings provide metadata; LibreTV owns playback. */
(function(root){
  'use strict';
  const providers=new Map();
  function register(id,toPlaybackRequest){
    if(!/^[a-z][a-z0-9-]*$/.test(String(id))||typeof toPlaybackRequest!=='function')
      throw new TypeError('Invalid ranking provider');
    if(providers.has(id))throw new Error('Ranking provider already registered: '+id);
    providers.set(id,toPlaybackRequest);
  }
  function open(id,item){
    const adapter=providers.get(id);
    if(!adapter||!root.QuickPlay?.open)return false;
    const raw=adapter(item)||{};
    const title=String(raw.title||'').trim();
    if(!title)return false;
    const value=String(raw.year||'').match(/(?:19|20)\d{2}/)?.[0]||'';
    const kind=['movie','tv'].includes(raw.kind)?raw.kind:'';
    root.QuickPlay.open({title,year:value,kind,scope:'safe-all'});
    return true;
  }
  root.LibreRankBridge=Object.freeze({
    register,open,providers:()=>[...providers.keys()]
  });
})(typeof window!=='undefined'?window:globalThis);
