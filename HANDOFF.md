# COMETS Pay 交接文档

更新时间：2026-08-19（Asia/Shanghai）

这份文档面向完全没有本会话上下文的新会话。项目是 COMETS Pay 的本地前端原型，维护范围为仓库内 `app/` 源码。

## 1. 项目与运行方式

- 技术栈：React 18、TypeScript、Vite、Vitest、Lucide React。
- 本地预览地址：[http://127.0.0.1:5173/](http://127.0.0.1:5173/)。
- 启动方式：进入 `app/` 后运行 `npm install`（如依赖已存在可跳过），再运行 `npm run dev -- --host 127.0.0.1 --port 5173`。
- 生产构建：`cd app && npm run build`。
- 测试：`cd app && npm test -- --run`。
- 当前分支：`codex/merge-colleague-20260812`。
- 当前最新提交：`95159ca feat(contracts): support framework contracts across projects`。
- 当前工作区在本次交接前是干净的。

必须先阅读：`AGENTS.md`、`PROJECT_CONTEXT.md`、`SYSTEM_AUDIT.md`、`app/SOURCE_BASELINE.md`、`ID_STANDARD.md`。

## 2. 系统边界

这是纯前端高保真原型，没有真实后端、数据库、服务端鉴权、持久化、Airwallex/PayPal/PayMax API、飞书回调或真实付款接口。

- 登录、RBAC、审批、合同、Invoice、付款批次、校验和付款状态均由 React 内存状态模拟。
- 刷新页面会丢失运行时修改。
- 页面中出现的 Airwallex Form Schema 是本地同结构字段展示，不代表真实 API 调用。
- 不要把当前实现描述成安全或生产可用的支付系统。
- 未收到明确部署指令前，不连接、不修改、不重启 Mac 远端 `192.168.88.188:8771`。

## 3. 核心业务模型

### 合同、Invoice、请款项目

主要关联链为：

```text
合作项目
  -> creatorId + engagementId（达人合作关系）
    -> 合同 contractId
    -> Invoice invoiceId
      -> 付款清单 paymentListId
```

- 普通合同和 IO 单只能归属一个合作项目和一条达人合作关系。
- Invoice 快照保存 `creatorId`、`engagementId`、`contractIds` 和收款账户快照。
- 请款项目通过 `creatorLinks[]` 同时保存 `creatorId`、`engagementId`、`contractIds`、`invoiceIds`。
- Invoice 关联候选按合作项目、达人、合作关系和是否被其他请款项目占用校验。
- 合同候选要求稳定 ID、达人、合作关系，并要求合同已确认/签署。

### 框架合同

最新需求是“一份框架合同可以对应多个合作项目”，已在 `95159ca` 实现：

- `ContractRecord` 新增 `frameworkProjectLinks`。
- 框架合同候选可以跨合作项目展示；普通合同/IO 仍按单项目过滤。
- 选择框架合同只新增框架合同与当前合作项目的关联，不把框架合同误当成达人执行合同。
- 支持解除当前项目的框架合同关联；已复用的框架合同受到删除保护。
- 旧框架合同的 `projectId/cooperationProjectId` 继续作为兼容的历史关联。
- IO 单仍通过 `frameworkContractId` 指向框架合同。

关键文件：

- `app/src/contracts.ts`
- `app/src/components/RequestProjectResourceManager.tsx`
- `app/src/pages/MediaPaymentProjectsPage.tsx`
- `app/src/App.tsx`

## 4. 请款状态流转

系统用 `lifecycle + approval` 作为状态源，再派生两个模块的展示状态。

| 业务节点 | 我的项目 | 请款项目 |
| --- | --- | --- |
| 未提交 | 草稿 | 不展示 |
| 提交申请 | PM审批中 | 请款提交 |
| PM通过 | 项目负责人审批中 | PM审批通过 |
| 项目负责人通过 | 老板审批中 | 项目负责人审批通过 |
| 老板通过 | 财务审批中 | 老板审批通过 |
| 财务通过 | 待打款 | 财务审批通过 |
| 全部付款成功 | 已付款 | 已付款 |
| 任一节点退回 | 已退回 | 已退回 |

重新提交开始新审批轮次，保留历史记录。部分付款不会提前变成已付款，只有当前请款项目的全部关联付款均成功才完成。

相关代码主要在：`app/src/paymentRequestProjects.ts`、`app/src/requestApprovalWorkflow.ts`、`app/src/businessWorkflow.ts`、`app/src/App.tsx`。

## 5. 付款清单现状

### 生成规则

每个请款项目只有一张付款清单；每个关联 Invoice 对应一条付款明细。

付款行由 `invoicePaymentListItem()` 生成，来源包括：

- Invoice 编号、达人、Real Name、币种；
- Invoice 明细行金额合计；
- Invoice 收款账户冻结快照；
- 收款渠道、账户 ID、版本、指纹、beneficiary ID；
- Airwallex Form Schema 字段；
- 合同/请款项目提供的手续费承担方。

默认交易字段：付款原因为“影音服务”，交易附言为空，描述为空且选填。交易附言、付款原因、币种、收款币种、金额、转账方式、手续费承担方等字段在编辑器中维护。

账户和字段读取遵循：`overrides -> accountOverride -> snapshot`。

### 逐笔编辑器

`app/src/components/PaymentListEditor.tsx` 提供：

- 左侧 Invoice PDF 快照，支持缩放；
- 右侧渠道付款明细；
- Airwallex、PayPal、PayMax 字段分支；
- 付款原因和交易附言整单批量填入；
- 上一笔/下一笔、数字页签、鼠标拖动、触摸和键盘左右键切换；
- 左右卡片独立滚动，窄屏上下布局；
- 收款账户使用 Invoice 冻结快照和 Schema 字段。

### 版本和校验

- `draft`：可编辑；
- `generated`：已生成版本并锁定；再次编辑会创建草稿；
- `submitted/approved/paid`：普通媒介/PM 提交后只能查看；管理员、项目负责人、老板可编辑已提交付款明细。
- 修改付款字段或收款账户会将该付款行标记为 `requiresRevalidation: true`。
- 重新校验只针对当前付款行；通过后继续原审批节点，不退回审核。
- 修改后未校验时，管理员、项目负责人和老板不能关闭编辑弹窗，所有关闭路径都会提示“请完成付款信息校验”。
- 未发生实际修改时，不会强制重新校验。

校验规则集中在 `app/src/businessWorkflow.ts` 的 `validatePaymentListGeneration()` 和 `revalidatePaymentListItem()`，包括账户 Schema 必填字段、账户版本/指纹、beneficiary、渠道、金额、币种、手续费承担方、付款原因和交易附言。

## 6. 权限与查看/编辑

- `admin`、`project`、`owner`：提交后可以查看和编辑付款清单明细；修改后当前行需重新校验。
- `media`、`pm`：提交后只能查看；退回媒介修改或付款失败恢复场景按现有回退规则重新开放有限编辑。
- “查看本笔”是只读入口，不创建编辑草稿、不修改审批、不触发校验。
- “编辑本笔”从列表定位到对应 Invoice 付款行。

主要权限和交互文件：`app/src/components/RequestProjectResourceManager.tsx`、`app/src/components/PaymentListEditor.tsx`、`app/src/App.tsx`。

## 7. 付款工作台与付款批次

- 执行打款前逐笔显示付款信息校验成功状态。
- 执行打款页左侧展示请款项目和达人付款信息概览，右侧展示审批流。
- 左侧看板可独立滚动；窄屏和 iPad 有响应式布局。
- 可退回媒介修改并填写原因；确认记录有误时“确认本页无误”置灰。
- 执行打款成功后进入“已付款”，并生成批次号进入付款批次。
- 付款批次详情使用“付款信息”“付款项目编号”“付款金额”等文案；付款处理中时详情状态也显示“付款处理中”。
- 一个请款项目只有一张付款单，一个请款项目只有一个付款渠道。

相关文件：`app/src/components/PaymentExecutionWorkspace.tsx`、`app/src/components/PaymentListReviewContent.tsx`、`app/src/paymentBatches.ts`、`app/src/components/PaymentBatchDetailPage.tsx`（如存在）。

## 8. 已完成的主要界面调整

本会话还完成了大量基于浏览器截图的 UI 和交互调整，后续不要轻易回退：

- 达人关联卡片改为圆角、简约表单风格；
- 请款事由文案和必填星号位置统一；
- 新建请款项目增加付款渠道、预计付款时间、成本类型、手续费承担方、备注和附件；
- 付款工作台三看板、顶部统计卡片、付款清单和执行打款页面持续做了响应式调整；
- 付款清单按钮顺序固定为：清空清单、导出 Excel、编辑付款清单、生成付款清单；
- 收款账户下拉内容改为简洁摘要；
- 付款明细编辑弹窗扩大并支持响应式双栏/上下布局；
- Invoice 快照使用 PDF 文件快照，支持缩放；
- 描述默认为空且非必填；手续费承担方从关联合同/请款项目带入；
- 付款工作台支持已退回原因、付款失败恢复和达人账户更新提示；
- 项目详情恢复请款进度条和状态规则；
- 项目提交后媒介账号不能编辑，退回或付款失败恢复时例外开放。

## 9. 当前已知问题与风险

1. **纯前端状态不持久化**：刷新页面会丢失所有运行时新增合同、Invoice、付款清单和审批变化。
2. **没有真实权限边界**：账号、角色和数据都在前端，不能用于真实支付或真实敏感数据。
3. **Invoice 候选列表的媒介审核限制需继续确认**：当前候选弹窗主要校验项目、达人、合作关系、渠道和占用关系；提交请款时才严格要求 Invoice 状态为 `已通过`。如果业务要求“只有完成媒介审核的 Invoice 才能在选择框出现”，应把状态过滤前移到 `invoiceAssociationUnavailableReason()`/候选列表。
4. **框架合同关联是原型字段**：`frameworkProjectLinks` 当前保存在合同对象内，正式后端应拆为独立关联表并保留审计、有效期、组织范围和并发约束。
5. **框架合同旧数据兼容**：旧记录的 `projectId/cooperationProjectId` 会被视为历史关联；迁移到真实数据时需要明确哪些项目是 ACTIVE，避免误开放。
6. **付款渠道不是真实接口**：Airwallex、PayPal、PayMax 仅展示本地字段和校验适配器，不能执行真实资金操作。
7. **生产构建存在大 chunk warning**：当前构建成功，但 Vite 提示部分 chunk 大于 500KB，后续可单独做代码分包优化。
8. **测试以源码静态/领域测试为主**：已覆盖关键状态和函数，但仍需要浏览器端桌面、iPad、390px 和控制台回归。

## 10. 最近提交与验证

最近相关提交：

- `95159ca feat(contracts): support framework contracts across projects`
- `a01283e fix(payment-list): require revalidation before privileged editor close`
- `1b39a73 fix(payment-list): preserve approval flow for privileged edits`
- `600ece3 feat(payment-list): add read-only per-item preview`
- `26fd0fb fix(permissions): allow admin submitted payment editing`
- `565e635 feat(payment-list): add read-only submitted detail view`

最近验证结果：

- 合同、Invoice、付款清单关联回归测试：69 项通过；
- 生产构建：成功；
- `git diff --check`：通过；
- 当前工作区：干净。

## 11. 下一步建议

建议按以下顺序继续：

1. 在浏览器中验证框架合同跨项目关联、解除关联、刷新后原型数据行为和普通合同隔离。
2. 明确 Invoice 候选框是否必须只展示“已完成媒介审核”的 Invoice；如是，前移状态过滤并增加测试。
3. 为框架合同新增独立的“已关联项目”展示和项目范围/有效期校验，避免列表只显示一个旧项目字段。
4. 补充 React 交互测试：管理员编辑提交付款单、修改后关闭拦截、重新校验后关闭、框架合同跨项目选择。
5. 如进入真实业务，先建设服务端认证、RBAC、数据库、审计日志、TLS、密钥管理和支付渠道代理，再考虑部署。
6. 任何 Mac 部署都必须先按 `AGENTS.md` 做远端备份、磁盘检查、暂存目录部署、原子替换和健康检查；本会话没有部署远端。

## 12. 新会话接手清单

1. 阅读本文件及 `AGENTS.md`、`PROJECT_CONTEXT.md`、`SYSTEM_AUDIT.md`、`app/SOURCE_BASELINE.md`、`ID_STANDARD.md`。
2. 执行 `git status --short --branch` 和 `git log -1 --oneline`。
3. 从 `app/` 启动本地服务，打开 `http://127.0.0.1:5173/`。
4. 先验证当前用户请求，不要直接修改压缩后的 `dist`。
5. 修改 `App.tsx`、`businessWorkflow.ts`、公共类型或全局 CSS 前，在评论中说明影响范围。
6. 完成一个需求后运行聚焦测试和 `npm run build`，创建一个聚焦的本地 commit。

