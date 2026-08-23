# Design QA - Invoice 审核详情四卡与 4:6 逐行审核布局

## Reference and environment

- Source visual truth:
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-4b5bd31d-1394-4209-bc2a-b70afffdacb2.png` (`1588 x 763`)，内部 Invoice 顶部与审核区参考。
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-ca87719d-a21b-446a-8226-bafa2f3727cb.png` (`1549 x 775`)，外部 Invoice 原页面及待移除步骤状态栏参考。
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-15affcd8-f2a5-4cc7-8bd0-0de34a1b0b24.png`，右侧逐行摘要样式参考。
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-0a073e92-67a3-4efa-8b91-cfaeeabc1687.png` (`692 x 456`)，标记异常弹窗参考。
- Browser-rendered implementation:
  - `/var/tmp/comets-pay-invoice-review-qa/invoice-review-internal-desktop.png` (`1535 x 891`).
  - `/var/tmp/comets-pay-invoice-review-qa/invoice-review-external-desktop.png` (`1535 x 891`).
  - `/var/tmp/comets-pay-invoice-review-qa/invoice-review-anomaly-modal.png` (`1535 x 891`).
  - `/var/tmp/comets-pay-invoice-review-qa/invoice-review-external-mobile.png` (`375 x 812`).
- Combined comparison: `/var/tmp/comets-pay-invoice-review-qa/invoice-review-comparison-board.png` (`1464 x 1422`).
- Implementation URL: `http://127.0.0.1:5175/`.
- Desktop CSS viewport override: `1550 x 900`; responsive CSS viewport override: `390 x 844`; device pixel ratio: `1`.
- State: 管理员账号；内部待签署 Invoice `INV-20240717-00001`；外部待媒介审核 Invoice `INV-20260823-00001`，总金额字段待复核。

## Comparison evidence

- 三组参考与实现已放入同一张对照图，分别检查内部详情、外部详情和异常弹窗。
- 内部 Invoice 保留原标题、操作区和摘要位置；按本次要求将三张摘要卡扩展为四张，`Invoice类型` 位于第一张。
- 外部 Invoice 删除六步状态栏，并使用与内部 Invoice 一致的 `Invoice类型 / 当前状态 / Invoice金额 / 付款方式` 四张卡片。
- 审核工作区默认左 `40%`、右 `60%`；参考图受侧边栏和截图裁切影响，因此以内容区实际比例与同屏信息密度作为归一化判断依据。
- 右侧概览恢复为逐行信息结构；外部异常行仍在同一行保留证据、纠正确认、重新上传和异常标记操作。

## Required fidelity surfaces

- Fonts and typography: passed；继续使用现有 Noto Sans SC，卡片标签、数值、行标签和帮助文案层级稳定，未增加负字距或视口缩放字体。
- Spacing and layout rhythm: passed；四张卡片等宽，审核区为 4:6，逐行信息使用统一分隔线和 4/8px 间距节奏；390px 下改为单列且页面无横向溢出。
- Colors and visual tokens: passed；沿用 COMETS Pay 中性表面、紫灰主色和现有成功/警告/异常语义色，状态同时使用图标和文字表达。
- Image quality and asset fidelity: passed；本次没有新增位图或品牌资产，页面与弹窗图标均使用项目现有 Lucide 图标库。
- Copy and content: passed；四张卡片字段完全一致，外部技术状态只保留在状态卡片和审核记录，不再展示顶部步骤状态栏。

## Interaction, responsive and technical checks

- `查看证据` 可展开四层证据并高亮左侧原文；页面检测到 1 个证据面板和 1 个高亮原文字段。
- 分隔线初始值为 `40%`，键盘 `ArrowRight` 可调整为 `42%`，原拖动和键盘交互保留。
- 标记异常弹窗有可见字段标签、处理说明、字数统计和就地错误；少于 5 个字时 `aria-invalid=true` 且保存不可用，完整说明后保存按钮可用。
- `390 x 844` 下四张卡片全部存在，分隔线隐藏，工作区上下排列；document `scrollWidth === clientWidth === 375px`。
- 浏览器控制台 warning/error 日志为空。
- 聚焦 Vitest：3 个文件、11 项测试通过；全量 Vitest：91 个文件、585 项测试通过；TypeScript/Vite 构建通过，仅保留既有 chunk-size 提示。

## Findings and comparison history

1. 初始参考中的外部详情保留六步状态栏，且右侧使用横向表格单元格，均与本次目标不一致。
   - Fix: 删除外部步骤状态栏；将内外部顶部统一为四张卡片；右侧改为逐行信息结构。
2. 初始异常弹窗只有标题、文本框和按钮，缺少处理语境、持久帮助及就地校验反馈。
   - Fix: 增加字段级说明区、持久帮助、最小有效长度、`aria-invalid` 和具体保存动作文案。
3. 最终桌面、390px、证据定位、键盘分隔线、弹窗校验和控制台复查未发现剩余可执行的 P0、P1 或 P2 问题。

final result: passed

---

# Design QA - 达人请款名单数量层级与列宽

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-9956a70a-2e0a-4ea9-b7c0-895253ec3226.png`.
- Browser-rendered desktop implementation: `app/qa/creator-payment-table/implementation-desktop-final.png`.
- Browser-rendered 390px implementation: `app/qa/creator-payment-table/implementation-mobile-table-390.png` and `app/qa/creator-payment-table/implementation-mobile-table-right-390.png`.
- Combined focused comparison: `app/qa/creator-payment-table/comparison-source-left-implementation-right.png`.
- Implementation URL: `http://127.0.0.1:5176/`.
- Source pixels: `1488 x 399`; desktop CSS viewport: `1490 x 900`; rendered desktop capture: `1475 x 891`; responsive CSS viewport: `390 x 844`; rendered responsive capture: `375 x 812`; density: `1`.
- Focused comparison normalization: source and implementation regions were each resized to `900px` wide, producing `900 x 197` and `900 x 343` regions in one `1816 x 343` comparison image.
- State: media demo account, request project `REQ-202607-000001`, two creators, two Invoices and three contracts.

## Comparison evidence

- The supplied screenshot and final browser-rendered table were combined into one comparison image before review.
- Both surfaces retain the same seven-column hierarchy, compact header band, two creator rows, right-aligned amounts and restrained status marker.
- The implementation intentionally adds the requested document hierarchy: Invoice and contract quantities are the primary line, while stable document numbers remain smaller, clickable secondary lines.
- Focused comparison was required because quantity weight, number size, column spacing and row density are the acceptance target; full-page evidence confirms the table remains aligned with the surrounding project-detail cards.

## Required fidelity surfaces

- Fonts and typography: passed; existing Noto Sans SC remains unchanged, quantity labels use the row's primary weight, and document numbers are reduced to `10px` with readable line height and no negative letter spacing.
- Spacing and layout rhythm: passed; desktop columns use balanced content-aware widths (`17 / 12.5 / 14 / 17.5 / 13 / 13 / 13%`), all seven columns fit without a desktop scrollbar at the reference viewport, and row separators remain aligned.
- Colors and visual tokens: passed; existing neutral text, table background, border and semantic status colors are preserved.
- Image and icon fidelity: passed; this table change requires no new visual asset, and existing creator avatars remain unchanged.
- Copy and content: passed; Invoice and contract quantities, stable document numbers, payment channel, both amount columns and validation state remain complete and accurate.

## Responsive, interaction and technical checks

- At `390 x 844`, the table uses its existing contained horizontal scroll. The left creator/channel/document area and right amount/status area remain readable with no page-level horizontal overflow.
- `INV-301164-01` opens the existing Invoice detail; `CON-20260801-A30101` locates the existing contract record.
- Desktop table wrapper measured equal client and scroll widths (`832px`), confirming no unnecessary horizontal overflow. Creator-name text measured without truncation.
- Browser console warning/error log: empty.
- Focused request-project tests: 17 tests passed; full Vitest suite: 33 files and 227 tests passed; TypeScript production build passed with only the existing Vite chunk-size advisory.

## Findings and comparison history

1. Initial P2: the first implementation retained a desktop table minimum width larger than the scaled content area, so the last columns required horizontal scrolling.
   - Fix: reduced only the desktop minimum width while retaining a larger mobile minimum width for deliberate horizontal scrolling.
2. Initial P2: mechanically equal columns clipped the longer creator name even though the overall table fit.
   - Fix: redistributed a small amount of width to the creator and contract columns while keeping the remaining five columns closely balanced.
3. Post-fix desktop, 390px, click-target and console checks found no remaining actionable P0, P1 or P2 issue.

final result: passed

---

# Design QA - 财务审核 Invoice / 合同凭证级联

## Evidence

- Desktop implementation: `app/design-qa/finance-review-document-switcher-desktop.png` (`1440 x 900`)。
- Contract selector menu: `app/design-qa/finance-review-document-switcher-menu.png` (`1440 x 900`)。
- Mobile implementation: `app/design-qa/finance-review-document-switcher-mobile.png` (`390 x 844`)。
- State: 付款工作台待审核首个项目，已进入校验审核；左栏从 Invoice 切换到合同快照并打开具体合同下拉。

## Required Fidelity Surfaces

- 凭证选择：通过系统 `SelectField` 完成 Invoice / 合同一级选择，以及具体合同二级选择；没有合同时合同选项保持禁用并显示“没有合同”。
- 文档展示：Invoice 继续使用冻结 Invoice 视图，合同使用现有合同结构化快照视图；两者共享左栏滚动、缩放和翻页容器。
- 布局：桌面三看板仍保持原有 `4:4:2` 比例；新增选择器位于 Invoice 看板顶部，不挤压付款清单和项目审批看板。
- 响应式：390px 下选择器纵向堆叠，页面 `scrollWidth === clientWidth`，没有水平溢出或遮挡。
- 无障碍：禁用合同选项输出 `disabled`、`aria-disabled` 和 `title="没有合同"`；选择凭证和具体合同均有明确的 `aria-label`。

## Interaction Checks

- 点击审核后先进入项目概览，再点击“校验审核”进入三看板。
- 第一级切换到合同后显示第二级合同下拉，并能打开对应合同快照。
- 切换审核页后凭证选择重置为当前页 Invoice，付款清单页码和审核状态保持同步。
- 合同切换不会改变中栏付款清单、右栏审批流或审核会话结论。
- 1440px 桌面和 390px 移动端浏览器控制台无新增错误。
- 聚焦 Vitest：16 项通过；完整构建仍受工作树已有 `ContractId` 导出错误影响，与本需求无关。

final result: passed

---

# Design QA - Invoice 达人签署日期

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-7f889bf6-afd0-4583-a8b2-247f4b2c1cf4.png` (`648 x 668`).
- Browser implementation: `app/qa/invoice-signature-date/implementation-detail-scrolled.png` (`1265 x 712`) from a `1280 x 720` CSS viewport at device pixel ratio 1.
- Focused source region: `app/qa/invoice-signature-date/source-signature-region.png` (`230 x 110`).
- Focused implementation region: `app/qa/invoice-signature-date/implementation-signature-region-fixed.png` (`250 x 120`).
- Combined comparison: `app/qa/invoice-signature-date/signature-comparison.png`; both focused regions were normalized to the same displayed width in one comparison view.
- State: local administrator, waiting-signature Invoice `INV-240717`, immediately after clicking `模拟达人完成签署` on 14 Aug 2026.

## Required Fidelity Surfaces

- Fonts and typography: passed. `Date` uses the Invoice's existing serif document typography, bold label treatment, and zero additional letter spacing. The rendered value follows `Date of Invoice` as `14 Aug 2026`.
- Spacing and layout rhythm: passed. The new field sits directly below the existing signature line in the annotated target area. Existing paper width, signature width, and surrounding payment spacing are unchanged.
- Colors and visual tokens: passed. The field keeps the existing black-on-white document palette with no new state color or decoration.
- Image quality and asset fidelity: passed. This change adds structured document text and requires no raster or icon asset. Browser rendering remains sharp at device pixel ratio 1.
- Copy and content: passed. The label is `Date:`; the value is blank before signing and uses the simulated signing day after signing.

## Interaction Evidence

- Confirmed the waiting-signature row exposes `模拟达人完成签署`.
- Confirmed clicking the action moves the Invoice to `待媒介审核` and records the exact signing timestamp in the audit history.
- Confirmed the preview displays `Date: 14 Aug 2026` immediately after the action.
- Confirmed legacy prototype Invoices without a generated snapshot derive the document date from `invoiceSignedAt`.
- Confirmed return, document edit, and signature invalidation clear the prior signature date before re-signing.
- Confirmed browser console warnings/errors after the final flow: none.

## Comparison History

1. Initial browser pass showed the `Date` label but no value for a legacy fixture without a generated Invoice snapshot. This was a P1 functional mismatch because the required click-time date was not visible.
2. The detail model now derives the document date from the canonical `invoiceSignedAt` timestamp when a signed snapshot date is unavailable.
3. The repeated browser flow displayed `Date: 14 Aug 2026`; the combined focused comparison found no remaining actionable P0, P1, or P2 difference.

final result: passed

---

# Design QA - Batch Invoice 生成结果列表

## Evidence

- Current-state reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-026497b8-f277-4bd9-b6ce-1c66049898a3.png`.
- Target list reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-df227a1d-b3cd-4c84-a9f1-2149b0cb8f02.png`.
- Desktop implementation: `artifacts/invoice-batch-results-qa/results-desktop.png` from a `1440 x 1000` viewport.
- Mobile implementation: `artifacts/invoice-batch-results-qa/results-mobile-390.png` from a `390 x 844` viewport.
- State: media demo account, five prototype creators, five successfully generated EUR Invoices.

## Visual And Interaction Checks

- The page has five persistent workflow cards; the fifth card provides a useful empty state before generation and the generated list afterward.
- Generated results use a semantic seven-column table on desktop: creator, payment channel, Invoice, contract, amount, status, and files.
- Creator initials and existing accent colors produce five distinct avatars. Airwallex and PayPal use restrained, differentiated channel badges.
- PDF, DOCX, and batch ZIP actions remain available with Lucide icons and descriptive accessible labels.
- At `1440px`, the result wrapper has equal client and scroll widths (`778px`), so all seven columns remain visible without horizontal scrolling.
- At `390px`, the table reflows into creator result cards. Document client and scroll widths are both `375px`, each card is `311px`, and file actions use `44px` touch targets.
- Success uses both an icon and text, not color alone. Browser console warnings/errors: none.

## Verification

- Focused Vitest: 2 tests passed.
- TypeScript/Vite production build passed after the result-list change; later concurrent worktree edits introduced unrelated missing `contracts` / `creators` props in `PaymentWorkbenchPage.tsx`.
- Full Vitest: 438 of 439 tests passed. The unrelated `PaymentExecutionWorkspace` test currently expects two board cards while concurrent worktree changes render three.

final result: passed for the Batch Invoice result-list scope

---

# Design QA - Batch Invoice 演示数据与宽松合同校验

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-f4ad6898-2ed0-4180-b4f9-61f4e9f287e7.png` (`1492 x 379`).
- Desktop full implementation: `qa/invoice-batch-demo-data/implementation-desktop-full.png` (`1425 x 2293`) from a `1440 x 900` viewport override at device pixel ratio 1.
- Desktop focused implementation: `qa/invoice-batch-demo-data/implementation-desktop-validation-focused.png` (`1425 x 891`) from the same viewport and the validation-card state.
- Mobile implementation: `qa/invoice-batch-demo-data/implementation-mobile-top.png` and `implementation-mobile-validation-focused.png` (`375 x 812`) from a `390 x 844` viewport override at device pixel ratio 1.
- State: media demo account, demo seed loaded for `PRJ-260801-07`, five selected creators, EUR currency, mixed Bank/PayPal accounts, and five same-project creator contracts.
- Full-view comparison evidence: the supplied source and desktop focused implementation were opened together. The source is a focused validation-card capture, so the desktop focused implementation is the direct comparison target.
- Focused evidence: the implementation shows the same card, metric, table, status, and preview surfaces with the requested post-fix ready state. Separate mobile top and validation captures verify the new page action and responsive layout.

## Required Fidelity Surfaces

