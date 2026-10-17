# LibreTV 动态资源站完整目录接入 · 2026-10-17

## 结论与背景
原版只认 /api.php/provide/vod/ 并用 6.5 秒单次测试删除其他来源，导致 77 条登记记录只取 21 条。现在改成读取资源站目录官方列表 JSON：
https://www.ziyuanzu.com/api/v1/sources?limit=100
保留目录原始 URL，不按源名合并。

## 数据快照
- 官方发布 77 条 API，全部 apiType=json；其中 status=ok 57、status=down 20。
- 安全/成人专用过滤 17 条，安全候选记录保留 60 条；其中 ready=39、review=21（包含 HTTP 混合内容、目录待恢复）。
- 六类发布路径均保留：/api.php/provide/vod[/]、/provide/vod/、/inc/api.php、/api.php、/api/json.php。
- 已有、本地手动和自动目录按规范化完整链接去重。实际浏览器片源库总计 69 条，热榜可搜索候选 49 条，待验证 20 条。
- 注册标签：本地源、自动接入、自动接入·待验证。待验证保留在下拉框，不自动参与搜索/热榜；网站恢复后下次同步可升为 ready。用户手动打开待验证源仅是自愿尝试，不保证 HTTPS 混合内容或受限接口能播放。
- 接口验证仅证明来源可登记或其状态来自资源站目录，并非视频播放验收。不进行未经授权的访问绕过。用户已要求屏蔽成人专用来源。

## 实现与测试
- scripts/sync-source-directory.mjs：只抓取官方 JSON 列表一次，不由 Cloudflare Worker 每次访问外部网站；静态保存 data/auto-source-directory.json 和 js/auto-source-feed.js。使用 atomic-ish 临时文件再 rename。
- js/auto-source-registry.js：同步导入，保留安全站点目录与可搜索集合分离；按完整 API URL 去重。
- js/browse-live.js：片源库下拉读取 catalogIds，既能浏览 ready 也能看到 review。
- js/content-policy.js：safeSourceIds 拦截成人专用、searchable=false，并去重；全站搜索最多 5 个并发，热榜按用户已保存的选择与排序。
- .github/workflows/auto-source-directory.yml：定时创建复审 PR，不直接推送 main。只有项目负责人合并更新 PR 才会进入线上环境。
- 2026-10-17 实测 Node 126/126 PASS；静音 Chrome 本地显示片源库 69、热榜选源 49；全选、反选、保存、两页切换、CMS 三级目录按原有 type_id 查询通过，浏览器 JS 异常为空。
- 本轮使用 feat/native-dualviews-source-prefs-20261016 的工作树，不动正式站点、DR Docker 或其代理服务。

## 尚需
Cloudflare 独立 Preview 真实页面验收和后续 iPhone 实测。在线播放成功率、高清码率及授权未经逐站核实，不能声称所有 49 条可实际播放。
