# LibreTV 资源站补充候选 · 2026-10-16

## 原项目及隔离
- 原项目：G:\CodexWorkspace\04_PROJECTS\LibreTV_CF_Deployment，不新建 LibreTV 项目。
- 使用同一 Git 仓库的临时隔离 worktree，分支 feat/cms-source-supplement-20261016，从 origin/main 87f373a 建立。
- 原有 feat/dr-native-page-20261016 分支及未提交 DR 接力文档完全不动。

## 去重与现状
- 现有 js/customer_site.js 已有22个默认接口，包括暴风、360、无尽、魔都、非凡、豪华、光速、极速。
- 首页默认勾选仍是7个；方案二独立使用 /managed-sources 订阅，不能直接覆盖方案选择。
- 避免把 ziyuanzu.com 所有77条目录批量导入：其中有成人专用或不稳定接口。

## 三条新候选的当次实际接口测试
- 牛牛资源：https://api.niuniuzy.me/api.php/provide/vod/；分类59；列表与单条详情均 HTTP200、MacCMS JSON，有播放字段。
- 速播资源：https://subocj.com/api.php/provide/vod/；分类44；列表与单条详情均 HTTP200、MacCMS JSON，有播放字段。
- 豪华资源站备用：https://haohuazy.com/api.php/provide/vod/；分类48；列表与单条详情均 HTTP200、MacCMS JSON，有播放字段；与既有 hhzyapi.com 不覆盖。
- 乐播、索尼、奥斯卡在用户 Windows 机器当次均 ECONNRESET，本轮不添加。
- 本轮仅证明数据接口结构；真实播放首帧、高清码率、内容授权及长期稳定性未验证。

## 接入与验收边界
- 只新增3个可选择 CMS 来源，不修改默认勾选、缓存版本、DR 页面或 Cloudflare 正式部署。
- 保留既有成人内容/源筛选；新候选上线前还需实测内容安全与真实播放。
- 先 npm test 和 diff check，再走 PR + Cloudflare Preview + 浏览器验收；未经验收不要宣称正式上线。
