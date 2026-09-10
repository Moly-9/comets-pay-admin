# COMETS Pay ID 规范

版本：1.0  
适用范围：COMETS Pay 前端、后端、数据库、导入导出、Webhook 与第三方集成

## 1. 设计目标

系统中的业务对象必须使用稳定、不可变、全局唯一的内部 ID。姓名、邮箱、社媒
Handle、合同号、Invoice 号、收款账号和第三方 ID 只能作为业务属性或外部映射，
不得作为跨模块关联的主键。

统一采用“双标识”：

- `<entity>_id`：实体专属的 UUIDv7 字段，例如 `creator_id`，作为数据库主键、
  外键和内部 API 标识，不展示给普通用户。
- `<entity>_code`：带业务前缀的可读编号，例如 `creator_code`，用于页面、搜索、
  导出和人工沟通，不作为外键。

所有规范字段使用 `snake_case`。现有 React 属性迁移时可在 API 边界映射为
`camelCase`，但不得在同一接口中混用两种命名。

## 2. 生成与校验规则

### 2.1 内部 ID

- 格式：标准小写 UUIDv7，例如 `0196f4d7-8d3a-7c21-9b42-7e83c214a111`。
- 生成方：仅由后端服务生成；前端不得生成正式业务对象 ID。
- 创建后永久不变，不允许根据姓名、日期、项目或外部编号重新计算。
- 删除业务对象时保留 ID 和审计记录，不能把旧 ID 分配给新对象。
- 所有外键必须引用内部 UUID，不得引用 `code`、姓名或第三方 ID。

前端可以生成独立的 `client_request_id`（UUIDv4）用于防止重复提交，但它不能替代
任何业务对象的 `<entity>_id`。

### 2.2 可读业务编号

编号格式：

```text
<PREFIX>-<YYYYMMDD>-<RANDOM>
```

- `PREFIX` 使用下表定义的固定前缀。
- `YYYYMMDD` 使用对象创建时的 UTC 日期。
- `RANDOM` 为 6 位大写 Crockford Base32 字符。
- 编号由后端生成并建立唯一索引。
- 编号不携带用户、地区、渠道、金额或其他业务含义。
- 编号允许在页面搜索，但不得用于数据库表之间的关联。

付款域有两类经业务确认的编号例外，不使用上述随机段：

```text
付款单：PAY-YYMMDDXXXX
付款明细：PMT-YYMMDDXXXX
```

- `YYMMDD` 使用 `Asia/Shanghai` 业务日期。
- `XXXX` 是四位当日顺序号，分别在 `PAY` 与 `PMT` 序列内从 `0001` 开始，
  每个业务日重新计数，达到 `9999` 后必须阻止继续创建。
- `PAY` 标识一次渠道付款对应的付款单；重新付款创建新的 `PAY` 编号。
- `PMT` 标识一笔业务付款明细；同一付款明细重新付款时沿用原 `PMT` 编号。
- 当前前端内存原型仅通过扫描当前会话数据模拟顺序号。真实系统必须由后端事务、
  唯一索引或等价的原子序列服务保证并发唯一性，不能依赖前端分配。

## 3. 对象与编号

| 对象 | 主键字段 | 可读编号/业务字段 | 前缀 |
| --- | --- | --- | --- |
| 组织 | `organization_id` | `organization_code` | `ORG` |
| 用户 | `user_id` | `user_code` | `USR` |
| 网红/创作者 | `creator_id` | `creator_code` | `CRT` |
| 社媒账号 | `social_account_id` | 无 | — |
| 外部身份映射 | `external_identity_id` | 无 | — |
| 项目 | `project_id` | `project_code` | `PRJ` |
| 合作关系 | `collaboration_id` | `collaboration_code` | `COL` |
| 合同 | `contract_id` | `contract_code` | `CON` |
| IO | `contract_io_id` | `io_number` | `IO` |
| Invoice | `invoice_id` | `invoice_number` | `INV` |
| 收款账户 | `payout_account_id` | `payout_account_code` | `PAC` |
| 付款申请 | `payment_request_id` | `payment_request_code` | `REQ` |
| 付款单 | `payment_order_id` | `payment_order_code` | `PAY` |
| 付款明细 | `payout_id` | `payment_code` | `PMT` |
| 付款批次 | `payment_batch_id` | `payment_batch_code` | `BAT` |
| 渠道转账 | `transfer_id` | `transfer_code` | `TRF` |
| 审批实例 | `approval_id` | `approval_code` | `APR` |
| 审计事件 | `audit_event_id` | 无 | — |

`invoice_number` 和 `io_number` 可能来自合同或开票主体，保留原始值；系统仍必须为
对应记录生成独立 UUID 主键。

## 4. 网红身份与外部系统映射

### 4.1 内部身份

`creator_id` 是网红在 COMETS Pay 中唯一且永久的身份。以下字段均不得替代它：

- 姓名、艺名和签约主体
- 社媒 Handle、主页 URL 和邮箱
- `contract_id`、`invoice_id`
- 支付渠道 `beneficiary_id`
- 飞书或其他外部系统的用户 ID

合同、Invoice、合作关系、付款申请和付款单必须直接保存 `creator_id`。历史单据还
应保存当时的姓名、签约主体和收款资料快照，但快照只用于展示与审计。

### 4.2 通用外部身份

每个外部系统使用独立映射记录：

```text
external_identity_id
creator_id
external_system
external_tenant_id
external_creator_id
status
verified_at
created_at
updated_at
```

唯一约束：

```text
(external_system, external_tenant_id, external_creator_id)
```