- Fonts and typography: passed. Existing Noto Sans SC hierarchy, compact table labels, tabular money display, zero added letter spacing, and readable mobile wrapping are preserved.
- Spacing and layout rhythm: passed. The new header action uses the existing button component. Four metric cards remain equal width on desktop and reflow to two columns on mobile; five row cards fit within the 343px mobile content width.
- Colors and visual tokens: passed. Ready rows use the existing green success treatment, while neutral, green, amber, and coral metric surfaces match the source visual language.
- Image and icon fidelity: passed. No new raster asset is required; the new action uses the existing Lucide icon family and all source UI surfaces remain code-native controls.
- Copy and content: passed. The demo seed shows five realistic creator rows, EUR `10,420.00`, varied Price/Amount values, mixed payment methods, stable contract codes, and no stale contract-mismatch error.

## Interaction And Responsive Checks

- `填充演示数据` selects the project with the largest eligible cohort and produces five ready rows without auto-dirtying the page on entry.
- All five Payment Information controls remain enabled even when their account or payment method differs from the contract snapshot.
- Invoice preview opens with EUR and the seeded amount, and all five contracts resolve to the same project, creator, and engagement as their row.
- The summary reports `已选择达人 5`, `可生成invoice 5`, `需处理条数 0`, and `批次总金额 EUR 10,420.00`.
- At `390 x 844`, document client width equals scroll width (`375px`), both heading actions fit, and there is no horizontal page overflow.
- Browser console warnings/errors after desktop and mobile flows: none.
- Full Vitest suite: 70 files and 438 tests passed.
- TypeScript/Vite production build: passed; only the existing Vite chunk-size advisory remains.

## Comparison History

1. Source state: the row was blocked because Invoice amount, currency, account, and payment method differed from the selected contract snapshot.
2. Fix: batch validation now checks only stable project, creator, engagement, document completeness, eligible creator account, and duplicate Invoice rules; contract snapshot value equality no longer participates.
3. Post-fix evidence: five deliberately varied rows all render `可生成`, no issue text appears, payment accounts remain editable, preview works, and desktop/mobile checks found no actionable P0, P1, or P2 issue.

final result: passed

---

# Design QA - 批量生成 Invoice 多币种选择

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-9e5a1a1e-7402-4cac-b0bb-b329e3499c5e.png`.
- Desktop implementation: `artifacts/invoice-batch-currency-qa/implementation-desktop-1419x497-final.png`.
- Responsive implementation: `artifacts/invoice-batch-currency-qa/implementation-mobile-390x844-final.png` and `artifacts/invoice-batch-currency-qa/implementation-mobile-390x844-menu.png`.
- Source pixels: `1419 x 497`; desktop CSS viewport: `1419 x 497`; browser-rendered capture: `1404 x 492`; responsive CSS viewport: `390 x 844`; browser-rendered capture: `375 x 812`; device pixel ratio: `1`.
- Density normalization: the in-app browser removes its outer frame from captured page pixels. Source and desktop implementation were compared together at their original density; the focused main-content region was used for layout judgment because the source omits the application sidebar and header.
- State: media demo account, batch Invoice builder, common currency changed from USD to EUR, one project creator selected; a fresh tab separately selected SGD for clean-console verification.

## Comparison evidence

- The supplied source and the browser-rendered desktop implementation were opened together in the same comparison input.
- The source is a cropped common-information region. The implementation preserves the same two-column date/currency grid, notice banner, section hierarchy and Description controls while intentionally replacing the gray fixed-USD surface with an interactive select trigger.
- Focused inspection was required for the currency menu and responsive state because the closed source does not show options or mobile behavior.

## Required fidelity surfaces

- Fonts and typography: passed; existing Noto Sans SC labels, weights, line heights and zero letter spacing are unchanged. Currency codes remain the primary select text and Chinese currency names are secondary option descriptions.
- Spacing and layout rhythm: passed; the select occupies the former fixed-currency slot without changing the public-information grid. At `390 x 844`, date and currency stack to full width, and the menu fits inside the viewport without covering the following heading incoherently.
- Colors and visual tokens: passed; the trigger, focus ring, selected option and helper text reuse the existing custom-select and neutral form tokens.
- Image and icon fidelity: passed; no new raster asset is required, and the existing Lucide chevron and check icons remain unchanged.
- Copy and content: passed; the page offers `USD / EUR / GBP / HKD / SGD`, explains that one currency applies to the whole batch, and labels generated-row currency as the current batch currency.

## Interaction and technical checks

- Opening the currency control exposes all five options with Chinese descriptions. Selecting EUR updates the common field, new batch row, row totals, currency column, preview model and generated snapshot currency.
- The XLSX export already reads each row's currency, so the selected batch currency remains reflected in the protected template.
- Once any row has generated files, the common currency control is disabled to prevent a mixed-currency batch.
- The 390px menu remains fully visible and selectable. A fresh browser tab selected SGD and reported no console warning or error.
- Focused Invoice batch tests: 8 tests passed. Full Vitest suite: 69 files and 432 tests passed. TypeScript production build passed; only the existing Vite chunk-size advisory remains.

## Findings and comparison history

1. Initial P2: helper copy beneath the new select inherited the form error color, making the valid field look invalid.
   - Fix: added a neutral currency-note style using the existing secondary text color and rechecked desktop and 390px states.
2. Post-fix source comparison, five-option selection, row synchronization, responsive menu and clean-console checks found no remaining actionable P0, P1 or P2 issue.

final result: passed

---

# Design QA - 新建达人本地清算方式下拉浮层

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-ca99edf8-e2b5-4587-b6f9-dc1f4a76df37.png`.
- Browser-rendered implementation: `app/design-qa-local-clearing-select.png`.
- Combined comparison evidence: `app/design-qa-local-clearing-comparison.png`.
- Implementation URL: `http://127.0.0.1:5173/`.
- Source pixels: `1046 x 770`, normalized to `967 x 712`; implementation capture: `1265 x 712`; CSS viewport: `1280 x 720`; density: `1`.
- State: administrator account, new creator profile, Airwallex draft account, `US / USD / PERSONAL / LOCAL`, local clearing select expanded with `ACH` selected.

## Comparison evidence

- The supplied screenshot and browser-rendered implementation were combined into one comparison image before review.
- The source shows the options clipped by the rounded `付款场景` section boundary. The implementation keeps the same field, typography, colors and selected state while allowing the menu to overlay the following section in full.
- Focused comparison was required because the clipping boundary and second `FEDWIRE` option are the acceptance target; the rest of the creator form is intentionally unchanged.

## Required fidelity surfaces

- Fonts and typography: passed; the existing Noto Sans SC family, weights, line heights and labels are unchanged.
- Spacing and layout rhythm: passed; trigger size, field spacing, menu radius and shadow remain on the existing custom-select tokens.
- Colors and visual tokens: passed; the existing neutral surface and peach selected state are unchanged.
- Image and icon fidelity: passed; this control requires no raster asset and continues to use the existing Lucide chevron and check icons.
- Copy and content: passed; `ACH · 低费优先`, its explanation and `FEDWIRE` are fully visible without wording changes.

## Interaction and technical checks

- Opening the select renders the menu as a viewport-positioned portal, so the section's required `overflow: hidden` no longer clips it.
- Both options are visible and selectable. Selecting `FEDWIRE` closes the listbox and updates the account summary and Schema condition to `LOCAL / FEDWIRE`.
- The existing shared custom-select scroll listener continues to recalculate the fixed menu position, and its width remains clamped to the viewport.
- Browser interactions surfaced no application warning or error.
- Airwallex and payout regression tests: 3 files and 20 tests passed.
- Full Vitest suite: 33 files and 212 tests passed.
- TypeScript production build: passed; only the existing Vite chunk-size advisory remains.

## Findings and comparison history

1. Initial P1: the local-clearing menu was absolutely positioned inside `.creator-payment-section`, whose rounded card boundary uses `overflow: hidden`; options below the card edge were unusable.
   - Fix: only this field now uses the existing fixed, portaled select strategy with automatic placement and scroll repositioning.
2. Post-fix visual comparison and option-selection verification found no remaining actionable P0, P1 or P2 issue in the requested field.

final result: passed

---

# Design QA - 付款清单编辑、刷新与 Excel 导出

## Environment and State

- Local implementation URL: `http://127.0.0.1:5173/`.
- State: administrator account, `REQ-202607-000001`, payment list `PAY-301164-01` with two synthetic Airwallex payment rows.
- Desktop viewport: default application viewport; responsive override: `390 x 844`.
- Exported workbook: `/Users/aria/Downloads/DRAFT-COMETS-PAY-REQ-202607-000001-PAY-301164-01.xlsx`.

## Interaction Checks

- The list toolbar order is `生成 / 刷新清单`, `导出 Excel`, `编辑付款清单`, `删除清单`; duplicate row-level edit, export, and list-delete actions are absent.
- Clicking `编辑付款清单` unlocks the payment fields. Editing the optional description marks the row for revalidation without changing the Invoice snapshot.
- After revalidation, `生成 / 刷新清单` creates and locks version `v2`; the manually edited description remains in the generated snapshot.
- `导出 Excel` writes the current locked version. The workbook contains the `Airwallex batch transfer` sheet, 21 columns from `A:U`, and two payment rows matching the UI.
- Formula-error scan returned no matches.

## Responsive and Runtime Checks

- At `390 x 844`, the four toolbar actions stack vertically and remain fully visible with no text or control overlap.
- Desktop controls remain right aligned beside the summary panel and use the existing modal spacing and button system.
- Browser console error log is empty.
- Full Vitest suite: 33 files and 216 tests passed.
- TypeScript production build: passed; only the existing Vite chunk-size advisory remains.

final result: passed

---

# Design QA - 移除合同选择提示文字

## Reference and Environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-1c3152cc-1c9f-44ff-b667-220948a2186f.png`.
- Browser-rendered implementation: `app/design-qa-contract-selection-copy-removed.jpg`.
- Source pixels: `1442 x 527`; implementation viewport and screenshot: `1414 x 800`, device density 1.
- State: administrator contract list, with both unselected and one-contract-selected behavior checked.

## Comparison Evidence

- The source and browser-rendered implementation were opened together in the same visual comparison input at original width.
- The source is already a focused contract-list capture; the implementation clearly shows the corresponding search, batch-action, filter, and table region, so a second detail crop was unnecessary.
- The boxed `请选择合同` location is empty in the implementation, and no replacement selection-count text is rendered.

## Required Fidelity Surfaces

- Fonts and typography: passed; no remaining selection helper text or orphaned text spacing is visible.
- Spacing and layout rhythm: passed; filters align with the search and batch actions without adding a blank second row.
- Colors and tokens: passed; existing search, disabled action, active filter, and table treatments are unchanged.
- Image and icon fidelity: passed; no new asset is required and existing Lucide action icons are unchanged.
- Copy and behavior: passed; `请选择合同` and dynamic `已选择 N 项` copy are both removed while checkbox selection remains available.

## Interaction and Technical Checks

- No `.contract-selection-count` element exists before or after selecting a contract.
- Export and delete remain disabled with no selection and enabled after selecting one contract.
- Browser console warning/error log is empty.
- Focused component test: 2 tests passed; TypeScript production build passed.

## Findings

- No actionable P0, P1, or P2 issue remains.

final result: passed

---

# Design QA — 请款项目关联 Invoice 与达人筛选

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-142b988f-0722-4b16-b148-57a8d3b5faf9.png`.
- Implementation URL: `http://127.0.0.1:5183/`.
- Main Invoice dialog: `app/design-qa-invoice-resource-desktop.png`.
- Invoice-association dialog: `app/design-qa-invoice-association-desktop.png`.
- Responsive association dialog: `app/design-qa-invoice-association-390.png`.
- Source pixels: `1100 x 790`; desktop implementation pixels and CSS viewport: `1265 x 712`; responsive CSS viewport: `390 x 844`, rendered capture: `375 x 812`; density: `1`.
- States: `REQ-202607-000001` with two unlinked synthetic Invoice candidates, and `REQ-202607-000004` before and after linking an Invoice whose creator was not yet in the request project.

## Comparison evidence

- The source and the browser-rendered main Invoice dialog were opened together in one comparison input. The implementation retains the same modal hierarchy, header panel, toolbar placement, compact flat rows, neutral palette, typography and fixed footer.
- The source-highlighted `关联已有 Invoice` action remains in the same toolbar position. Invoice rows preserve `查看 / 解除 / 删除`; `编辑` is removed as requested.
- The association dialog is a new state not pictured in the source. It reuses the same modal, custom select, candidate row, status tag and footer patterns rather than introducing a separate visual language.
- Focused inspection was required for the association dialog because the filter, existing/new creator labels and disabled candidate reasons are not readable in the full main-dialog comparison.

## Required fidelity surfaces

- Fonts and typography: passed; existing Noto Sans SC sizes, weights, line heights and wrapping remain unchanged.
- Spacing and layout rhythm: passed; candidate rows, filter panel, 8px radii and footer spacing match the existing resource-dialog system.
- Colors and visual tokens: passed; neutral borders/backgrounds and restrained green/purple creator-membership labels remain secondary to text labels.
- Image and icon fidelity: passed; no raster asset is required, and the existing Lucide Invoice, link, view, unlink and delete icons are reused.
- Copy and content: passed; candidate scope, automatic creator addition, Invoice amount, covered-contract count and ownership state are explicit.

## Interaction and responsive checks

- `REQ-202607-000001` exposes `INV-301164-19` and `INV-301164-20` as unlinked candidates from the same cooperation project. Filtering to Yuki Tanaka reduces the list from two records to one.
- Linking `INV-301164-20` increases the project from 18 to 19 Invoices while keeping 18 creators; Yuki Tanaka correctly shows two Invoices.
- `REQ-202607-000004` exposes `INV-260727-04-24` as `关联后新增达人`. Linking it increases the request project from 23 to 24 creators and creates the new creator link with one Invoice.
- Candidate association uses stable `creatorId / engagementId / invoiceId`; records owned by another active request or using a conflicting engagement are disabled with a reason.
- At the `390 x 844` override, the document, dialog, filter and candidate list have equal client and scroll widths; no horizontal overflow occurs and the footer remains usable.
- Browser console warning/error log: empty.
- `npm test`: 31 test files and 200 tests passed.
- `npm run build`: passed.

## Findings and comparison history

1. Initial P1: Invoice candidates were restricted to creators already in the request project, so a cooperation-project Invoice could not add its creator.
   - Fix: candidates now come from the full cooperation-project Invoice pool and merge by stable IDs, creating a new creator link with `contractIds: []` when needed.
2. Initial P2: the Invoice association dialog had no creator filter, making a larger candidate pool difficult to scan.
   - Fix: added a keyboard-accessible creator filter with per-creator candidate counts and clear existing/new creator labels.
3. Initial P2: the main Invoice list exposed an edit action that the user explicitly removed from this workflow.
   - Fix: removed only the project-resource edit entry while preserving source viewing, unlinking, deletion protection and global Invoice management.
4. Post-fix desktop, responsive, filtering, automatic-creator-add, multi-Invoice, console, test and build checks found no actionable P0, P1 or P2 issue.

final result: passed

# Design QA - 合同批量操作移至搜索栏旁

## Reference and Environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-2669d63e-666f-44bf-9cea-1ab02ed12199.png`.
- Browser-rendered desktop implementation: `app/design-qa-contract-toolbar-desktop-final.png`.
- Browser-rendered responsive implementation: `app/design-qa-contract-toolbar-560-final.png`.
- Source pixels: `1414 x 541`; desktop viewport and implementation screenshot: `1414 x 900`, device density 1.
- State: administrator account, contract list, one contract selected so export and delete are enabled.

## Comparison Evidence

- The source and browser-rendered implementation were opened together in the same visual comparison input at original width.
- The source target is already a focused crop of the contract-list toolbar, so a second focused crop was not needed.
- The implementation keeps the search box first, places the compact export and delete actions immediately after it, and leaves the four filters at the far right with the selection count underneath.

## Required Fidelity Surfaces

