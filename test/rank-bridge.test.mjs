import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const bridgeCode=fs.readFileSync(root+'js/rank-bridge.js','utf8');
const quickCode=fs.readFileSync(root+'js/quick-play.js','utf8');

test('independent ranking adapters use the same safe playback entry',()=>{
  const opened=[],window={QuickPlay:{open:request=>opened.push(request)}};
  vm.runInNewContext(bridgeCode,{window});
  const bridge=window.LibreRankBridge;
  bridge.register('official',item=>({title:item.title,year:item.info,kind:item.kind}));
  assert.equal(bridge.open('official',{title:' 影片 ',info:'2026',kind:'movie'}),true);
  assert.deepEqual({...opened[0]},{title:'影片',year:'2026',kind:'movie',scope:'safe-all'});
  assert.equal(bridge.open('unknown',{title:'影片'}),false);
  assert.equal(bridge.open('official',{title:''}),false);
  assert.throws(()=>bridge.register('official',()=>({title:'重复'})));
});
test('ranking bridge does not invent movie/tv metadata for unknown genres',()=>{
  const opened=[],window={QuickPlay:{open:request=>opened.push(request)}};
  vm.runInNewContext(bridgeCode,{window});
  window.LibreRankBridge.register('other',item=>item);
  window.LibreRankBridge.open('other',{title:'综艺节目',year:'未知',kind:'variety'});
  assert.deepEqual({...opened[0]},{title:'综艺节目',year:'',kind:'',scope:'safe-all'});
});
test('source lookup checks at most three pages, skips adult results and finds page two',async()=>{
  const requests=[],window={
    ProxyAuth:{addAuthToProxyUrl:async u=>u},
    LibreContentPolicy:{isAdultVideo:x=>String(x.type_name||'').includes('伦理')}
  };
  const ctx={window,console,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,
    API_CONFIG:{search:{
      path:'?ac=videolist&wd=',
      pagePath:'?ac=videolist&wd={query}&pg={page}'
    }},
    PROXY_URL:'/proxy/',
    getApiSearchContext:()=>({apiBaseUrl:'https://normal.example/api.php/provide/vod'}),
    fetch:async url=>{
      requests.push(decodeURIComponent(String(url)));
      const second=decodeURIComponent(String(url)).includes('pg=2');
      return {ok:true,json:async()=>({pagecount:5,list:[{
        vod_id:second?'2':'1',vod_name:'目标影片',
        type_name:second?'剧情片':'伦理片',vod_year:'2026'
      }]})};
    }
  };
  vm.runInNewContext(quickCode,ctx);
  const items=await window.QuickPlay.findMatches('safe',{title:'目标影片',kind:'movie'});
  assert.deepEqual(Array.from(items,x=>x.vod_id),['2']);
  assert.equal(requests.length,2);
  assert.ok(requests[1].includes('pg=2'));
  assert.equal(window.QuickPlay.sourceProgress(),null);
});