同一个 `creator_id` 可以关联多个外部系统，也可以在同一外部系统的不同租户中拥有
不同的 `external_creator_id`。外部 ID 必须按字符串原样保存，不转换大小写、不
截断、不尝试解析为数字。`external_tenant_id` 必填；外部系统没有租户概念时统一
写入 `default`，避免空值破坏唯一约束。

### 4.3 支付渠道收款人

支付渠道身份属于收款账户，不直接属于网红：

```text
payout_account_id
creator_id
provider
provider_account_scope
external_beneficiary_id
status
```

唯一约束：

```text
(provider, provider_account_scope, external_beneficiary_id)
```

一个网红可以拥有多个收款账户；一个收款账户必须明确属于一个 `creator_id`。
`beneficiary_id` 迁移后统一命名为 `external_beneficiary_id`。

## 5. 核心关联链

所有业务关联使用 UUID 外键：

```text
creator_id
  -> collaboration.creator_id
  -> contract.creator_id
  -> invoice.creator_id
  -> payment_request.creator_id
  -> payment_order.creator_id
  -> payout_account.creator_id
```

付款链路：

```text
payment_request_id
  -> payment_order_id
  -> payment_batch_id
  -> transfer_id
  -> external_transfer_id
```

项目、合同、Invoice 与付款的关键约束：

- `contract.project_id` 必须等于对应合作关系的 `project_id`。
- `invoice.creator_id` 必须等于 `contract.creator_id`；无合同时仍必须指定
  `creator_id`。
- `payment_order.creator_id` 必须等于 `invoice.creator_id`。
- `payment_order.payout_account_id` 对应的账户必须属于同一个 `creator_id`。
- 姓名匹配只能产生人工核验提示，不能建立或修改关联。

## 6. 外部接口契约

### 6.1 向外部发送合同或 Invoice

所有消息必须包含：

```json
{
  "event_id": "UUIDv7",
  "event_type": "invoice.created",
  "schema_version": "1.0",
  "occurred_at": "RFC3339 UTC timestamp",
  "source_system": "comets_pay",
  "creator_id": "UUIDv7",
  "creator_code": "CRT-YYYYMMDD-XXXXXX",
  "external_creator_id": "target system creator id",
  "project_id": "UUIDv7",
  "contract_id": "UUIDv7 or null",
  "invoice_id": "UUIDv7"
}
```

`external_creator_id` 必须根据目标系统和租户从映射表解析，不能由姓名或 Handle
临时匹配。找不到映射时停止发送并进入“待人工绑定”，不得静默创建新网红。

### 6.2 接收付款状态

支付状态必须通过交易定位，不能只通过网红定位：

```text
provider
+ provider_account_scope
+ external_transfer_id
  -> transfer_id
  -> payment_order_id
  -> creator_id
```

Webhook 必须保存 `event_id` 并执行幂等校验。无法找到
`external_transfer_id`、金额或币种不一致、付款单已终态时，事件进入异常队列，
不得自动修改付款状态。

## 7. 现有字段迁移

| 当前字段/方式 | 目标字段 | 处理 |
| --- | --- | --- |
| 网红档案 `id` | `creator_id` + `creator_code` | 为现有网红分配 UUIDv7；原值暂存为 `legacy_id` |
| 项目 `id`（`PRJ-*`） | `project_id` + `project_code` | 原值迁移到 `project_code` |
| 合同 `id`（`CON-*`） | `contract_id` + `contract_code` | 原值迁移到 `contract_code` |
| `ioId` | `contract_io_id` + `io_number` | IO 建立独立记录 |
| Invoice `id`（`INV-*`） | `invoice_id` + `invoice_number` | 原值迁移到 `invoice_number` |
| 付款记录 `id`（`pay-*`） | `payment_order_id` + `payment_order_code` | 停止用前端数组 ID 表示付款单 |
| `paymentOrder` / `paymentListId` | `payment_order_id` | 合并为一个标准字段 |
| `batchId` | `payment_batch_id` | 批次建立独立 UUID 主键 |
| `beneficiaryId` | `external_beneficiary_id` | 同时增加 `payout_account_id` |
| 姓名/Handle 关联 | `creator_id` 外键 | 只保留为展示和人工核验字段 |
| `Date.now()` / `Math.random()` 生成 | 后端 UUIDv7 和编号服务 | 前端停止生成正式 ID |

迁移期间保留 `legacy_id`，只用于追溯和对账；新接口不得继续写入旧字段。

## 8. API 与前端约束

- API 路径使用内部 UUID，例如 `/v1/creators/{creator_id}`。
- 列表响应返回实体专属字段，例如 `creator_id` 和 `creator_code`；选择器提交
  `creator_id`，展示 `creator_code` 和名称。
- 前端路由可以使用 UUID，不得根据数组下标、名称或 Handle 定位记录。
- TypeScript 中所有 ID 定义为不同的品牌类型，禁止把 `CreatorId` 传给需要
  `InvoiceId` 的接口。
- API 对未知、格式错误或已删除的 ID 返回明确错误，不自动回退到名称匹配。
- 日志记录内部 ID、业务编号和请求 ID，不记录完整银行账号或敏感凭据。

## 9. 验收标准

- 同名网红、改名网红和多个社媒账号不会产生错误关联。
- 一个网红的多个收款账户可以独立绑定不同渠道 `beneficiary_id`。
- 合同、Invoice 和付款单都能仅通过 UUID 外键回溯到同一个 `creator_id`。
- 外部系统映射缺失时不会发送合同或 Invoice。
- 支付回调仅通过外部交易 ID 定位付款单，重复回调不会重复更新状态。
- 代码中不再使用 `Date.now()`、`Math.random()`、姓名或 Handle 生成正式业务 ID。
- 所有迁移记录保留旧编号，历史页面和导出仍可按旧编号查询。
