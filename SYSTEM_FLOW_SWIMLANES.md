# COMETS Pay 系统流程泳道图

版本：V1.0  
适用场景：产品经理向研发讲解当前系统、达人 C 端接入目标、审批付款闭环与异常恢复  
目标 C 端：响应式 Web / H5  

## 1. 阅读口径

- 本文先讲“当前管理端原型”，再讲“接入达人 C 端后的目标系统”，两者不能混为一谈。
- 当前应用是纯前端高保真原型：没有真实后端、数据库、服务端鉴权、持久化、支付渠道或 Webhook。
- 目标系统由管理端和达人 C 端共享同一套服务端业务数据，但通过服务端 RBAC、数据范围与独立会话隔离权限。
- 默认请款审批链为“PM → 媒介负责人 → 老板 → 财务”，后台允许按组织配置节点；流程图展示默认链。
- 泳道图中的实线箭头表示业务请求或操作，虚线箭头表示通知、回执或状态同步。

## 2. 当前管理端原型流程（AS-IS）

> 讲解重点：页面和状态较完整，但所有关键能力仍在浏览器内模拟；当前没有独立达人 C 端。

```mermaid
sequenceDiagram
    autonumber
    participant FS as 飞书项目源（模拟）
    participant M as 媒介
    participant A as COMETS Pay 管理端原型
    participant R as PM／媒介负责人／老板
    participant F as 财务
    participant P as 付款渠道（模拟）

    FS-->>A: 同步合作项目演示数据
    M->>A: 创建请款草稿并关联合作项目
    M->>A: 维护达人档案、社媒账号、收款账户
    M->>A: 上传或生成合同
    Note over M,A: 合同签署在线下完成，签署文件再回传管理端

    alt 系统生成 Invoice
        M->>A: 选择项目／达人／合同并生成 Invoice
        M->>A: 发布待签署 Invoice
        A->>A: 模拟达人反馈或电子签署
        M->>A: 媒介审核或退回修改
    else 外部 Invoice 收集
        M->>A: 创建并发布外部 Invoice 收集任务
        A->>A: 模拟达人上传、OCR、字段确认与提交
        M->>A: 字段复核、通过或退回
    end

    M->>A: 关联已通过 Invoice 与合同
    A->>A: 生成并校验付款清单快照
    M->>A: 提交请款
    A-->>R: 依次进入 PM、媒介负责人、老板审批
    R->>A: 审批通过或退回媒介复核
    A-->>F: 进入财务审批／付款工作台
    F->>A: 财务复核并发起批次付款
    A->>P: 模拟提交 Airwallex／PayPal／PayMax
    P-->>A: 模拟付款成功或失败
    A-->>M: 展示交易、失败原因与重试状态

    Note over FS,P: 核心业务状态主要在浏览器内存，少量目录／草稿使用本地存储；没有服务端持久化
```

## 3. 目标端到端业务闭环（TO-BE 总览）

> 讲解重点：达人不再是管理端中的“模拟动作”，而是独立用户；`creator_id` 将两端的项目、合同、Invoice、收款账户和付款记录串成同一条业务链。

```mermaid
sequenceDiagram
    autonumber
    participant C as 达人 C 端（Web／H5）
    participant M as 媒介管理端
    participant S as COMETS Pay 服务端
    participant R as 审批角色
    participant F as 财务管理端
    participant X as 外部系统

    M->>S: 导入名单或单独邀请达人
    S-->>C: 发送限时邀请链接
    C->>S: 验证邮箱、激活账号、完善档案
    C->>S: 提交收款账户
    S->>X: 校验收款人／账户
    X-->>S: 返回验证结果
    S-->>C: 展示账户可用或待处理状态

    X-->>S: 同步飞书合作项目
    M->>S: 建立项目与达人合作关系
    M->>S: 生成或上传合同并发布给达人
    S-->>C: 推送合同任务
    C->>S: 查看、反馈并完成合同确认／签署
    S-->>M: 回传签署结果和审计记录

    alt 系统生成 Invoice
        M->>S: 生成 Invoice 并发布签署
        S-->>C: 推送 Invoice 签署任务
        C->>S: 反馈或签署 Invoice
        S-->>M: 进入媒介审核
    else 达人提供外部 Invoice
        M->>S: 发布外部 Invoice 收集任务
        S-->>C: 推送上传任务
        C->>S: 上传文件、确认识别字段并提交
        S-->>M: 进入媒介字段复核
    end

    M->>S: 组装请款项目并生成付款清单
    S-->>R: 按可配置审批链流转
    R->>S: 通过或按具体资料退回
    S-->>F: 全部审批通过，解锁付款
    F->>S: 最终校验并发起付款
    S->>X: 提交支付渠道
    X-->>S: Webhook 回传处理中／成功／失败
    S-->>C: 同步付款进度与结果
    S-->>M: 同步请款、批次与交易状态
```

