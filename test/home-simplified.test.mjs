import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const txt=f=>fs.readFileSync(root+f,'utf8');
test('single-site homepage no longer ships DR portal or either configuration scheme',()=>{
 for(const gone of ['dr.html','js/dr-portal.js','css/dr-portal.css','css/dr-navigation.css','js/profile-manager.js','css/profile-schemes.css','functions/managed-sources.js'])
   assert.equal(fs.existsSync(root+gone),false,'obsolete module must be removed: '+gone);
 for(const file of ['index.html','player.html','service-worker.js']){
   const src=txt(file);
   assert.doesNotMatch(src,/dr\.html|dr-portal|dr-navigation|profile-manager|profile-schemes|managed-sources/);
 }
 const i=txt('index.html');
 assert.doesNotMatch(i,/lt-dual-nav|lt-preset-bar|LibreTV\s*·\s*主站/);
 assert.match(i,/id="searchArea"/);
 assert.match(i,/id="ltInlineHistory"/);
 assert.match(i,/id="recentSearches"/);
 assert.match(i,/data-history-trigger/);
 assert.match(i,/id="historyPanel"/);
 assert.match(i,/js\/discovery-views\.js/);
 assert.match(i,/js\/rank-source-prefs\.js/);
 assert.equal((i.match(/data-history-trigger/g)||[]).length,1);
});
test('search history and viewing history sit before two destination cards and safe shared source registry remains',()=>{
 const layout=txt('js/discovery-views.js');
 assert.match(layout,/search\.insertAdjacentElement\('afterend',bar\)/);
 assert.match(layout,/history\.append\(continueWatching\)/);
 const nav=layout.indexOf('search.insertAdjacentElement');
 const content=layout.indexOf("bar.insertAdjacentElement('afterend',hot)");
 assert.ok(nav>0&&content>nav);
 const app=txt('js/app.js');
 assert.doesNotMatch(app,/LibreProfiles/);
 assert.match(app,/API_SITES\[apiKey\]/);
 const ranked=txt('js/rank-source-prefs.js');
 assert.match(ranked,/safeSourceIds/);
 assert.doesNotMatch(ranked,/preset-data/);
 const filter=txt('js/content-policy.js');
 assert.match(filter,/isAdultSource/);
 const css=txt('css/dual-discovery.css');
 assert.match(css,/\.lt-inline-history/);
 assert.match(css,/lt-view-sources/);
 assert.match(css,/lt-view-ranks/);
});