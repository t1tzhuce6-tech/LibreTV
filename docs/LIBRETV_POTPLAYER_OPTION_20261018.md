# LibreTV 本地 PotPlayer 播放选项 · 2026-10-18

## 目标
保留原网页播放器和现有源切换、选集、搜索机制；只在 Windows 播放页来源工具条新增【PotPlayer 播放】。
源选定后将当前集的直连 HTTP(S) 视频地址交给浏览器的 `potplayer://` 外部应用协议；首次点击由浏览器询问是否允许打开外部应用。
PotPlayer 不是部署到 Cloudflare，而是在用户 Windows 电脑本地运行。用户 PC 已存在：
- C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe
- HKEY_CLASSES_ROOT\potplayer\shell\open\command 指向当前 PotPlayerMini64.exe。
没有修改系统注册表，不会自行启动播放测试或产生声音。

## 具体逻辑
- 新增 js/potplayer-launch.js，纯粹被动加载，绝不自动唤起。仅允许 Windows，且仅 HTTP(S) 直连 m3u8、mp4、webm、mov、m4v、ts、mkv、flv。
- 拒绝 file/javascript/magnet、含账号密码的 URL、内网地址以及普通网页 URL。
- 浏览器通过 `potplayer://https://.../movie.m3u8` 请求本地已注册的处理程序。JS 无法确认播放器实际打开，因此只提示“已请求浏览器打开”，不宣称成功。
- 通过播放器已有 currentVideoUrl（当前线路与剧集对应 URL）构造请求，点击后暂停网页播放器以避免双重音频。
- 手机端隐藏按钮，网页版不受影响；原有“复制链接”可用于协议无法打开时手工操作。
- 通过本地测试和独立 Preview 确认后才能合并，不动 LIB 正式版，不修改独立 drpyS Docker。

## 限制
- 需真实直链；网盘分享页、DRM、必须携带 Cookie / Referer 才能取流的线路可能不能在 PotPlayer 中直接播放。
- 软件是否顺利打开必须用户在 Windows 浏览器中亲自点击确认；自动验收不主动播放视频。