## 4. 达人 C 端全生命周期泳道

> 讲解重点：C 端首期采用邀请制 Web/H5；达人只能访问自己的档案、合作与单据，不能看到内部审批意见、其他达人或公司资金账户。

```mermaid
sequenceDiagram
    autonumber
    participant M as 媒介
    participant S as COMETS Pay 服务端
    participant N as 通知服务
    participant C as 达人 C 端（Web／H5）
    participant V as 校验／签署服务

    rect rgb(245, 247, 250)
        Note over M,V: 阶段一：邀请与账号激活
        M->>S: 新建邀请（邮箱＋社媒账号）
        S->>S: 去重并创建 7 天有效邀请
        S->>N: 发送邀请邮件
        N-->>C: 邀请链接
        C->>S: 邮箱验证码校验
        S->>S: 创建 user_id、creator_id 与外部身份映射
        C->>S: 完善主体、联系人、社媒账号
        S-->>M: 达人状态更新为“已激活”
    end

    rect rgb(250, 248, 244)
        Note over M,V: 阶段二：收款账户建立
        C->>S: 新增 Airwallex／PayPal／PayMax 账户
        S->>S: 加密存储并生成账户版本与指纹
        S->>V: 创建／校验渠道收款人
        alt 自动验证通过
            V-->>S: VALIDATED／VERIFIED
            S-->>C: 账户可用于 Invoice 和付款
        else 需要人工复核或校验失败
            V-->>S: REVIEW_REQUIRED／INVALID
            S-->>M: 生成复核任务
            S-->>C: 展示原因与补充入口
            C->>S: 修正资料并重新提交
        end
    end

    rect rgb(245, 249, 246)
        Note over M,V: 阶段三：合同协作
        M->>S: 发布合同任务
        S->>N: 发送待办通知
        N-->>C: 合同待处理
        C->>S: 查看／下载合同
        alt 有异议
            C->>S: 提交反馈
            S-->>M: 通知媒介修改并生成新版本
            M->>S: 重新发布
        else 无异议
            C->>V: 在线确认／签署，或上传线下签署件
            V-->>S: 返回签署证据
            S->>S: 冻结合同版本并写入审计日志
            S-->>M: 合同已签署
        end
    end

    rect rgb(248, 246, 251)
        Note over M,V: 阶段四：Invoice 协作
        alt 系统生成 Invoice
            S-->>C: 待签署 Invoice
            C->>S: 核对金额、币种、主体与收款账户
            alt 信息有误
                C->>S: 提交反馈
                S-->>M: 修改后重新发布
            else 信息正确
                C->>S: 电子签署
                S->>S: 冻结 Invoice 与收款账户快照
            end
        else 外部 Invoice
            S-->>C: 待上传任务
            C->>S: 上传 PDF／JPG／PNG
            S->>V: OCR 识别
            V-->>C: 返回字段与原文证据
            C->>S: 纠正可举证字段、选择已验证账户并提交
            S-->>M: 媒介复核
            alt 需要修正或重传
                M-->>C: 返回具体字段和原因
                C->>S: 修正确认值或上传新文件版本
            else 审核通过
                M->>S: 批准 Invoice
            end
        end
    end

    rect rgb(244, 248, 251)
        Note over M,V: 阶段五：付款查询与失败处理
        S-->>C: 展示待审批／待付款／处理中／已付款
        alt 付款成功
            S-->>C: 展示付款时间、金额、币种和交易编号
        else 收款账户导致失败
            S-->>C: 推送失败原因和修正任务
            C->>S: 更新或更换收款账户
            S->>V: 重新验证
            V-->>S: 返回验证结果
            S-->>M: 等待财务确认并重新付款
        end
    end
```

