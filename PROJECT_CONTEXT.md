# COMETS Pay 项目上下文

更新时间：2026-09-17（Asia/Shanghai）

这份文件用于在新的 Codex 任务中快速恢复项目上下文。开始工作前，应同时阅读
`AGENTS.md`、`SYSTEM_AUDIT.md`、`app/SOURCE_BASELINE.md` 和 `ID_STANDARD.md`，
并先执行 `git status`。本文件不替代这些文档。

## 1. 协作角色

Codex 在本项目中持续以以下双重角色工作：

- 资深前端工程师：关注 React/TypeScript 工程质量、组件边界、交互状态、
  响应式设计、可访问性、性能、可维护性和可验证发布。
- 资深产品经理：先厘清用户角色、业务目标、完整流程、状态机、异常路径、
  权限边界、数据口径和验收标准，再决定页面与实现细节。

工作方式应直接、严谨、面向落地。不能只做视觉表面调整，也不能把原型能力描述成
真实后端能力。发现业务逻辑、数据关联或安全边界存在问题时，需要明确指出影响和
可执行方案。

## 2. 用户约定

- 后续前端改动只在本地源码 `app/` 中进行。
- 未收到用户明确的“推上 Mac”或“部署到 Mac”指令前，禁止连接、修改、重启或
  部署远端服务。
- 不覆盖用户现有文件或无关改动。
- 每个完成的需求保持为聚焦的本地 Git 提交，便于查看改了什么、更新了什么。
- 完成后向用户说明变更文件、行为变化、验证结果和本地 commit ID。
- 本地页面可运行时，提供可点击的预览地址。
- 默认使用中文沟通。
- 后续代码输出只展示聚焦 diff，不输出整个文件或重复调试日志。
- 同一报错最多调试 3 次；仍无法解决时停止重试，给出可执行的人工排查方向。
- 修改 `App.tsx`、`types.ts`、`index.css`、公共组件或其他全局文件前，
  必须主动声明影响范围；优先复用现有类型、组件和工具函数。

## 3. 工作区与版本状态

- 主工作区：`/Users/aria/Documents/支付系统管理端`
- 维护源码：当前工作区下的 `app/`
- GitHub：`https://github.com/Moly-9/comets-pay-admin`（公开仓库）
- 默认远程分支：`main`
- 当前维护分支：`codex/merge-colleague-20260812`
- 当前功能基线：`abc1b93 refactor(projects): rename Feishu status update action`
- GitHub 同名分支尚未同步最新本地提交；推送前必须重新执行 `git fetch`、
  `git status --short --branch` 和完整验证，不得仅依赖本文档的快照。
- 源码基线提交：`1513bd6 chore: import maintainable frontend source baseline`
- 原始源码压缩包标记提交：`7d419cb8694e7a3afbd05f608f69256a511cae81`
- 原始压缩包 SHA-256：
  `b39add34e433877188bf474250fcae6dee684475aad8a54179e20e533e0dad2f`

源码是从桌面压缩包导入 `app/` 的，没有覆盖根目录已有审计文档、增强模块、远端
快照或历史代码。导入时已移除固定演示密码、员工邮箱和完整示例收款号码。

截至本次更新，工作树没有未提交的跟踪文件；以下未跟踪资料必须继续保留在
Git 提交之外：

- `outputs/` 下的 Excel 临时锁文件。
- `outputs/design-qa-contract-signature/`。
- `outputs/frontend-style-audit-20260911/`。

## 4. 本地运行与验证

- 本地预览：`http://127.0.0.1:5173/`
- Vite 开发和预览服务只绑定 `127.0.0.1`。
- 当前功能基线已通过 134 个测试文件、1029 项 Vitest 测试和
  `npm run build`（2026-09-17）。
- 主要页面已进行桌面端与 390px 窄屏视觉检查；个别新需求仍应重新验收。
- 登录和主控制台已检查，浏览器控制台没有警告或错误。
- `/health`、首页、静态资源、SPA 回退、404、405、`server.mjs` 语法和 plist
  均已验证。
- `npm audit --omit=dev` 报告 8 个依赖风险（4 个 high、4 个 moderate），主要涉及
  Vite/esbuild、Browserslist、PostCSS、Nano ID 和 ExcelJS 间接依赖。不得直接运行
  `npm audit fix --force`；升级必须单独评估破坏性变更并完成全量回归。

如果新任务中预览地址失效，应从 `app/` 启动本地开发服务，不得因此操作远端。

