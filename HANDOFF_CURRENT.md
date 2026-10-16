# LibreTV / Cloudflare Pages — 当前接力入口
最后核验：2026-10-15（北京时间）。本文件是给新 Codex / GPT 窗口的工作交接，不是产品需求替代文件。
**不要重新建项目。** 现有项目就是 G:\CodexWorkspace\04_PROJECTS\LibreTV_CF_Deployment。
GitHub：https://github.com/t1tzhuce6-tech/LibreTV
线上：https://libretv-private-20261013.pages.dev/
历史流水和证据见 docs/LIBRETV_DISCOVERY_HISTORY_20261015.md。

## 0. 新接手者先做的四件事
1. 在现有目录读取本文件和历史文件；不要凭旧会话直接改站。
2. 检查 git status、分支、origin/main、Cloudflare 最近部署及用户最新反馈。
3. 代码修改须从最新 origin/main 新建功能分支；先运行 npm test，再改；通过 PR 合并，验收上线。
4. 单轮改动范围保持小，尽量每个步骤不超过约20分钟；上线前必须实测真实数据与浏览器页面。
## 1. 已核对的磁盘/Git 事实
- 工作目录存在，包含 index.html、js/、css/、functions/、test/、docs/、.git/。
- 2026-10-15 07:36：本地分支 feat/nexus-chinese-lists-20261015，HEAD=ef90819。
- 已 git fetch；远端 origin/main=a526d7e44242a507f1677236a3af3e4f440a5211。
- 本地功能分支与 origin/main 分别有1个独有提交（GitHub squash 合并造成）；不要把 ef90819 当主线，也不要重复合并。
- 核验前 git status 干净；随后接力文档为新建未提交的本地文件，不影响生产代码。
- 本地 npm test：110/110 通过，0失败（2026-10-15接力前实测）。
- GitHub 最新主线：a526d7e “Add Chinese Nexus editorial directory with full ranked lists”。
- Cloudflare Pages 项目：libretv-private-20261013；此前验证生产构建 success、部署 SHA=a526d7e。
- Cloudflare 实际 HTTP 200 的数据以及浏览器验收详情见历史文件；不要将它误写成永久可用保证。
## 2. 用户的实际目标和边界
- 做好用、中文优先、基本免维护的影视发现入口；不愿意手工维护几十个失效影视源或片单。
- 豆瓣只是多个榜单来源之一；爱奇艺、腾讯、猫眼等需要各自真实排名和原平台分类，不能混起来假造总榜。
- 能分页的必须能继续翻，不能只接25条首屏；无分页的不能臆造更多数据。
- 中文主题/种草片单需要标题、说明、海报、完整作品列表；原来 My Lists 全英文且恐怖/成人内容较多，已降为备用。
- 成年内容应在片单目录、分类、影片三级过滤；恐怖题材不要默认大量推荐，可独立隐藏/另设选项。
- 用户点影片可走网站原有 QuickPlay 自动找片；找不到时可复制中文片名回站搜索。不得承诺所有影片一定能播放。
- 网站原有两个配置方案必须保留独立设置；旧 IPTV 前端已按要求移除，未经明确批准不得重新加入。
- 未批准的第3阶段：选某个具体片源之后，该片源横向分类、细分类下拉、影片查询都只用这个片源真实 type_id。
## 3. 已实现、已合并进 main 的部分
- 方案1：原始 LibreTV VOD；方案2：由 hebijunge/tvbox-config 的 healthy.json 导入兼容 MacCMS 源，配置互相独立。
- 内容策略：隐藏成人源/目录/片名；旧的电视直播 UI 移除，内部旧 IPTV 文件尚在，勿误删或重启用。
- 六个短榜：豆瓣电影、国产剧、海外剧、两类综艺、百度热播剧；上游多为6～10部，只能当短榜。
- 豆瓣热门电影/电视剧：复用原豆瓣分页接口，每批20，向下追加；现在仍是两个粗分类，不是完整豆瓣分类。
- 豆瓣海报：functions/poster-image.js 通过受限图片代理解决 Douban CDN HTTP 418 防盗链。
- 爱奇艺风云榜：独立模式；12个频道、榜单原始顺序和热度、每次25部、追加至第50名已浏览器验收。
- Nexus 中文片单：共43个原专题，默认屏蔽3个明确成人/恐怖/惊悚专题，实际页面40个；中文名称、海报、原名次。
- My Lists 英文社区：原541份公开目录，非空过滤后约140份；只放在中文专题页面的手动备用入口。
- 所有新影视入口点击影片仍使用已有 QuickPlay；Nexus 另有单独复制片名按钮。
## 4. 真实验收证据：区分程序实现和实测
- 爱奇艺真实 JSON：mesh.if.iqiyi.com/portal/pcw/rankList/comSecRankList，category_id=-1、tag=0、pg_num=1/2。
- 线上 functions/iqiyi-rank 接口：总榜第1批25部，第2批25部；电影/电视剧频道各25部，含海报和热度字段。
- 真 Chrome 对生产页：选择爱奇艺总榜 25部→点击追加50部（末张#50）→切到电影变25部（首张#1），抽查前5张海报成功，无JS异常。
- Nexus 元数据来自原站页面 Schema.org CollectionPage / ItemList，不是我们自动编榜；线上目录40专题。
- Nexus 线上：高分悬疑电影完整100部，热门欧美剧作者50部、过滤后48部；浏览器展示100部，抽查前8张海报全部成功。
- Chrome 曾与第三方浏览器验收得到相互矛盾的爱奇艺切换报告；之后独立 Chrome DOM 验证25→50与换频道成功。
- 上述证明接口与主要UI实际可用，不等于所有100部都可在所选片源播放；也不等于 iPhone 所有缓存版本均无问题。
- 正式承诺必须依据当前代码及当次重新测试，不得把本文件里的历史观察当最新健康检测。
## 5. 核心文件速查
- index.html：首页入口加载顺序/静态版本参数；css/iqiyi-ranks.css、css/nexus-lists.css：新模块样式。
- js/hot-list.js：首页模式切换与豆瓣分页、每周六小榜。
- functions/hot-list.js：6个短榜60s API数据；js/iqiyi-ranks.js：爱奇艺UI；functions/iqiyi-rank.js：爱奇艺固定上游读取。
- js/nexus-lists.js：中文专题目录、详情、QuickPlay和复制；functions/nexus-directory.js：目录的Schema.org解析。
- functions/nexus-list.js：单份片单ItemList解析；js/curated-lists.js、functions/curated-*.js：原英文备用源。
- js/douban.js：旧豆瓣推荐和既有分页读取；js/browse-live.js：片源选择及目前分类逻辑。
- js/catalog-adapter.js：MacCMS类目 normalClasses/categoryIds；js/profile-manager.js：两套方案状态。
- js/quick-play.js：真实搜索/播放协调；js/content-policy.js：成人内容策略。
- service-worker.js：PWA缓存版本，现主线 APP_VERSION=20261015-nexus-v1。
- test/：node --test（npm test）；尤其 iqiyi-ranking.test.mjs、nexus-chinese.test.mjs。
## 6. 尚未实现或尚未充分验证：不可表述为完成
- 爱奇艺目前只验收 tag=0 的热播类；飙升、免费、必看、期待、N刷、热搜等榜型尚未确认真实独立请求，不能直接用网页路径的数字冒充接口参数。
- 爱奇艺源代码设 page<=40 安全上限（不是官方宣称最大页数）。用户希望尽可能完整翻阅，须验证上限后再调整。
- 豆瓣电影/电视剧热门当前人为设约400候选上限，也不是完整的电影17类、电视10类体验。
- Nexus 当前目录依赖固定链接顺序与结构化项目顺序对应；上游变化会造成错位，需补强解析校验。
- Nexus 完整内容未显示评分、年份、精确类型等丰富元数据，只有片名、排名、封面和标题简介。
- 成人筛选为规则组合，不是100%安全；用户曾报告英文片单出现色情和恐怖内容。
- 猫眼网页目前公开榜单约30名；腾讯9个频道短榜约10名。尚未接进网站；网页能看不等于有稳定官方API。
- 第3阶段片源→横向分类→细类→列表的严格联动，用户已认可思路但尚未实施。
- 仅测试自动找片入口存在，尚未全面验收某个爱奇艺/Nexus作品最终播放成功率。
## 7. 建议的下一轮顺序（先诊断/评审，再经用户确认实施）
1. 核对生产现场与用户最近截图/反馈；跑 npm test 和真实浏览器，先处理当前可用性问题。
2. 方案设计：完整豆瓣分类、多平台独立榜型、中文专题质量/说明/过滤、手机可读性和稳定缓存。
3. 对爱奇艺不同榜型逐一抓取浏览器真实网络请求，仅接入已验证完全不同的真实数据。
4. 补完豆瓣分类，避免新旧两个豆瓣入口重复；检验各标签翻页和图片来源。
5. 评估猫眼/Tencent等独立数据的合法、稳定读取与退路；不强行绕过登录或反爬机制。
6. 按已讨论的第3阶段做片源/分类严格联动（状态失效、旧请求污染、无类目不可静默回全部）。
7. 每个小变更：单独分支、测试、PR、Cloudflare、手机与Chrome真实验收；失败可回退。
**不要一次性执行全套，也不要创建另一个LibreTV项目；未经用户确认不要自行大改导航或重加直播。**