## 5. 请款审批与付款执行泳道

> 讲解重点：提交请款时冻结单据和付款清单版本；任一节点退回都只开放被退回的资料，修改后重新校验并从退回节点继续。

```mermaid
sequenceDiagram
    autonumber
    participant M as 媒介
    participant S as 业务服务／工作流引擎
    participant PM as PM
    participant L as 媒介负责人
    participant O as 老板
    participant F as 财务
    participant P as 支付渠道
    participant C as 达人 C 端

    M->>S: 选择合作项目、达人、合同和已通过 Invoice
    S->>S: 校验稳定 ID 关联、金额币种、合同覆盖、账户状态
    S->>S: 生成版本化付款清单与不可变账户快照
    M->>S: 提交请款（幂等请求）
    S->>S: 锁定本轮资料并创建审批实例

    S-->>PM: 待 PM 审批
    alt PM 退回
        PM->>S: 指定问题资料与原因
        S-->>M: 退回媒介复核
    else PM 通过
        PM->>S: 审批通过
        S-->>L: 待媒介负责人审批
        alt 媒介负责人退回
            L->>S: 指定问题资料与原因
            S-->>M: 退回媒介复核
        else 媒介负责人通过
            L->>S: 审批通过
            S-->>O: 待老板审批
            alt 老板退回
                O->>S: 指定问题资料与原因
                S-->>M: 退回媒介复核
            else 老板通过
                O->>S: 审批通过
                S-->>F: 待财务审批
                alt 财务退回
                    F->>S: 指定 Invoice／付款清单／合同问题
                    S-->>M: 退回媒介复核
                else 财务通过
                    F->>S: 审批通过
                    S->>S: 请款状态改为“待打款”
                end
            end
        end
    end

    opt 任一审批节点退回后
        M->>S: 只修改被退回资料
        S->>S: 旧签署或付款校验按影响范围失效
        S-->>C: 如涉及达人资料，推送修正／重签任务
        C->>S: 修正并提交
        M->>S: 重新校验并提交新审批轮次
        S-->>S: 从原退回节点恢复流转
    end

    F->>S: 付款前二次校验并确认资金账户
    S->>S: 按请款项目和支付渠道拆分付款批次
    S->>S: 生成 PAY 付款单与 PMT 付款尝试编号
    S->>P: 提交转账并保存 external_transfer_id
    P-->>S: 异步 Webhook 回传结果
    S->>S: 验签、幂等去重、核对金额币种并更新交易
    S-->>F: 更新批次与交易记录
    S-->>M: 更新请款进度
    S-->>C: 更新达人付款进度
```

## 6. 异常退回与付款失败恢复泳道

> 讲解重点：修改已签署或已提交的资料不能“原地覆盖”；必须产生新版本、重新验证，并保留旧版本和每次付款尝试。

```mermaid
sequenceDiagram
    autonumber
    participant P as 支付渠道
    participant S as COMETS Pay 服务端
    participant F as 财务
    participant M as 媒介
    participant C as 达人 C 端

    P-->>S: Webhook：付款失败
    S->>S: 通过 provider＋account_scope＋external_transfer_id 定位付款尝试
    S->>S: 保存失败码、渠道原始结果和当前快照

    alt Invoice 内容错误
        S-->>M: 退回 Invoice 内容问题
        S-->>C: 推送修改／重签任务
        C->>S: 确认新版本并重新签署
        S->>S: 生成新 Invoice 版本和新付款快照
        M->>S: 媒介复核并重新提交
        S-->>F: 从需要的审批节点恢复
    else 付款清单或收款账户错误
        S-->>M: 标记失败明细并生成修复任务
        S-->>C: 通知更新收款资料
        C->>S: 更新原账户或提交新账户版本
        S->>S: 渠道重验＋付款清单重验
        S-->>F: 等待财务确认账户变化
        F->>S: 确认并允许重试
    else 渠道临时失败且资料未变化
        S-->>F: 展示可直接重试及失败原因
        F->>S: 确认重试
    end

    S->>S: 仅为失败明细创建新付款尝试与新 PMT 编号
    S->>P: 重新提交转账
    P-->>S: 回传成功或再次失败
    S->>S: 成功明细保持终态，失败明细保留完整尝试链
    S-->>C: 同步最终结果
    S-->>M: 同步请款的成功／部分失败／完成状态
```

