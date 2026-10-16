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

## 第二阶段（代码完成，尚未实际联网验收）
- functions/dr-data.js 增加 detail 和 play：T4 ?ac=detail&ids=...；解析 vod_play_from / vod_play_url 的线路及选集；每集经 ?play=...&flag=... 获得视频地址。
- dr.html 加影片详情弹窗；js/dr-native.js 可查看 DR 选集、逐集解析并把识别到的直接 HTTPS 视频地址交给原 LibreTV 的 player.html。
- js/player.js 增加 dr=1 独立模式：从 DR 播放时换源返回 dr.html 按片名重新搜索，不会列出原主站普通源；关闭主站相关推荐及不适用的详情入口。
- 对需要特殊请求头、二次解析、HTTP、DR 自己的媒体代理的线路直接提示不支持，不暴露后端 API 密码。仅能确认代码处理逻辑，不能宣称这些源已成功播放。
- DR 源下拉选择器可以切换源；在搜索状态切换 DR 源继续搜索相同片名，不混原网站片源；不加入爱奇艺榜单。
- 以上使用模拟 T4 响应测试；全量 138 项测试通过。

## 第三阶段（尚未执行）
- 部署真实 drpyS Node 后端；配置 DR_BACKEND_URL、DR_API_PWD、DR_SOURCE_ALLOWLIST，逐源审查成人内容。
- 测试真实 T4 目录、首页推荐、分类、搜索、影片详情及原 LibreTV 播放器上的直接媒体播放。
- 对必须附带特定媒体请求头、需代理/嗅探解析的线路建立单独安全兼容方案，不做开放代理、不向客户端泄漏后端凭证。
- 验证 DR 换源、连播、进度、手机访问；达成验收条件后再发布正式站。

## 运行环境
- 本机 Node v24，不满足 drpyS <24 限定；本轮不安装 DR 服务或对公网暴露端口。
- 当前 Cloudflare Pages 生产仍是历史 iframe 版本，需要后续功能完成后替换。