## 8. 新窗口 / Codex 接力口令
请接手现有项目 G:\CodexWorkspace\04_PROJECTS\LibreTV_CF_Deployment。
先完整阅读 HANDOFF_CURRENT.md 和 docs/LIBRETV_DISCOVERY_HISTORY_20261015.md。
从磁盘/Git/线上现场核对已验证事实与未完成问题，特别注意当前本地功能分支不是GitHub已squash合并的main。
不要新建项目、不要复做已完成爱奇艺/中文专题、不要重新添加旧直播UI。
先给我现状差异、最重要的下一项工作和风险；等我确认再修改。若获准修改，用origin/main创建新分支、运行测试、PR合并并验收生产。


## 9. 爱奇艺安全片源 P0 专项（2026-10-15 本地分支）
本轮直接核对和修复方案参见 docs/LIBRETV_SOURCE_POOL_P0_AUDIT_20261015.md。
分支 fix/iqiyi-safe-source-pool-20261015 从 origin/main 82eb484 建立：排除成人源、扩大榜单播放安全源池、无需返回首页修改勾选即可换源。
本文写入时尚未合并/部署；本地114项测试通过，不等于生产站已完成授权浏览器首帧及移动端验收。通过 PR 合并后必须再核查。

## 10. 官方榜单可复用入口与片源可见性（2026-10-15）
参见 docs/LIBRETV_RANK_EXTENSION_ARCHITECTURE_20261015.md。已在 PR #21 的同一功能分支继续开发：
新增 js/rank-bridge.js 为官方榜单的统一播放桥，爱奇艺先接入；QuickPlay 搜索增加限时的第2/3页补漏；
QuickPlay 和播放器换源弹窗显示片源总数、已检查数、匹配数，禁止过期播放历史绕开当前安全片源池；
方案二刷新后保留十多个手动选择源有新增回归测试。upstream Git remote 指向 wxst/LibreTV，但没有合并上游代码。
未合并到 main、未部署生产，最终线上实机首帧/换源/高速高清验收仍待完成。