- Typography and control density: passed; existing COMETS Pay button, filter, and search styles are unchanged.
- Spacing and hierarchy: passed; the desktop gap between the search box and batch actions is 14px, and the filter group remains visually separate on the right.
- Color and icon fidelity: passed; existing secondary/danger treatments and Lucide download/trash icons are retained.
- Copy and behavior: passed; no labels, selection logic, export behavior, administrator permission, or delete confirmation behavior changed.
- Responsive behavior: passed; at 560px the search box occupies its own row, actions and filters wrap below it, and document horizontal overflow is 0.

## Interaction and Technical Checks

- Selecting one contract changes the selection message to `已选择 1 项` and enables both batch actions.
- Desktop element order is search, batch actions, filters; browser console warnings/errors: none.
- Full Vitest suite: 33 files and 212 tests passed.
- TypeScript production build: passed; only the existing Vite chunk-size warning remains.

## Comparison History

1. Initial P2: at approximately 900px, the inherited `space-between` rule left an excessive gap between search and batch actions.
   - Fix: the contract toolbar now uses start alignment while the filter group retains right alignment.
2. Initial P2: at 560px, all controls could compress the search input into an unreadably narrow field.
   - Fix: below 860px the search box takes a full row and the remaining controls wrap beneath it.
3. Post-fix desktop and responsive verification found no remaining actionable P0, P1, or P2 issue.

final result: passed

---

# Design QA - 合同列表批量操作分层

## Reference and Environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-9264c93c-b6ea-4b82-a6d0-ccbcd50b7364.png`.
- Browser-rendered desktop implementation: `app/design-qa-contract-toolbar-desktop.png`.
- Browser-rendered narrow implementation: `app/design-qa-contract-toolbar-900.png`.
- Source pixels: `1406 x 547`; desktop CSS viewport: `1406 x 720`, rendered capture: `1391 x 712`; narrow CSS viewport: `900 x 720`, rendered capture: `885 x 708`; density: `1`.
- States: administrator with no selection and one selected contract.

## Comparison Evidence

- The supplied source and the browser-rendered desktop implementation were opened together in one comparison input.
- The source identifies the existing compact filter and batch-action area. The requested change is visible in the implementation: `全部 / 可付款 / 待处理 / 模板` remains on the first row, while selection count, export and administrator delete form a second right-aligned row.
- Focused DOM measurements confirmed the batch row begins below the filter row at both `1406px` and `900px`, with no page-level horizontal overflow.

## Required Fidelity Surfaces

- Fonts and typography: passed; filter chips remain `11px`, while selection text and batch actions use `10px` to create the requested one-level hierarchy without changing the system font.
- Spacing and layout rhythm: passed; the second row uses a compact `6px` vertical and horizontal gap, removes the obsolete vertical divider and stays aligned to the filter group's right edge.
- Colors and visual tokens: passed; existing neutral, disabled, active-filter and danger-button colors remain unchanged.
- Image and icon fidelity: passed; no raster asset is required, and the existing Lucide download and delete icons remain unchanged.
- Copy and content: passed; filter labels, selection count, export and administrator-only delete copy are unchanged.

## Interaction and Responsive Checks

- Selecting one contract updates the count to `已选择 1 项` and enables both export and administrator delete without changing their second-row placement.
- At `900 x 720`, the two rows remain separated and right aligned, and the document has no horizontal overflow.
- Browser console warning and error log: empty.
- Full Vitest suite: 33 files and 212 tests passed.
- Production build: passed; Vite reported only the existing chunk-size advisory.

## Comparison History

1. Initial P2: filter and batch actions shared one horizontal row, so the less frequent export/delete actions competed with the primary list filters.
   - Fix: stacked batch actions under the filter group and reduced their text and control dimensions by one visual level.
2. Post-fix desktop, narrow, selected-state, console, test and build checks found no remaining actionable P0, P1 or P2 issue in the requested toolbar area.

final result: passed

---

# Design QA - 新建项目紧凑单据选择器与演示数据

## Reference and Environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-92de26a3-f99d-4f4c-b36a-12059e1bc8fd.png`.
- Browser-rendered implementation: `app/design-qa-media-request-picker.png`.
- Implementation URL: `http://127.0.0.1:5173/`.
- Source pixels: `631 x 265`; focused implementation pixels: `372 x 259`; CSS viewport: `1280 x 720`; device density: `1`.
- State: Sara Nielsen 的 Invoice 选择器展开，显示一份已占用 Invoice、两份未占用合成 Invoice，并已选择 `INV-260727-04-25`。

## Comparison Evidence

- 参考图和浏览器渲染后的实现图已在同一个对比输入中打开。两者都使用紧凑的触发框、单列候选区、左侧单据图标、两行文字层级和右侧选择标记。
- 实现保留新建项目原表单的双列结构，因此单个选择器宽度小于参考图的独立全宽示例；候选行高度、边框、圆角和文字密度保持一致。
- Focused crop 足以清楚检查字段标题、触发框、金额、状态、禁用态和选中态，不需要额外全页细节图。

## Required Fidelity Surfaces

- Fonts and typography: passed; 现有 Noto Sans SC 字体、11-12px 字段层级、金额与状态次级文字均清晰且无溢出。
- Spacing and layout rhythm: passed; 触发框约 50px、候选行约 46px，字段间距和达人行分隔比旧卡片方案更紧凑。
- Colors and visual tokens: passed; 沿用系统中性灰边框、低饱和粉色选中态，并以文字说明禁用原因，不仅依赖颜色。
- Image and icon fidelity: passed; 该表单不需要位图资源，复用现有 Lucide Invoice、合同、选择和展开图标。
- Copy and content: passed; Invoice 金额、占用项目、待发起请款、当前选择及 Invoice 自动带入合同均有明确文案。

## Interaction and Runtime Checks

- `PRJ-260727-04` 下 Sara Nielsen 和 Sofia Martinez 均排在可创建达人前列，各有两份未占用 Invoice 和两份已确认合同。
- 选择 `INV-260727-04-25` 后自动关联 `CON-20260807-GI-SN01`；选择 `INV-260727-04-27` 后自动关联 `CON-20260807-GI-SM01`。
- 点击创建项目成功生成本地草稿 `REQ-20260807-WJR1MX`，包含 2 位达人、2 份 Invoice、2 份合同，总金额为 `USD 5,090`。
- 合同、Invoice、付款快照均通过 `cooperationProjectId / creatorId / engagementId` 对齐；未使用姓名、Handle 或文件名建立关联。
- 修复后新标签页控制台 warning/error 为空。
- Full Vitest suite: 33 files and 212 tests passed.
- Production build: passed.

## Comparison History

1. Initial P1: 达人可选但 Sara、Sofia 没有未占用的关联单据，无法完成原型创建流程。
   - Fix: 为两位达人各增加两份脱敏合成 Invoice、两份已确认合同和匹配的付款快照。
2. Initial P1: 达人单据区使用独立选择控件和已选卡片，重复内容占用过多纵向空间。
   - Fix: 改为参考图的内嵌展开多选器，候选项直接展示金额、状态、占用原因和选中态。
3. Initial P1: 选择 Invoice 后合同关系缺少直接、可验证的同步反馈。
   - Fix: Invoice 选择继续按稳定 ID 自动勾选其覆盖的已确认合同，并在合同触发框显示已选数量。
4. Post-fix visual comparison, multi-select, automatic contract linking, creation, console, test and build checks found no actionable P0, P1 or P2 issue.

final result: passed

---

# Design QA - 合同列表批量导出与管理员删除

## Reference and Environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-81346401-abaa-48fb-b308-06770a6a238b.png`.
- Browser-rendered administrator list: `/tmp/comets-contract-batch-admin.png`.
- Browser-rendered selected state: `/tmp/comets-contract-batch-selected.png`.
- Browser-rendered responsive state: `/tmp/comets-contract-batch-mobile.png`.
- Source pixels: `1413 x 679`; desktop implementation pixels: `1398 x 672`; CSS viewport override: `1413 x 679`; density: `1`.
- Responsive CSS viewport: `390 x 760`; rendered capture: `375 x 731`; density: `1`.
- States: administrator with no selection and two selected contracts; finance viewer with one selected contract; responsive finance viewer at 390px.

## Comparison Evidence

- The supplied source and the browser-rendered administrator list were opened together in one comparison input. The implementation preserves the source search placement, compact filter chips, table typography, row density, neutral borders and payment-readiness labels.
- The new checkbox column stays visually subordinate to contract content. Export and administrator-only delete actions sit at the upper right of the list, beside the existing filters, without changing the page-level create and upload actions.
- Focused comparison used the selected desktop and responsive captures together. Selected rows use the existing low-saturation peach accent, the count is explicit, and the mobile table scrolls inside its own container instead of compressing text into overlapping columns.

## Required Fidelity Surfaces

- Fonts and typography: passed; existing Noto Sans SC sizing, weights, line heights, ellipsis and secondary metadata remain unchanged.
- Spacing and layout rhythm: passed; toolbar controls, 8px buttons, 15px checkboxes, table rows and confirmation modal align with the existing COMETS Pay component rhythm.
- Colors and visual tokens: passed; neutral gray controls, restrained peach selection and existing danger-button styling preserve the current palette and do not use color as the only status signal.
- Image and icon fidelity: passed; this list uses no raster assets, and existing Lucide `Download`, `Trash2` and `AlertTriangle` icons are reused.
- Copy and content: passed; selection count, export progress, partial-export warning, delete scope, session-only persistence and revalidation impact are explicit.

## Interaction and Responsive Checks

- Administrator selection enabled both actions, showed a two-contract confirmation modal, deleted two records, reduced the count from 18 to 16 and cleared stale selection.
- The delete operation removed stable contract IDs from related Invoice and request-project snapshots and marked affected Invoice and payment-list data for revalidation.
- Finance viewer exposed one enabled export action after selection and no delete action. Unit tests also verify that media, PM, finance and project roles lack `contract_delete`.
- Batch export created a ZIP containing `contracts.csv`, available source documents and `unavailable-files.csv` when a selected record had no readable document URL.
- At `1413 x 679`, table client and scroll widths were both `773px`; at `860 x 760`, both were `787px`. At `390 x 760`, document client and scroll widths remained equal while the dense table used an independent horizontal scroller.
- Browser console warning/error log: empty.
- Full Vitest suite: 33 files and 210 tests passed.
- Production build: passed after the final responsive and export edge-case fixes.

## Comparison History

1. Initial P2: the list retained a wide-table minimum at a 1413px viewport with the application sidebar, forcing horizontal scrolling for routine desktop use.
   - Fix: moved the compact seven-column layout breakpoint to 1500px and hid only the update-date column; the complete primary workflow now fits without horizontal overflow.
2. Initial P1: at 390px the fixed table tracks compressed contract, publisher, amount and readiness content into overlapping text.
   - Fix: restored a readable mobile table minimum inside the existing scroll container; page-level overflow remains zero and checkboxes stay usable.
3. Initial P2: selected demo records without a source URL were omitted from the ZIP without explanation.
   - Fix: the archive now records these files in `unavailable-files.csv` and the completion toast reports partial availability.
4. Post-fix desktop, administrator, finance, deletion, export, 860px, 390px and console checks found no remaining actionable P0, P1 or P2 issue.

final result: passed

---

# Design QA — 新建项目达人单据下拉表单

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-22a3e8a9-ff3f-4d54-8986-f2de8c9afba1.png`.
- Implementation URL: `http://127.0.0.1:5173/`.
- Browser-rendered form top: `app/design-qa-payment-request-form-top.png`.
- Browser-rendered document association area: `app/design-qa-payment-request-documents.png`.
- Source pixels: `844 x 841`; implementation capture and CSS viewport: `1265 x 712` / `1280 x 720`; device density: `1`.
- State: `#301164` cooperation project with Mina Kato and Yuki Tanaka, each linked to one synthetic Invoice and its stable contract snapshot references.

## Comparison evidence

- The annotated source and the revised browser capture were opened together in one comparison input.
- The source card/radio presentation is replaced by two aligned form fields per creator. Invoice and contract selection now use the existing custom select component, followed by compact removable value rows.
- The surrounding modal header, creator identity, fixed footer, neutral form borders, typography and restrained pink accent remain consistent with the existing project form.
- Focused inspection was used because Invoice amount, selected-document provenance and remove actions are not readable in a full-page capture.

## Required fidelity surfaces

- Fonts and typography: passed; existing Noto Sans SC hierarchy, 12px field labels and compact secondary text remain consistent and do not overflow.
- Spacing and layout rhythm: passed; creator identity sits above a stable two-column field grid with 18px inter-column spacing and clear row separation.
- Colors and visual tokens: passed; neutral gray inputs and selected rows retain the existing low-saturation pink accent only for required/optional metadata.
- Image and icon fidelity: passed; no raster asset is required and the existing Lucide Invoice, contract, select and remove icons are reused.
- Copy and content: passed; Invoice requiredness, multi-select behavior, amounts, disabled reasons and automatic contract linking are explicit.

## Interaction and runtime checks

- `INV-301164-19 · USD 1,250` automatically selects `CON-20260801-A30101` and `CON-20260801-A30102`.
- `INV-301164-20 · USD 980` automatically selects `CON-20260801-A30106`.
- Automatic selection requires matching stable `creatorId`, `cooperationProjectId`, `engagementId` and contract snapshot ID, and excludes unconfirmed contracts.
- Clicking `创建项目` successfully created `REQ-20260807-3TKNGE` as a local draft with `USD 2,230`, two creators, three contracts and two Invoices.
- Missing required fields keep the create action available and return explicit field-level issues instead of an unexplained disabled button.
- The existing `760px` breakpoint collapses only the Invoice/contract field grid to one column; the modal and selected rows keep fluid widths without fixed minimums.
- Browser console error log: empty.
- `npm test -- --run`: 31 test files and 201 tests passed.
- `npm run build`: passed.

## Findings and comparison history

1. Initial P1: Invoice and contract candidates were card/radio controls, which made the repeated creator section visually heavy and hid the intended form hierarchy.
   - Fix: converted both resource types to existing form-style custom selects while retaining multi-select through removable selected-value rows.
2. Initial P1: the create action was disabled without explaining incomplete requirements.
   - Fix: the action now validates on click, displays the exact missing items and proceeds when the required project, PM, reason, creators and Invoices are present.
3. Initial P1: selecting an Invoice did not reliably express or apply its contract relationship.
   - Fix: synthetic Invoice snapshots now reference confirmed contracts through stable IDs; selection automatically links only compatible contracts.
4. Post-fix comparison, end-to-end creation, console, test and build checks found no actionable P0, P1 or P2 issue.

final result: passed

---

# Design QA — 请款项目关联合同与达人筛选

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-153f11bc-f651-43a2-8e07-35565483c7ba.png`.
- Implementation URL: `http://127.0.0.1:5183/`.
- Main contract dialog: `app/design-qa-contract-resource-desktop.png` (`1120 x 680`).
- Contract-association dialog: `app/design-qa-contract-association-desktop.png` (`920 x 576`).
- Responsive association dialog: `app/design-qa-contract-association-390.png`.
- Side-by-side comparison: `app/design-qa-contract-resource-comparison.png`.
- Source pixels: `1106 x 769`; main implementation dialog: `1120 x 680`; default browser capture: `1265 x 712`; density: `1`.
- Responsive viewport override: `390 x 844`; rendered capture: `375 x 812`; density: `1`.
- States: `REQ-202607-000001` with three contract candidates, and `REQ-202607-000004` before and after linking a contract whose creator was not yet in the request project.

## Comparison evidence

- The native-size side-by-side comparison shows the same contract resource modal hierarchy, toolbar, row density, typography, neutral palette and compact row actions as the reference.
- The `关联已有合同` action remains in the same toolbar position. Contract rows retain `查看 / 解除 / 删除`; the highlighted `编辑` action from the source is removed as requested.
- The source and implementation both retain nine initially linked contracts; three additional synthetic contracts remain available only in the association workflow.
- The association dialog is a new interaction state not shown in the source. It reuses the existing modal, heading panel, custom select, flat resource row, status and footer patterns.

## Required fidelity surfaces

