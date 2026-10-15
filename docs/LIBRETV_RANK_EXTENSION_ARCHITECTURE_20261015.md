# LibreTV 官方榜单扩展与片源维护：可更新的边界

- 现有仓库：t1tzhuce6-tech/LibreTV（GitHub fork），直接上游 wxst/LibreTV。
- Git: origin 指向我们的仓库；upstream 已注册作者仓库，当前仅核实地址，没有拉取/合并作者代码。
- 本专项在 fix/iqiyi-safe-source-pool-20261015 的 PR #21 草稿分支实施，合并前必须验收。

## 三个独立职责
1. 播放器：LibreTV 原版播放器负责播放、字幕、进度与换源；后续尽量减少修改其核心文件。
2. 榜单：每个平台使用独立 Cloudflare Function，按官方数据动态获取排名、分类、分页和海报；当前为 functions/iqiyi-rank.js。
3. 片源：沿用可配置的普通 VOD 源和自动更新的订阅；成人专用源从候选池排除，混合源只过滤成人影片/分类。

## 新增的稳定接入边界
- js/rank-bridge.js 暴露 window.LibreRankBridge.register(provider, mapper) 和 open(provider, item)。
- 注册器将各榜单项目映射为 {title, year, kind}，最终交给 QuickPlay，强制使用当前方案的 safe-all 搜索范围。
- 爱奇艺仅在 js/iqiyi-ranks.js 注册映射，不再直接耦合播放器查询参数；未来的榜单各自注册而不是复制找片逻辑。
- js/quick-play.js 最多并行处理4个源，每源首次未命中时最多查第3页，总计6.5秒源级时间预算。
- QuickPlay.findMatches 被播放器换源对话框复用；UI显示检查数和片名匹配数，匹配不等于播放成功。
- 配置方案的勾选仍存 localStorage；榜单扩展搜索不改变勾选。方案一与方案二继续隔离。
- SourceSpeed 和真实播放历史的质量评分已有基础能力；最佳高清自动选择仍待实际测量与验收。

## 安全同步上游
- 仅 fetch upstream 并在临时同步分支比较差异，绝不 force push 或 reset 覆盖我们的 main。
- 冲突需独立审查、合并测试和播放器回归，确认后通过 PR 更新我们的 main。
- 官方榜单日常名次变化由动态 API 读取自动反映；若官方修改接口协议，仍需修复对应平台适配器。

## 验收边界
- 自动化测试和接口清单成功不能代替授权浏览器首帧、换源、速度、清晰度和移动端缓存实测。
- 此文件及对应程序改动提交草稿 PR；未合并前线上继续运行原版本。

## 2026-10-15 补强：动态全源换源（不固定12个）
- 界面换源按钮必须查询运行时 API_SITES 中所有已注册、可搜索、非成人源；选中状态只影响优先级而不限制搜索范围。
- 方案一本地源和已缓存/更新的方案二订阅源共同进入安全播放候选池；保持两套方案各自的 selectedAPIs 勾选不变。
- 当前活动方案中的全部自定义源也纳入候选，即使未勾选；已存于非活动方案快照中的独立自定义源尚未映射进运行时注册表，属于后续扩展边界。
- 同一接口 URL 去重；明显色情源与不可搜索源排除；混合正常/成人内容的站按影片、分类、详情过滤。
- 首页及播放器均主动刷新订阅（6小时缓存、并发复用一个刷新 Promise），手动点换源前等待本轮刷新。
- 100内置注册源+1安全自定义源+成人/停用/重复源的模拟测试通过；100条健康订阅不再被75条旧上限截断（设置300条安全上限）。
- 搜索并发保持4路、每源6500ms超时并最多查3页；换源匹配结果逐步出现，不必全部搜完再显示；历史播放质量评分影响查找优先级。
- “有HLS地址/标称高清”不等于首帧实测；高速、画质、不卡顿仍需浏览器授权播放验证，无法保证每条第三方源稳定。
- 在草稿PR中，未合并至正式 main，线上截图显示的是旧版行为。

## 2026-10-15 预览和 Edge 浏览器验收补充
- Cloudflare Pages 项目：libretv-private-20261013。GitHub 部署预览此前设为 none，造成预览记录 queued/idle 且 404。
- 仅将预览配置改为 custom，并只允许 fix/iqiyi-safe-source-pool-20261015，正式分支 main 和生产部署设置不变。
- 重试 ae0d888 的预览部署后 Cloudflare 构建/部署成功，URL：https://2fa23f59.libretv-private-20261013.pages.dev/。
- HTTP 实测：首页、js/rank-bridge.js、js/quick-play.js、js/player.js、js/content-policy.js、service-worker.js、爱奇艺榜单API和27源订阅均返回200；部署传播初期短暂404，复查已恢复。
- Windows Edge 独立测试配置文件真实加载预览：首页注册49源，过滤去重后42个安全候选；local方案只勾选7源；播放器同样42候选；榜单桥传递正确 title/year/kind/scope。
- Edge 换源弹窗交互测试（注意：搜索结果使用模拟响应，不是真实播放测试）：实际走遍42个互不重复的源，2个模拟匹配则渲染2条来源和2个「切换」按钮，状态显示“检查完成：42个源，匹配2个”。
- Cloudflare预览环境缺少 PASSWORD/PASSWORD_HASH，生产环境有 PASSWORD(secret_text)；预览代理 /proxy/ 请求确认为401。不得把401当成源失效。
- 暂未完成带授权身份的实机检索→详情→视频首帧→卡顿/分辨率及iPhone缓存验证。预览无授权代理，因此 PR #21 应保持 Draft，不自动合并 main。
- 待独立审查：旧代理鉴权由 HTML 注入密码哈希，浏览器代理请求将该哈希用于认证，需核查对外公开的哈希是否足够保护代理。未因本次排查修改密码或生产环境。
- GitHub当前无关联PR触发的GitHub Actions workflow run；本地 npm test 121/121通过，不能视为GitHub CI已通过。
