/* TVBox / FanTaiYing metadata reader. Never execute untrusted Spider JAR or JS in a page. */
(function(){
  'use strict';
  const MIRROR_URL='https://raw.githubusercontent.com/qist/tvbox/master/0826.json';
  function make(tag,text,css){
    const node=document.createElement(tag);
    if(text!==undefined) node.textContent=text;
    if(css)node.className=css;
    return node;
  }
  async function fetchManifest(){
    // Metadata only. The project-owned Cloudflare proxy is used for JSON, not for video.
    const proxied=window.ProxyAuth?.addAuthToProxyUrl
      ? await window.ProxyAuth.addAuthToProxyUrl('/proxy/'+encodeURIComponent(MIRROR_URL))
      : '/proxy/'+encodeURIComponent(MIRROR_URL);
    const result=await fetch(proxied,{cache:'no-store'});
    if(!result.ok)throw new Error('JSON 请求失败：HTTP '+result.status);
    const config=await result.json();
    if(!config||!Array.isArray(config.sites))throw new Error('不符合 TVBox JSON 配置结构');
    return config;
  }
  function describeCompatibility(entry){
    const api=String(entry.api||'');
    if(Number(entry.type)===3||/^csp_/i.test(api))
      return 'TVBox Spider/JAR 专用，当前网页不能直接播放';
    if((Number(entry.type)===0||Number(entry.type)===1)&&/^https?:\/\//.test(api))
      return '标准 HTTP API 候选，需单独验证返回格式';
    return '非标准接口，需要专门适配';
  }
  function start(){
    const controls=document.querySelector('#ltBrowseBody .lt-explore-controls');
    if(!controls)return;
    const button=make('button','饭太硬 · 点播源目录（TVBox）','lt-explore-btn');
    button.type='button';
    const panel=make('section',undefined,'lt-fty-catalog');panel.hidden=true;
    const message=make('p','饭太硬的 TVBox JAR 不能直接放进网页执行；这里只展示配置来源，不宣称已经接通 4K 视频播放。');
    panel.appendChild(message);
    const output=make('div',undefined,'lt-fty-list');panel.appendChild(output);
    controls.insertAdjacentElement('afterend',panel);
    controls.appendChild(button);
    let loaded=false;
    button.addEventListener('click',async()=>{
      panel.hidden=!panel.hidden;
      if(panel.hidden||loaded)return;
      output.replaceChildren(make('p','正在读取公开的饭太硬 TVBox 配置镜像……'));
      try{
        const config=await fetchManifest();
        const sites=config.sites.filter(site=>site&&site.name);
        loaded=true;
        output.replaceChildren(make('p','镜像收录 '+sites.length+' 个点播入口。部分标注 4K、秒播；这些文字不是实测画质或速度。'));
        sites.forEach(site=>{
          const row=make('div',undefined,'lt-fty-entry');
          const title=make('strong',site.name);
          const badge=make('small',describeCompatibility(site));
          row.append(title,badge);
          output.appendChild(row);
        });
      }catch(e){output.replaceChildren(make('p','暂时无法读取饭太硬配置：'+e.message));}
    });
  }
  document.addEventListener('DOMContentLoaded',start);
  window.FtyConfigAdapter={describeCompatibility};
})();