# LibreTV 影视发现工程：实施流水账和证据索引
日期：2026-10-13 至 2026-10-15。历史回顾基于当前 git main 提交、线上接口和此前浏览器验收；每次续工仍须再核实。
工作目录：G:\CodexWorkspace\04_PROJECTS\LibreTV_CF_Deployment
生产网址：https://libretv-private-20261013.pages.dev/
仓库：https://github.com/t1tzhuce6-tech/LibreTV
本文件是 HANDOFF_CURRENT.md 的证据附录，不是另建项目或第二份需求 SSOT。

## A. 为什么做这套改动
用户希望一个中文影视发现站：不是只搜索影片，也能按平台热度、国家地区、影视类型及别人整理的主题片单连续逛片。
基本要求：能看到中文名/图片/简介、真正按现成维护者数据排序、不自己造榜、尽可能不需要用户维护。
用户明确抱怨初版只有十部榜单、中文分类少、英文主题片单恐怖成人内容多、豆瓣类别展示不足。
网站原始方案1和远端维护方案2保留；视频网站热榜与真实VOD源是两个维度，不允许混为一谈。

## B. 按时间记录 GitHub main 的演进（已用 git log 核验）
2026-10-13：开始源目录浏览和IPTV适配的尝试；后续用户反馈旧直播质量不好，要求撤掉UI。
2026-10-14：b751420 引入双配置方案及远端 TVBox healthy 订阅；04accce 调整手机样式和方案切换。
2026-10-14：2b8466a 成人分类与内容过滤、移除旧直播入口（核心旧代码仍在）。
2026-10-14：9aa5b34 引入 LibreTV/60s 六个短榜复用 QuickPlay；272f8b7 将首页发现区提前，防止被源浏览列表淹没。
2026-10-14：4ae7293 初始 My Lists 五份样本；1759b45 更新为公开目录，可搜索/分页；d4e213b 修补PWA缓存。
2026-10-14：45ea9d9 增加 Douban poster-only 代理修复HTTP 418；f30d301 加豆瓣热门电影/电视剧连续浏览。
2026-10-15：b1bb719 爱奇艺真实分页接口与12个频道；a526d7e Nexus 中文电影专题。
## C. 真实取数证据与精确限制
1. 爱奇艺原榜：https://www.iqiyi.com/ranks1/-1/0 。浏览器滚动发出真实请求：
   https://mesh.if.iqiyi.com/portal/pcw/rankList/comSecRankList?category_id=-1&tag=0&pg_num=2
   现场观察 pg_num=2、3、4，各次结构化 JSON 含 contents[25]、title、img、mainIndex、tags、desc。
   频道 category_id 有电影1、电视剧2、动漫4、纪录片3等；排序子榜型并未完成独立参数验证。
2. 爱奇艺生产代理：/iqiyi-rank?channel=-1&page=1 和 page=2；分别25条、起始rank1和26。
   Chrome 首页：进入爱奇艺总榜25条；点击继续追加50条且末张#50；切电影频道变25条、首张#1。
   前5张海报成功；未核验每一部播放成功，也未声明手机端永不缓存旧资源。
3. Nexus目录：https://nexusfilmx.com/rankings ，HTML中 Schema.org CollectionPage 的 hasPart 含43个主题。
   代码默认屏蔽 erotic/horror/thriller 三主题，展示40。
   示例：https://nexusfilmx.com/rankings/douban-genre-mystery 的 ItemList 有100部、含中文名与 TMDB image。
   示例：https://nexusfilmx.com/rankings/douban-hot-tv-american 的 ItemList 50部，当前过滤后48部。
   线上通过 /nexus-directory 和 /nexus-list?slug=douban-genre-mystery；Chrome显示100部，前8海报真实宽度500。
4. 豆瓣热门：直接使用网站原豆瓣推荐/搜索结果接口按20条请求，连续加载实测20→59条。
   注意这是热门推荐，不是原始热度1-300名排行；已有400候选软限制。
5. 豆瓣周榜/百度热播来自 60s 源，多数每榜10，个别仅6，不存在漏显90条的问题。
6. 猫眼网页公开前30，往下没有网页版31名；腾讯实时频道短榜每类10，尚未完成稳定服务端接入。
## D. 做过而不应再犯的错误
- 初次六个短榜（6～10部）被描述成主发现方案，实质只是每周速览；用户需要完整可翻阅的榜和不同平台。
- My Lists 英文社区原有541目录记录，多数空或与中文观看需求不合，过滤后约140非空；并且恐怖题材占比高。
  正式中文精选已替换默认入口；旧英文内容仍可手动进入，不要再把它作为首页主要推荐。
- 直接从 img*.doubanio.com 加载海报被HTTP 418挡住；Referer验证后HTTP 200，代理只接受特定Douban图片。
- Cloudflare预览分支此前常停queued，不能称排队预览成功；以main合并后部署和真实网址验收为准。
- 自动浏览器一次误报爱奇艺切换失败，随后独立Chrome直接DOM验证实际25→50及换频道；失败报告与成功报告均应保留。
- 用户不喜欢临时补丁堆砌；下一轮先做信息架构/数据源审查，而不是看到一个榜单就加一个平级按钮。
- 区分证实事实、推断假设、代码存在与生产实测；不能把本地单测全过等同于页面可用。
## E. 关键代码与验证方法
顶层：index.html、service-worker.js。
数据：functions/iqiyi-rank.js、functions/nexus-directory.js、functions/nexus-list.js、
functions/hot-list.js、functions/poster-image.js、functions/managed-sources.js。
界面：js/hot-list.js、js/iqiyi-ranks.js、js/nexus-lists.js、
js/curated-lists.js、js/douban.js、js/browse-live.js、js/quick-play.js。
成人策略：js/content-policy.js；测试：test/iqiyi-ranking.test.mjs、test/nexus-chinese.test.mjs及npm test。
2026-10-15 07:37 npm test 110/110 通过。上次成功生产deploy的 GitHub main SHA=a526d7e。
不要把临时测试探针或存放在 TEMP 的现场HTML当作项目永久证据（已清理临时探针）。
可复查证据：git log origin/main、GitHub PR 17/18、Cloudflare最新main部署、
实际生产接口第1/2页、浏览器中的卡片数量/海报 naturalWidth/分类切换。

## F. 后续待办与交接边界
- 必做：完整豆瓣分类与多层筛选；爱奇艺其他榜型正确对应；Nexus专题说明/评分/地区细化和筛选质量。
- 必审：Schema.org目录链接和名字目前按索引配对，可能因上游改版而顺序错位；需要结构化匹配/监控。
- 待批准第3阶段：将“选片源→横类→细类→片源API查询”严格绑定，拒绝无声回全部。
- 次要：猫眼跨平台短榜/腾讯频道榜，只在找到稳定可验证的数据并符合平台使用限制后接入。
- 工作管理：现有项目不新建；修改先branch from origin/main，不覆盖生产，不跨功能堆改。