- Fonts and typography: passed; existing Noto Sans SC sizing, weights, line heights and wrapping are unchanged.
- Spacing and layout rhythm: passed; filter, candidate rows and sticky modal footer use the existing compact resource-dialog spacing and 8px radii.
- Colors and visual tokens: passed; neutral borders and backgrounds are retained, with restrained green membership and purple new-creator labels that do not replace text status.
- Image and icon fidelity: passed; no image asset was required, and the existing Lucide contract, link, view, unlink and delete icons are reused.
- Copy and content: passed; the dialog explains the cooperation-project candidate scope and the automatic creator-add behavior before selection.

## Interaction and responsive checks

- The main cooperation project exposes one confirmed candidate plus one draft and one pending-confirmation contract. Draft and pending records remain visible, disabled and provide explicit reasons plus contract-detail access.
- Selecting Emily Wong in the creator filter reduces the visible candidates from three to her single draft contract.
- The Invoice candidate dialog retains its existing request-project scope and has no new creator filter.
- In `REQ-202607-000004`, the Ava Thompson fixture is shown as `关联后新增达人`. Linking it increases the request project from 23 to 24 creators and creates a stable link with one contract and zero Invoices.
- The new creator's zero-Invoice state remains visible as `待补资料`; existing submission validation continues to require at least one Invoice before approval submission.
- At the `390 x 844` override, document, dialog, filter and candidate-list `scrollWidth` equal their respective `clientWidth`; there is no horizontal overflow.
- Browser console warning and error log: empty.
- `npm test -- --run`: 31 test files and 196 tests passed.
- `npm run build`: passed.

## Findings and comparison history

1. Initial P1: contract candidates were restricted to creators already present in the request project, and the commit path only iterated existing creator links.
   - Fix: candidates now use the cooperation-project contract pool; confirmed selections merge by stable `creatorId / engagementId`, creating a new creator link with `invoiceIds: []` when needed.
2. Initial P2: the association dialog had no creator filter, so a larger cooperation-project contract pool would be difficult to scan.
   - Fix: added a keyboard-accessible creator select with candidate counts and clear existing/new creator labels.
3. Initial P2: contract rows exposed an edit action after the user explicitly removed editing from this workflow.
   - Fix: removed only the contract edit action while preserving view, unlink, deletion protection and source-detail navigation.
4. Post-fix desktop, responsive, filtering, disabled-state, automatic-creator-add, console, test and build checks found no actionable P0, P1 or P2 issue.

final result: passed

---

# Design QA — 项目详情操作精简与 Airwallex 付款限制

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-48d9cba1-215c-4948-b0c8-886a645757e1.png` and `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-77dbb577-2225-42fd-8a54-d4465d38ee47.png`.
- Implementation URL: `http://127.0.0.1:5176/`.
- Desktop CSS viewport: `1280 x 720`; responsive CSS viewport: `390 x 844`.
- Verified project: `PRJ-260727-05`, containing 12 stable Engagements, 12 linked Invoices and one project-level payment list.

## Project resource dialogs

- The project contract dialog contains only `关联合同/IO 单` as its create/link action. `生成合同` remains available in the contract-management module.
- Contract rows retain `查看`, `编辑`, `解除` and `删除`; contract editing still opens the contract detail flow.
- Project Invoice rows contain `查看`, `解除` and `删除`, with no project-level `编辑` action or edit modal.
- The Invoice-management module retains its existing generation and edit callback path.

## Payment list interaction

- The payment-list header no longer contains provider cards, channel tabs or a provider-specific generation action. A project presents one current payment list.
- Every payment row contains an account selector sourced from that creator's stable, Invoice-eligible payout accounts.
- Account choices show provider, currency where applicable, status, masked account identifier and a shortened beneficiary reference. The PayPal test account renders as `y***@example.com`, never as the full email.
- Selecting Yuki Tanaka's PayPal backup account immediately displays the row warning `Yuki Tanaka 当前选择 PayPal，付款单仅支持 Airwallex。`.
- Clicking `生成付款单` with that selection keeps the list in draft, creates no version, and focuses the unsupported-provider warning.
- Switching back to Airwallex removes the provider blocker. The next generation attempt focuses the first blank transaction-reference field, confirming that the existing required-field validation continues after provider validation.

## Responsive and runtime checks

- At `390px`, the document client width and scroll width are both `375px`; no page-level horizontal overflow is present.
- The Invoice dialog is `335px` wide within the responsive client area and has no internal horizontal overflow.
- Payment rows and account triggers are `296px` wide, with equal client and scroll widths. Long account metadata truncates inside the custom select instead of resizing the dialog.
- The sticky footer keeps `生成付款单` at the bottom-right action area without covering row fields.
- Browser console contains only Vite/React development information; no application warning or error was produced during the final desktop and responsive flows.
- `npm test -- --run`: 28 test files and 175 tests passed.
- `npm run build`: passed.

final result: passed

# Design QA — 生成合同多平台频道编辑

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-0a0e13f2-2674-49dc-a0d5-14a9d4e91930.png`
- Implementation URL: `http://127.0.0.1:5173/`
- Desktop implementation: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-publishing-channels-1440.png`
- Combined comparison input: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-publishing-channels-comparison.png`
- CSS viewport: `1440 × 1000`; implementation screenshot: `1425 × 990`; source screenshot: `1566 × 694`
- State: the contract builder has selected Mina Kato. Her Instagram and TikTok profile URLs are loaded from the creator profile as two editable contract-snapshot rows.

## Comparison evidence

- The combined comparison places the annotated source state and the revised contract builder side by side.
- The original single platform and single link controls are replaced by one compact bordered publishing-channel group.
- Each creator social account is represented by one row with aligned “发布平台” and “频道链接” columns, preserving the requested platform-to-link relationship.
- The surrounding creator, project, publisher, address, quality summary, toolbar, and A4 preview layouts remain unchanged.

## Required fidelity surfaces

- Fonts and typography: passed; existing Noto Sans SC field labels, helper text, input type, and heading hierarchy are retained.
- Spacing and layout rhythm: passed; the new group follows the existing compact form density and uses a stable one-third/two-thirds platform/link allocation.
- Colors and visual tokens: passed; existing neutral background, gray border, coral focus, and error tokens are reused.
- Image and icon fidelity: passed; no new image asset or icon was introduced.
- Copy and content: passed; the helper text clearly states that values come from the creator profile and only modify the current contract snapshot.

## Interaction and runtime checks

- Selecting Mina Kato loads `Instagram → https://www.instagram.com/MinaKato` and `TikTok → https://www.tiktok.com/@MinaKato` as two separate rows.
- Both platform names and both links are enabled inputs. Editing the second row updates only the contract model and automatically positions the preview at the channel field page.
- Unit coverage verifies that an edited contract row does not mutate `CreatorProfile.socialAccounts`.
- Empty platform, empty link, non-HTTP(S) URL, creator switching, legacy single-channel draft recovery, and PDF/DOCX multi-platform output are covered.
- The channel group has no horizontal overflow at the verified desktop viewport.
- Browser warning and error log: none.
- `npm test`: 19 test files and 107 tests passed.
- `npm run build`: passed.

## Findings and comparison history

1. Initial P1: the form selected one matching or first social account, so multi-platform creators lost every additional platform-to-link relationship.
   - Fix: introduced a stable `socialAccountId`-backed `publishingChannels` snapshot and initialized every creator social account as its own form row.
2. Initial P2: the first grid implementation reserved too little usable width for long channel URLs.
   - Fix: changed the row tracks to `minmax(100px, 1fr) / minmax(0, 2fr)` and rechecked the final desktop capture.
3. Post-fix visual, interaction, document-generation, validation, and console checks found no actionable P0, P1, or P2 findings.

final result: passed

---

# Design QA — Invoice 批量生成多条 Description

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-9011640c-b3c6-4b2c-8df5-289053dcfb08.png` and `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-b98a378a-f73f-4eec-8957-68a7aefc5d62.png`.
- Implementation URL: `http://127.0.0.1:5174/`.
- Browser-rendered implementation: `app/design-qa-invoice-batch-descriptions-desktop.png`.
- Side-by-side comparison: `app/design-qa-invoice-batch-descriptions-comparison.png`.
- Source pixels: `1295 x 532`; implementation pixels and CSS viewport: `1265 x 712`; device density: `1`.
- State: unified Description mode with three entries created, the middle entry removed, and the remaining first and third values preserved.

## Comparison evidence

- The source and browser-rendered implementation were opened together in the combined comparison image.
- The duplicated public `收款方式` block marked in the source has been removed; the prototype Payment Information notice, Invoice date, currency, and Description controls remain aligned.
- The former single textarea is replaced by a compact repeated field group that follows the existing single-Invoice line-item treatment, including a right-aligned add action and per-row delete icon.
- The first Description remains required and cannot be deleted; later entries can be removed independently.

## Required fidelity surfaces

- Fonts and typography: passed; the existing Noto Sans SC hierarchy, field-label weight, helper text, and input text sizing are retained.
- Spacing and layout rhythm: passed; the repeated rows use the existing form width, divider rhythm, compact vertical spacing, and stable delete-action column.
- Colors and visual tokens: passed; neutral inputs, gray dividers, coral interaction accents, and the blue prototype notice continue to use existing tokens.
- Image and icon fidelity: passed; no raster asset was required, and the existing Lucide plus/trash controls are used consistently.
- Copy and content: passed; the UI explains that all selected creators share the Description list while Price and Amount remain per-creator values.

## Interaction and runtime checks

- Added three Description rows, entered `Dedicated Video`, `Usage License`, and `Social Cutdown`, then removed the middle row. The surviving values remained `Dedicated Video` and `Social Cutdown`.
- Stable `templateKey` synchronization is covered by unit tests so deleting a middle Description does not move another line's Price or Amount onto the wrong item.
- Multi-item document construction is covered for the Invoice preview, PDF, and DOCX model, including the aggregate total.
- The browser DOM contains no public `收款方式` field in Invoice public information; the per-creator `Payment Information` table column remains present.
- Browser console warnings/errors after the final interaction: none; only Vite debug and React development information entries were present.
- Focused Invoice batch tests: `15/15` passed.
- Full test suite: `28` files and `161` tests passed.
- TypeScript production compilation and `npm run build`: passed.

## Findings and comparison history

1. Initial P1: unified mode stored one Description and one Price/Amount pair, so one Invoice could not express several fee lines.
   - Fix: introduced stable batch line items and synchronized every selected creator row by `templateKey`.
2. Initial P2: the public payment-method card duplicated the per-creator Payment Information choice and occupied the area called out in the reference.
   - Fix: removed only that public card while preserving the prototype-data notice and the row-level cascader.
3. Post-fix visual, add/remove, stable association, document construction, console, test, and build checks found no actionable P0, P1, or P2 findings.

final result: passed

---

# Invoice Batch Payment Information Cascader Design QA

## Reference and environment

- Current-state reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-2bba2ecc-9c04-4327-b1be-b082588a6493.png`.
- Cascader visual reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-b889af2a-8c74-4d8f-b44f-025cd6a5d5da.png`.
- Implementation URL: `http://127.0.0.1:5174/`.
- Desktop implementation: `app/design-qa-invoice-batch-cascader-desktop.jpg`.
- Responsive implementation: `app/design-qa-invoice-batch-cascader-mobile-390.jpg`.
- Desktop captured pixels: `1265 x 712`; responsive CSS viewport: `390 x 844`; responsive captured content pixels: `375 x 812`; device density: `1`.
- State: one project creator selected, synthetic Airwallex and PayPal accounts available, and the two-level Payment Information cascader open.

## Comparison evidence

- The target reference and final desktop screenshot were inspected together at native density.
- The native browser select is replaced by a white, elevated two-column panel. The left column contains `Paid by Bank` and `Paid by PayPal`; the right column contains the corresponding masked prototype accounts.
- The panel is rendered through a portal and positioned with a fixed `6px` gap above or below the trigger, so it does not cover the edited row control and is not clipped by the table scroller.
- Existing COMETS Pay typography, neutral borders, compact table density, coral focus treatment, and account summary hierarchy are preserved.

## Interaction and responsive checks

- Both payment methods remain visible at level one even when a method has no usable account; level two then displays an explicit empty state.
- Selecting the synthetic PayPal account updates the stable `payoutAccountId`, row summary, validation result, and Invoice preview Payment Information.
- Keyboard navigation covers open/close, method movement, method-to-account movement, account movement, selection, and Escape.
- At `390px`, the trigger rectangle ends at `570.86px` and the menu starts at `576.86px`; overlap is false. The menu remains between `12px` and `378px`, and document scroll width remains within the viewport.
- Browser console warnings/errors: none.
- Invoice-focused tests: `15/15` passed.
- Full test suite: `27` files and `157` tests passed.
- TypeScript check and `npm run build`: passed.

## Findings and comparison history

1. Initial P1: the native select opened over the table control and presented payment methods and accounts as a flat list.
   - Fix: introduced a portal-based two-level cascader with collision-aware placement and separate method/account columns.
2. Initial P2: the prototype data guaranteed only an Airwallex bank account, so `Paid by PayPal` could not be demonstrated consistently for every creator.
   - Fix: injected one deterministic, verified, synthetic PayPal account per creator while retaining the default synthetic Airwallex account.
3. Post-fix desktop, responsive, pointer, keyboard, preview, console, test, and build checks found no actionable P0, P1, or P2 issue.

final result: passed

---

# Design QA — 生成合同页面整页滚动

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-1604ad1e-ba2e-4928-9c24-4273b3de67f7.png`
- Existing product reference: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-invoice-layout-reference.png`
- Implementation URL: `http://127.0.0.1:5178/`
- Before screenshot: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-scroll-before.png`
- Desktop implementation: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-scroll-1682.png`
- Scrolled implementation: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-scroll-scrolled-1682.png`
- Responsive captures: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-scroll-861.png` and `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-scroll-390.png`
- Combined comparison input: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-scroll-comparison.png`
- Source and desktop implementation pixels: `1682 × 862`; CSS viewport `1682 × 862`; device density `1`
- Responsive CSS viewports: `861 × 900`, `860 × 900`, and `390 × 844`
- State: blank contract-generation form with the first page of the local 17-page draft preview.

## Comparison evidence

- The combined comparison places the existing “生成 Invoice” page and the revised “生成合同” page side by side at the same viewport.
- Both pages now use a natural document flow: the form determines the page height, the browser owns vertical scrolling, and the preview remains visible as a desktop sticky panel.
- The contract-specific `40% / 60%` adjustable split, quality summary, PDF toolbar, and A4 preview are intentional differences retained from the approved contract workflow.
- The scrolled implementation is the focused interaction evidence: after the document scrolls `720px`, the left form moves with the page, its internal `scrollTop` remains `0`, and the preview stays at the application content offset.

## Required fidelity surfaces

- Fonts and typography: passed; the existing Noto Sans SC hierarchy, compact field labels, toolbar copy, and contract-page text are unchanged.
- Spacing and layout rhythm: passed; the heading, notice, double-column workspace, form sections, preview toolbar, and final action area now follow the same long-page rhythm as the Invoice builder.
- Colors and visual tokens: passed; no palette, semantic status color, border, radius, or elevation token was changed.
- Image and icon fidelity: passed; existing COMETS branding, Lucide controls, and generated PDF canvas are retained. No new visual asset or icon approximation was introduced.
- Copy and content: passed; no field, validation, contract text, or action label changed.

## Interaction and responsive checks

- Desktop document height is `3077px` in an `862px` viewport, proving the page can scroll naturally.
- After scrolling `720px`, page `scrollY = 720`, left form `scrollTop = 0`, and sticky preview top is `96.59px`.
- At the document bottom, the action bar is fully visible between `753.73px` and `820.42px`; it is no longer held in a fixed viewport grid.
- At `861px`, the form and preview remain in two columns and document `scrollWidth = clientWidth = 846px`.
- At `860px`, the responsive “合同信息 / 合同预览” tabs activate as designed.
- At `390px`, document `scrollWidth = clientWidth = 375px`; the form uses the full content width and page scrolling leaves the form’s internal `scrollTop` at `0`.
- Splitter keyboard adjustment, preview page controls, issue-to-field positioning, and full-screen preview remain available from the prior implementation.
- Browser console warnings and errors: none.
- `npm test -- --run`: 19 test files and 90 tests passed.
- `npm run build`: passed.

## Findings and comparison history

1. Initial P1: the contract builder forced the workspace into a viewport-height grid. The left form and PDF preview scrolled independently, so users could not move through the page like the existing Invoice builder.
   - Fix: removed the viewport height and hidden-overflow constraints, allowed form content to determine document height, and moved the action area back into normal document flow.
   - Post-fix evidence: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-scroll-1682.png`.
