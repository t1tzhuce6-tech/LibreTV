# LibreTV 央视大全（官方动态）｜2026-10-19 限定实施
## 目标/范围
这是 LibreTV 原生点播片源，不依赖 DR/drpyS，不恢复旧 IPTV UI。只涉及央视官方动态分类、作品、全集、栏目与官方观看入口。后续才考虑直连高清/4K。
## 文件
- `functions/cctv-vod.js`：Cloudflare Pages Function，唯一固定上游 `api.cntv.cn`，`op=categories/list/detail/column`；限制分类、分页、单作品 ID、响应大小和超时，不接收任意上游 URL。
- `js/cctv-browse.js`：独立 LibreTV VOD 适配器，注册为 `cctv_official`；作品/栏目转换为原片源卡片；选集链接严格限制在 `https://tv.cctv.com/YYYY/MM/DD/...shtml`；不处理DR、密钥、分片或本地代理。
- `js/browse-live.js`：只为央视选源、分类、列表和详情增加分支，其余原 MacCMS 片源路径保持不变。
- `css/cctv-browse.css`、`index.html`：独立弹窗及静态资源加载。
- `service-worker.js`：央视数据 `/cctv-vod` 一律走网络，不将动态API数据缓存为离线APP壳；刷新SW版本和新资源。
## 已验证
- 2026-10-19 本机 Node 请求：纪录片第一页24条、《广济沧海》4集、电视剧第一页24条、《今日说法》近20期。
- 官方作品详情用视频作品 `VIDA...` ID 请求；误用 `VSET...` 会有 url error。
- 片源选择及官方链接安全测试通过，所有原生LibreTV测试回归通过。
## 播放和清晰度真实边界
- 当前是点击“某集”进入央视官网相应页面观看；不是声称 LibreTV 内已直连 HLS，也不是4K达成。
- 央视官方 `getHttpVideoInfo.do` 返回某些HLS及章节记录，但单独 ffprobe 没有验证可用1080P/2160P。可能需要官方播放器、地域/授权或不同分辨率接口。
- 不解密或绕过DRM。后续只有当允许播放的媒体接口能稳定返回可解码音视频、且可合法用于自有播放器时，才增设站内高清直连。
## 发布要求
按现有项目 AGENTS.md：功能分支（基于 origin/main）→ 完整 npm test → PR/预览 → 线上真实核验；不要把“已写入文件”冒称“线上发布完成”。
