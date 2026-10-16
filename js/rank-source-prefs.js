/* Ranked-discovery source preferences, independent from the two site presets. */
(function(root){
  'use strict';
  const KEY='libretv:rank-sources:v1';
  const store=()=>{try{const v=JSON.parse(root.localStorage?.getItem(KEY)||'{}');return v&&typeof v==='object'?v:{}}catch{return {}}};
  const clean=a=>Array.isArray(a)?[...new Set(a.filter(v=>typeof v==='string'))]:[];
  const available=()=>clean(root.LibreContentPolicy?.safeSourceIds?.(true)||[]).filter(id=>{
    const info=id.startsWith('custom_')?root.getCustomApiInfo?.(id.slice(7)):root.API_SITES?.[id];
    return !!info&&info.searchable!==false&&!root.LibreContentPolicy?.isAdultSource?.(info);
  });
  function ordered(){
    const ids=available(),prior=clean(store().order).filter(id=>ids.includes(id));
    return [...prior,...ids.filter(id=>!prior.includes(id))];
  }
  function selected(){
    const excluded=new Set(clean(store().excluded));
    return ordered().filter(id=>!excluded.has(id));
  }
  function update(next){
    const ids=available(),valid=new Set(ids);
    const value={order:clean(next.order).filter(id=>valid.has(id)),
      excluded:clean(next.excluded).filter(id=>valid.has(id))};
    try{root.localStorage?.setItem(KEY,JSON.stringify(value))}catch{}
    root.dispatchEvent?.(new Event('libretv:rank-sources-changed'));
  }
  const label=id=>id.startsWith('custom_')?root.getCustomApiInfo?.(id.slice(7))?.name||id:root.API_SITES?.[id]?.name||id;
  function initPanel(){
    const hot=root.document?.getElementById('ltHotList');if(!hot||root.document.getElementById('ltRankSources'))return;
    const panel=root.document.createElement('details');panel.id='ltRankSources';panel.className='lt-rank-sources';
    const summary=root.document.createElement('summary');summary.className='lt-rank-sources-summary';panel.append(summary);
    const toolbar=root.document.createElement('div');toolbar.className='lt-rank-sources-toolbar';
    const list=root.document.createElement('div');list.className='lt-rank-sources-list';
    const hint=root.document.createElement('p');hint.className='lt-rank-sources-hint';
    panel.append(toolbar,list,hint);hot.querySelector('.lt-hotlist-head')?.insertAdjacentElement('afterend',panel);
    const button=(text,action)=>{
      const b=root.document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',action);toolbar.append(b);
    };
    button('全选',()=>update({order:ordered(),excluded:[]}));
    button('反选',()=>update({order:ordered(),excluded:selected()}));
    button('恢复默认',()=>update({order:[],excluded:[]}));
    function render(){
      const order=ordered(),chosen=new Set(selected());
      summary.textContent='选择参与热榜搜索的片源：'+chosen.size+' / '+order.length+'（点击展开，调整顺序）';
      list.replaceChildren();
      for(let i=0;i<order.length;i++){
        const id=order[i],row=root.document.createElement('div');row.className='lt-rank-source-row';
        const input=root.document.createElement('input');input.type='checkbox';input.checked=chosen.has(id);input.setAttribute('aria-label','搜索 '+label(id));
        input.addEventListener('change',()=>update({order,excluded:order.filter(x=>x===id?!input.checked:!chosen.has(x))}));
        const name=root.document.createElement('label');name.append(input,root.document.createTextNode(' '+label(id)));row.append(name);
        const move=(delta)=>{
          const target=i+delta;if(target<0||target>=order.length)return;
          const sorted=[...order];[sorted[i],sorted[target]]=[sorted[target],sorted[i]];
          update({order:sorted,excluded:order.filter(x=>!chosen.has(x))});
        };
        for(const [direction,text] of [[-1,'↑'],[1,'↓']]){
          const b=root.document.createElement('button');b.type='button';b.textContent=text;b.title=(direction<0?'提高':'降低')+'优先级';
          b.setAttribute('aria-label',(direction<0?'上移':'下移')+label(id));b.disabled=(i+direction<0||i+direction>=order.length);
          b.addEventListener('click',()=>move(direction));row.append(b);
        }
        list.append(row);
      }
      hint.textContent=chosen.size?'勾选仅影响热榜找片；按列表顺序优先检索，后续来源仍会分批查询。':'目前没有勾选片源，热榜找片将不执行搜索。';
    }
    root.addEventListener('libretv:rank-sources-changed',render);
    root.addEventListener('libretv:preset-data',render);
    render();
  }
  root.LibreRankSources=Object.freeze({available,ordered,selected,update,initPanel});
  root.document?.addEventListener('DOMContentLoaded',initPanel);
})(typeof window!=='undefined'?window:globalThis);
