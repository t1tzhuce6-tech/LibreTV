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