2. Initial P2: removing all height constraints could have made the 17-page preview disappear while users completed the long form.
   - Fix: retained a bounded PDF page viewport inside a sticky desktop preview panel, while keeping the form and application page on a single vertical scroll axis.
   - Post-fix evidence: `/Users/aria/.codex/worktrees/fc9a/支付系统管理端/app/design-qa-contract-scroll-scrolled-1682.png`.
3. Post-fix desktop, responsive, scroll, action-area, and console checks found no actionable P0, P1, or P2 findings.

final result: passed

---

# Design QA — 项目达人名单筛选弹窗

## Reference and environment

- Source visual truth: `/var/folders/kq/dz44fm994nz94zw2dfqnz_g00000gn/T/codex-clipboard-baacc64b-16ab-47a1-be47-f473c73fd09a.png`
- Implementation URL: `http://127.0.0.1:5174/`
- Saved-roster screenshot: `/Users/apple/Documents/MUSE-Pay-网红支付系统/project-detail-creator-list-qa.png`
- Creator-filter modal screenshot: `/Users/apple/Documents/MUSE-Pay-网红支付系统/project-creator-modal-qa.png`
- Combined comparison input: `/Users/apple/Documents/MUSE-Pay-网红支付系统/project-creator-comparison-qa.png`
- Source pixels: `2028 × 744`
- Implementation pixels and CSS viewport: `1265 × 712`; device density `1`
- Normalization: the source was proportionally downsampled to `1265 × 464`; both implementation captures remain at native `1265 × 712`.
- State: source shows the project-detail creator card before concrete archive profiles are linked; implementation evidence shows both the saved roster and the new filter/multi-select modal.

## Comparison evidence

- Full-view comparison: `project-creator-comparison-qa.png` places the source crop, populated project roster, and filter modal in one input.
- The project-detail card keeps the supplied white-card treatment, header position, muted helper copy, and right-aligned “查看全部” entry.
- The new modal is an intentional interaction extension that the source screenshot does not prescribe. It uses the existing COMETS Pay modal, input, custom select, avatar, coral selected-state, neutral border, and fixed-footer patterns.
- A separate focused crop was not needed because the supplied source is already focused on the creator card and the modal controls remain readable at native scale in the combined comparison.

## Required fidelity surfaces

- Fonts and typography: passed; the existing Noto Sans SC stack, heading weights, small helper copy, row labels, truncation, and button hierarchy are preserved.
- Spacing and layout rhythm: passed; the card retains the original section spacing, while the modal uses a balanced header, three-control toolbar, scrollable result area, and persistent footer.
- Colors and visual tokens: passed; existing white and soft-gray surfaces, coral focus/selected state, blue information notice, neutral borders, radii, and elevation are reused.
- Image and icon fidelity: passed; the existing COMETS brand asset, shared avatars, and Lucide controls are retained. No placeholder artwork or handcrafted icon approximation was introduced.
- Copy and content: passed; the modal explicitly states that data comes from system 【达人档案】 and exposes search by name/account plus region and platform filtering.

## Interaction and runtime checks

- Login: `jeff / 1234`.
- Opened `我的项目 → Once Human主机上线KOL合作项目 → 查看全部 20 位`.
- Search for `Mina` reduced the archive from 13 to 1 result.
- Region `日本` reduced the archive to 3 results; adding platform `Instagram` reduced it to 2.
- Selected Mina Kato and Yuki Tanaka, saved the roster, and verified that the project, contract, Invoice, and payment-list counts all changed to 2.
- Navigated to `达人档案` and confirmed both selected people and their profile data come from the shared 13-person archive.
- Navigated away and back to `我的项目`; the updated 2-person roster persisted after project state was lifted to the app level.
- Reopening the modal restored the selected profiles; cancel closed it without another write.
- `npm run build` passed.
- The browser log buffer contains four historical errors at `09:39:11` from the transient Vite HMR frame while the `ProjectsPage` prop signature was being lifted. A cold reload of the final build at `09:41:49`, followed by login, project navigation, and modal opening, produced no newer warning or error entries.

## Findings and comparison history

1. Earlier P2: the populated four-column creator table inherited the global `850px` table width and showed a horizontal scrollbar inside the narrow project-detail column.
   - Fix: gave the project creator table its own fixed-width column layout, removed its inherited minimum width, tightened cell padding, and applied intentional handle truncation.
   - Post-fix evidence: `/Users/apple/Documents/MUSE-Pay-网红支付系统/project-detail-creator-list-qa.png`.
2. Earlier P1: updating the creator roster only changed `ProjectsPage` local state, so navigating to `达人档案` and back remounted the page and restored the old count.
   - Fix: lifted the project collection into `App` and passed the shared updater into `ProjectsPage`.
   - Post-fix evidence: browser verification found the exact project row with `2 位` after navigating away and back.
3. Post-fix comparison: no actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: long creator handles intentionally ellipsize inside the compact project-detail table. Full names, handles, region, and platform remain available in the modal.

final result: passed

---

# Design QA — 收款账户三渠道布局

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-214f2cd8-cc16-4e9a-b119-3e41fd6af5f3.png`
- Implementation URL: `http://127.0.0.1:5175/`
- Browser-rendered implementation: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/comets-pay-payout-accounts-cropped.png`
- Side-by-side comparison: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/comets-pay-payout-accounts-comparison.png`
- Desktop viewport: `1534 × 900` CSS px; device pixel ratio: `1`
- Mobile viewport: `390 × 844` CSS px
- Source pixels: `1534 × 459`
- Implementation region: `1060 × 459` CSS px and pixels
- Density normalization: none; both comparison captures are 1x. The implementation is narrower because the existing creator modal has a fixed maximum width.
- State: Airwallex selected with three visible Airwallex cards. The source uses three verified fixture accounts; the implementation uses three new draft accounts to preserve the requested product state.

## Comparison evidence

- The source and implementation were opened in one side-by-side comparison image.
- Both use the same four-level structure: three provider tabs, four summary metrics, a three-column account-card row, and right-aligned add-account actions.
- Card height, section rhythm, compact typography, borders, icon placement, selected state, default star, and action density are visually aligned.
- The source green accents were intentionally not copied. The implementation retains the existing COMETS Pay pink-purple palette because the request explicitly required no color change.
- Fixture counts and statuses differ intentionally because a new creator must start with one unverified Airwallex draft account.
- A separate focused crop was not needed because both 1x captures keep typography, spacing, icons, status chips, and action labels readable in the full-view comparison.

## Required fidelity surfaces

- Fonts and typography: passed; the existing Noto Sans SC stack, compact weights, line heights, and label hierarchy are preserved without clipping or unintended wrapping.
- Spacing and layout rhythm: passed; provider tabs, summary cells, account cards, and footer actions follow the source hierarchy and proportions. Account-card radii are 8px.
- Colors and visual tokens: passed; existing COMETS Pay colors are retained as requested and status colors continue to use the established semantic tokens.
- Image and icon fidelity: passed; the region contains no raster imagery. Existing Lucide icons are used consistently and remain sharp at 1x.
- Copy and content: passed; the UI uses `Airwallex`, `PayPal`, and user-facing `PayerMax`; internal `PayMax` model naming is not exposed.

## Interaction and responsive checks

- New creator starts with one default Airwallex draft account.
- Airwallex, PayPal, and PayerMax provider tabs switch correctly.
- Empty provider state appears without fabricating account data.
- All three add-account actions create and select the correct draft account.
- PayerMax renders its editable account fields.
- Account-card selection and the set-default menu work.
- Desktop `1534 × 900` and mobile `390 × 844` have no document-level horizontal overflow.
- Mobile provider tabs, cards, summary cells, and actions collapse without text overlap.
- Browser console warnings and errors: none.
- `npm test -- --run`: 34 tests passed.
- `npm run build`: passed.

## Findings and comparison history

1. Pass 1 found no actionable P0, P1, or P2 mismatch.
2. Intentional differences are the preserved COMETS Pay palette, narrower existing modal container, and draft fixture states.
3. Post-interaction desktop and mobile verification found no clipping, state error, or console issue.

final result: passed

---

# Design QA — 登录方式上下顺序调整

## Reference and environment

- Source visual truth: `/var/folders/kq/dz44fm994nz94zw2dfqnz_g00000gn/T/codex-clipboard-97f7d87a-12de-4c7e-8172-21d37cfeb3c4.png`
- Implementation URL: `http://127.0.0.1:5173/`
- Desktop screenshot: `/tmp/comets-login-order-desktop.png`
- Mobile screenshot: `/tmp/comets-login-order-mobile.png`
- Focused implementation screenshot: `/tmp/comets-login-order-focus-cropped.png`
- Combined comparison input: `/tmp/comets-login-order-comparison.png`
- Source pixels: `818 × 739`
- Desktop implementation pixels and CSS viewport: `1280 × 900`; device density `1`
- Mobile implementation pixels and CSS viewport: `390 × 844`; device density `1`
- Focused implementation pixels: `478 × 560`
- Normalization: the source remains at native size; the focused implementation remains at native scale and is vertically padded on a white canvas for the `1296 × 739` combined comparison.
- State: default account login screen with account `jeff`.

## Comparison evidence

- The combined comparison places the supplied annotated current-state screenshot and the revised focused login region in one image.
- The revised order is `账号密码登录 → 注册入口 → 或使用飞书扫码登录 → 飞书扫码按钮`.
- The source annotation rectangles are review markup rather than application UI and are intentionally absent from the implementation.
- A focused comparison was used because the requested change affects only the ordering of the two authentication methods; the full desktop and mobile captures verify the surrounding responsive layout.

## Required fidelity surfaces

- Fonts and typography: passed; the existing heading, field-label, input, divider, button, and helper-copy hierarchy is unchanged.
- Spacing and layout rhythm: passed; the existing `17px` form rhythm, input dimensions, divider spacing, button dimensions, radii, and alignment remain intact after reordering.
- Colors and visual tokens: passed; the black account-login action, neutral divider, white provider button, and blue-green Feishu icon treatment are unchanged.
- Image and icon fidelity: passed; the existing Lucide scan icon and COMETS branding are retained, with no new placeholder or handcrafted assets.
- Copy and content: passed; the divider now accurately reads `或使用飞书扫码登录`, while the login, registration, and email guidance copy remain unchanged.

## Interaction and responsive checks

- Desktop DOM geometry confirms the account field is above the divider and the divider is above the Feishu button.
- Clicking `使用飞书扫码登录` opens the existing `飞书扫码登录` screen with QR code, refresh, confirmation, and account-login return controls.
- Returning through `账号密码登录` restores the reordered default login screen.
- At `390 × 844`, the same order is preserved and `scrollWidth = clientWidth = 390px`.
- Page identity is `账号登录 · COMETS Pay`; no framework error overlay is present.
- Browser console warnings/errors: none.
- `npm run build`: passed.

## Findings and comparison history

1. Initial P2: the supplied current state placed the secondary Feishu QR option above the primary account-password form, conflicting with the requested priority.
   - Fix: moved the full account-password flow above the divider and moved the Feishu entry below it; updated the divider copy to describe the lower option.
   - Post-fix evidence: `/tmp/comets-login-order-comparison.png`.
2. Post-fix desktop, mobile, interaction, layout, and console checks found no actionable P0, P1, or P2 differences.

final result: passed

---

# Design QA — 新建达人档案弹窗高度

## Reference and environment

- Source visual truth: `/var/folders/kq/dz44fm994nz94zw2dfqnz_g00000gn/T/codex-clipboard-e3eb1056-7cc6-465d-99b8-da4663a9def2.png`
- Implementation URL: `http://127.0.0.1:5174/`
- Before screenshot: `/tmp/muse-creator-modal-height-before.png`
- Implementation screenshot: `/tmp/muse-creator-modal-height-after.png`
- Combined comparison input: `/tmp/muse-creator-modal-height-comparison.png`
- Desktop viewport: `1903 × 1138`; device density `1`
- Compact viewport: `1366 × 768`
- State: `达人档案 → 新建达人档案`

## Comparison evidence

- The supplied screenshot and final implementation were compared together at the same `1903 × 1138` pixel dimensions.
- The creator editor increased from approximately `842px` to `918px` rendered height, adding about `76px` of usable vertical space.
- More of the Invoice contact section is visible before scrolling, while the header and primary footer action remain fixed and immediately reachable.
- The height override is scoped to new/edit creator forms; the read-only creator detail modal retains the shared default height.

## Required fidelity surfaces

- Fonts and typography: passed; existing Noto Sans SC hierarchy, weights, bilingual helper labels, and form copy are unchanged.
- Spacing and layout rhythm: passed; the same header, section cards, form-grid gaps, and fixed footer are retained while only the vertical viewport grows.
- Colors and visual tokens: passed; backdrop, white surface, peach-lilac summary card, borders, radii, elevation, and black primary action are unchanged.
- Image and icon fidelity: passed; existing COMETS branding, avatar treatment, and Lucide icons remain intact.
- Copy and content: passed; no field names, required rules, archive data, or action labels were changed.

## Interaction and responsive checks

- At `1903 × 1138`, the editor is `918px` tall and stays within the viewport with `110px` total vertical margin.
- At `1366 × 768`, the responsive fallback remains `728px` tall with `20px` top and bottom margins.
- The form content remains independently scrollable and the `取消 / 建立达人档案` footer remains visible.
- Browser console warnings/errors: none.
- `npm run build`: passed.

## Findings and comparison history

1. Earlier P2: the default shared `780px` CSS cap rendered the scaled creator editor at about `842px`, leaving unnecessary unused viewport space.
   - Fix: added an editor-only desktop height cap of `850px`, still bounded by `calc(100vh - 80px)`.
2. Earlier P2: changing the shared modal height would have enlarged unrelated dialogs.
   - Fix: added an optional modal class hook and applied it only while creating or editing a creator profile.
3. Post-fix comparison found no actionable P0, P1, or P2 differences.

final result: passed

---

# Design QA — 新建项目弹窗加宽与达人搜索优化

## Reference and environment

- Source visual truth: `/var/folders/kq/dz44fm994nz94zw2dfqnz_g00000gn/T/codex-clipboard-7ba8189d-193c-4860-a041-7b27e95b773e.png`
- Implementation URL: `http://127.0.0.1:5174/`
- Implementation screenshot: `/tmp/comets-project-modal-wide-search-final-empty.png`
- Filtered-state screenshot: `/tmp/comets-project-modal-wide-search-filtered.png`
- Mobile screenshot: `/tmp/comets-project-modal-wide-search-mobile.png`
- Desktop viewport: `1948 × 1092`
- Mobile viewport: `390 × 844` (browser content width `375px`)
- State: “我的项目” → “新建项目” → 展开“合作达人”选择器

## Comparison evidence

- Full-view comparison: `/tmp/comets-project-modal-wide-comparison.png`
  - The modal now renders at `821px` in the reference desktop viewport instead of approximately `605px`.
  - Existing typography, dimmed backdrop, modal elevation, form rhythm, coral interaction color, and footer treatment remain consistent with COMETS Pay.
  - The width increase is intentional and directly addresses the supplied issue screenshot.
- Focused creator-filter comparison: `/tmp/comets-project-modal-wide-search-focus-comparison.png`
  - Search input and result count are now separated into a balanced toolbar.
  - The input has clearer padding, icon alignment, placeholder contrast, focus treatment, and usable horizontal space.
  - Result count is visible as a dedicated `13 / 13 位` badge.
  - Creator rows use consistent spacing, borders, radii, and alignment across the wider list.

## Required fidelity surfaces