## 7. 研发落地边界

| 能力域 | 当前原型 | 目标系统必须补齐 |
| --- | --- | --- |
| 身份与权限 | 前端账号和角色判断 | 服务端会话、邀请制达人账号、RBAC、数据范围、登录风控 |
| 数据持久化 | React 内存与少量本地草稿 | 业务数据库、对象存储、版本记录、并发控制、备份恢复 |
| 达人身份 | 档案记录，部分模拟邀请 | 永久 `creator_id`、`external_identity`、同名/改名安全关联 |
| 合同与 Invoice | 浏览器生成、解析和模拟签署 | 服务端文件存储、版本、签署证据、OCR、审计和访问授权 |
| 收款账户 | 前端表单和模拟校验 | 敏感字段加密、脱敏、账户版本、渠道 beneficiary 校验、最小可见范围 |
| 审批 | 固定客户端状态机 | 可配置工作流、服务端状态机、退回范围、幂等提交、操作审计 |
| 付款 | 模拟渠道与结果 | 支付渠道 API、签名验签、Webhook 幂等、对账、异常队列与重试 |
| 通知 | 模拟站内信／邮件 | 邮件与站内通知服务、模板、发送记录、失败重试和已读状态 |
| 安全与运维 | 静态 HTTP 原型 | TLS、密钥管理、日志脱敏、监控告警、审计留存和灾备 |

## 8. 核心数据与接口约束

- `creator_id` 是达人唯一身份，必须贯穿合作关系、合同、Invoice、请款、付款单与收款账户；姓名、邮箱、Handle 只能用于展示和人工核验。
- 达人 C 端只提交内部 UUID；外部系统身份通过 `(external_system, external_tenant_id, external_creator_id)` 映射，不允许按姓名临时匹配。
- Invoice 完成签署或外部 Invoice 审核通过时，冻结金额、币种、主体、账户版本和账户指纹；后续修改生成新版本。
- 只有 `VALIDATED` 或 `VERIFIED` 的收款账户可以进入 Invoice 和付款清单。
- 请款提交、审批动作、付款提交和 Webhook 均使用幂等键；重复请求不得重复建单或重复付款。
- 付款回调通过 `provider + provider_account_scope + external_transfer_id` 定位交易，并校验金额、币种与终态。
- 审计日志记录操作者、对象 ID、业务编号、前后状态、时间和原因；不得记录完整银行账号、证件或密钥。

建议的关键领域事件：

| 事件 | 触发方 | 主要消费方 |
| --- | --- | --- |
| `creator.invited` / `creator.activated` | 达人服务 | 通知、媒介工作台、审计 |
| `payout_account.submitted` / `payout_account.validated` | 达人服务／渠道适配器 | C 端、媒介、Invoice 服务 |
| `contract.published` / `contract.signed` | 合同服务 | C 端、媒介、通知、审计 |
| `invoice.collection_published` / `invoice.submitted` / `invoice.approved` | Invoice 服务 | C 端、媒介、请款服务 |
| `payment_request.submitted` / `returned` / `approved` | 工作流服务 | 审批人、媒介、财务、通知 |
| `transfer.submitted` / `succeeded` / `failed` | 支付编排／渠道适配器 | 财务、媒介、C 端、交易记录 |

## 9. 研发评审建议讲解顺序

1. 先用“AS-IS”说明当前页面能力完整，但所有核心状态都在前端模拟，不能直接承载真实付款。
2. 再用“TO-BE 总览”说明真正的闭环是“邀请达人 → 档案与账户 → 合同 → Invoice → 请款审批 → 付款 → 状态回传”。
3. 用“达人 C 端全生命周期”明确达人可做什么、不可看到什么，以及所有修改都需要版本和审计。
4. 用“请款审批与付款执行”锁定默认审批链、退回恢复点、付款前二次校验和渠道回调。
5. 最后用“异常恢复”强调系统不能覆盖历史数据，重签、重验和重付都必须产生新版本或新尝试。

首期范围默认包含：邀请制 C 端、达人档案、收款账户、合同任务、两类 Invoice、付款进度和账户失败修复。首期不包含原生 App、小程序、开放注册、达人主动发起付款、达人查看内部审批意见或公司资金账户。