## 11. 用户新增验收要求：换源查询所有已接入安全片源（2026-10-15）
用户在播放器显示“66-360*”的截图中明确要求：从榜单进入后手动点【换源】，不应只查已勾选的两个源或写死12个；后续新增的普通源也应自动进入候选，排除明显色情源、禁用源、同接口重复源，优先稳定高清高速。
本分支在 PR #21 上修正：safeSourceIds(true) 改为动态枚举 API_SITES 所有来源及当前方案所有自定义源（不受勾选限制）；首页/播放器都刷新订阅，换源及 QuickPlay 在扫描前等待同步；每次只并发4路、最多查3页，逐步显示匹配来源，历史质量数据影响优先级。
模拟100个不同正常源+未勾选普通自定义源通过；订阅上限从75提高到300（用于防止异常大规模订阅）；两个方案的勾选仍独立。非活动方案快照的独立自定义源目前未跨方案映射，不能宣称全部已覆盖。
正式生产仍是 origin/main，未经 Cloudflare Preview HTTP/授权浏览器真实播放验收，不得宣称截图中的行为已更新。

## 12. Cloudflare Preview 修复及实机范围（2026-10-15）
具体见 docs/LIBRETV_RANK_EXTENSION_ARCHITECTURE_20261015.md 末尾。
已查明 Pages 预览原先禁用（preview_deployment_setting=none），本轮仅开启当前修复分支 custom 预览，不触动 main/生产。
Cloudflare重试 ae0d888 预览成功，https://2fa23f59.libretv-private-20261013.pages.dev/ 可访问。
Edge真实浏览器：首页和播放器注册49源、动态安全候选42源，而方案一勾选仍为7；实际调用换源弹窗并注入2个模拟匹配，确认查遍42源/两个切换按钮/搜索进度文字。
预览无 PASSWORD，代理无鉴权返回401，生产有密钥；真实代理→首帧/画质/缓冲需独立授权，不能把模拟的2条当成实播。现有哈希式代理鉴权存在待审安全边界；不可随意复制生产密码到预览。
PR #21 保持 Draft，正式生产未更新，未请求合并。

## 13. 换源卡片真实分辨率 vs HLS清单声明（2026-10-15）
本轮以 origin/main 931b34a 派生 feat/switch-source-resolution-20261015 分支，详情见 docs/LIBRETV_SWITCH_RESOLUTION_20261015.md。
用户要求截图的换源弹窗，在现有测速数字旁增加每条线路的分辨率。实现遵守证据分级：当前已播放流以 videoWidth/videoHeight 显示“实际解码”；其他线路只能从原有 HLS 清单测速得到 RESOLUTION，标注“清单声明”；没有来源则显示“分辨率未知”，不能猜1080P。
复用测速，无独立下载额外媒体段，原有42安全候选池不变；随当前播放集数优先采样。测试125/125通过。若未合并本分支，则正式站点依然没有新分辨率标签。

