# LibreTV 自动资源站目录接入验收 · 2026-10-17

## 用户目标
动态接入 www.ziyuanzu.com/top 资源站到**已有**片源库下拉框；只按规范化 API URL 去重，不按名称去重；用 [自动接入]/[本地源] 标记来源；首页搜索、热榜找片、播放器换源共用同一个安全片源池。保留手动源的勾选排序。

## 架构
- scripts/sync-source-directory.mjs：从 /top/__data.json 解析 onlineSources，保存 3 组 TOP10 指标和各站 CMS URL；过滤成人专用源、重复链接、无效/HTTP地址，实际 GET ?ac=list 确认 CMS JSON 结构；最多 7 并发，每源 6.5 秒。
- data/auto-source-directory.json 为可审计快照；js/auto-source-feed.js 为无需 CORS 的同步加载脚本。登录/打开网站时不会直接请求 ziyuanzu。
- js/auto-source-registry.js：在 app 初始化前、播放器之前加载；对已有 API_SITES 及 customAPIs 按完整 URL 去重。既有/自定义来源优先；同名但不同 URL 保留。不可执行第三方 JS，只接收安全文本和有效 API。
- js/content-policy.js：安全片源池兼容自动/原有/手动，保留成人内容来源过滤；相同完整链接只返回一个源 ID。
- js/browse-live.js：下拉框标记来源并列出 34 个合格去重源，原站 CMS 分类继续动态展示；自定义源也可进入选择列表。
- js/rank-source-prefs.js：热榜管理列表显示来源标签，新来源自动出现，已保存的勾选和排序沿用。播放器仍通过 rank-selected 来源筛选。
- js/app.js：首页搜索使用相同全部合格来源，限制最大 5 并发，以减少 Cloudflare Workers 瞬时负担。
- 自动同步流程：.github/workflows/auto-source-directory.yml 每天 01:25 UTC 尝试生成新快照，**生成更新 PR、禁止直接推送 main**。只有合并且通过 CI 才更新正式页面；该工作流只有落入默认分支后才会定时生效。

## 测试与事实边界
- 2026-10-17 上午真实访问 /top/__data.json：onlineSources 70 条。经 URL、成人专用源和 CMS 类别有效性过滤，21 条进入当前快照。
- 本地去重后，片源库实际列表 34 条（其中既有片源22条，动态快照导入12条；另外9条动态站点 API 与既有源重复不再显示）。
- Node 测试 124/124 PASS，专门验证同名不同 URL 仍保留、不同名相同 URL 合并、自定义/现有优先、自动标签、索引注入顺序。
- 静音 Chrome 本地浏览器：两个页面切换、片源库 34 项、热榜片源管理 34 项、勾选/反选、三级 CMS 分类、页面排序均验证，浏览器 JS 错误 0。未播放任何视频。
- API 列表 HTTP200 与分类 JSON 合格不代表有可用影视内容、合法授权或流媒体实播成功；未宣称全部高清资源可播放。
- 本次分支为 feat/native-dualviews-source-prefs-20261016，原 DR 分支及正式网站未改变。后续需 Preview 验收，才允许合并至 main。
