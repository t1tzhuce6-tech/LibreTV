# LibreTV 原生 DR 第二页（2026-10-16）

## 用户明确需求
- 旧 LibreTV 主页继续使用；第二页仍由 LibreTV 原生页面、搜索、选集和播放器实现。
- DR 只作为后台源服务，绝不 iframe 嵌入 DrPlayer，也不跳转到 DR 独立网页。
- 第二页只展示 DR 的源、首页推荐、分类、搜索、影片详情与播放；不要引入爱奇艺榜单或现有普通资源站/直播源。
- 开发分阶段进行，每阶段独立验收，避免不完整服务进入正式站。

## 第一阶段（当前开发分支）
- 主页切换按钮继续使用，dr.html 彻底替换成 LibreTV 原生 DR 页。
- js/dr-native.js 从同源 /dr-data 查询源列表、首页推荐、分类、搜索和分页，使用 DOM textContent 渲染数据。
- functions/dr-data.js 以 drpyS T4 /config/1?sub=green&healthy=1 发现已审查源，再向固定的 /api/:module 读数据。
- 服务端环境：DR_BACKEND_URL=公网HTTPS服务根地址；DR_API_PWD=该服务访问密码；DR_SOURCE_ALLOWLIST=逗号分隔的已验证源 key，缺省为空时拒绝显示。所有值只配置到服务端。
- 禁止客户端任意指定上游，拒绝非 HTTPS 后端和跨域的 source.api，不允许未在名单的源调用。
- 成人源、成人分类、成人影片标题等基础过滤；还需要真实后端及分类复核，不能代替最终审核。
- 取消原来的 DR_PUBLIC_URL 注入、DrPlayer iframe、旧 js/dr-portal.js 和 css/dr-portal.css。
- 更换 PWA 缓存版本以防手机沿用旧页面。
- 当前未配置和启动实际 drpyS，所以暂时无法实机试播；模拟 API 测试不能算真实播放通过。

## 第二阶段（尚未执行）
- 增加 DR 详情 T4 ?ac=detail&ids=...，解析 vod_play_from / vod_play_url 的线路和集数。
- 对每集调用 T4 ?play=...&flag=... 解析真实地址，不直接把播放 ID 当 URL。
- 复用 LibreTV 播放能力，DR 内播放、DR 源独立换源、下一集/历史回退；阻止原普通片源混入 DR。
- 处理媒体请求头、DR 服务自己的媒体代理、安全鉴权、HTTPS/跨域及不能播放的可解释反馈。
- 完成真实后端连通、选集、播放与手机浏览器验收后，再合并 PR 并部署正式站。

## 运行环境
- 本机 Node v24，不满足 drpyS <24 限定；本轮不安装 DR 服务或对公网暴露端口。
- 当前 Cloudflare Pages 生产仍是历史 iframe 版本，需要后续功能完成后替换。
