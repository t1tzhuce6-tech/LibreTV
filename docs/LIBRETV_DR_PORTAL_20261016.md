# LibreTV + DR 双入口接力（2026-10-16）
## 决议
用户保留 LibreTV 为主站，DR 作为单独网页；两套片源、榜单与系统互不影响。
## 本轮实现
- index.html 添加 LibreTV / DR 页签；dr.html 是独立 DR 专区。
- dr.html 输入 DR 服务器的 HTTPS 网址，打开对方自带的 /apps/drplayer/。
- 允许浏览器本机与内网 HTTP 地址，但 HTTPS 页不嵌入 HTTP，以“新标签页打开”作为退路。
- 只在本地 localStorage 保存地址，不收集或储存 DR 密码、Cookie、Token。
- Cloudflare Pages 可通过 DR_PUBLIC_URL 环境变量统一设置公网 HTTPS DR 服务地址；_middleware 注入前验证地址。
- 不改变现有 LibreTV 的首页功能、搜索、榜单、视频源或直播。
- Service Worker 版本更新并缓存 DR 页面资源；新增专项自动测试。
## 未完成及限制
- 本轮仅交付 DR 网页接入层；没有启动 DR 后端，页面未配置时明确说明这一点。
- Windows 目前是 Node v24.17.0，而 drpyS 的 package.json 要求 Node >=18 且 <24。
- Windows 已安装 Docker 客户端，Docker daemon 当前没运行。
- Cloudflare Pages 不能直接运行常驻的 drpyS Node.js 服务。
- DR 需要一台持续运行的 Windows/NAS/VPS 或独立托管后端；禁止未经同意开放本机端口至公网。
- 未进行手机端实际播放验证；远程 DrPlayer 可能禁止 iframe 嵌入，但提供独立打开退路。
- 不添加未经审查成人源，不声称接口天然授权或一定可播放。
## 发布和回退
- 自动化测试全绿后用 PR 发布。
- 旧生产 SHA：2c51310111007c528f14e7d88a2bcc2b3954dfc5。
