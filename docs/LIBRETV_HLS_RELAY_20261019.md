# LibreTV PotPlayer HLS 本机转发 · 2026-10-19

## 目的
只解决已验证的 `play.maoyanplay.top` HLS 链在 PotPlayer 中读取失败的问题，不修改系统 DNS/hosts、Windows 证书链、LIB 正式站、Docker 或 v2rayN 代理。

## 验证记录
- 原 URL: `https://play.maoyanplay.top/20250905/Mf7CJJUU/index.m3u8`
- 主清单 -> `1414kb/hls/index.m3u8` -> AES-128 密钥 -> 3580 个 TS 分片。
- 同一个 TS 分片: `36.151.195.235` 直连 10 秒只收到 169 KB；`107.149.120.20` 直连 1.43 秒完整取得 355888 字节。
- Windows 的 `F:\emby\system\ffmpeg.exe` 使用原始 HLS URL 完成静音 3 秒解码，退出码 0。
- Windows 本机 Node 转发绑定 `127.0.0.1:18755`，只允许上游 `play.maoyanplay.top`，以保留正常 HTTPS SNI/证书验证的方式将请求定位到 `107.149.120.20`。重写所有 m3u8 中的下一层地址及 `#EXT-X-KEY URI`，不动原始 AES 加密数据。
- 通过本机转发读取同一条视频，FFmpeg 再次完成静音解码 3 秒，退出码 0。**没有自动启动有声 PotPlayer 播放。**

## 部署
- 本机 Node 服务 `C:\Tools\LibreTV-HLS-Relay\relay.js`
- 启动脚本 `C:\Tools\LibreTV-HLS-Relay\Start-Relay.ps1`
- 健康检查 `http://127.0.0.1:18755/health`
- Windows 当前用户登录自启：`HKCU\Software\Microsoft\Windows\CurrentVersion\Run\LibreTV_HLS_Relay`；原来不存在该项，仅添加新项。
- 日志 `C:\Tools\LibreTV-HLS-Relay\relay.log`；本机服务只监听 loopback，不能从 LAN、外网直接访问。
- LIB 的 `js/potplayer-launch.js` 对该域名的 M3U8 经严格原始 URL 校验后改写成 `potplayer://http://127.0.0.1:18755/r/<base64url>/stream.m3u8`。其他来源的 PotPlayer 行为保持不变；移动端不显示 PotPlayer 按钮。
- 该 IP 为 CDN 临时节点，未来有可能变动。遇到节点下线必须重新验证，不应无条件推广到所有站点。

## 恢复
- 退回旧 PotPlayer URL 逻辑：撤销本 PR 的上述 JS 代码修改，或使用原版本。
- 停止本地转发：只终止命令行为 `C:\Tools\LibreTV-HLS-Relay\relay.js` 的 node.exe 进程；不能杀掉全部 Node。
- 关闭登录自启：仅删除上面的 `LibreTV_HLS_Relay` 注册表值。
- 不更改其他用户注册表项、代理、hosts 和证书信任。

## 验收
- LIB Node 测试套件 130/130 通过。
- FFmpeg 经本机转发静音解码通过，但 PotPlayer 最终视频画面和声音需要用户在网页预览中最后确认，不能宣称已经实播成功。