## 5. 系统现状

COMETS Pay 当前是 React 18、Vite 和 TypeScript 构建的纯前端高保真原型，由一个
小型 Node HTTP 服务提供静态文件。

当前没有：

- 应用后端或数据库
- 真实认证、会话和服务端 RBAC
- 真实注册、重置密码或飞书登录回调
- 数据持久化和服务端审计日志
- 支付渠道、Webhook 或真实付款集成

页面中的审批、合同、Invoice、付款、渠道校验和通知均为客户端内存行为，刷新会
丢失。任何真实认证、PII、银行资料、审批或付款流程都必须先建设服务端能力，不能
仅靠前端实现。

当前已实现的主要原型能力：

- 合作项目与媒介请款项目分离；飞书合作项目使用本地适配器和演示数据。
- “我的请款”负责新建、草稿、退回修改、资源维护和提交；合作审批、财务审批与
  付款工作台保持独立角色入口。
- 请款的项目 PM 为选填；选择 PM 时使用“PM → 媒介负责人 → 老板 → 财务”，
  未选择时从媒介负责人开始。
- 合同支持单页上传、PDF/DOCX 本地解析、字段确认、结构化生成与 PDF/DOCX 下载。
- Invoice 支持单笔和批量生成、签署提醒、媒介审核、版本修订和付款失败回退。
- 同一达人可关联多份合同；但在一次请款中只能关联一份已审核通过的
  Invoice。历史多 Invoice 记录只保留展示，编辑或重提前必须修正为一份。
- 合同、Invoice 和请款的资源关联均使用稳定 `creatorId`、`engagementId` 和业务实体 ID；
  Handle、Display Name 和平台不用作跨模块主键。
- 收款账户支持 Airwallex、PayPal 和 PayMax；文档使用选定账户的不可变快照。
- 付款清单按 Invoice 保存独立付款行，支持版本化编辑、重新校验和 Excel 导出。
- 管理员修改已提交资源时，现有审批和付款校验会失效并要求重提。

## 6. ID 规范与待实现事项

`ID_STANDARD.md` 已确定系统采用：

- UUIDv7 作为稳定、不可变的内部实体 ID。
- 带业务前缀的可读 code 用于页面、搜索、导出和人工沟通。
- `creator_id` 贯穿合同、Invoice、付款申请、付款单和收款账户。
- `external_identity` 保存目标系统、租户与 `external_creator_id` 的映射。
- 付款回调通过 `external_transfer_id` 定位交易，再关联付款单和网红。

应用已引入 `CooperationProjectId`、`PaymentRequestProjectId`、`CreatorId`、
`EngagementId`、`ContractId`、`InvoiceId` 和 `PaymentListId` 等品牌类型，主要跨模块流程
已使用稳定 ID 关联。但现有 fixtures 与部分旧字段仍保留字符串兼容层，真实 UUIDv7
仍必须由未来后端生成。姓名、邮箱、Handle、合同号、Invoice 号或渠道 beneficiary ID
都不能替代 `creator_id`。

## 7. 开发与发布边界

- 不手工修改压缩后的生产 bundle。
- 在 `app/` 修改可维护源码并重新构建带 hash 的 `dist`。
- 开始编辑前检查 Git 状态，保留用户和其他任务已有改动。
- 发布前必须重新读取 `AGENTS.md` 的备份、磁盘、暂存、原子替换和验证要求。
- 远端生产服务只维护 `192.168.88.188:8771`，不得触碰相邻端口或服务。
- 远端当前发布包和本地源码构建并非完全一致，部署前必须单独验收差异。

## 8. 新任务启动流程

1. 阅读本文件以及开头列出的四份项目文档。
2. 运行 `git status --short --branch`，确认并保护现有改动。
3. 运行 `git log -1 --oneline` 获取真实最新提交，不仅依赖本文档中的历史基线。
4. 确认用户本次要修改的页面、角色、业务流程和验收结果。
5. 先查找现有类型、组件、领域函数和测试，避免在页面内重复定义同一业务规则。
6. 只在 `app/` 内实现业务改动；根目录文档仅在上下文、审计或发布元数据需要时修改。
7. 进行与风险相称的测试、TypeScript 构建和浏览器验证。
8. 提交为聚焦的本地 Git commit，并报告 diff 摘要、验证与 commit ID。
9. 除非用户明确授权部署，否则始终保持 Mac 服务器不变。
