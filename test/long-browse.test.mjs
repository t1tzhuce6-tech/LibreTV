import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const script=fs.readFileSync(root+'js/hot-list.js','utf8');
const style=fs.readFileSync(root+'css/hot-list.css','utf8');
test('homepage offers two long paged lists instead of only ten-entry weekly charts',()=>{
  assert.match(script,/id:'browse_movie'/);
  assert.match(script,/id:'browse_tv'/);
  assert.match(script,/current='browse_movie'/);
  assert.match(script,/ltHotListShortBoards/);
  assert.match(script,/其他六个每周精选小榜/);
});
test('reuses existing Douban paged fetch and appends pages of twenty, not replacing existing results',()=>{
  assert.match(script,/fetchDoubanData\(url\)/);
  assert.match(script,/page_limit=20&page_start=/);
  assert.match(script,/discovery\.offset\+=20/);
  assert.match(script,/render\(additions,true\)/);
  assert.match(script,/IntersectionObserver/);
  assert.match(script,/loadBrowseMore/);
  assert.match(script,/!adult\(item\)/);
  assert.match(script,/window\.QuickPlay\.open/);
});
test('long discovery is not mislabeled as a numbered heat ranking',()=>{
  assert.match(script,/kind,rank:null/);
  assert.match(script,/if\(item\.rank\)art\.appendChild/);
  assert.match(script,/豆瓣热门推荐/);
  assert.match(script,/当前可用列表末尾/);
});
test('assets use fresh versions and mobile shows two main choices',()=>{
  const home=fs.readFileSync(root+'index.html','utf8');
  const sw=fs.readFileSync(root+'service-worker.js','utf8');
  assert.match(home,/20261014long1/);
  assert.match(sw,/20261015-global-pool-v3/);
  assert.match(style,/lt-hotlist-featured/);
  assert.match(style,/lt-hotlist-more/);
});
