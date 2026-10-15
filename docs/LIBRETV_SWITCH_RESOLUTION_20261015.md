# LibreTV 换源界面分辨率显示：实施与验证（2026-10-15）

## 需求及原则
- 用户在播放器“换源”列表希望看到当前线路实际分辨率，以便综合评估速度、延迟、清晰度。
- 明确分开：当前**已播放**视频的浏览器实际解码尺寸（video.videoWidth / video.videoHeight）与**尚未播放**线路 HLS 主清单中标注的 RESOLUTION。
- 后者显示“清单声明”，不可冒充实际解码或100%高清；普通HLS媒体清单/MP4等无相应元数据时显示“分辨率未知”。
- 不因显示分辨率而下载额外视频片段、不固定片源数量、不改变播放器原有排序和默认勾选；换源仍使用安全全源池。

## 改动位置
- js/source-speed.js：在原有主清单解析时读取最高 BANDWIDTH 被选流的 RESOLUTION；支持嵌套主清单；以 resolution 字段传播到原有测速结果，并通过 onPlaylistInfo 在媒体测速队列前提前通知UI。
- js/player.js：测速优先选择当前观看集数的对应项；每条换源行显示分辨率，默认读取中→声明/未知；如果是当前播放行，则以实际解码像素优先显示并监听 loadedmetadata/resize 更新（支持自适应码流变化）；换源弹窗关闭时监听随 AbortSignal 清理。
- css/player.css：紧凑颜色标签，未干扰原有速度、延迟和换源按钮。
- player.html + service-worker.js：静态文件显式版本及PWA缓存刷新。
- test/source-speed.test.mjs：主清单最高带宽分辨率、多层主清单、无元数据时不推测、提前回调和当前播放器显示契约。

## 验收
- 本地 npm test 125/125 通过，JS语法检查、git diff --check 通过。
- 还需 Cloudflare Preview 真实浏览器检查移动/桌面排版；普通片源 HLS主清单含 RESOLUTION 才可显示声明分辨率。
- 需要有真实视频播放的浏览器才能验收 videoWidth/videoHeight 值是否随播放与变码率更新；不能靠静态测试声称真实首帧已测。
- 此轮独立功能分支 feat/switch-source-resolution-20261015；正式生产仍为 main，除非另行批准部署。