## 14. 片源质量第二阶段：成人专用源清理与高清基线（2026-10-15）
见 docs/LIBRETV_SOURCE_QUALITY_AUDIT_20261015.md。
从 origin/main d68e588 建立独立修复分支 fix/source-quality-adult-cleanup-20261015。本轮线上27条订阅源经新规则实际核算：排除10条成人专用条目，保留17条（13条可搜索）；对独立域名、重命名、旧浏览器缓存和自定义源同时禁止。尚未确认有成人属性的正常综合影视源不整站删除，继续按内容过滤。
真实测试《轧戏》同集 HLS 声明：光速1920x1080 4.096Mbps；360 1920x1080 0.991Mbps；U酷1280x720 2Mbps；非凡1280x720 0.8Mbps；影视工厂1080x608 0.8Mbps。豪华一个集数的 ffprobe 实测H264 1920x1080，其他源不一定能在采集机探测；真实质量需多集、多时段核验。
外部发现的七条新候选均未满足实时可搜索条件，未接入。后续要提高平均画质，优先验证光速及豪华码率/缓冲/质量后再评估自动优先级。
用户明确要求安全源直接移除，完成独立PR并发布至 main 后才算线上生效。发布时必须核对服务端订阅返回值、浏览器候选池和PWA缓存版本。

## 15. DR 独立影视页入口（2026-10-16）
用户明确决定暂不替换 LibreTV，以 LibreTV 为主站，DR 另开独立页面，先接网页入口、后续再部署/连通 DR 服务。说明见 docs/LIBRETV_DR_PORTAL_20261016.md。
开发分支 feat/drpy-dual-portal-20261016 从 origin/main 2c513101 创建。新增 dr.html、js/dr-portal.js、css/dr-portal.css、css/dr-navigation.css；主页增加切换页签。DR 地址可按浏览器独立设置或将来从 DR_PUBLIC_URL 环境变量统一提供（仅安全 HTTPS 公网来源）。现有资源与安全过滤不受影响。
**不要混淆完成状态：DR 网页接入入口可部署，但 drpyS Node 后端尚未安装/启动/公网连通。** 当前 Windows Node v24 超出 drpyS 的 <24 要求，Docker daemon 未运行。未授权之前不能把本机端口暴露到公网。需进一步确定 DR 后端常驻位置及身份认证。

## 16. 纠正 DR 集成方向（2026-10-16，覆盖第15条原嵌入设计）
用户明确纠正：DR 绝不是在 LibreTV 里 iframe 嵌入 DrPlayer 或跳转到 DR 网站；LibreTV 第二页使用本系统原生页面与播放能力，DR 仅负责数据、推荐、分类、搜索、影片详情、播放解析。DR 页**不要爱奇艺榜单，也不混主站任何普通源或直播**。允许分阶段实施并每阶段自测。
开发分支 feat/dr-native-page-20261016 基于已合并 origin/main 87f373a。第一阶段更改 dr.html，新增 css/dr-native.css、js/dr-native.js、functions/dr-data.js，删除旧 js/dr-portal.js、css/dr-portal.css 及前端公开 DR_URL 注入。原主站不变。设置 DR_BACKEND_URL、DR_API_PWD、DR_SOURCE_ALLOWLIST 仅在服务端。明确只有源名单和 T4 同源 API 可请求；成人信息基础过滤。
第一阶段 npm test 134项全绿。**尚未合并/部署**，避免把只有目录/搜索的页面当成已可播放。第二阶段要实现 DR T4 详情与逐集解析及复用 LibreTV 的播放器、DR 独立换源，第三阶段要连通实际后端验收后才能正式替换线上旧 iframe 版。完整说明 docs/LIBRETV_DR_PORTAL_20261016.md。

## 17. DR 原生页第二阶段代码完成（2026-10-16）
在 feat/dr-native-page-20261016 继续实现 DR T4 detail/play：从 DR 详情拆出各线路和集数，按 ?play 和 flag 逐集解析；可直接访问的 HTTPS 媒体交给 LibreTV 原 player.html（dr=1）。在 player.js 的 DR 模式，换源不再显示主站源池，而是返回 DR 页按当前片名搜索；相关推荐/主站影片详情在 DR 模式被屏蔽。视频解析若需额外请求头、网页嗅探、DR 代理、HTTP则明确不支持，不能谎称可播放。
DR 搜索状态换源仍保留相同搜索词。全项目 138 项模拟/静态测试 PASS；未连接真实 drpyS 后端，未经过真实播放和手机端验证，**该 Draft PR 不可合并至生产**。下一步：实际部署 DR Node 服务，配置环境变量、严格审核源名单，再联调源、视频流和兼容性。详见 docs/LIBRETV_DR_PORTAL_20261016.md。