- Fonts and typography: passed; existing family, weights, hierarchy, and small UI copy are preserved.
- Spacing and layout rhythm: passed; wider frame, 10px filter surface padding, 42px search control, and 7px creator-row spacing produce a cleaner rhythm.
- Colors and visual tokens: passed; existing neutral borders/backgrounds and coral focus/selected color are reused.
- Image and icon fidelity: passed; existing Lucide search/user controls and system avatar component are retained; no placeholder or custom drawn assets were introduced.
- Copy and content: passed; search hint now covers name, account, region, and platform, and result count is explicit.

## Interaction and responsive checks

- Search for `Mina` reduced the list to one option and removed unrelated creator rows.
- Empty query restored the complete 13-person list.
- Desktop dialog width measured `821px`; no horizontal overflow.
- Mobile dialog measured `335px` within a `375px` content viewport; `scrollWidth = clientWidth = 375px`.
- Modal footer remains visible and creator results scroll inside the modal.
- Browser console contains no warnings or errors.
- `npm run build` passed.

## Findings and iteration history

1. Earlier P2: the `605px`-wide dialog compressed the expanded creator picker.
   - Fix: set the new-project dialog width to `760px` (`821px` rendered at the desktop scale).
   - Post-fix evidence: `/tmp/comets-project-modal-wide-search-final-empty.png`.
2. Earlier P2: the search field read as a narrow, unfinished inset control and did not clearly expose the result count.
   - Fix: introduced a dedicated search toolbar, visible result-count badge, refined focus state, and more structured creator rows.
   - Post-fix evidence: `/tmp/comets-project-modal-wide-search-focus-comparison.png` and `/tmp/comets-project-modal-wide-search-filtered.png`.
3. Post-fix comparison: no actionable P0, P1, or P2 findings remain.

Final result: passed

---

# Design QA — 付款退回审核原因

## Reference and environment

- Source visual truth: `/var/folders/kq/dz44fm994nz94zw2dfqnz_g00000gn/T/codex-clipboard-b2f040ef-9b33-414a-8bce-4a6a092977f1.png`
- Implementation URL: `http://127.0.0.1:5174/`
- Return-reason modal screenshot: `/tmp/muse-pay-return-review-reason-modal.png`
- Post-return implementation screenshot: `/tmp/muse-pay-return-review-result.png`
- Mobile screenshot: `/tmp/muse-pay-return-review-mobile.png`
- Source viewport: `2527 × 1192`
- Browser comparison viewport: `2048 × 960`; the source was proportionally normalized to the same height because the in-app capture surface caps its desktop width.
- Mobile viewport: `390 × 844`
- State: `付款工作台 → Yuki Tanaka 付款详情 → 退回审核 → 填写原因 → 确认退回`

## Comparison evidence

- Full-view comparison: `/tmp/muse-pay-return-review-comparison.png`
  - Reference and implementation show the same post-return drawer state, payment record, approval step, warning treatment, and return reason.
  - The red annotation arrow and floating pink overlay controls in the supplied source are review annotations, not product UI, so they are intentionally absent from the implementation.
- Focused drawer comparison: `/tmp/muse-pay-return-review-drawer-comparison.png`
  - Drawer hierarchy, creator card, red handling notice, payment information grid, five-step approval timeline, attachments, and restart action remain aligned with the existing COMETS Pay design system.
  - The newly entered reason is rendered exactly as `财务退回：请核对收款主体与合同主体`.

## Required fidelity surfaces

- Fonts and typography: passed; existing font stack, drawer hierarchy, label sizes, weights, line heights, and textarea copy remain consistent.
- Spacing and layout rhythm: passed; the existing drawer layout is preserved, while the modal uses the product's 520px frame, 22px content padding, 12px grouping radii, and 18px vertical rhythm.
- Colors and visual tokens: passed; existing neutral surfaces, coral focus state, red return action, peach-lilac creator treatment, and amber warning tokens are reused.
- Image and icon fidelity: passed; no new raster assets were required. Existing Lucide icons and shared Avatar/Modal/Button components are used; no placeholder or handcrafted icons were introduced.
- Copy and content: passed; reason is required, limited to 300 characters, announced as synced to the project owner, and shown in the reference-matching post-return warning.

## Interaction and responsive checks

- `确认退回` is disabled while the reason is empty and enabled after non-whitespace input.
- Submitting changes the payment to `已退回`, closes the form, displays the entered reason, changes the primary action to `重新发起审核`, and shows a success toast.
- Re-starting approval clears the previous return reason and moves the payment to `飞书审批中`.
- The 390 × 844 modal keeps the textarea and both footer actions visible without horizontal clipping.
- Browser console warnings/errors: none.
- `npm run build`: passed.

## Findings and comparison history

1. Initial comparison: no actionable P0, P1, or P2 visual differences were found in the post-return drawer.
2. Intentional extension: the reference only depicts the result state; the required reason-entry modal was added using existing product components and tokens.
3. Responsive pass: no clipping, off-screen primary actions, or unreadable copy was found at 390 × 844.

final result: passed

---

# Design QA — 合同管理统计卡片内部样式

## Reference and environment

- User issue screenshot: `/var/folders/kq/dz44fm994nz94zw2dfqnz_g00000gn/T/codex-clipboard-44ef4fb5-832d-4f37-9169-06d92b394ffa.png`
- Source visual truth: the existing “我的项目” metric cards captured at `/tmp/comets-project-metric-card-reference.png`
- Implementation URL: `http://127.0.0.1:5174/`
- Desktop implementation screenshot: `/tmp/comets-contract-card-after-desktop.png`
- Mobile implementation screenshot: `/tmp/comets-contract-card-after-mobile.png`
- Focused comparison: `/tmp/comets-contract-card-design-comparison.png`
- Desktop CSS viewport: `1280 × 900`; device pixel ratio: `1`
- Mobile CSS viewport: `390 × 844`
- Reference focus capture: `850 × 160`; implementation focus capture normalized from `835 × 155` to `850 × 160`
- State: `合同管理 → 默认全部合同`

## Comparison evidence

- Full-view evidence compares `/tmp/comets-project-metric-card-reference.png` with `/tmp/comets-contract-card-after-desktop.png`.
- Focused evidence places the reference cards and normalized contract cards together in `/tmp/comets-contract-card-design-comparison.png`.
- The implementation now follows the reference hierarchy: metric label, main value, then one line of supporting business context.
- The former decorative circle and icon containers were removed because they created excess empty space and were absent from the selected in-product reference.
- All three contract cards intentionally retain subtle color fills because the preceding requirement explicitly requested colored blocks for this page.

## Required fidelity surfaces

- Fonts and typography: passed; label, `22px` value, muted supporting copy, line height, weight and letter spacing match the existing metric-card hierarchy.
- Spacing and layout rhythm: passed; `20px` padding, `7px` grid gap, `14px` radius and centered content rhythm match the reference component.
- Colors and visual tokens: passed; the existing peach treatment is matched, with equivalent low-saturation mint and amber variants retained for the contract-specific color requirement.
- Image and icon fidelity: passed; the selected reference contains no imagery inside the cards, and the implementation removes the unnecessary icons rather than introducing new assets.
- Copy and content: passed; each card now explains the metric with accurate contract data or its workflow meaning.

## Interaction and responsive checks

- “待处理” filters the list to the single matching contract.
- “查看合同” opens the full contract-reading view and “返回合同列表” restores the list.
- At `390 × 844`, the first two cards share one row and the third card spans the full row; page-level horizontal overflow is `0`.
- Browser page identity is `合同管理 · COMETS Pay`; no framework overlay is present.
- Browser console warnings/errors: none.
- `npm run build`: passed.

## Findings and comparison history

1. Earlier P2: the card interior only contained a label, icon and value, leaving a large empty gap and conflicting with the system’s established metric-card hierarchy.
   - Fix: removed the decorative icon area, added supporting business copy, and adopted the existing `label → value → meta` rhythm.
   - Post-fix evidence: `/tmp/comets-contract-card-design-comparison.png`.
2. Earlier P2: card radius, padding and number scale were heavier than the selected in-product reference.
   - Fix: aligned the card to the reference’s `14px` radius, `20px` padding, `7px` gap and `22px` value scale.
   - Post-fix evidence: `/tmp/comets-contract-card-after-desktop.png`.
3. Post-fix desktop, mobile, interaction and console checks found no actionable P0, P1 or P2 findings.

final result: passed

---

# Design QA — 全站 Ant Design 风格分页器

## Reference and environment

- Source visual truth: `/var/folders/kq/dz44fm994nz94zw2dfqnz_g00000gn/T/codex-clipboard-2e11f717-acfd-4344-a5e2-536e471cb375.png`
- Implementation URL: `http://127.0.0.1:5174/`
- Desktop screenshot: `/tmp/muse-pay-ant-pagination-desktop.png`
- Mobile screenshot: `/tmp/muse-pay-ant-pagination-mobile.png`
- Focused comparison: `/tmp/muse-pay-ant-pagination-comparison.png`
- Desktop viewport: `1600 × 900`
- Mobile viewport: `390 × 844`
- State: `达人档案 → 默认 10 条/页 → 第 1 页`

## Comparison evidence

- The focused comparison checks the supplied Ant Design reference against the implementation at native control scale.
- The active page is a 32px square with a 6px radius, blue border, blue text, and white fill.
- Inactive page numbers remain unboxed; previous and next controls use compact chevrons; the page-size selector uses a neutral bordered field with a trailing chevron.
- The application keeps its existing light surface because the user requested only the pagination style, not the reference image's dark page theme.

## Required fidelity surfaces

- Fonts and typography: passed; compact numeric labels and existing Chinese UI font hierarchy are preserved.
- Spacing and layout rhythm: passed; 32px controls, 6px gaps, and the separated page-size selector match the reference density.
- Colors and visual tokens: passed; Ant Design blue `#1677ff` is used for the active, hover, and focus states while the product's light background remains unchanged.
- Image and icon fidelity: passed; no raster assets are required, and Lucide chevrons provide the reference-equivalent navigation icons.
- Copy and content: passed; existing totals remain in Chinese and the selector explicitly exposes `10 / 20 / 50 条/页`.

## Interaction and responsive checks

- Creator archive defaults to 10 rows for 13 creators and exposes pages 1 and 2.
- Clicking page 2 selects it with `aria-current="page"` and displays the remaining 3 creators.
- Switching to 20 rows per page resets to page 1 and displays all 13 creators on one page.
- Both `达人档案` and `付款工作台` render the shared pagination component.
- Mobile viewport has no page-level horizontal overflow: `scrollWidth = clientWidth = 390px`.
- Browser console warnings/errors: none.
- `npm run build`: passed.

## Findings and comparison history

1. Initial reference comparison found the previous filled circular active state and icon-only pager inconsistent with the supplied Ant Design style.
2. The pager was consolidated into one shared component with Ant Design-style page items, chevrons, ellipsis handling, and a page-size selector.
3. Post-fix desktop, mobile, state-change, and console checks found no actionable P0, P1, or P2 differences.

final result: passed

---

# Design QA — 收款账户摘要栏移除

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-4d641a99-ab48-470f-9f32-95eed74b3766.png`
- Implementation URL: `http://127.0.0.1:5175/`
- Browser-rendered implementation: `/tmp/comets-pay-payout-summary-removed-final.png`
- Combined comparison input: `/tmp/comets-pay-payout-summary-removed-comparison.png`
- Desktop viewport: `1265 × 712` CSS px; device pixel ratio: `1`
- Source pixels: `989 × 413`
- Implementation focused region: `970 × 324` CSS px and pixels
- Density normalization: none; both captures are 1x.
- State: `达人档案 → 新建达人档案 → 收款账户`，Airwallex 渠道选中并显示一个默认草稿账户。

## Comparison evidence

- 合并对比图同时展示了带红框的源图和删除摘要栏后的浏览器实拍。
- 源图红框中的“当前渠道 / 账户总数 / 可用账户 / 档案完整度”整行已删除。
- 渠道标签后直接展示账户卡片，卡片下方直接进入新增账户操作，不存在残留占位或异常空白。
- 本次需求只涉及一个聚焦区域，因此合并对比图已经同时承担全视图和细节对比，无需额外局部裁切。

## Required fidelity surfaces

- Fonts and typography: passed；保留现有 Noto Sans SC 字体、渠道标签、账户卡片和按钮层级。
- Spacing and layout rhythm: passed；摘要栏移除后，渠道、账户卡片和新增操作之间的间距连续且稳定。
- Colors and visual tokens: passed；未改变现有粉紫选中态、中性色边框、状态色或背景色。
- Image and icon fidelity: passed；继续使用现有 Lucide 图标，没有引入占位图或手绘图形。
- Copy and content: passed；只删除用户指定的四项摘要，渠道、账户状态和操作文案均保留。

## Interaction and runtime checks

- DOM 中 `.payout-provider-summary` 数量为 `0`。
- 三个付款渠道标签仍存在；当前 Airwallex 草稿账户卡片数量为 `1`。
- 页面无横向溢出：`scrollWidth - clientWidth = 0`。
- 浏览器控制台 warnings/errors：无。
- `npm test -- --run`：34 项通过。
- `npm run build`：通过。

## Findings and comparison history

1. Initial P2：红框内四项摘要占用较多垂直空间，且属于用户明确不需要的信息。
   - Fix：删除摘要计算、摘要 JSX 和桌面/响应式 CSS。
   - Post-fix evidence：`/tmp/comets-pay-payout-summary-removed-comparison.png`。
2. Post-fix comparison：未发现可执行的 P0、P1 或 P2 问题。

final result: passed

---

