# 付款单生成与锁定 Design QA

## Comparison Evidence

- Source visual truth:
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-e0378c50-1889-42c8-9cbe-15a31d6d3d2b.png`
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-ddaa4ff5-512a-4185-a70d-34bae61f8c6c.png`
- Browser-rendered implementation:
  - `design-qa-payment-list-remove-desktop.png`
  - `design-qa-payment-list-generated-desktop.png`
  - `design-qa-payment-list-remove-mobile-390.png`
  - `design-qa-payment-list-generated-mobile-390.png`
- Browser viewports: desktop and `390 x 844` CSS px.
- Route and state: 我的项目详情，付款清单弹窗，管理员账号；覆盖移除确认、草稿、生成后锁定和重新编辑。

## Findings

No actionable P0, P1 or P2 mismatch remains.

- 移除付款行使用系统 `Modal`，水平、垂直居中，桌面宽度约 `440px`，窄屏保留安全边距。
- 警告图标、Invoice 编号、达人和“仅移除付款行，Invoice 源记录保留”说明形成清晰的信息层级。
- 付款清单保持现有字体、边框、按钮、状态色和字段密度；未引入参考图中的浏览器原生视觉。
- 交易附言和描述的输入顺序延续现有表单；描述默认空白且选填，交易附言默认空白且生成前必填。
- 底部操作区固定在弹窗右下角；内容区域独立滚动，桌面和窄屏都没有横向溢出或按钮遮挡。
- 已生成状态以文字、锁图标、禁用控件和版本信息共同表达，不依赖颜色作为唯一状态信号。

## Interaction Verification

- 取消移除后付款行数量不变；按 `Escape` 可关闭确认弹窗。
- 确认移除后仅付款清单减少一行，Invoice 主模块源记录继续保留。
- 未重新校验的修改会阻断生成并聚焦第一条问题字段。
- 完成重新校验后成功生成 `v4`，弹窗不关闭，全部字段、账户选择和增删入口立即锁定。
- 已生成且未提交时可重新进入编辑态；管理员可从已提交付款单创建新草稿版本，历史版本保持不变。
- 桌面端与 `390 x 844` 窄屏均无横向溢出；浏览器控制台无 warning 或 error。

## Intentional Product Differences

- 参考图一为浏览器原生确认框；实现按需求改为系统模态框，以提供一致视觉、键盘关闭和明确的源记录保留说明。
- 参考图二底部只展示关闭入口；实现按状态展示生成、编辑或创建新版本入口，以承载付款单版本与锁定流程。
- 已生成页面只显示脱敏账户摘要；完整付款资料只进入浏览器本地生成的 Excel。

## Known Prototype Boundary

- 当前状态、版本、审计和文件都保存在浏览器内存中；正式业务需要服务端数据库、权限校验、不可变审计、文件存储和 Airwallex 服务端集成。
- 本次未修改付款批次页面或付款批次状态机。

final result: passed
