# 重构记录 TODO

## 已完成

- [x] 建立重构蓝图文档，明确模块化单体目标
- [x] 新增 `auth/session` 共享模块，收口 bearer token、会话用户加载、团队/管理员守卫
- [x] 新增 `billing/cost` 共享模块，收口计费类型与费用解析
- [x] 新增 `provider/seedance/seed` 共享模块，收口 seed 规范化
- [x] 新增 `billing/task-settlement` 统一结算模块
- [x] 将 `webhook` 成功/失败处理切到统一结算服务
- [x] 将 `status polling` 成功/失败处理切到统一结算服务
- [x] 将“上游提交失败”的补偿退款接到统一失败结算
- [x] 将手动退款接口切到统一退款服务
- [x] 建立 `components/dashboard` 与 `hooks/dashboard` 的拆分落点说明
- [x] 抽离 `DashboardStatsPanel`，从 `app/dashboard/page.tsx` 移出统计 tab 主体 JSX
- [x] 清理 `page.tsx` 中已废弃的隐藏统计块，避免继续在大页文件中堆死代码
- [x] 将 `auth/session` 继续接入生成、任务详情、状态查询、手动退款等核心任务路由
- [x] 抽离 `TaskListPanel` 与 `TaskDetailModal`，继续压缩 `app/dashboard/page.tsx` 的任务中心代码
- [x] 抽离 `TeamManagementPanel`，将团队主页面布局与成员表格从 `app/dashboard/page.tsx` 迁出
- [x] 抽离团队配置/成员/预算相关 5 个弹窗，进一步收口团队域 UI
- [x] 抽离资产选择/编辑/删除/保存为主体相关弹窗，收口资产域 UI
- [x] 抽离 `AssetLibraryPanel` 与 `SubjectLibraryPanel`，将资产库/主体库展示区从 `app/dashboard/page.tsx` 迁出
- [x] 抽离 `GenerationDisplayPanel`，将右侧生成结果筛选与卡片展示区从 `app/dashboard/page.tsx` 迁出
- [x] 抽离 `HoverPreviewPortal`，将生成页悬浮媒体预览层从 `app/dashboard/page.tsx` 迁出
- [x] 抽离 `GenerationConfigPanel`，将左侧生成配置区从 `app/dashboard/page.tsx` 迁出
- [x] 抽离 `DashboardModalLayer`，将页面底部各类弹窗编排从 `app/dashboard/page.tsx` 迁出
- [x] 抽离 `DashboardMainContent`，将 dashboard 主内容 tab 切换编排从 `app/dashboard/page.tsx` 迁出
- [x] 抽离 `DashboardSidebar`，将 dashboard 左侧导航与底部操作区从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useAssetPicker`，将资产选择器分页/筛选/滚动加载逻辑从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useTaskDisplay`，将右侧生成结果排序/过滤派生逻辑从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `browser-session` 与 `useGenerationEstimate`，将浏览器会话读写和生成预估派生从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useDashboardBootstrap` 与 `useTaskPolling`，将 dashboard 初始化和任务轮询 effect 从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useDashboardData`，将 assets/tasks/stats/team 配置与成员拉取逻辑从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useTeamAdmin`，将团队配置与成员/预算管理动作从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useTaskSubmission`，将生成提交、乐观任务、重新编辑/重新生成、手动刷新任务等 action 逻辑从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useAssetLibrary`，将资产上传、引用素材上传、编辑、删除、保存为主体等动作从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useDashboardUi`，将 dashboard 页面中的筛选切换、弹窗开关、任务/统计刷新等纯 UI 编排桥接从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useReferenceAssets`，将引用素材多选、拖拽排序、删除等交互逻辑从 `app/dashboard/page.tsx` 迁出
- [x] 新增 `useTaskPresentation`，将任务展示的 prompt 渲染、模式文案、时间/token 格式化从 `app/dashboard/page.tsx` 迁出
- [x] 清理 dashboard 中已废弃的旧版 `contentEditable` prompt/@引用实现，统一以 Slate `PromptEditor` 为唯一编辑入口
- [x] 修正资源消耗统计口径：失败且已退款的任务不再计入“预估消费”
- [x] 收紧团队配置读取：dashboard 首屏只拉摘要状态，管理员打开设置时再懒加载上游地址，且不再向前端回填完整 API Key
- [x] 引入 `submit_unknown` 止血态：上游超时/网关/网络异常不再直接失败退款，而是保留预扣并进入待确认状态
- [x] 补齐 `submit_unknown` 的管理端修复闭环：对账页可识别本地待确认提交，同步接口优先回填并补齐预算/费用结算
- [x] 新增待确认任务自动认领：超级管理员可按用户/时间窗口/prompt/seed/参数唯一匹配上游任务，并回填到原任务继续结算
- [x] 将待确认任务自动认领下沉到共享服务，并接入用户状态刷新与轮询链路，减少对管理员按钮的依赖
- [x] 为待确认任务认领补充流量保护：取消高频轮询自动认领，仅在手动刷新时显式确认，并在服务端加入确认冷却窗口
- [x] 为系统管理员任务列表补充任务详情查看能力，复用工作台任务详情弹窗并补齐待确认/过期状态展示
- [x] 为工作台与系统管理员任务列表补充“失败已退款”“提交确认中”等明确筛选项，避免把账务失败与待确认状态混在一起
- [x] 为团队配置补充培训机构上线所需的提交防护参数：团队最大并发、团队每分钟最大提交数、成员提交冷却秒数，并在生成接口服务端强制执行
- [x] 根据上游能力调整前端模式语义：将视频编辑和视频延长统一归并到参考生成 `reference`，移除独立入口并兼容历史任务重生
- [x] 视频模型目录补齐 `providerProtocol` 元数据，开始把“模型决定协议”落到视频侧
- [x] 新增视频 adapter registry，先以兼容层方式承接 `volcengine-seedance-v1` / `aliyun-wan-27-video`
- [x] 视频主链路切到 adapter 解析：生成、状态轮询、删除、sync、webhook、管理员对账/漏单同步不再直接依赖旧 video provider registry
- [x] 视频协议 adapter 已拆成独立文件，registry 退化为装配层；任务侧 adapter 选择逻辑收口到共享 resolve helper
- [x] 视频协议 shared 层已开始下沉：`normalizeIncomingTask` / `mapStatusToLocal` / `getTaskGenerationTimeSeconds` 先从旧 provider 中抽到协议 shared 模块
- [x] 阿里云视频协议的 `buildCreateTaskBody` 已下沉到 `aliyun-wan-27-video-shared`，旧 provider 开始只保留请求转发与兼容导出
- [x] 火山视频协议的 `buildCreateTaskBody` 已通过 `volcengine-seedance-v1-shared` 收口，视频双协议在请求构造层完成对齐
- [x] 图片 adapter 骨架已建立：`volcengine-images-v1`、`aliyun-wan-27`、`grsai-gpt-image`、`grsai-nano-banana`，生成入口与执行入口开始按 model protocol 解析 adapter
- [x] `grsai` 图片协议已开始下沉到 shared：GPT Image 与 Nano Banana 的请求构造、轮询和结果归一化从旧 provider 中抽离
- [x] `aliyun` 图片协议已下沉到 `aliyun-wan-27-shared`：请求构造、错误包装和结果归一化从旧 provider 中抽离
- [x] `volcengine` 图片协议已下沉到 `volcengine-images-v1-shared`：请求构造和结果归一化从旧 provider 中抽离
- [x] 旧的 `lib/modules/image/providers/*` 已退成兼容别名，图片 registry 直接指向 adapter，避免继续维护双份实现
- [x] 视频 registry 已直接指向 adapter，旧的 `lib/modules/provider/providers/*` 开始退成兼容别名，减少双份实现
- [x] 已补第一批 provider fixtures 校验骨架：新增 `npm run check:provider-fixtures`，已覆盖图片侧 shared 请求构造与固定响应样本
- [x] 已补视频侧第一批 fixtures：覆盖 aliyun video shared 请求构造，以及 aliyun / volcengine video 成功态和运行中态样本
- [x] 已补失败态和空输出 fixtures：覆盖 grsai / aliyun / volcengine image 边界样本，以及 aliyun / volcengine video 失败样本
- [x] 已移除画布功能：删除 dashboard 入口、`/canvas` 编辑器壳、`/api/canvas` 与兼容 `api/v2` 接口、`public/canvas` 静态运行时，并移除 `CanvasProject` 模型与表。

## 当前阶段目标

- [ ] 继续把账务逻辑从路由完全迁出，做到 route 只负责鉴权/参数/响应
- [ ] 统一 webhook 与 polling 的终态处理日志和幂等语义
- [ ] 审查团队预算池 `team.usedBudget` 的所有写路径，补齐对账逻辑
- [ ] 按 `generation-provider-refactor-plan.md` 推进文本/图片/视频多厂商统一接入架构，优先完成通用 provider config 命名与图片 adapter 抽象
- [ ] 继续把视频 provider 从“兼容 adapter”推进到“协议 adapter”，把厂商实现中的请求构造/响应归一化进一步下沉到 protocol 文件
- [ ] 继续收口资源弹窗与任务列表的数据加载边界，避免大列表一次性拉取。

## 下一阶段

- [ ] 抽 `jobs/status` 模块，统一上游状态映射
- [ ] 继续收口 `app/dashboard/page.tsx` 中残余的状态拼装与交互桥接逻辑
- [ ] 继续下沉 prompt/引用编辑相关逻辑，评估 `usePromptMentions` 或独立 editor 模块
- [ ] 引入更明确的账务状态字段或 reservation/ledger 结构
- [ ] 用 ledger 驱动统计，而不是继续只靠 task 行聚合
- [ ] 建立 provider adapter normalizer fixtures，覆盖提交成功、轮询中、成功、失败、鉴权失败、空输出和未知响应

## 风险提醒

- 当前数据库结构仍然是过渡态，尚未正式引入 `reservation` / `ledger` 独立表
- 这意味着账务逻辑虽然已开始收口，但还没有完成最终商业级形态
- 本机 `npm run dev` 当前会因为 `spawn EPERM` 无法直接拉起；当前验证使用 `npm run build`、PM2 重启以及本机 HTTP 访问
- 供应商配置已开始支持聚合平台厂商，但 `getUserVideoProviderConfig` / `TeamVideoProviderConfig` 等命名仍处于兼容过渡态
- GRSAI 是文本/图片/视频聚合平台，不应在架构上建模成 image-only；当前只是先接入了 GPT Image API

## 暂停点

- 资源弹窗已改为打开后按页加载，搜索带防抖，滚动触底继续加载；任务列表首屏只拉取分页任务并收窄返回资产字段。
- 画布功能已按产品决策移除，后续不再继续迁移画布侧辅助 AI 能力。