# Contract Page Confirmation Design QA

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-0b434dd5-bf3e-4843-8102-be723e64e368.png`
- Browser-rendered implementation: `app/design-qa-contract-confirm-final-viewport.jpg`
- Focused implementation panel: `app/design-qa-contract-confirm-final-panel.jpg`
- Side-by-side comparison: `app/design-qa-contract-confirm-comparison.png`
- Browser viewport: `1425 x 900` CSS px
- Source pixels: `484 x 687`
- Implementation panel: `506 x 759` CSS px and pixels
- Device scale factor: `1`
- Density normalization: none; both captures are 1x and aligned at their top edge
- State: uploaded prototype contract, Contract Summary tab, 0/8 fields confirmed

## Full-View Comparison

The contract reader retains the existing two-column desktop layout. The inspector remains visually
secondary to the source document and has enough width for the new page-level action, status badges,
field values, and source links without horizontal overflow.

## Focused Comparison

The focused side-by-side comparison confirms the requested changes:

- The eight row-level confirmation buttons are removed.
- One compact `确认本页` button occupies the section heading's right side.
- Every editable field has a persistent light-gray underline.
- Field status remains visible at row level without competing with the page action.
- Existing tabs, labels, source links, type scale, and restrained gray-purple palette are preserved.

## Findings

No actionable P0, P1, or P2 visual differences remain.

- P3: The implementation panel is slightly taller than the annotated source because the persistent
  editable underline and longer prototype source labels add vertical rhythm. All eight rows remain
  readable in the inspector and the added height does not obscure controls.

## Required Fidelity Surfaces

- Fonts and typography: existing Noto Sans SC/system hierarchy preserved; field values remain compact
  and use zero letter spacing.
- Spacing and layout rhythm: page action is aligned to the section heading; row spacing and separators
  remain consistent.
- Colors and visual tokens: existing neutral borders, muted labels, blue source links, and low-saturation
  purple accents are unchanged.
- Image and icon fidelity: no image assets were introduced; the existing Lucide status/action icon style
  is preserved.
- Copy and content: `确认本页` and `本页已确认` clearly describe the new confirmation scope.

## Interaction Verification

- Contract Summary confirms all 8 fields with one action.
- Payment and Invoice confirms all 6 fields independently.
- Editing a confirmed field returns the page to a pending-confirmation state.
- An incomplete or unresolved-conflict page cannot be partially confirmed.
- Row-level `确认` button count is `0`.
- Page and inspector horizontal overflow is absent.
- Browser console warning/error count is `0`.

## Comparison History

1. Initial implementation: page action and underlines worked, but the inspector was narrower than the
   reference and caused avoidable source-label wrapping.
2. Fix: increased the inspector minimum width and tightened the field grid columns/gaps.
3. Post-fix evidence: `app/design-qa-contract-confirm-comparison.png`; no P0/P1/P2 findings remain.

final result: passed

---

# Contract Confirmed-Field Editing Design QA

## Reference and environment

- Source visual truth:
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-e7da30a7-1a08-4f68-bdc8-228752c65c9f.png`
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-2071fe97-0a6c-4b4d-bd8e-8855bdfe3687.png`
- Browser-rendered implementation:
  - `app/design-qa-contract-field-edit-summary.jpg`
  - `app/design-qa-contract-field-edit-checks.jpg`
- Combined comparison inputs:
  - `app/design-qa-contract-field-edit-summary-comparison.jpg`
  - `app/design-qa-contract-field-edit-checks-comparison.jpg`
- Browser viewport: summary `1425 x 900` CSS px; checks `1265 x 712` CSS px.
- Captured implementation pixels: summary `1410 x 891`; checks `1265 x 712`.
- Source pixels: summary `564 x 691`; checks `568 x 458`.
- Device scale factor: `1`; comparison crops keep native pixel density and are top-aligned.
- State: uploaded prototype contract before formal application, with summary confirmed at `8/8` and
  all recognition fields confirmed at `14/14`.

## Full-view and focused comparison

- The full desktop view preserves the existing contract reader proportions, information density, tab
  hierarchy, field typography, source links, and status badges.
- The focused summary comparison shows confirmed values without editable underlines, a compact `编辑`
  action in place of the former confirmed-state button, and no extra row actions.
- The focused checks comparison shows the progress panel using the same border, radius, spacing, and
  two-column content rhythm as the issue panel below it, with a distinct green completion treatment.
- At `14/14`, the stale `合同识别结果待人工确认` blocker is absent while the separate
  `上传合同尚未确认` blocker remains until formal application.

## Required fidelity surfaces

- Fonts and typography: passed; existing Noto Sans SC hierarchy, compact 10-13px inspector type, and
  zero letter spacing are preserved.
- Spacing and layout rhythm: passed; the edit action stays aligned to the section heading, and the
  progress card matches the issue-card radius, padding, and vertical gap.
- Colors and visual tokens: passed; confirmed fields retain restrained green status badges, the edit
  action uses the existing low-saturation purple accent, and the completed progress panel uses a
  distinct pale green treatment without relying on color alone.
- Image quality and asset fidelity: passed; no raster UI assets were introduced and existing Lucide
  icons are used consistently.
- Copy and content: passed; `编辑`, `确认本页`, `已应用`, `14/14 项`, and the remaining validation
  message correspond to their actual workflow state.

## Interaction verification

- Confirming the summary changes all eight fields to read-only and removes their bottom borders.
- Direct fill attempts on confirmed fields are rejected.
- Clicking `编辑` reopens only the current page, returns its progress to `0/8`, and permits changes.
- Reconfirming the summary and confirming payment produces `14/14`; the checks tab count changes from
  `2` to `1`.
- The recognition-confirmation blocker disappears at `14/14`; the upload-final-version blocker remains.
- Applying the fields to the formal contract removes the edit action, displays `已应用`, and keeps all
  recognition fields read-only.
- Browser console warnings/errors: none.

## Comparison history

1. The supplied summary state showed editable underlines and no way to reopen a confirmed page.
   - Fix: confirmed fields now render read-only without underlines; before formal application, a page-level
     `编辑` action reopens that page atomically.
2. The supplied checks state used a visually flatter progress bar and retained the recognition blocker.
   - Fix: the progress panel now matches the issue-card structure with a distinct semantic color, and the
     recognition blocker is derived from live confirmation progress.
3. Post-fix combined comparisons found no actionable P0, P1, or P2 differences.

final result: passed

---

# Invoice Batch Payment Information And Preview Design QA

## Reference and environment

- Source visual truth:
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-51d9013a-cdd5-4813-a299-c4d3df2bc523.png`
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-7d06ce10-b986-4e85-b74f-2d2aa57846bc.png`
- Source pixels: `1450 x 517` and `1395 x 433`.
- Implementation URL: `http://127.0.0.1:5174/`.
- Desktop implementation screenshots:
  - `app/design-qa-invoice-batch-table-1450.png`
  - `app/design-qa-invoice-batch-footer-1450.png`
  - `app/design-qa-invoice-batch-preview-1450.png`
- Responsive implementation screenshots:
  - `app/design-qa-invoice-batch-mobile-390.png`
  - `app/design-qa-invoice-batch-mobile-footer-390.png`
- Combined comparison input: `app/design-qa-invoice-batch-comparison.png`.
- Desktop CSS viewport: `1450 x 900`; captured pixels: `1435 x 891`. Responsive CSS viewport: `390 x 844`; captured content pixels: `375 x 812`. Device density: `1`.
- Normalization: source and implementation remain at native 1x density; the comparison places each source/implementation pair in equal `800px` columns without cropping.
- State: project `燕云十六声` with selected creators, shared Description, USD price/quantity rows, prototype Airwallex selected as `Paid by Bank`, and Camila Costa's row-level Invoice preview open.

## Full-view and focused comparison

- The combined comparison shows the source table/footer and source common-information section beside the corresponding browser-rendered implementation.
- The footer now keeps `取消` and `批量生成 Invoice` adjacent at the lower right. The implementation retains the application sidebar, so its usable content frame is narrower than the source crop; the table therefore keeps its intentional desktop horizontal scroll rather than compressing controls.
- The common-information section preserves the existing Invoice form hierarchy while changing the business label to `收款方式`, showing `Paid by Bank`, and adding a visible prototype-data notice.
- The focused preview capture confirms that the eye action opens a large Invoice document with the current Description, amount, and Payment Information snapshot.

## Required fidelity surfaces

- Fonts and typography: passed; the existing Noto Sans SC hierarchy, compact table labels, helper copy, control weights, and Invoice document type are retained without clipping.
- Spacing and layout rhythm: passed; common information, summary metrics, row controls, status, preview, and the right-aligned footer follow the existing long-form rhythm. Mobile rows become single bordered panels with stable field groups.
- Colors and visual tokens: passed; neutral surfaces, coral focus, semantic row status colors, and black primary action styling match the existing COMETS Pay system.
- Image quality and asset fidelity: passed; no raster product asset was added. The preview control uses the existing Lucide `Eye` icon, and the Invoice preview is the shared document renderer rather than an approximation.
- Copy and content: passed; `收款方式`, `Payment Information`, `Paid by Bank`, the explicit fake-data notice, and the large-preview explanation all match their actual prototype behavior.

## Interaction and runtime checks

- Selecting project `燕云十六声` exposes search, select-all, and 16 project creators. All selected rows receive USD and a synthetic default Airwallex account.
- `Payment Information` is a native row-level select. Airwallex renders `Paid by Bank`; creators with additional synthetic accounts can switch to PayPal or another bank option by stable payout-account ID.
- Clicking the preview icon opens a large Invoice and displays `USD 5.00`, the current Description, and `Paid by Bank` without consuming a formal Invoice number.
- After one browser-local prototype Invoice was generated, clicking Camila Costa opened her creator profile and positioned the `Payment Information` section.
- At the responsive target, document `scrollWidth` equals `clientWidth` (`375px`); row fields, preview, and adjacent footer actions do not overlap.
- Browser console warnings/errors: none.
- Invoice-focused tests: `11/11` passed.
- Full test suite: `27` files and `156` tests passed.
- TypeScript check and `npm run build`: passed; the project has no separate `typecheck` script, and build runs `tsc` before Vite.

## Findings and comparison history

1. Earlier P0 verification blocker: the prior local tab had become an `ERR_CONNECTION_REFUSED` page, so no implementation screenshot existed.
   - Fix: restored the local-only Vite service, opened a fresh in-app browser tab, repeated the complete interaction, and captured desktop, preview, creator-profile, and responsive states.
2. Earlier P1 product mismatch: the restored 03:00 version still labeled the field as `收款账户` and separated the two final actions.
   - Fix: reinstated `Payment Information`, `Paid by Bank`, the explicit fake-data notice, row preview, creator-profile link, and the adjacent lower-right action group.
3. Post-fix combined comparison, browser interactions, responsive capture, console inspection, tests, and build found no actionable P0, P1, or P2 issue.

final result: passed

---

# Invoice Batch Separate Mode Cards Design QA

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-6ea04c64-1831-4a75-998f-b73e224a04df.png` plus the user's explicit requirement that the two cards remain side by side but become independent cards.
- Implementation URL: `http://127.0.0.1:5174/`.
- Desktop implementation: `app/design-qa-invoice-batch-mode-cards-desktop.png`.
- Responsive implementation: `app/design-qa-invoice-batch-mode-cards-mobile.png`.
- Side-by-side comparison: `app/design-qa-invoice-batch-mode-cards-comparison.png`.
- Source pixels: `1295 x 225`; focused implementation pixels: `820 x 215`; desktop CSS viewport: `1280 x 720`; responsive CSS viewport: `390 x 844`; device density: `1`.
- State: `统一 Description` selected, followed by a verified switch to `分别填写 Description` and back.

## Comparison evidence

- The combined comparison places the supplied connected segmented control beside the revised browser-rendered component.
- The revised control keeps two equal-width columns but removes the shared outer border and center divider. Each option now owns a complete border, `10px` radius, background, focus ring, and selected treatment, separated by a visible `12px` grid gap.
- A focused comparison is sufficient because the request is limited to this single control and all typography, copy, icons, and surrounding section spacing remain unchanged.

## Required fidelity surfaces

- Fonts and typography: passed; title, helper copy, font family, weight, size, and wrapping preserve the existing COMETS Pay form hierarchy.
- Spacing and layout rhythm: passed; both cards remain left/right, equal width, vertically aligned, and visibly independent on desktop and at `390px`.
- Colors and visual tokens: passed; selected coral border/background and neutral inactive card colors reuse the existing batch-form tokens.
- Image and icon fidelity: passed; no raster asset was required, and the existing Lucide file/check icons remain unchanged.
- Copy and content: passed; mode labels and descriptions are unchanged.

## Interaction and runtime checks

- Clicking `分别填写 Description` moves `aria-checked=true` and `is-selected` exclusively to the second card; switching back restores the first-card state.
- Desktop computed geometry shows two `373.08px` cards with independent four-sided borders, `10px` radii, and a visible inter-card gap.
- At `390px`, both cards remain side by side at `150.5px` each; long copy wraps within the card and document `scrollWidth` equals `clientWidth` (`375px`).
- Browser console warnings/errors after the final interaction: none.
- `npm run build`: passed, including TypeScript compilation.

## Findings and comparison history

1. Initial P1: the two modes were rendered as one connected segmented container, which visually contradicted the requested two-card selection model.
   - Fix: moved border, radius, and background ownership from the group onto each option and added an explicit grid gap.
2. Initial P2: the existing `760px` breakpoint stacked the options vertically.
   - Fix: kept the mode selector as a two-column grid at narrow widths and added controlled wrapping and check-icon positioning.
3. Post-fix desktop, responsive, pointer-state, geometry, overflow, console, and build checks found no actionable P0, P1, or P2 issue.

final result: passed

---

# 我的项目页面 Design QA

## Comparison Target

- Source visual truth:
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-7be68911-d9e6-4f20-a936-33bd76e13c7b.png` (指标卡)
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-2ec21155-0812-4317-bca5-73ac2bbe174b.png` (筛选器)
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-4a29f76b-4d97-462d-a74c-bc7481bd79cf.png` (状态竖线)
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-7d3635df-dbc9-4c50-8611-0bce99d66d81.png` (资源卡)
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-a14941f2-2f4b-4097-bfac-20599ec9356c.png` (达人空状态)
- Browser-rendered implementation:
  - `/tmp/codex-comets-my-projects-list-clean.jpg`
  - `/tmp/codex-comets-my-projects-form-clean.jpg`
  - `/tmp/codex-comets-my-projects-draft-detail-clean.jpg`
  - `/tmp/codex-comets-my-projects-detail.png`
- Comparison composites:
  - `/tmp/codex-comets-my-projects-list-comparison.png`
  - `/tmp/codex-comets-my-projects-detail-comparison.png`
- Browser viewport: `1265 x 712` CSS px, device scale factor 1.
- Implementation screenshot pixels: `1265 x 712`.
- Source pixels: indicators `1464 x 226`, filters `1413 x 520`, status `190 x 454`, resource cards `970 x 446`, creator empty state `982 x 201`.
- Density normalization: all inputs are 1x captures. Because the source images are component crops rather than full-page screenshots, comparisons use matching visible regions instead of stretching them to the full browser frame.
- State: admin demo account, current 20-record fixture set; list default state, filtered state, valid create form, draft detail, and submitted detail.

## Full-view Comparison Evidence

- List composition follows the reference hierarchy: heading/action, three horizontally aligned metrics, a dense filter surface, and the project table.
- The metrics intentionally show the current fixture values `7 / 3 / 20` rather than copying stale reference numbers.
- The filter panel wraps to two rows at the available content width, matching the reference grouping without horizontal overflow.
- Project detail keeps the existing product shell and uses the requested contract, Invoice, and payment-list resource card treatment.

## Focused Region Comparison Evidence

- Metrics: low-saturation peach, white, and lilac surfaces; label/value/supporting-copy hierarchy matches the target.
- Filters: labels sit above controls, amount inputs remain grouped under budget, result count remains visible, and all controls retain keyboard focus states.
- Status: labels remain the existing business status strings; only the leading vertical semantic color changes, with no enclosing border.
- Resource cards: icon, colored label/count, primary value, supporting copy, status line, and trailing action align with the reference.
- Create form: the old compact modal interaction is restored; creator selection is collapsible, selected creators are chips, and linked Invoice/contract data appears below.
- Images/assets: the references contain no photographic or illustrative assets. Existing COMETS Pay branding and the repository's Lucide icon system are preserved; no placeholder imagery or custom SVG/CSS illustration was introduced.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- Typography: existing Noto Sans SC stack, weights, line height, and wrapping remain consistent with the application; metric and compact-card type is not oversized.
- Spacing/layout: cards, filters, table, modal, and detail resources preserve the current system rhythm and do not overlap at the tested viewport.
- Colors/tokens: reference peach, lilac, blue, and orange accents are mapped to existing subdued tokens; state meaning is not color-only because text labels remain.
- Copy/content: headings and field labels match the requested business meaning. Dynamic values come from the current fixtures rather than copied screenshot values.
- Accessibility: filters have accessible names, the creator picker exposes expanded/selected states, disabled create state is explicit, and draft-only actions are removed from submitted records.

## Interaction Verification

- Project search reduced the list from 20 to the single matching `燕云十六声` record.
- Project/customer/PM/currency/budget/status filter logic is covered by unit tests.
- Selecting `原神-欧美KOC-6.7版本` surfaces all creators and puts the creator with one usable Invoice first.
- Selecting Ava Thompson automatically links `INV-260727-04-24` and enables `创建项目`; clicking it creates a draft and opens its detail.
- Draft detail shows `添加达人`; submitted detail does not expose that action.
- Submitted detail renders project media, created time, resource cards, and creator list.
- Browser console errors/warnings checked after the flow: none from the application.

## Comparison History

- Pass 1: source fragments and implementation captures were compared together at the same browser viewport. No P0/P1/P2 design mismatch was found.
- Intentional differences: metric numbers use current fixture data, and resource-card content reflects each selected record's actual contract/Invoice/payment-list counts.
- No visual fix iteration was required after the final clean-state capture.

## Follow-up Polish

- P3: a future backend version should replace browser-session creation timestamps and records with server-generated values and durable persistence.

final result: passed

---

# Design QA - “我的项目”资源管理与多 Invoice

## Comparison Target

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-3ed12d61-99b9-4e31-a411-e8be9e414536.png`.
- Intended implementation URL: `http://127.0.0.1:5174/`.
- Target state: project-detail summary rows plus the flat contract, Invoice, and payment-list management dialogs.
- Source pixels: `1512 x 494`.
- Browser-rendered implementation screenshot: unavailable.
- Intended desktop viewport: `1280 x 720`; intended responsive viewport: `390 x 844`; density normalization could not be performed without a browser capture.

## Available Evidence

