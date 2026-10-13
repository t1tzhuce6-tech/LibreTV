/* Unified adapters shared by all MacCMS/VOD sources and M3U live subscriptions. */
(function(root) {
  'use strict';
  const groupLabels=Object.freeze({
    'entertainment':'娱乐','news':'新闻','sports':'体育','sport':'体育','movies':'电影',
    'movie':'电影','series':'电视剧','documentary':'纪录','documentaries':'纪录',
    'kids':'少儿','children':'少儿','music':'音乐','religious':'宗教','general':'综合',
    'education':'教育','educational':'教育','business':'财经','lifestyle':'生活',
    'travel':'旅游','cooking':'美食','culture':'文化','comedy':'喜剧','animation':'动画',
    'international':'国际','local':'地方频道','shopping':'购物','weather':'天气',
    'science':'科学','family':'家庭','classic':'经典','other':'其他频道',
    'undefined':'其他频道','uncategorized':'其他频道','xxx':'成人'
  });
  function displayGroup(raw) {
    const value=String(raw||'').trim();
    return groupLabels[value.toLowerCase()]||value||'其他频道';
  }
  function asVodPayload(response) {
    const list=Array.isArray(response)?response:Array.isArray(response?.list)?response.list:[];
    return {list};
  }
  function normalClasses(values) {
    return (Array.isArray(values)?values:[]).filter(c=>c&&c.type_id!=null&&c.type_name).map(c=>({
      ...c,type_id:String(c.type_id),type_pid:String(c.type_pid??'0')
    }));
  }
  function childIds(classes,parentId) {
    const visited=new Set(), results=[];
    function visit(id) {
      if(visited.has(String(id)))return;
      visited.add(String(id));
      const children=classes.filter(c=>String(c.type_pid)===String(id));
      if(!children.length){results.push(String(id));return;}
      children.forEach(c=>visit(c.type_id));
    }
    visit(parentId);
    return [...new Set(results)];
  }
  function categoryIds(classes,selectedId,max=16) {
    if(selectedId)return childIds(classes,selectedId).slice(0,max);
    const roots=classes.filter(c=>['0',''].includes(String(c.type_pid))
      && /电影|连续剧|电视剧|综艺|动漫|动画|短剧/.test(c.type_name));
    const choices=[];
    roots.forEach(c=>choices.push(...childIds(classes,c.type_id).slice(0,c.type_name.includes('电影')?3:2)));
    return [...new Set(choices)].slice(0,max);
  }
  function parseM3U(raw) {
    const lines=String(raw||'').split(/\r?\n/);
    const results=[],seen=new Set();
    let pending=null,skipped=0;
    for(const item of lines) {
      const line=item.trim();
      if(line.startsWith('#EXTINF')) {
        const comma=line.lastIndexOf(',');
        const name=comma>=0?line.slice(comma+1).trim():'未命名频道';
        const originalGroup=/group-title="([^"]*)"/i.exec(line)?.[1]||'其他频道';
        pending={name:name||'未命名频道',group:displayGroup(originalGroup),groupOriginal:originalGroup};
      }else if(line&&!line.startsWith('#')&&pending){
        if(/^https:\/\//i.test(line)) {
          const key=pending.name+'|'+line;
          if(!seen.has(key)){results.push({...pending,url:line});seen.add(key);}
        }else skipped++;
        pending=null;
      }
    }
    return {results:results.slice(0,5000),skipped};
  }
  root.LibreCatalog=Object.freeze({displayGroup,asVodPayload,normalClasses,childIds,categoryIds,parseM3U});
})(typeof window!=='undefined'?window:globalThis);
