# LibreTV 双内容页 / 热榜自选源阶段报告（2026-10-16）
 
## 范围与用户确认
原项目：G:\CodexWorkspace\04_PROJECTS\LibreTV_CF_Deployment。
本次 Git worktree：G:\CodexWorkspace\03_WORKTREES\LibreTV_DualViews_20261016。
功能分支：feat/native-dualviews-source-prefs-20261016，从 origin/main 87f373a 建立。
原 DR 分支 feat/dr-native-page-20261016 和未提交文档不动；CMS 候选源另在 Draft PR #26，不在本轮并入。

## 已实现
- 在主站内提供独立可直接访问的两个页面状态：?view=sources（片源库）和 ?view=ranks（热榜发现），共用原有播放器及密码体系，保留 DR 单独入口。
- 片源库不再写死「电影／电视剧／国产剧／美剧」等标签，按当前源 CMS API 返回的 type_id/type_pid 原生展示一级、二级或更多层级；平铺的源保持平铺。
- 片源目录通过当前安全源注册表动态生成；源首页数据用当前源不带 t 的分页 API，点击分类只带原始 type_id，不擅自把父级拼成前16个子分类。
- 热榜现有爱奇艺、豆瓣、中文专题等内容入口保留；增加一套与网站两种配置独立的搜索源选择：全选、反选、逐个勾选、上下调整查询顺序、恢复默认；localStorage 持久化。
- 热榜点播入口使用 scope=rank-selected，播放器自动找片和换源应用同一勾选和顺序；其他普通搜索与片源库仍遵照既有安全候选规则。
- 新增合适的版本号和 PWA 资源缓存项。
- 保留原有成人专用源过滤和内容过滤；每个选择项动态由合格来源注册表生成，默认全选所有合格来源。
 
## 实测
- npm test：135/135 PASS（含本轮新增2项断言）。
- Chrome headless --mute-audio，localhost:5764 静态页面；?view=ranks 导航、热榜显示、片源库隐藏正确。片源选择22项、全选→22、反选→0、手动取消→21，storage 存在，无JS异常。
- ?view=sources 切换正确，显示22个来源；用模拟 CMS 树检验了源原样分类及 t=1/t=2 查询。
- 以上不代表 Cloudflare Preview/生产已部署，也未验证当前真实片源的媒体播放。无视频自动播放。
 
## 未完成 / 风险
- 榜单各平台的频道描述仍由既有单平台适配器（如爱奇艺既有频道名单）定义；未改为动态发现上游新增频道，也不伪造平台未提供的榜型。
- 片源详情与实播、CF Production 浏览器/iPhone 实测仍需要。不能把模拟的分类验收说成真实上游分类完全兼容。
- 之前登录授权/代理/Cloudflare 运维问题独立处理，本轮不改 Workers 或付费计划。
- 不要未经验证就把 CMS PR #26 的3个新候选称为已上线。
- 上线前检查现有主线与 PR 是否冲突，按 Preview → PR 合并 → Production 路线，失败可回退。