- The local-only Vite server responds successfully at `127.0.0.1:5174`.
- The source visual was opened at original resolution and used to preserve the existing three-row resource-card hierarchy.
- Unit and source-structure tests verify flat resource dialogs, no creator-filter state/control, unavailable-contract reasons, multi-Invoice aggregation, stable-ID validation, permissions, and audit identifiers.
- `npm test -- --run`: 31 files and 195 tests passed.
- `npm run build`: TypeScript compilation and Vite production build passed.

## Blocker

- The Codex in-app Browser URL security policy rejected both opening and reloading `http://127.0.0.1:5174/`, including an existing user tab at that exact URL.
- Because no current browser-rendered implementation screenshot could be captured, full-view comparison, focused-region comparison, interaction checks, responsive overflow checks, and console inspection could not be completed.
- No alternate browser automation or raw CDP workaround was used.

## Findings

- Automated tests and build contain no functional blocker.
- Visual parity and responsive behavior remain unverified in-browser; this is a QA evidence blocker rather than a claimed UI defect.

final result: blocked

---

# Design QA - 达人收款账户三点编辑入口

## Reference and Environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-cb99db41-e561-42cd-86db-a16ad9de054e.png`.
- Browser-rendered desktop implementation: `/tmp/comets-payout-account-edit-menu-open.png`.
- Browser-rendered mobile implementation: `/tmp/comets-payout-account-edit-mobile.png`.
- Focused implementation crop: `/tmp/comets-payout-account-edit-menu-open-crop.jpg`.
- Side-by-side comparison: `/tmp/comets-payout-account-edit-menu-comparison.png`.
- Source pixels: `956 x 376`.
- Desktop CSS viewport override: `1534 x 900`; browser capture pixels: `1519 x 891`; device density: 1.
- Focused implementation crop: `1040 x 380`, normalized to `956 x 350` and padded to `956 x 376` for equal-size comparison.
- Mobile CSS viewport: `390 x 844`; state is the same account menu open on a new creator's default Airwallex draft account.

## Comparison Evidence

- The side-by-side comparison places the supplied source and browser-rendered implementation in the same image at equal `956 x 376` frames.
- Provider tabs, selected treatment, account-card size, default star, ellipsis trigger, status chip, divider, and three add-account actions retain the supplied layout and COMETS Pay palette.
- The supplied source shows the menu with only the disabled default-account row. The implementation intentionally adds `编辑账户` above that row because this is the requested recovered interaction.
- The focused component comparison is readable at native UI scale, so a second detail crop was not required.

## Required Fidelity Surfaces

- Fonts and typography: passed; the existing Noto Sans SC stack, compact weights, line heights, truncation, and small helper-copy hierarchy are unchanged.
- Spacing and layout rhythm: passed; provider tabs, card grid, 8px card radius, menu alignment, divider, and right-aligned add actions match the reference structure without overlap.
- Colors and visual tokens: passed; no palette changes were introduced, and selected, default, disabled, and focus states continue to use existing tokens.
- Image and icon fidelity: passed; this region has no raster assets. Existing Lucide `MoreHorizontal`, `Pencil`, and `Star` icons are used instead of custom artwork.
- Copy and content: passed; existing provider/account labels remain unchanged, with only the requested `编辑账户` action added.

## Interaction and Responsive Checks

- Clicking the selected card's ellipsis opens an accessible `menu` containing `编辑账户` and the existing default-account action.
- Clicking `编辑账户` closes the menu, keeps the selected account active, scrolls to its account form, and focuses `账户别名`.
- At `390 x 844`, the menu remains inside the viewport, all three provider tabs and add actions stack cleanly, and document horizontal overflow is `0`.
- Browser console errors after desktop and mobile flows: none.
- Full Vitest suite: 33 files and 209 tests passed.
- Production build: passed.

## Comparison History

1. Initial P1: the current three-dot menu exposed only `当前默认账户`, so the previously available account-level edit route was missing.
   - Fix: restored a native `编辑账户` menu action in the maintained React component and connected it to selected-account form focus.
2. Post-fix desktop and mobile verification found no remaining actionable P0, P1, or P2 visual or interaction issue.

final result: passed

---

# Design QA - 查看资料弹窗内容边距

## Reference and Environment

- Current issue reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-d22fa6f4-d6a1-4361-8797-7efe404273fb.png`.
- Spacing target reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-e01fa8aa-28cc-4036-8473-b684af1f9528.png`.
- Local implementation URL: `http://127.0.0.1:5173/`.
- Desktop evidence: `app/design-qa-request-resource-contract-spacing-desktop.png`, `app/design-qa-request-resource-modal-spacing-desktop.png`, `app/design-qa-request-resource-payment-spacing-desktop.png`.
- Mobile evidence: `app/design-qa-request-resource-modal-spacing-mobile.png` at `390 x 844`.

## Findings

- Contract, Invoice, and payment-list dialogs share the same maintained modal class and now use a 20px desktop content inset, matching the target dialog rhythm.
- Header and footer dimensions remain unchanged; only the scrollable body content is inset, so title and close controls retain their existing alignment.
- At 390px the existing responsive rule reduces the body inset to 12px. Summary panels, toolbars, payment fields, and footer controls remain within the viewport without visible overlap.
- No business behavior, resource permissions, or modal actions changed.

final result: passed

---

# Design QA - 付款达人卡片与字段边框

## Reference and Environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-f3d5dab7-3bc0-4a81-841d-86174a338073.png`.
- Source pixels: `1158 x 833`.
- Intended implementation URL: `http://127.0.0.1:5173/`.
- State: payment-list dialog with two creators, generated version, and locked payment fields.
- Implementation screenshot: unavailable.

## Implemented Scope

- Each creator payment row now uses a full bordered card constrained to the same parent width as the `全部付款明细` summary panel.
- Locked inputs and custom selects retain visible neutral borders and backgrounds instead of collapsing into borderless text.
- `删除清单` is replaced by `清空清单`; clearing removes current payment rows while preserving payment-list identity, generated history, and Invoice source records.
- The empty state explains that `生成 / 刷新清单` can rebuild payment rows from linked Invoices.

## Verification and Blocker

- Focused component and workflow tests passed; the full Vitest suite passed with 33 files and 217 tests.
- TypeScript and the production build passed; only the existing Vite chunk-size advisory remains.
- The in-app browser security policy blocked refreshing the local implementation URL after the code change. No alternate browser or lower-level workaround was used.
- Because no post-change browser-rendered screenshot could be captured, full-view comparison, focused comparison, responsive inspection, interaction verification, and console inspection remain blocked.

final result: blocked

---

# Design QA - Invoice 待签署提醒

## Reference and Environment

- Source detail: `app/qa/invoice-signature-reminder/source-detail.png` (`1482 x 653`).
- Source feedback modal: `app/qa/invoice-signature-reminder/source-feedback-modal.png` (`770 x 676`).
- Browser implementation: `app/qa/invoice-signature-reminder/implementation-detail-desktop.png` and `implementation-modal-desktop.png` (`1265 x 712`).
- Responsive implementation: `app/qa/invoice-signature-reminder/implementation-modal-390.png` (`375 x 812`) at a `390 x 844` CSS viewport.
- Combined evidence: `comparison-detail-source-left-implementation-right.png` and `comparison-modal-source-left-implementation-right.png`.
- Desktop CSS viewport: `1280 x 720`; device pixel ratio: `1`.
- State: media demo account, waiting-signature Invoice `INV-240717`, signature-reminder dialog open with the default editable message.

## Comparison Evidence

- The full-view comparison preserves the existing Invoice detail hierarchy and places the new secondary reminder action immediately beside the primary PDF download action.
- The focused modal comparison normalizes the source and implementation modal panels to `546 x 573`, with the source on the left and implementation on the right.
- The implementation intentionally replaces feedback-specific copy with signature-reminder copy and uses an enabled send action because the default reminder is prefilled; modal structure, density and visual hierarchy remain consistent with the source.

## Required Fidelity Surfaces

- Fonts and typography: passed; existing Noto Sans SC weights, line heights, field hierarchy and wrapping match the feedback-dialog pattern.
- Spacing and layout rhythm: passed; the 560px panel, 8px summary/channel surfaces, textarea proportions, dividers and footer controls align with the source rhythm.
- Colors and visual tokens: passed; existing neutral surfaces, purple communication icons, coral focus border and black primary action are reused.
- Image and icon fidelity: passed; no raster asset is required, and existing Lucide user, message, mail, information, send and close icons remain sharp and consistent.
- Copy and content: passed; recipient, Invoice, project, dual delivery channels and prototype-only boundary are explicit without implying a real notification service.

## Interaction and Responsive Checks

- The reminder entry is visible only for manageable waiting-signature records. Empty or whitespace-only content disables sending; the editable default stays within the 300-character limit.
- Two consecutive sends create two independent audit entries with masked email and simulated channel results while status remains `待签署` and signature metadata is unchanged.
- `Esc` closes the dialog, focus returns to the reminder trigger, and `Tab` / `Shift+Tab` remain trapped inside the dialog.
- At `390 x 844`, the panel, textarea, channel rows and footer actions remain inside the viewport with no horizontal overflow.
- Browser console warnings/errors: none.
- Full Vitest suite: 33 files and 227 tests passed.
- TypeScript production build: passed; only the existing Vite chunk-size advisory remains.

## Findings and Comparison History

1. Initial P2 accessibility finding: the shared modal did not respond to `Esc` or keep keyboard focus inside the dialog.
   - Fix: added focus trapping, `Esc` close behavior and focus restoration to the maintained shared Modal component; the reminder trigger also explicitly restores focus after close.
2. Post-fix desktop, focused-modal, responsive, repeat-send, audit-history, keyboard and console checks found no remaining actionable P0, P1 or P2 issue.

final result: passed

---

# Finance Review Workspace Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-df6276d5-9349-48d9-95c6-0d1db63b78b0.png`
- Source pixels: 1897 x 868 at the supplied density.
- Desktop implementation: `design-qa/finance-review-desktop-final.png`
- Desktop pixels / CSS viewport: 1628 x 895 capture from a 1643 x 903 CSS viewport at device pixel ratio 1. The in-app browser removes its own outer frame from the captured page.
- Mobile implementation: `design-qa/finance-review-mobile-invoice.png`, `design-qa/finance-review-mobile-payment.png`, and `design-qa/finance-review-mobile-approval.png`.
- Mobile pixels / CSS viewport: 375 x 812 capture from a 390 x 844 CSS viewport at device pixel ratio 1.
- Full comparison: `design-qa/finance-review-comparison-full.png`.
- Focused approval comparison: `design-qa/finance-review-comparison-approval.png`.
- State: finance user, payment workbench pending-review tab, first request, first Invoice, no manual decision recorded.

## Comparison

The supplied image is a right-side review drawer, while the approved implementation brief requires a full-screen three-column workspace. The comparison therefore treats the source as the visual-language reference and the written three-column layout as the structural source of truth.

- Fonts and typography: existing Noto Sans SC and the Invoice's serif document typography are preserved. UI weights, compact labels, status hierarchy, and zero letter spacing match the existing COMETS Pay system and remain readable at desktop and mobile sizes.
- Spacing and layout: the implementation retains the dimmed workbench background, white review surface, thin dividers, compact 8px-or-smaller framed regions, independent column scrolling, and fixed bottom actions. Desktop panes measure approximately 42 / 33 / 25 percent at 1440px with no workspace overflow.
- Colors and tokens: neutral white/gray surfaces, green completed states, orange current-review states, red error states, and restrained lilac avatars match the reference. No new gradients or decorative artwork were introduced.
- Image quality: the Invoice is rendered from the existing frozen document model rather than a placeholder. It is sharp at desktop size and scales to the mobile viewport without horizontal overflow.
- Copy and content: labels describe real request, Invoice, payment-list, and approval data. Payment information is intentionally moved to the center column; the right column is limited to the approval flow as requested.
- Icons: all visible actions and states use the existing Lucide icon library with consistent stroke weight and alignment.
- Accessibility and responsiveness: the topmost modal alone handles Escape and focus trapping; nested issue and return dialogs restore focus correctly. Mobile uses three semantic tabs, footer button text fits, and all pane widths remain within the viewport.

## Interaction Evidence

- Confirmed that saving an issue is disabled until a reason is entered.
- Confirmed Escape closes only the issue dialog and leaves the review workspace open.
- Confirmed issue reasons appear in the aggregated return dialog.
- Confirmed closing and reopening preserves the current browser-session decisions.
- Confirmed the final approval remains disabled after one of two pages is confirmed and enables only after both are confirmed.
- Confirmed successful approval closes the workspace, removes the request from the pending count, and shows the success toast.
- Confirmed a request with zero Invoices renders one blocking page, cannot be marked correct, and can be returned after recording a reason.
- Confirmed a fresh browser tab reports no console errors.

## Comparison History

1. Initial mobile capture showed the Invoice paper retaining a 640px minimum width, causing horizontal clipping at 390px. This was a P2 responsive issue.
2. Removed the mobile minimum width and reused the existing compact Invoice typography. The revised paper measures 323px inside a 347px client area, with equal client and scroll widths.
3. Rechecked Invoice, payment, and approval tabs. Payment pane client/scroll width is 362px, and every footer button has equal client and scroll width.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3: the reference drawer can display more approval nodes vertically because it dedicates the entire width to one column; the implementation intentionally gives that space to simultaneous Invoice and payment comparison.

final result: passed

---

# Design QA - Batch Invoice 卡片化布局

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-c419cefc-ea2f-45c9-8e63-b63696970529.png` (`1396 x 788`).
- Desktop implementation: `app/qa/invoice-batch-card-layout/implementation-desktop-final.png` (`1381 x 787`) from a `1396 x 796` CSS viewport at device pixel ratio 1.
- Focused desktop implementation: `app/qa/invoice-batch-card-layout/implementation-desktop-validation-fixed.png` (`1265 x 712`) from a `1280 x 720` CSS viewport at device pixel ratio 1.
- Mobile implementation: `app/qa/invoice-batch-card-layout/implementation-mobile-top.png` and `implementation-mobile-validation.png` (`375 x 812`) from a `390 x 844` CSS viewport at device pixel ratio 1.
- State: media demo account, first cooperation project selected, one eligible creator selected, shared Description entered, and one validation issue visible.
- Full-view comparison evidence: the source and final desktop capture were opened together in one visual comparison input at effectively matching desktop dimensions.
- Focused evidence was required because the four validation metrics are below the source image crop; the focused desktop and mobile captures show their final layout and dynamic values.

## Required Fidelity Surfaces

- Fonts and typography: passed. Existing Noto Sans SC hierarchy, weights, zero letter spacing, control labels, and compact operations density are unchanged.
- Spacing and layout rhythm: passed. The four workflow areas now use individual 8px-radius cards separated by 14px on desktop and 10px on mobile. The metric cards use a four-column desktop grid and a two-by-two mobile grid.
- Colors and visual tokens: passed. Existing white/gray surfaces and coral interaction color remain dominant; restrained green, amber, and coral metric states improve scanning without changing business meaning.
- Image and icon fidelity: passed. No new raster asset is required; existing Lucide section and control icons remain consistent with the source interface.
- Copy and content: passed. The requested labels are exactly `已选择达人`, `可生成invoice`, `需处理条数`, and `批次总金额`.

## Interaction And Responsive Checks

- Project selection, select-all creator selection, shared Description entry, dynamic validation counts, and the existing table state were exercised in the browser.
- At desktop size, all four main cards remain within the 820px content column and all four metric cards remain equal width.
- At `390 x 844`, main cards measure 343px, metric cards measure 152px in a two-column grid, and document horizontal overflow is `0`.
- Browser console warnings/errors after desktop and mobile flows: none.
- Full Vitest suite: 70 files and 433 tests passed.
- TypeScript production build: passed; only the existing Vite chunk-size advisory remains.

## Comparison History

1. Initial P2: after changing the outer form to CSS Grid, the table's desktop minimum width expanded the validation card to about 1603px and shifted the metric grid outside the viewport.
2. Fix: constrained the form grid track with `minmax(0, 1fr)` and each workflow card with `min-width: 0`, keeping wide-table overflow inside its existing table wrapper.
3. Post-fix desktop, selected-data, mobile, interaction, overflow, and console checks found no remaining actionable P0, P1, or P2 issue.

final result: passed
