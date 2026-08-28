# Contract Parsing Review Design QA

## Evidence

- Source visual truth:
  `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-3f5f8991-7655-44d6-951a-cf70cb8834c9.png`
- Awaiting confirmation:
  `qa/contract-review-awaiting-confirmation.png`
- Field editing:
  `qa/contract-review-field-editing.png`
- Confirmed and available for request:
  `qa/contract-review-confirmed.png`
- Side-by-side comparison:
  `qa/contract-review-comparison.png`

## Normalization

- Source image: 1566 x 794 px.
- Awaiting-confirmation capture: 1551 x 786 px at device scale factor 1.
- The comparison normalizes the implementation capture to 1566 x 794 px and
  places it beside the unchanged source image.
- Focused editing and confirmed captures: 1265 x 712 px at device scale factor
  1, using the in-app browser's default viewport.

## State

The contract detail is shown after local DOCX parsing. The source layout,
document preview, summary cards, tabs, and field rows remain in place. The
implementation adds field-level edit controls, a compact review-status banner,
and a top-right confirmation action.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Typography: all new controls inherit the existing COMETS Pay font stack,
  weights, compact sizes, and zero letter spacing. Input text matches the
  surrounding field-value hierarchy.
- Spacing and layout: pencil controls occupy a stable 28 px column and do not
  move field labels or source text. The three top-right actions fit on desktop;
  the confirmation action spans the mobile action row.
- Colors and tokens: editing uses the existing restrained purple used by the
  contract inspector. Confirmation uses the system's established success green,
  while download remains the existing black primary action.
- Image and icon quality: edit and confirmation controls use the exact Lucide
  Pencil and CircleCheckBig assets. No handcrafted or placeholder icons are
  used.
- Copy and content: parsing, awaiting confirmation, field editing, confirmed,
  and request-ready states use concise Chinese labels consistent with the
  current module.

## Focused Comparison

The full-view comparison verifies that the existing contract detail layout is
preserved. The focused editing capture verifies the user-marked inspector area:
fields remain read-only until their pencil icon is clicked, then only that row
shows an input with Cancel and Save actions.

## Interaction Verification

- A newly uploaded DOCX entered the parsing workflow and produced detected
  values and source labels.
- The inspector contained zero inputs before an edit icon was clicked.
- Clicking the Publisher pencil displayed one editor; Cancel restored the
  read-only row without changing the value.
- Saving `Léa Martin Studio` updated only Publisher and marked it as an
  unconfirmed manual edit.
- Payment and Invoice fields were parsed and received their own edit buttons.
- The confirmation button changed the contract to `已确认`, the readiness card
  to `可用于请款`, and the list row to `可用于请款`.
- Editing and saving after confirmation revoked readiness and returned the
  contract to `待确认`, requiring another unified confirmation.
- The contract amount card updated from the parsed Project Total Fees value.
- Browser console warning/error logs were empty after the complete flow.

## Comparison History

1. The first verification pass exposed repeated DOM writes that caused a
   mutation loop during upload.
2. Status and banner updates were made idempotent, removing the loop.
3. A subsequent pass found the review banner could move above the section
   heading after a React tab render.
4. The enhancer now restores the heading-first order only when needed.
5. Post-fix screenshots and DOM snapshots show stable layout, working editing,
   correct confirmation gating, and list-state synchronization.

## Follow-up Polish

- No P3 issue is required for this scoped workflow.

## Five-Step Contract Upload

### Evidence

- Project and project-creator linkage:
  `qa/contract-upload-project-creator.png`
- Extracted fields confirmed before saving:
  `qa/contract-upload-five-step.png`
- Saved contract detail with upload associations:
  `qa/contract-upload-linked-detail.png`

### Verification

- The upload action now opens the ordered flow: project, project creator, file,
  extracted-field confirmation, and save.
- The creator select remains disabled until a project is selected.
- Projects with only a creator count and no linked creator profiles show a
  blocking explanation instead of displaying guessed creators.
- After a creator profile is linked from the project detail, only that
  project's linked creators appear in the upload select.
- DOCX parsing populated Advertiser, IO number, platform/channel, dates, fees,
  and payment terms before save.
- Project and Publisher use the selected system relationship as the
  authoritative value and carry into the saved contract detail.
- PDF and Word files both reach the original contract detail flow. Existing
  preview, original-file download, field editing, and final payment-readiness
  confirmation remain available.
- Browser warning/error logs were empty after Word and PDF end-to-end tests.

## Searchable Contract Project Selector

### Evidence

- Searchable selector with draft projects:
  `qa/contract-upload-project-search.png`
- Reference and implementation comparison:
  `qa/contract-upload-project-search-comparison.png`

### Verification

- The project field accepts project-name or project-number searches and opens
  the matching dropdown while typing.
- Dropdown rows display only the project name, customer, and status; project
  numbers remain searchable without being shown in the option text.
- Draft projects created in “我的项目” are persisted locally and appear with
  a restrained draft badge in the upload selector.
- Mouse selection and Arrow Up/Down plus Enter selection both work.
- Changing the project still resets the creator, file, extracted fields, and
  save readiness. The creator selector remains limited to profiles linked to
  the selected project.
- Browser warning/error logs were empty after the interaction checks.

## Contract Payment Readiness States

### Evidence

- Uploaded contract awaiting review:
  `qa/contract-readiness-pending.png`
- Confirmed contract ready for payment projects:
  `qa/contract-readiness-confirmed.png`
- Confirmed-state reference and implementation comparison:
  `qa/contract-readiness-comparison.png`

### Verification

- A newly uploaded contract displays `等待解析中` in the payment-readiness
  metric and in the contract list through both parsing and manual-review phases.
- The pending list state follows the existing attention treatment with an
  orange 6px circular marker and orange status text.
- The readiness state changes only after the user clicks `确认解析内容` and all
  required fields are complete.
- After confirmation, both the detail metric and contract-list status display
  `可用于付款项目`.
- The confirmed list state follows the existing ready treatment with a green
  6px circular marker and green status text.
- Contract metadata continues to show its separate processing phase
  (`待确认` or `已确认`) without being conflated with payment readiness.
- Browser warning/error logs were empty after the complete upload, review,
  confirmation, and list-return flow.

final result: passed

---

# 合作项目付款明细展示验收

验收日期：2026-08-27

## Evidence

- Desktop implementation: `design-qa-request-payment-details.png`.
- Mobile implementation: `design-qa-request-payment-details-390.png`.
- State: 管理员查看合作项目 `REQ-202607-000001` 的付款明细。

## Findings

- 达人列使用系统头像组件，并同时展示 account name、handle 与社媒平台；缺少稳定达人 ID 的旧数据才按名称回退匹配。
- 付款渠道复用系统 `PaymentProviderBadge`，Airwallex、PayPal 与 PayMax 保持系统统一图标样式。
- 付款方式读取付款账户冻结快照中的 `transferMethod`，按数据展示 `Local`、`Swift` 或 `PayPal`。
- 单笔付款状态通过 `paymentListItem.invoiceId → GeneratedInvoiceRecord.sourcePayoutId → Payout.id` 关联，只显示未付款、付款处理中、已付款、付款失败四种状态。
- 390px 视口没有页面级横向溢出；表格在卡片内部独立横向滚动，达人信息保持可读。
- 浏览器控制台没有新增 warning 或 error。

## Automated Verification

- 定向 Vitest：`RequestProjectDetailPage.test.ts` 与 `RequestProjectDetailPage.workflow.test.tsx` 共 12 项通过。
- 完整 Vitest：97 个测试文件、669 项测试通过。
- TypeScript 与 Vite 生产构建通过。
- `git diff --check` 通过。

final result: passed

---

# Returned Payment Progressive Detail Design QA

## Evidence

- Desktop overview: `design-qa-assets/payment-returned-progressive-overview-1280x720.png`.
- Desktop expanded detail: `design-qa-assets/payment-returned-progressive-detail-1280x720.png`.
- Mobile overview: `design-qa-assets/payment-returned-progressive-overview-390x844.png`.
- Mobile expanded detail: `design-qa-assets/payment-returned-progressive-detail-390x844.png`.
- State: a pending-payment request returned by finance with the reason `收款账户名与 Invoice 不一致，请修正付款资料后重新提交。`.

## Findings

- Returned payment details now use the same progressive right-drawer to full-screen transition as payment execution.
- The returned overview leads with the rejection card before project metadata, so `审核未通过` and the complete return reason are visible in the initial desktop and mobile viewport.
- The overview remains read-only and contains only `关闭` and `查看付款清单`; execution and return actions are absent.
- Expanded detail retains the existing two-board layout. Every rejected payout is labeled `审核未通过` and contains `具体退回原因`, while unaffected payouts retain the approved treatment when the return is scoped.
- At 390 px, the overview and expanded state both measure 390 px document width and scroll width, with no horizontal overflow or clipped action text.

## Interaction Verification

- Created a returned request through the existing finance payment return flow, then opened it from the workbench `已退回` tab using `查看详情`.
- Verified the overview reason, expanded the payment list, checked all 15 rejected records, and returned to the overview without losing the reason.
- Confirmed the expanded read-only detail contains no execution action.
- Browser console contains no warnings or errors. Full Vitest passes 74 files and 474 tests; TypeScript/Vite build and `git diff --check` pass.

final result: passed

---

# Payment Execution Direct Action Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-3dd28990-3769-4c7f-a50d-c290b97e5a1c.png`.
- Desktop implementation: `design-qa-assets/payment-execution-direct-action-1280x720.png` at 1280 x 720 CSS px.
- Mobile implementation: `design-qa-assets/payment-execution-direct-action-390x844.png` at 390 x 844 CSS px.
- State: payment workbench, pending-payment project overview open before entering the payment list.

## Findings

- The project overview now exposes both paths in the fixed footer: optional `查看付款清单` and primary `执行打款`.
- The helper copy makes the choice explicit without implying that opening the payment list is required.
- Desktop keeps all three actions on one aligned row. At 390 px, `关闭` and `查看付款清单` share the first row while `执行打款` occupies the full second row.
- Mobile measurements confirm all buttons are 44 px high; the primary action is 370 px wide within the 390 px viewport, with no overlap, clipping, or horizontal overflow.
- The existing validation gate is shared by both execution entries, so an invalid payout disables direct execution rather than bypassing payment readiness checks.

## Interaction Verification

- Opened `REQ-202607-000006` from the pending-payment list and confirmed that the initial project overview contains both actions.
- Clicked `执行打款` directly from the overview without opening the payment list. The drawer closed, the request moved out of pending payment, and its status became `付款处理中` under the paid/progress tab.
- The existing `查看付款清单` path remains available and unchanged.
- Browser console contains no warnings or errors. Full Vitest passes 74 files and 473 tests; TypeScript/Vite build and `git diff --check` pass.

final result: passed

---

# Payment Execution Progressive Drawer Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-633620e7-c820-4222-b3c9-827848630c9c.png` (1902 x 871 px).
- Desktop overview: `design-qa-assets/payment-execution-progressive-overview-1280x720.png`.
- Desktop payment list: `design-qa-assets/payment-execution-progressive-list-1280x720.png`.
- Mobile overview: `design-qa-assets/payment-execution-progressive-overview-390x844.png`.
- Mobile payment list: `design-qa-assets/payment-execution-progressive-list-390x844.png`.
- Combined comparison: `design-qa-assets/payment-execution-progressive-comparison.png`.
- Viewports and density: 1280 x 720 and 390 x 844 CSS px at device scale factor 1. The 1902 x 870 source was aspect-fitted to 1280 x 720 without cropping for structural comparison.
- State: payment workbench, pending-payment project, project overview drawer and expanded payment-list stages.

## Findings

- No actionable P0, P1, or P2 visual or interaction issue remains.
- Fonts and typography: the existing Noto Sans SC hierarchy is preserved. Drawer labels, project values, table fields and footer actions remain readable without negative letter spacing, unintended wrapping or dynamic layout shifts.
- Spacing and layout rhythm: the first stage is a measured 520 px right drawer with independently scrollable project, approval and resource content. The second stage expands to the established 7:3 two-card layout; the main card regains focus without a visible outline artifact.
- Colors and visual tokens: existing neutral surfaces, purple section icons, green validation states and orange waiting-payment states remain consistent with the workbench. No new gradient or unrelated palette was introduced.
- Image and icon quality: the operational screen requires no raster product imagery. Existing Lucide icons are reused and no custom SVG, CSS illustration or placeholder asset was added.
- Copy and content: the project overview precedes approval and resources; payment execution and return actions are intentionally absent until the user opens the payment list. The payment-list stage uses `返回项目`, `退回媒介修改` and `执行打款`.
- Responsive behavior: below 900 px, the overview becomes a full-screen single panel. At 390 x 844, the footer actions remain visible, the project data stacks without horizontal overflow, and the expanded payment-list stage retains the existing responsive card/table presentation.
- Accessibility: the two stages use an `aria-live` announcement, programmatic focus transfer, a non-dismissable backdrop, Escape handling through the shared Modal, and reduced-motion fallbacks.

## Interaction Verification

- Clicking a waiting-payment row action opens the overview stage with `请款项目信息`, `当前审批流`, then `关联资料`; the nine-column table is not mounted.
- `查看付款清单` expands the same dialog to full viewport and renders all 15 payout rows.
- Expanding all approval nodes, returning to the project overview and entering again preserves the approval state.
- `执行打款` closes the dialog and updates the row from `待打款` to `付款处理中`, with the action changing to `查看进度`.
- Browser console produced 0 warnings and 0 errors during desktop and mobile flow checks.

## Comparison History

1. The supplied reference represented the existing expanded execution layout. The implementation preserves that layout as the second stage and inserts the requested project-first drawer before it.
2. The first browser pass showed a focus outline around the expanded main card. The payment-list focus target now suppresses only the programmatic outline while retaining control focus styles.
3. Post-fix desktop and 390 px captures show fixed footers, visible actions, independent drawer scrolling and no text overlap or clipped persistent controls.

final result: passed

---

# Finance Review Linked Resources Card Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-ac6becd8-aa22-4a57-9f68-36dc265cedb8.png` (402 x 174 px).
- Desktop implementation: `artifacts/finance-review-linked-resources/desktop-review-resources.png`, captured at a 1440 x 900 CSS viewport.
- Focused implementation: `artifacts/finance-review-linked-resources/desktop-resource-card.jpg` (255 x 215 px, including the narrow approval-pane card frame).
- Mobile implementation: `artifacts/finance-review-linked-resources/mobile-resource-card.jpg`, captured at a 390 x 844 CSS viewport.
- Contract and Invoice dialogs: `artifacts/finance-review-linked-resources/desktop-contract-modal.jpg`, `desktop-invoice-modal.jpg`, `mobile-contract-modal.jpg`, and `mobile-invoice-modal.jpg`.
- Same-input visual comparison: `artifacts/finance-review-linked-resources/reference-implementation-comparison.jpg`.

## State And Normalization

- Signed in as the finance demo role and opened `REQ-202607-000001` from `付款工作台 -> 待审核`.
- The right approval pane was scrolled to the project-level resources card below the real approval flow.
- The focused comparison preserves both source images at their native pixel density. The implementation is intentionally narrower because it occupies the 20% approval pane; layout and hierarchy were compared rather than stretching either image to a false common width.

## Findings

- No actionable P0, P1, or P2 visual issue remains.
- Fonts and typography: the card uses the existing product font stack and compact approval-pane type scale. Labels, counts, actions, and status remain readable without clipping or overlapping at both verified widths.
- Spacing and layout rhythm: the implementation preserves the reference's heading followed by three separate bordered rows, consistent icon alignment, compact row height, and right-aligned actions. The narrow pane uses responsive wrapping rather than shrinking text beyond the existing review scale.
- Colors and visual tokens: neutral borders and surfaces match the current finance workspace; the passed account result uses the existing restrained green semantic treatment. Hover and keyboard focus use the workspace's purple accent.
- Image and icon fidelity: the source contains only standard interface icons. The implementation uses the project's existing Lucide icon set and introduces no raster placeholder, custom SVG, or decorative asset.
- Copy and content: contract and Invoice names are replaced with real project-level counts (`合同 · 17 份`, `Invoice · 17 份`), while the third row reports the project account-validation result.

## Interaction Verification

- `查看合同` opens a project-scoped list with all 17 linked contracts, creator, IO, amount, readiness, and the existing per-record `查看` action.
- `查看 Invoice` opens a project-scoped list with all 17 linked Invoice records, creator, amount, covered contract count, validation state, and the existing per-record `查看` action.
- At 390 x 844, the resources card remains fully visible in the `项目与审批` tab. Both dialogs contain 17 records and report equal client and scroll widths, with no horizontal overflow.
- The page and document root both report 390 px client and scroll widths. Browser console contained 0 warnings and 0 errors during desktop and mobile verification.

## Comparison History

1. The reference and first focused implementation were placed in one comparison image. The implementation preserved the reference hierarchy and interaction language while adapting to the narrower approval pane.
2. Desktop and mobile dialog checks confirmed the real project counts and complete list content; no P0/P1/P2 visual correction was required after capture.

final result: passed

---

# Transaction Paid And Processing Filter Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-f8831f52-3197-4b6d-8a8e-f7729bd8e5f5.png` at 1864 x 822 px.
- Desktop implementation: `artifacts/transaction-status-filter-qa/paid-tab-desktop-1864x822.png`, captured from an 1864 x 822 CSS viewport at device scale factor 1; the in-app browser content capture is 1849 x 815 px.
- Mobile implementation: `artifacts/transaction-status-filter-qa/paid-tab-mobile-390x844.png` and `artifacts/transaction-status-filter-qa/paid-tab-mobile-table-390x844.png`, captured from a 390 x 844 CSS viewport at device scale factor 1; each in-app browser content capture is 375 x 812 px.
- State: signed in as the local administrator demo account, opened `交易记录`, selected `已付款`, and left the status selector at `全部付款状态` so both paid and processing rows are visible.
- Normalization: the source and desktop implementation use the same requested CSS viewport and density. The browser's reserved scrollbar/content chrome accounts for the implementation bitmap being 15 px narrower and 7 px shorter; comparison used the visible app content rather than browser chrome.

## Findings

- No actionable P0, P1, or P2 issue remains.
- The first desktop pass placed the export button on a second toolbar row after the status selector was added. Search, date, status, and channel control widths were tightened while preserving their 45 px rendered height; the revised capture keeps all six controls on one row.
- The `已付款` tab defaults to 68 records: 42 `已付款` and 26 `付款处理中`. Its selector exposes exactly `全部付款状态`, `已付款`, and `付款处理中`.
- The independent `时间` column is absent. `付款人 / 付款时间` remains as the seventh visible data column before `操作`.
- The full page has no horizontal overflow at 390 px. The intentionally wide transaction table remains scrollable inside its own 317 px container.

## Required Fidelity Surfaces

- Fonts and typography: existing Noto Sans SC and monospace amount/Invoice treatments are preserved; the new selector uses the same size, weight, line height, and zero letter spacing as the channel selector.
- Spacing and layout rhythm: tabs, 45 px filter controls, table header, row height, card radii, and section spacing remain aligned with the reference. Desktop filters stay on one row; mobile controls stack at a stable full width.
- Colors and visual tokens: the selector reuses the existing white surface, gray border, dark text, chevron, focus, and selected-option tokens. Processing and paid status colors remain semantic and text-labeled.
- Image quality and asset fidelity: the target contains no new photographic or illustrative asset. Existing logo and Lucide interface icons remain unchanged and sharp; no custom SVG, CSS drawing, or placeholder visual was introduced.
- Copy and content: all three tabs remain `全部`, `已付款`, and `付款失败`. Filter labels and table headings match the requested payment terminology.

## Full-View And Focused Comparison

- The source and implementation were opened together at original resolution in one comparison input. Overview cards, tabs, toolbar, table density, provider badges, status marks, amounts, and row actions remain visually consistent.
- A separate crop was unnecessary because both 1864 x 822 originals render the toolbar and table header legibly. The same full-resolution comparison makes the intentional additions and removals directly visible: one status selector added, one time column removed, and processing rows admitted.

## Interaction Verification

- `全部` shows 72 payment records; `已付款` shows 68 paid-or-processing records; `付款失败` shows 4 failed records.
- Selecting `已付款` returns 42 records and every visible row has that status. Selecting `付款处理中` returns 26 records and every visible row has that status.
- The status selector appears only in the `已付款` tab and resets to `全部付款状态` when the user changes tabs.
- Browser console contained 0 warnings and 0 errors during desktop and mobile verification.
- Full Vitest passed 69 files and 432 tests. TypeScript/Vite production build and `git diff --check` passed.

## Comparison History

1. The first rendered comparison found a P2 desktop toolbar wrap caused by the new selector.
2. Filter widths were reduced using the existing responsive CSS, without changing control height, copy, or behavior.
3. The second desktop capture and both 390 px captures found no remaining actionable P0/P1/P2 issue.

final result: passed

# Transaction Record Spacing And Icon Removal Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-57a3eef1-4988-463c-9ea4-8b22ed9c762b.png` (1920 x 962 px, including browser chrome).
- Desktop implementation: `artifacts/transaction-records-spacing-desktop-1920x965.jpg` (1905 x 957 px content capture from a 1920 x 965 CSS viewport at device scale factor 1).
- Mobile implementation: `artifacts/transaction-records-spacing-mobile-390x844.jpg` (375 x 812 px content capture from a 390 x 844 CSS viewport at device scale factor 1).
- Focused source crop: `artifacts/transaction-records-spacing-reference-focus.png` (720 x 260 px).
- Focused implementation crop: `artifacts/transaction-records-spacing-desktop-focus.jpg` (720 x 260 px).
- State: signed in as the local admin demo account, with the `交易记录` page and `全部` tab active.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Fonts and typography: the existing COMETS Pay type hierarchy, weights, line heights, and tab labels remain unchanged; removing the icons does not alter the two-line data hierarchy.
- Spacing and layout rhythm: each provider row now uses three content-width columns with one shared gap. Browser measurements show equal label-to-rate and rate-to-count gaps for Airwallex, PayPal, and PayMax: about 9.2 px in the desktop capture and 8 px at 390 px.
- Colors and visual tokens: the lilac success-rate card, semantic channel/status treatments, borders, and table colors are unchanged.
- Image and icon quality: Invoice, amount, time, and payer/payment-time cells contain zero icons. Existing creator avatars, channel badges, and the `查看详情` action icon remain intact because they are outside the requested removal scope.
- Copy and content: the three final-state tabs retain `全部`, `已付款`, and `付款失败` while their numeric badges are removed. Dynamic totals differ from the supplied screenshot because the current fixture contains newer completed transactions.
- Responsive behavior: desktop and 390 px views show no page-level horizontal overflow. The wide transaction table remains intentionally contained in its own horizontal scroller.

## Comparison And Verification

- The source and desktop implementation were opened together for a full-view comparison; the page structure, card color, filter layout, and transaction table remain consistent with the existing design.
- The 720 x 260 source and implementation card crops were opened together for focused comparison. The requested channel metrics are visibly tighter, and both adjacent gaps use the same grid spacing.
- DOM verification found zero tab count badges and zero field icons in the four specified columns.
- The three tabs remain functional, transaction filters and table content remain present, and the browser console contained zero application warnings or errors.
- This scoped pass required no follow-up P0/P1/P2 visual correction after the first browser capture.

final result: passed

---

# My Projects Request Progress Restoration Design QA

## Evidence

- Source reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-75eba917-a81e-4e81-bd69-64ff5b12b5fe.png` (1452 x 797 px).
- Desktop implementation: `artifacts/my-project-request-progress-qa/progress-desktop-1284x904.png` (1269 x 891 px browser content capture).
- Mobile implementation: `artifacts/my-project-request-progress-qa/progress-mobile-card-390x844.png` (375 x 812 px browser content capture).
- Direct comparison: `artifacts/my-project-request-progress-qa/reference-vs-implementation.png`.

## State And Rules

- The restored sequence is `项目创建` -> `补充合同` -> `关联 Invoice` -> `提交审核` -> `渠道打款`.
- Contracts remain optional under the current product rule. A project without a contract shows `合同为选填，当前未关联 / 已跳过` and does not block Invoice, approval, or payment.
- Draft readiness, live approval round and node, approval return, finance approval, waiting payment, processing, partial payment failure recovery, and all-paid completion are derived from current request, approval, Invoice, and payout data.
- Channel payment completes only when the request lifecycle is complete or every payout linked to the current request is paid.

## Findings

- No actionable P0, P1, or P2 issue remains.
- The new request detail branch now reuses the established two-column project-detail layout, sticky progress card, node icons, connector, typography, spacing, and status colors from the supplied reference.
- Return and payment-failure panels remain full width above the detail layout, so exception context is not squeezed into the main column.
- The current fixture correctly renders the first three stages complete, `第 1 轮 · 财务审批中` current, and channel payment pending.
- At 1920 and 2560 px the information and progress areas remain side by side. At 1024 and 390 px they stack to one column without text clipping, overlap, or page-level horizontal overflow.

## Interaction And Technical Verification

- Browser inspection confirmed five visible stage labels, one current approval node, no horizontal overflow, and no console warnings or errors.
- Focused tests cover incomplete and complete drafts, finance approval, waiting and processing payments, all-paid completion, approval return, and failure recovery.
- Full Vitest passed 66 files and 415 tests. TypeScript/Vite production build and `git diff --check` passed.

final result: passed

---

# Transaction Detail Information And Resource Views Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-549728f0-663a-4e7c-942f-fd326ebddfe6.png`.
- Desktop implementation: `artifacts/transaction-detail-revision-desktop.png`.
- Mobile implementation: `artifacts/transaction-detail-revision-mobile.png`.
- Contract dialog: `artifacts/transaction-detail-contract-dialog.png`.
- Payment-list dialog: `artifacts/transaction-detail-payment-list-dialog.png`.
- Mobile payment-list dialog: `artifacts/transaction-detail-payment-list-dialog-mobile.png`.

## Dimensions And State

- Desktop verification used a 1518 x 767 CSS viewport. The browser content capture was 1503 x 759 px after browser chrome and scrollbar exclusion.
- Mobile verification used a 390 x 844 CSS viewport. The browser content capture was 375 x 812 px after browser chrome exclusion.
- Verified the transaction detail page, contract dialog, Invoice dialog, payment-list dialog, dialog close behavior, Escape behavior, focus trapping, and focus return to the originating `查看` button.

## Findings

- No actionable P0, P1, or P2 issue remains.
- The source-marked transaction title block is removed while a screen-reader-only page heading preserves navigation semantics and receives focus after entry.
- Payment information no longer exposes the transaction record ID. It shows the payment batch number and request reason alongside payment time, payer, account, method, fee bearer, and transaction reference.
- Contract, Invoice, and payment-list cards use the existing compact resource-card treatment and add consistent Lucide Eye actions without changing the page's visual hierarchy.
- The payment-list card retains its red emphasis, and its detail dialog uses the same restrained emphasis for the payment snapshot.
- Desktop and mobile layouts keep labels, long identifiers, and action text inside their containers with no visible overlap or horizontal overflow.

## Interaction And Technical Verification

- Contract, Invoice, and payment-list `查看` buttons open read-only dialogs populated from the selected transaction snapshot.
- Closing a dialog restores focus to its originating action; Escape and the shared modal focus trap continue to work.
- Full Vitest passed 60 files and 374/374 tests. The TypeScript/Vite production build and final diff check passed.

final result: passed

---

# Transaction Records Selection And Detail Design QA

## Evidence

- Transaction-list source: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-1f7431f8-b38e-428f-ae2a-7f80493611d1.png` (1833 x 789 px).
- Detail-layout source: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-d2036841-1349-4044-afe7-91465e71bf35.png` (1413 x 807 px).
- Creator-card source: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-2d404939-75de-406e-a4cb-11d3a2942cd5.png` (452 x 760 px).
- Desktop transaction list: `artifacts/transaction-records-list-desktop.png` (1842 x 785 px).
- Desktop detail top and linked resources: `artifacts/transaction-detail-top-desktop.png`, `artifacts/transaction-detail-payment-list-desktop.png`.
- Mobile transaction list and detail: `artifacts/transaction-records-top-mobile.png`, `artifacts/transaction-detail-top-mobile.png`, `artifacts/transaction-detail-resources-mobile.png` (375 x 812 px browser content captures).

## Findings

- No actionable P0, P1, or P2 issue remains.
- The table includes the requested checkbox, creator/payment project, Invoice, provider, status, amount, transaction time, payer/payment time, and action columns. It remains contained in the existing horizontal table scroller on narrow screens.
- The detail view follows the existing COMETS Pay page hierarchy and the supplied detail reference: compact header, creator identity card, three transaction summary cards, structured information grid, business associations, and linked document rows.
- The creator identity uses the compact tinted card treatment from the source, with avatar, name, project, handle, and visible status. Text wraps or truncates within stable bounds at desktop and 390 px.
- The payment-list row is the only resource given the requested red background, border, icon, and leading rule. Contract and Invoice rows keep neutral and blue-tinted resource treatments.
- Historical transactions without a stable payment-batch snapshot explicitly show `未记录` or `未关联`; no payer, batch, request, contract, Invoice, or payment-list data is fabricated.

## Interaction And Technical Verification

- Selecting two rows changed the disabled export control to enabled `导出已选（2）`; completing the export returned the control to its ready state with no error message. The workbook template test verifies typed selected-row output.
- Selecting all 36 batch-filtered records and moving to page 2 preserved the `导出已选（36）` state, confirming selection is stable across pagination.
- Searching `BAT-20260805` matched batch-linked transactions and displayed the batch payer and payment time. Opening one record exposed its project, request, batch, contract, Invoice, and payment-list snapshots.
- Returning from detail restored keyboard focus to the originating `查看详情` button.
- The reference and implementation captures were opened together in one comparison pass at comparable desktop and mobile states.
- Browser console contained 0 warnings and 0 errors.
- Full Vitest passed 60 files and 374 tests. TypeScript and the Vite production build also passed.

final result: passed

---

# Payment Workbench Returned Reason Detail Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-6a0d8703-09ff-4152-b739-babdfdfc85b8.png` (1907 x 824 px).
- Desktop comparison: `artifacts/payment-returned-reason-qa/returned-reason-1907x824.png`.
- Compact desktop / iPad landscape: `artifacts/payment-returned-reason-qa/returned-reason-1024x768.png`.
- iPad portrait: `artifacts/payment-returned-reason-qa/returned-reason-768x1024.png`.
- Narrow layout: `artifacts/payment-returned-reason-qa/returned-reason-390x844.png` and `returned-reason-390x844-details.png`.
- State: signed in as `finance.demo`, returned `REQ-202607-000006` from the payment execution workspace, opened the `已退回` tab, and selected `查看原因`.

## Findings

- No actionable P0, P1, or P2 visual issue remains.
- The returned detail preserves the reference's full-screen split workspace, project metrics, payee summaries, fixed footer, and read-only approval column.
- The project information section adds one restrained danger summary with the failure reason, return stage, actor, approval round, and timestamp.
- Every affected payee card replaces the success note with an explicit `请款信息已退回` state and its applicable failure reason.
- The footer exposes only `返回列表`; payment execution and repeat-return actions are absent in this state.
- At 1024 px the approval column reports equal client and scroll widths after the long-reason wrapping fix. At 390 px the project subtitle truncates before the status badge, the workspace has no horizontal overflow, and both failure surfaces remain reachable in the shared vertical scroll area.

## Interaction And Technical Verification

- Browser flow verified: `待打款 -> 退回媒介修改 -> 已退回 -> 查看原因`.
- Returned workspace component tests: 3/3 passed.
- Complete Vitest run: 59 files and 371 tests passed.
- TypeScript and production Vite build: passed.
- Source and implementation were opened in the same visual comparison pass at 1907 x 824.

final result: passed

---

# Finance Review Return Gate And Responsive Type Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-85498f35-9591-4ab4-940b-5ac0ff5573bb.png`
- Desktop implementation: `artifacts/finance-review-qa/finance-review-return-gate-1857x791.png`
- Narrow implementation: `artifacts/finance-review-qa/finance-review-return-gate-390x844.png`
- Source and desktop implementation are both 1857 x 791 px at device scale factor 1, so no density normalization was required.
- Narrow implementation uses a 390 x 844 CSS viewport at device scale factor 1.

## State

Signed in as `finance.demo`, opened `付款工作台`, selected the first pending finance request, recorded `INV-301164-R01` as incorrect, and left the other 16 Invoice/payment-list pairs unreviewed. This matches the requested return-gate state.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Fonts and typography: the workspace keeps Noto Sans SC and zero letter spacing. Five bounded type variables step at 1600, 1180, 900, and 480 px breakpoints, enlarging the hierarchy on wide screens and reducing it to a 9.5 px minimum on narrow screens without viewport-proportional reflow.
- Spacing and layout rhythm: the new guidance occupies the marked top-right gap without changing the 4:4:2 review-board proportions. At 390 px it moves to a full-width second row; the current state, segmented tabs, Invoice canvas, and 198 px action footer remain unobstructed.
- Colors and visual tokens: the reminder uses the existing restrained purple information palette, then switches to the established orange return or green approval semantic state. Disabled return uses the product's existing disabled control treatment.
- Image and asset fidelity: no new raster asset is required for this operational UI. Status affordances use the repository's existing Lucide icons and the Invoice remains the real frozen document snapshot.
- Copy and content: the reminder states the remaining count and explains that errors are returned once, after all Invoice/payment-list pairs are reviewed. Completed-error and completed-success states use distinct action-oriented copy.

## Full-View Comparison

The source explicitly marks the empty space before the counters. The implementation fills that exact region with one compact reminder while preserving project identity on the left, counters and current state on the right, the three review boards, and the fixed action footer. The implementation's gray disabled return button intentionally differs from the source's red enabled button because this request requires early return to be impossible.

## Focused Region Comparison

- Top guidance: at 1857 x 791 the reminder stays on one line between project identity and counters; no text, icon, counter, or status overlaps.
- Footer gate: after one incorrect decision and 16 unreviewed pages, `退回媒介修改` remains visible but disabled. After all 17 pages are decided, it becomes enabled and opens one aggregate dialog containing the Invoice number and recorded reason.
- Narrow layout: at 390 x 844 the guidance wraps within its own row, the four footer actions remain visible, and the modal reports no horizontal overflow.

## Interaction Verification

- First incorrect page: reminder shows 16 remaining records and return stays disabled.
- All pages decided: reminder changes to `全部核对已完成，可一次性退回 1 份有误记录。` and return becomes enabled.
- Aggregate dialog: displays `INV-301164-R01` and `收款账户与 Invoice 不一致`; confirmation is enabled only in this completed state.
- A fresh browser-rendered session reported 0 console warnings and 0 console errors.
- Targeted Vitest passed 21/21 assertions and TypeScript/Vite production build passed.
- Full Vitest passed 362/363 assertions; the one unrelated failure is the pre-existing TransactionsPage provider-badge markup assertion in the user's concurrent worktree changes.

## Comparison History

1. The source identified an unused top-right region and an early-return action that needed clearer process guidance.
2. The implementation added the dynamic guidance, bounded responsive type variables, a disabled early-return state, and domain plus App-level submission guards.
3. Equal-size desktop evidence and 390 px evidence showed no overlap, clipping, or hierarchy regression; no post-capture P0/P1/P2 correction was required.

## Implementation Checklist

- [x] Dynamic remaining/completed reminder in the marked region.
- [x] Return blocked until every review page has a valid decision.
- [x] Aggregate return dialog and final callback protected by the same rule.
- [x] Bounded responsive typography for wide, desktop, tablet, and narrow viewports.
- [x] Desktop and 390 px browser interaction verification.

## Follow-up Polish

- No P3 refinement is required for this scoped change.

final result: passed

---

# Finance Review Drawer And Invoice Controls Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-daf09230-eb1e-4616-9059-107b9c7905b2.png`.
- Desktop implementation: `artifacts/finance-review-drawer-zoom-final-1846x841.png`.
- Mobile implementation: `artifacts/finance-review-drawer-zoom-390x844.png`.
- Combined full-view and focused comparison: `artifacts/finance-review-drawer-zoom-comparison.png`.

## Dimensions And State

- Source and desktop implementation: 1846 x 841 px, 1846 x 841 CSS viewport, device scale factor 1; no density normalization was required.
- Mobile implementation: 390 x 844 px, 390 x 844 CSS viewport, device scale factor 1.
- State: signed in as the finance demo role, `付款工作台 > 待审核`, with `REQ-202607-000001` open at Invoice 1 / 17, approval drawer expanded, and Invoice zoom reset to 100%.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Fonts and typography: the existing Noto Sans SC hierarchy is unchanged. `上一页` and `下一页` use the same compact action weight as the review footer, with zero letter spacing and no truncation at desktop or 390 px.
- Spacing and layout rhythm: the approval handle sits inside the top-right area of the `项目与审批` header. Invoice edge controls are 48 x 48 px circles centered vertically. Footer paging starts at the lower-left without overlapping the review count or approval actions.
- Colors and visual tokens: the new controls reuse the existing white, cool-gray, and restrained purple finance-review palette. Hover and focus states retain the established high-contrast purple treatment.
- Image and asset fidelity: no new raster or decorative assets were required. Drawer, zoom, and page controls use the repository's existing Lucide icon set.
- Copy and content: the removed top pager is replaced by explicit `上一页` / `下一页` footer actions. Invoice, payment-list, account-snapshot, and page-count content remain synchronized.

## Full-View Comparison

- The implementation preserves the source's 4:4:2 board composition and moves the drawer handle to the exact requested top-right area of the approval board.
- The source's highlighted top paging group is intentionally removed. The implementation places the same synchronized navigation at the lower-left and exposes literal previous/next labels as requested.
- Invoice navigation remains visible at both vertical edges, now using circular buttons; the added compact zoom group fits in the Invoice header without reducing document width or overlapping the correspondence badge.

## Focused Region Comparison

- Drawer region: the control is fully contained by the approval header, remains visible when the drawer collapses, and returns to the same top-right position when expanded.
- Invoice region: both edge buttons are true circles. Zooming from 100% to 110% increases the rendered page width from about 679 px to 747 px and expands the Invoice canvas scroll width from 723 px to 791 px.
- Footer region: `上一页`, `1 / 17`, and `下一页` occupy the first footer group at the lower-left. The same controls remain reachable at 390 px with 44 px minimum height.

## Interaction Verification

- Zoom-out, percentage reset, and zoom-in controls: passed.
- `Control` / `Command` modifier-wheel and trackpad pinch handling uses a non-passive wheel listener, clamps zoom to 60%-220%, and preserves the pointer anchor inside the Invoice canvas.
- `Control` / `Command` plus, minus, and zero keyboard zoom: passed; 100% to 110% changed the document and scroll geometry without changing the browser viewport.
- Drawer collapse and expand: passed; collapsed columns measured 923 px / 923 px / 0 px at 1846 px.
- Bottom pager synchronization: passed; Invoice and payment-list comparison both moved from `INV-301164-R01` to `INV-301164-R03` at 2 / 17.
- Desktop and 390 px layouts had no page-level horizontal overflow. Browser console contained 0 errors.

## Comparison History

1. The first browser pass exposed a P1 zoom behavior issue: the percentage changed, but percentage-based document sizing kept the visible Invoice width fixed.
2. The Invoice stage was changed to reserve scaled width and height while transforming the document from its top-left origin.
3. The final comparison confirms real document enlargement, scrollable overflow, top-right drawer placement, circular edge navigation, lower-left labeled paging, and a responsive 390 px layout.

## Follow-up Polish

- No P3 refinement is required for this scoped interaction.

final result: passed

---

# Transaction Paid Total Card Design QA

## Evidence

- Transaction reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-193cfc59-10c8-418b-a9ec-b13e9974d006.png` (1483 x 718 px).
- Payment-workbench card reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-e9ee8868-4f34-4329-b71b-e283f21f2d44.png` (1544 x 484 px).
- Intended implementation viewport: 1483 x 718 CSS px at device scale factor 1, followed by a 390 px responsive pass.
- Implementation screenshot: unavailable because the in-app browser's local-URL policy rejected the running `127.0.0.1` preview.

## State

The target is the signed-in `交易记录` page with the complete paid-payout fixture set. The left overview card must use USD as the primary amount, place EUR, GBP, HKD, and SGD below the divider, preserve the all-currency paid count, and expose the same currency-detail action as the payment workbench.

## Findings

- [P0] Browser-rendered implementation evidence is unavailable. The local server returns HTTP 200, 54 test files / 345 tests pass, and the production build succeeds, but visual comparison, responsive rendering, interaction behavior, and console state cannot pass without a rendered implementation capture.
- The transaction card and both payment-workbench cards now render through one shared component, so icon sizing, amount hierarchy, divider, secondary-currency rows, detail action, and modal remain structurally identical.
- USD is guaranteed as the primary row even when no USD payout exists. Secondary currencies use the established USD, EUR, GBP, HKD, SGD ordering and retain their per-currency counts.
- The transaction summary label continues to use the total number of paid transactions rather than the USD-only count.

## Required Fidelity Surfaces

- Fonts and typography: the shared component retains the existing Noto Sans SC stack, 25 px primary amount, compact secondary values, tabular numbers, and zero added letter spacing.
- Spacing and layout rhythm: the existing two-column summary surface, 48 px icon slot, 18 px desktop gap, divider, two-column secondary grid, and single-column narrow layout are reused without new CSS.
- Colors and visual tokens: the transaction card keeps its peach surface while adopting the payment-workbench content hierarchy; no new color token or effect was introduced.
- Image and icon fidelity: WalletCards, ChevronRight, and Diamond come from the existing Lucide icon library. Currency flags use the existing repository SVG assets.
- Copy and content: `已付款总额` remains the transaction label; USD is primary and EUR, GBP, HKD, SGD are secondary.

## Focused Comparison

Blocked. Both source images were opened and measured, but the browser policy prevented the matching implementation capture and combined comparison input.

## Interaction Verification

- Static rendering verifies USD appears before the secondary-currency group, all four secondary currencies render below it, the total paid count is retained, and the detail action is labeled for assistive technology.
- Existing workbench tests continue to verify both card tones, currency ordering, detail actions, and the zero-USD fallback.
- Browser checks for the detail modal, 1483 px composition, 390 px reflow, overflow, and console errors remain blocked by local-URL access policy.

## Comparison History

1. The two supplied source images were opened and measured.
2. The payment-workbench card was extracted into a shared component and reused by `交易记录` with its original paid-total label and total count.
3. Focused tests and the production build passed.
4. The local preview remained healthy, but browser capture was rejected before the implementation state could be opened.

## Implementation Checklist

- Open `http://127.0.0.1:5173/`, sign in, and navigate to `交易记录`.
- Capture the page at 1483 x 718 and 390 px wide.
- Open and close `已付款币种详情`, then check keyboard focus and console output.
- Compare the reference and implementation images together and resolve any remaining P0/P1/P2 difference.

final result: blocked

---

# Finance Review Footer Action Placement Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-51ce1051-1dcb-443d-a203-26afc4d33614.png` (1891 x 851 px).
- Intended implementation URL: `http://127.0.0.1:5173/`.
- Intended states: three-board finance validation at desktop width and the existing segmented validation view at 390 px.
- Implementation screenshot: unavailable because every currently open in-app browser tab is at the account login screen.

## Findings

- Browser-rendered evidence is blocked by authentication, so typography, exact spacing, visible alignment, color fidelity, icons, copy, and responsive rendering cannot be signed off from a same-state comparison.
- The validation-only top return row has been removed. `返回项目概览` now belongs to the final-action group beside `通过财务审核`.
- Previous/next navigation, `记录有误`, `确认本页无误`, and the review-count summary now form one centered page-level action group.
- Desktop uses equal flexible left and right tracks around the center group, so the group is centered against the full footer rather than offset by the width of the final actions. At 1280 px and below, the groups split into rows; at 900 px and below, page-level and final actions use full-width touch layouts.

## Interaction Verification

- Focused tests verify DOM ordering, action ownership, full-footer centering, and removal of the old top return row.
- Button callbacks, disabled states, aggregate return gating, final approval gating, and review-session preservation are unchanged.
- Browser clicking, visual overflow checks, and console inspection remain blocked by the unauthenticated local state.

## Comparison History

1. The supplied screenshot was opened at native resolution and the marked source and destination regions were identified.
2. The implementation was opened in the in-app browser, but all local tabs were at the login screen and could not reproduce the requested three-board state.
3. No implementation capture was used because a login-screen image would not be valid comparison evidence.

final result: blocked

---

# Finance Review Approval Scroll And Account Routing QA

## Evidence

- Right-board reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-13867e34-14f3-4a1b-8a4a-5aa7577f9407.png`
- Account-warning reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-43ed51a4-0347-4392-8d0e-4d30b410042d.png`
- Browser state: signed in as `finance.demo`, opened `REQ-202607-000001`, and verified the first PayPal account warning at the desktop viewport and 390 x 844.

## Findings

- No actionable P0, P1, or P2 issue remains.
- The right board now contributes its full intrinsic content height to one independently scrolling viewport. It measures 661 px high with 1,336 px of content in the tested desktop view.
- Scrolling reaches the final `渠道付款` approval node; its bottom edge is 13 px above the right board's lower edge, so no approval content remains clipped behind the fixed footer.
- The warning summary identifies `Alex Ruiz`, recipient account `alexbuilds`, Invoice `INV-301164-02`, and the exact unsupported PayPal API reason.
- `去核对` switches from page 1 to page 2, synchronizes the Invoice and payment-list content, scrolls the matching account card into view, and moves keyboard focus to that card.
- At 390 x 844, the warning control retains a 66 x 30 px stable target, the review workspace stays within the 390 px viewport, and the fixed approval footer does not overlap the account content.

## Interaction Verification

- Right-board wheel scrolling: passed; `scrollTop` reached the 675 px maximum.
- Right-board focus semantics: passed; the scroll viewport is labeled `项目与审批详情` and is keyboard focusable.
- Problem-account routing: passed; the active element after navigation is the stable Alex Ruiz account-card ID.
- Responsive overflow: passed; document width equals the 390 px viewport.
- Console: 0 warnings and 0 errors during the verified flow.

## Comparison History

1. The first pass reproduced the reported clipping: the outer right board was scrollable, but implicit Grid rows compressed both inner sections and their `overflow: hidden` styling clipped 374 px and 749 px of content into two 225 px rows.
2. The approval board was changed to max-content implicit rows, preserving the existing cards while allowing their complete height to participate in the parent scroll range.
3. The final pass reached the last approval node and confirmed the account-warning route on desktop and the non-overlapping segmented layout at 390 px.

final result: passed

---

# Finance Review Field Scope Design QA

## Evidence

- Source field reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-6ad2afab-f92d-4db7-a17f-3ebf64007c9a.png` (1873 x 883 px).
- Source account reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-c54ad13e-4d68-4931-9a13-71a21039b2d8.png` (1908 x 880 px).
- Desktop field capture: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-qa/finance-review-fields-1911x814.png` (1911 x 814 CSS px, device scale factor 1).
- Desktop account capture: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-qa/finance-review-account-1911x814.png` (1911 x 814 CSS px, device scale factor 1).
- Mobile payment capture: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-qa/finance-review-fields-390x844.png` (390 x 844 CSS px, device scale factor 1).
- State: signed in as the finance demo user, opened `REQ-202607-000001`, selected the payment-list board, and inspected the first Invoice page.

## Comparison

The two source images and three browser-rendered captures were opened together in one comparison input. The first desktop capture verifies the scoped comparison table; the second verifies the account notice and recipient name; the mobile capture verifies the same content in the segmented layout.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- The finance workspace comparison starts at `Real Name` and ends at `交易附言`, matching the selected source region. Invoice identifiers, stable IDs, amount/channel/method metadata, account version, and fingerprint rows are absent from normal paired pages.
- The account section explicitly states that the fields are prototype display data and that concrete fields require the Airwallex API.
- `收款账户` now displays the recipient account name (`Mina Kato`) instead of a masked account-number summary.
- The comparison table and current-account detail both display `付款原因` as `影音服务`.
- Exceptional missing or duplicate records retain their blocking association row so the review screen never hides a structural error.

## Required Fidelity Surfaces

- Fonts and typography: the existing Noto Sans SC stack, compact weights, line heights, and zero custom letter spacing are unchanged.
- Spacing and layout rhythm: the original three-column proportions, row density, independent scrolling, fixed footer, and 390 px segmented layout are preserved.
- Colors and tokens: existing neutral, green match, orange manual-review, and purple focus tokens are unchanged.
- Image and icon fidelity: the existing Invoice renderer and Lucide icon system are preserved; no new raster asset, placeholder, CSS art, or handcrafted SVG was introduced.
- Copy and content: all 10 selected fields, the Airwallex prototype notice, unmasked account name, and `影音服务` reason are visible and consistent.

## Interaction Verification

- Desktop 1911 x 814: passed; only the selected 10 comparison rows are present and the account section remains reachable by independent scrolling.
- Mobile 390 x 844: passed; the payment-list tab, horizontal comparison-table scroll, account notice, and fixed actions remain reachable without overlap.
- Data consistency: passed; the first current page exposes three rendered `影音服务` values across comparison and detail content, and the recipient account value is `Mina Kato`.
- Console: 0 errors during the verified flow.
- Automated verification: 50 Vitest files / 325 tests passed; TypeScript and Vite production build passed.

## Comparison History

1. The source comparison exposed metadata rows above `Real Name` that were outside the selected review scope, a masked account summary, and content-service descriptions used as payment reasons.
2. The finance-workspace view now filters normal paired pages to the selected 10 rows, while the shared request-detail payment-list view keeps its complete field set.
3. The final desktop and mobile captures show the scoped rows, account API notice, recipient name, and `影音服务` without clipping or overlap.

final result: passed

---

# Request Payment List Read-Only Design QA

## Evidence

- Source visual truth:
  `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-6b45bb77-df33-48f5-9455-bc964c53d0ec.png`
- Existing design reference: the shared payment list browser in
  `app/src/pages/ProjectDetailPage.tsx`, matching the supplied list/detail screenshot.
- Implementation screenshot: automated capture is blocked because browser control
  policy rejects the local `http://127.0.0.1:5173/` URL. The page remains available
  for manual review in the in-app browser.

## Normalization

- Source image: 1074 x 636 px.
- Intended browser QA viewport: 1284 x 904 CSS px at device scale factor 1,
  matching the annotated page context before normalized comparison.
- Implementation dimensions and density: unavailable to automated browser capture
  because of the local URL policy restriction.

## State

The target state is the request-project detail payment-list modal for
`REQ-202607-000001`, opened in view-only approval mode. It keeps the same payment-row
hierarchy and visual tokens as `我的项目`, replaces editable controls with compact
approval fields, and adds account validation plus fixed-template Excel export.

## Findings

- [P0] Browser-rendered implementation evidence is unavailable.
  The local app is reachable and the production build passes, but browser control
  policy blocks local-page inspection. Visual fidelity, responsive behavior,
  interaction behavior, and console state cannot be passed without rendered evidence.
- The request modal reads the real request-linked `PaymentListRecord[]` state and
  uses the existing project payment-row shell, modal, buttons, status treatment,
  breakpoints, and Lucide icon system.
- Approval content is read-only. The modal exposes only account completeness
  validation, Excel export, and close actions; it contains no generate, edit,
  delete, clear, row removal, or refresh controls.
- Airwallex validation uses schema plus validate-only proxy requests and renders
  passed, invalid, unsupported-channel, and proxy-unavailable reminders inline.
- Export calls the same `exportAirwallexPaymentListWorkbook` implementation and
  exact 21-column template used by `我的项目`, with submitted-list export enabled
  only for the approval entry point.
- Image assets: the target contains standard interface icons only; the
  implementation uses the repository's existing Lucide icon system and adds no
  raster, placeholder, CSS-art, or handcrafted SVG assets.

## Focused Comparison

Blocked. The source image was opened, but the browser-control policy rejects the
local implementation URL and therefore prevents same-state screenshot comparison.

## Interaction Verification

- Automated source checks confirm the request viewer contains no add, edit,
  delete, generate, refresh, or clear action.
- Focused tests cover real payment-list mapping, read-only controls, API validation,
  unsupported and unavailable API states, and submitted-list export through the
  unchanged workbook template.
- Browser checks for close behavior, overflow, and console errors remain blocked
  by local URL access policy.

## Comparison History

1. The source image and existing `我的项目` payment-list structure were
   inspected.
2. The request viewer now uses the same payment-row hierarchy and shared visual
   tokens as the supplied `我的项目` reference, populated from stable request and
   payment-list IDs.
3. Editable form fields were replaced with approval-focused read-only values;
   API validation and the shared Excel export were added as the only work actions.
4. Local browser capture was attempted, but browser control rejected the local URL.

## Implementation Checklist

- Manually open `http://127.0.0.1:5173/` and sign in.
- Open `请款项目` -> `REQ-202607-000001` -> `查看清单`.
- Check desktop and narrow-screen modal states, close behavior, and page overflow.
- Confirm only `校验账户完整性`, `导出 Excel`, and `关闭` are available.
- Confirm the local static prototype reports the Airwallex proxy as unavailable;
  do not treat that warning as a successful provider validation.
- Compare source and implementation together, address any P0/P1/P2 mismatch,
  and update this section to `final result: passed` after rendered evidence exists.

final result: blocked

---

# Full-Screen Finance Review Workspace Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-11e9fad5-08f4-4217-a9d6-8584a8cba692.png`
- Source dimensions: 1043 x 220 px at the supplied image density.
- Desktop implementation: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-workspace-desktop-fixed.png`
- Desktop viewport and implementation dimensions: 1643 x 903 CSS px, device scale factor 1, 1643 x 903 PNG.
- Mobile account implementation: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-workspace-mobile-account.png`
- Mobile viewport and implementation dimensions: 390 x 844 CSS px, device scale factor 1, 390 x 844 PNG.
- State: signed in as `finance.demo`, opened the first pending request, selected the payment pane on mobile, and scrolled to the complete account-payment section.

## Comparison Scope

The source is an isolated 1043 x 220 payment-field crop rather than a complete finance-review screen. Exact full-screen column proportions therefore come from the requested three-column behavior and the established COMETS Pay review workspace. The source and both rendered implementation screenshots were opened together in one visual comparison input; focused judgment is limited to the payment-field hierarchy, read-only field treatment, spacing rhythm, labels, and values visible in the source.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- The desktop workspace occupies the complete 1643 x 903 viewport. Its three independently scrolling boards measure approximately 628 / 653 / 360 px and retain the existing Invoice-first hierarchy.
- The middle payment form preserves the source's quiet gray read-only surfaces, visible labels, compact grouping, and amount emphasis. It reflows from the source's wide two-row composition to the narrower center board without truncation.
- The complete account-payment section exposes Real Name, Account Name, Account Number, Beneficiary Bank Name, Beneficiary Bank Address, Swift Code, and optional IBAN. Match state uses both icon and text; mismatches use the same non-color-only treatment.
- The 390 px segmented layout has no horizontal overflow. Payment content scrolls independently above the fixed action footer, and the complete account number remains readable without masking.

## Required Fidelity Surfaces

- Fonts and typography: existing Noto Sans SC and system Latin fallbacks are preserved; labels, values, amounts, and status copy use the existing compact review hierarchy with zero custom letter spacing.
- Spacing and layout rhythm: the payment form follows the source's tight 8-12 px rhythm, 6 px field radii, stable grid tracks, and full-width description row. The desktop boards and mobile footer do not overlap.
- Colors and tokens: the implementation retains the current neutral surfaces, purple focus treatment, green match state, and orange review state instead of introducing a new palette.
- Image and icon fidelity: the Invoice is rendered by the existing document component and all controls/status markers use the existing Lucide icon family; no placeholder or drawn substitute was introduced.
- Copy and content: all source payment fields are present, with the additional requested complete account fields and explicit `关键字段一致 / 关键字段不一致` status.

## Interaction Verification

- Right-top close button: passed; 44 x 44 px target.
- Escape close: passed.
- Focus restoration: passed; focus returns to the originating `审核` button.
- Desktop independent scrolling: passed for Invoice, payment details, and approval timeline.
- Mobile tabs and account-detail scrolling: passed at 390 x 844.
- Final approval blocking: covered by finance-review domain tests for missing or mismatched complete account snapshots.
- Console: 0 warnings and 0 errors during the verified flow.

## Comparison History

1. First desktop pass found a P1 clipping issue: CSS Grid compressed the payment card and comparison block into equal-height rows, hiding the account-payment section inside an `overflow: hidden` card.
2. The payment column was changed to max-content rows with its own vertical scrolling, and background-page scrolling was locked while the full-screen review is open.
3. Second desktop capture shows the full account section directly below the payment form, a true 1643 x 903 overlay, and no viewport-width loss. The 390 px focused capture confirms every requested account field remains reachable without horizontal overflow.

## Follow-Up Polish

- P3: the isolated source is wider than the implementation's center board, so its amount/reason row can remain on one line while the implementation intentionally wraps into two compact rows.

final result: passed

---

# Payment-List Comparison Finance Review Design QA

## Evidence

- Reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-f9258078-ee69-4a99-b192-f10ca512cb87.png`
- Reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-c781a91b-0670-4e2a-8713-804a45ffa348.png`
- Reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-e792981f-2ed6-4de6-a1d1-5f726a8256c7.png`
- 1911 x 814 implementation: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-qa/finance-review-1911x814.png`
- 1440 x 900 implementation: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-qa/finance-review-1440x900.png`
- 390 x 844 payment implementation: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-qa/finance-review-390x844-payment.png`
- 390 x 844 project implementation: `/Users/aria/Documents/支付系统管理端/artifacts/finance-review-qa/finance-review-390x844-project.png`
- All three references and the rendered implementation captures were inspected together in one comparison input.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- The full-screen overlay retains the requested Invoice / payment-list comparison / project-and-approval hierarchy with independently scrolling boards and a fixed action footer.
- At 1911 x 814, the measured board widths are approximately 725 / 725 / 458 px, matching the requested 38% / 38% / 24% ratio. At 1440 x 900 they measure approximately 546 / 546 / 345 px.
- The middle board reuses the request-detail payment-list review content: validation and export controls, project summary, four-column comparison table, and the complete current creator account snapshot remain synchronized to one page index.
- The right board preserves the reference's compact request metrics and project metadata above the real approval timeline.
- At 390 px, the three boards become Invoice / payment list / project-and-approval tabs. The document has no horizontal overflow, the comparison table owns its horizontal scroll, and the fixed footer remains fully operable.

## Interaction Verification

- Page synchronization: passed; page 2 resolves to the same Invoice, creator, payment-list item, account snapshot, and `2 / 18` pager in both left and middle boards.
- Account validation: passed for complete local snapshots, API failures, and the unsupported PayPal API state without mutating payment data.
- Current-list export: passed for Airwallex and PayPal using provider-specific Excel templates.
- Required issue reason: passed; save remains disabled while the reason is empty.
- Review session: passed; one confirmed page remains `1 / 18` after closing and reopening.
- Close and focus restore: passed; the top-right close returns focus to the originating `审核` button.
- Approval guard: passed; final approval remains disabled until all pages are confirmed and the automatic comparison has no mismatches.
- Clean-load console: 0 warnings and 0 errors.

## Comparison History

1. The first rendered pass exposed a P1 data-scope issue: account validation summarized all 237 system payment rows instead of the current request's 18 rows. The workspace now filters by stable payment-list references from the current finance review pages.
2. Cross-channel export exposed a P1 functional issue: a PayPal page attempted to use the Airwallex workbook. A provider-specific PayPal workbook was added and the current page now selects the correct exporter.
3. The final desktop and mobile captures show the corrected 18-row scope, synchronized pagination, stable board dimensions, no page overflow, and no overlapping controls.

final result: passed

---

# Returned Payment Request Correction Design QA

## Evidence

- Desktop viewport: 1280 x 720 in the in-app browser.
- Mobile viewport: 390 x 844 in the in-app browser.
- Flow: a finance-stage request was returned from the payment workbench with a required page-level reason, then opened from `我的项目` as the administrator demo user.
- Verified request: `REQ-202607-000010` with a finance return reason tied to `INV-260727-10-01`.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Returned requests stay visible in `我的项目`; the list shows a compact warning banner, `已退回` status, payment-workbench source, reason summary, and `处理退回` action.
- The project detail shows the full reason, return stage, actor and role, time, and approval round before the normal request content.
- Request content and payment-list correction entry points remain separate and reuse the existing edit form and resource manager.
- The resubmit section lists missing payment-plan fields and keeps the final action disabled until content and resource validation both pass.
- At 390 px, the return banner, heading actions, reason, metadata, and correction buttons wrap without page-level horizontal overflow; the measured page width and scroll width are equal.

## Interaction Verification

- Payment-workbench return: passed; the project moved from `待审核` to `已退回`.
- My Projects visibility: passed; the returned request remained in the list with its finance reason.
- Detail reason and metadata: passed.
- `修改请款内容`: passed; the existing edit dialog opened with `保存修改` available.
- Payment-list correction routing: passed; `检查付款清单` scrolls to the existing resource manager.
- Resubmit validation: passed; missing expected payment time or request reason is reported before submission.
- Approval resume rule: covered by unit test; a finance return creates round 2 at `PENDING_FINANCE` after resubmission.

final result: passed

---

# Circular Multi-Select Controls Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-f6aa6027-816a-4db9-a733-5ec5fa5b1a44.png`.
- Source pixels: 1517 x 594 at the provided density.
- Intended implementation viewport: 1517 x 594, desktop, selected contract-list state.
- Implementation screenshot: unavailable. The in-app browser rejected `http://127.0.0.1:5173/` under its local URL security policy, so no browser-rendered capture could be produced.
- Implementation service check: HTTP 200; this is not a substitute for visual evidence.

## Findings

- [P1] Browser-rendered comparison is unavailable.
  Location: all native checkboxes and custom multi-select indicators.
  Evidence: the reference image is available, but there is no implementation screenshot to place beside it at the same viewport and state.
  Impact: roundness, pink-purple color fidelity, spacing, focus treatment, and selected-state consistency cannot be accepted from source code and build output alone.
  Fix: capture the contract list with selected rows in an allowed in-app browser session, then compare it with the source at matching dimensions.

## Required Fidelity Surfaces

- Fonts and typography: unchanged by this task; browser comparison blocked.
- Spacing and layout rhythm: control dimensions remain page-specific; browser comparison blocked.
- Colors and visual tokens: implemented with shared light pink-purple selection tokens; visual sampling against the source is blocked.
- Image quality and asset fidelity: no new image assets were introduced; existing Lucide selection icons are retained.
- Copy and content: unchanged by this task.

## Interaction Verification

- Native checked, unchecked, indeterminate, disabled, hover, and keyboard-focus states are implemented in CSS.
- Custom searchable filters, creator pickers, Invoice/contract pickers, and batch creator indicators use the same circular pink-purple treatment.
- Automated tests and production build pass, but browser interaction and console inspection are blocked by the local URL policy.

## Comparison History

1. The source image was opened and measured at 1517 x 594.
2. The local implementation returned HTTP 200.
3. The existing in-app browser tab was claimed and reloaded once; the browser URL policy rejected the local address. No alternate browser, raw CDP, or Playwright workaround was attempted.

## Implementation Checklist

- Capture the selected contract-list state when the local URL is permitted.
- Compare the full table and a focused checkbox region against the source image.
- Check desktop and narrow-screen control alignment, then update this result.

final result: blocked

---

# Payment Execution Workspace Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-48007313-5582-4cc0-af56-6a8aae7c664a.png`
- Desktop implementation: `artifacts/payment-execution-workspace-desktop.png`
- Narrow implementation, project section: `artifacts/payment-execution-workspace-390x844.png`
- Narrow implementation, approval section: `artifacts/payment-execution-workspace-390x844-timeline.png`

## Dimensions And Normalization

- Source capture: 1671 x 960 px. It includes browser chrome and several overlapping prototype panels, so it is used as qualitative region and information-hierarchy truth rather than a pixel-for-pixel viewport target.
- Desktop implementation: 1284 x 905 px at the in-app browser's default 1284 px CSS viewport and device scale factor 1.
- Narrow implementation: 390 x 844 px at a 390 x 844 CSS viewport and device scale factor 1.
- The full-view comparison keeps both captures at their native density. Region comparison maps the source's project summary, creator payment cards, approval rail, and bottom payment action to the corresponding implementation regions without stretching either image.

## State

Signed in as `finance.demo`, opened `付款工作台`, selected `待打款`, and opened `REQ-202607-000006`. The request is in round 1 after finance approval, with 15 creator payouts waiting for Airwallex execution.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Fonts and typography: the workspace inherits Noto Sans SC, preserves zero letter spacing, and uses the product's compact 9-16 px hierarchy. Long project, actor, Invoice, and payment references wrap or truncate without moving fixed controls.
- Spacing and layout rhythm: desktop uses a stable wide-left/narrow-right grid, 8 px or smaller radii, 1 px dividers, and independent content and approval scrolling. At 390 px the regions stack into one continuous scroll while the amount summary and actions remain fixed.
- Colors and visual tokens: white and cool-gray work surfaces, restrained purple identity accents, green completed states, and orange payment-pending states match the existing finance-review and form language. No decorative gradients or unrelated palette was added.
- Image and asset fidelity: this operational screen requires no product imagery. Wallet, document, account, timeline, close, and send controls use the repository's existing Lucide icon library rather than handwritten assets.
- Copy and content: project identity, payment order, single payment channel, creator-level Invoice and contract references, masked account details, fees, transfer notes, approval actors, timestamps, and channel writeback state are all present. The bottom action remains `执行打款`.

## Full-View Comparison

The source establishes four required regions through overlapping drawers: request information, creator payment details, the current approval flow, and a persistent payment action. The implementation preserves all four in one coherent full-screen workspace. The left column combines the source's request drawer and creator cards; the right rail carries the full approval flow; the footer keeps the amount, channel, return action, and execution action visible.

## Focused Region Comparison

- Project region: the implementation keeps the source's amount, linked-document counts, current state, project identity, team, channel, expected date, round, and request reason, with the payment order elevated into the summary row.
- Creator region: repeated cards preserve the source's account snapshot, currencies, amount, fee bearer, reason, remittance reference, Invoice, contract, and provider at a denser but still scannable rhythm.
- Approval region: all completed approval stages, channel payment, and system status writeback remain visible in order. The active channel step is labeled `待打款` and the right rail scrolls independently on desktop.
- Action region: `执行打款` remains the rightmost primary action and is visible throughout desktop and narrow scrolling.

## Interaction Verification

- `待打款 3` opens the correct payment-project list, and the first row's `执行打款` opens the project-level workspace instead of a single creator drawer.
- Desktop rendering shows the two-column composition and both independent scrollbars without clipped approval or creator content.
- At 390 x 844, the page scroll reaches the final `状态回写` node while the fixed footer remains unobstructed and both 44 px action buttons remain usable.
- The execution action is connected to the real prototype transition: all waiting payouts in the current request are validated, then moved together to `付款处理中`.
- Browser console contained 0 warnings and 0 errors during the verified flow.

## Comparison History

1. The source review identified that separate request, creator, and approval drawers obscured one another and did not present a project-level execution context.
2. The implementation consolidated those regions into a full-screen two-column workspace with a persistent footer and project-level action.
3. The first browser pass confirmed desktop hierarchy and exposed no overlap or clipping.
4. The narrow pass verified continuous scrolling from project information through creator cards to the final approval nodes, with the footer remaining fixed.

## Implementation Checklist

- [x] Project information above creator payment summaries.
- [x] Complete creator-level payment overview for the selected request.
- [x] Full approval flow with channel and status-writeback stages.
- [x] Persistent bottom-right execution action wired to project-level payment processing.
- [x] Desktop and 390 px responsive verification.
- [x] Browser console verification.

## Follow-up Polish

- No P3 refinement is required for this scoped workflow.

final result: passed

---

# Payment Provider Badge Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-e9718ad4-645f-4447-8205-34a721ad4cf3.png` (1420 x 400 px).
- Desktop overview: `artifacts/provider-badges/transactions-desktop-final.png`.
- Desktop list comparison: `artifacts/provider-badges/transactions-list-final.png`.
- Narrow implementation: `artifacts/provider-badges/transactions-390x844-final.png`, captured with the browser viewport override set to 390 x 844.
- State: signed in as `finance.demo`, opened `交易记录`, and displayed Airwallex, PayMax, and PayPal together in the channel summary and transaction list.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- Typography: channel names remain readable at the existing dense table scale. Labels use the product font, 700 weight, zero letter spacing, and stable line height without clipping.
- Spacing and layout: the shared badge uses a compact 26-30 px height, 4-9 px insets, and a 6-7 px gap. It fits existing table cells and summary rows without changing column widths or row heights.
- Colors: Airwallex uses a purple mark and lavender surface, PayMax uses coral and a warm pale surface, and PayPal uses blue and a pale blue surface. Each treatment includes a border and darker text for legibility.
- Icon and asset fidelity: the source's initial block is retained as a real text monogram inside the badge. No decorative imagery, custom SVG, emoji, or unrelated asset was added.
- Content: `Payermax`, `payer max`, and `PayMax` normalize to the displayed label `PayMax`; payment values and business rules remain unchanged. A letter mark plus provider name ensures color is not the only identifying signal.
- Responsive behavior: at 390 px the three summary rows remain fully visible, and the existing transaction-table scroll region preserves the provider badges without page-level overlap.

## Interaction And Technical Verification

- Shared badge rendering and provider normalization: 3 component tests passed.
- Complete Vitest run: 58 files and 365 tests passed.
- TypeScript check and production Vite build: passed.
- Browser console: 0 warnings and 0 errors during the verified transaction view.
- Source and implementation were opened together for direct visual comparison; the implementation preserves the source's purple / coral / blue provider mapping while adapting it to compact list rows.

## Comparison History

1. The first list pass established the three provider treatments and shared reusable component.
2. The first transaction-summary pass exposed truncated two-column content after badges were added.
3. The final pass moved provider metrics to one stable row per channel, then verified the overview and list at desktop and 390 px widths.

final result: passed

---

# Finance Review Footer Centering And Incorrect-State Gate Design QA

## Evidence

- Source visual truth, incorrect-state gate: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-1d46885e-aa9a-4ce4-b8f7-1d4f010f2b46.png` (1905 x 857 px).
- Source visual truth, centered footer: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-380f1826-6c6b-475c-9d50-c5969bfc68a3.png` (1890 x 865 px).
- Desktop drawer expanded: `artifacts/finance-review-qa/footer-expanded-1904x857.png`.
- Desktop drawer collapsed: `artifacts/finance-review-qa/footer-collapsed-1904x857.png`.
- Incorrect record state: `artifacts/finance-review-qa/footer-incorrect-1904x857.png`.
- iPad landscape: `artifacts/finance-review-qa/footer-incorrect-1024x768.png`.
- iPad portrait: `artifacts/finance-review-qa/footer-incorrect-768x1024.png`.

## Dimensions And State

- Desktop implementation captures use a 1904 x 857 CSS viewport at device scale factor 1. The one-pixel source-width difference does not require density normalization.
- iPad captures use 1024 x 768 and 768 x 1024 CSS viewports at device scale factor 1.
- State: signed in as `finance.demo`, opened the first pending finance request, then recorded the current Invoice as incorrect. Desktop evidence covers the approval drawer in both expanded and collapsed states.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Fonts and typography: the footer keeps the existing Noto Sans SC hierarchy, compact labels, tabular counts, and zero letter spacing. Disabled action copy stays readable at desktop and tablet sizes.
- Spacing and layout rhythm: navigation and review counts are one centered group inside the flexible track before the action buttons. At 1904 px its center is 763 px in both drawer states, exactly matching the center of the 16-1510 px available region. At 1024 px it centers at 270.5 px within the 16-525 px available region; at 768 px it centers at the 384 px viewport midpoint above the two-row action grid.
- Colors and visual tokens: `确认本页无误` uses the existing disabled treatment after an incorrect decision. No new palette or decorative treatment was introduced.
- Image and asset fidelity: this change adds no imagery or custom icons. Existing Lucide status and action icons remain unchanged.
- Copy and content: `上一页`, page position, `下一页`, confirmed count, and incorrect or pending count stay together. The incorrect state changes the action to `编辑有误记录` and prevents the contradictory confirm action.

## Full-View And Focused Comparison

- The source and implementation images were opened together in the same comparison pass. The implementation moves the complete paging and count group into the marked footer space while retaining the source's right-aligned review actions.
- The focused incorrect-state comparison confirms the source-marked `确认本页无误` action is visibly disabled after `已记录有误` appears.
- Drawer collapse changes only the workspace columns. Footer measurements remain identical, so the centered group does not drift when the right panel is hidden.

## Interaction Verification

- Saving an incorrect reason changes the page state to `已记录有误`, changes the first action to `编辑有误记录`, and leaves `确认本页无误` disabled.
- The confirm handler uses the same derived permission as the button and returns before mutating the session when the page is incorrect.
- Desktop drawer expanded and collapsed measurements are identical for the footer group and action region.
- 1024 x 768 and 768 x 1024 layouts report zero page-level horizontal overflow.
- Browser console contained 0 warnings and 0 errors.
- Focused Vitest passed 12/12 tests, full Vitest passed 58 files and 367/367 tests, and the TypeScript/Vite production build passed.

## Comparison History

1. The source identified two issues: a contradictory enabled confirmation action and a footer group anchored to the far left.
2. The implementation added one shared confirmation guard and a two-track footer with a centered pagination group.
3. Browser measurements and screenshots verified the corrected state across drawer positions and tablet orientations; no post-capture P0/P1/P2 correction was required.

final result: passed

---

# Payment Project Payment Detail Design QA

## Evidence

- User entry-point reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-9fbbf381-bb4b-40a9-8bea-6be12e32fac9.png` (1908 x 828 px).
- Existing payment-batch detail reference: `artifacts/payment-project-detail-qa/batch-reference-1908x828.png` (1893 x 821 px browser content capture).
- Project progress view: `artifacts/payment-project-detail-qa/progress-1908x828.png`.
- Project detail view: `artifacts/payment-project-detail-qa/detail-1908x828.png`.
- Failed project view: `artifacts/payment-project-detail-qa/failure-1908x828.png`.
- Failure handling dialog: `artifacts/payment-project-detail-qa/failure-dialog-1908x828.png`.
- Mobile failed project view: `artifacts/payment-project-detail-qa/failure-390x844.png` (375 x 812 px browser content capture).
- Full-view comparison: `artifacts/payment-project-detail-qa/batch-vs-project-progress.png`.
- Focused comparison: `artifacts/payment-project-detail-qa/batch-vs-project-progress-focused.png`.

## Dimensions And State

- Desktop reference and implementation were rendered with a 1908 x 828 CSS viewport at device scale factor 1. Browser content capture excluded 15 px of vertical scrollbar/chrome width and 7 px of browser chrome height, producing 1893 x 821 px page images on both sides; no density normalization was needed.
- Mobile verification used a 390 x 844 CSS viewport at device scale factor 1. The 375 x 812 px content capture reflects the same browser chrome exclusion and was checked separately for responsive behavior rather than pixel-matched to the desktop reference.
- States verified: payment processing (`查看进度`), fully paid (`查看详情`), partially failed (`处理失败`), expanded failed payment, failure return dialog, and the post-submit return to the workbench.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Fonts and typography: the project page reuses the batch-detail hierarchy, numeric emphasis, Noto Sans SC body treatment, tabular amounts, zero letter spacing, and compact metadata sizes. Long request and project identifiers remain readable without colliding with the status summary.
- Spacing and layout rhythm: header, four-column summary, progress panel, project section, and payment-item list align with the existing batch-detail composition. The project version removes batch-level multi-project density while preserving the same margins, dividers, radii, and section rhythm.
- Colors and visual tokens: processing, completed, failed, warning, and destructive states use the existing semantic tokens. The failure callout and return dialog add emphasis without introducing a new palette.
- Image quality and asset fidelity: the source flow contains no photographic or illustrative assets. Existing logo assets and Lucide interface icons remain sharp and consistent; no custom SVG, CSS illustration, emoji, or placeholder image was introduced.
- Copy and content: headings explicitly describe a single request project and its payment items. `查看进度`, `查看详情`, and `处理失败` resolve to the same project-level record while exposing state-appropriate guidance and actions.
- Responsive behavior: the four-column summary becomes a single-column stack on mobile, the failed-payment callout and action remain fully visible, and the page reports no horizontal overflow at 390 px.

## Full-View And Focused Comparison

- The full-view comparison places the existing payment-batch detail and the new project-payment detail side by side at the same viewport. Navigation, page header, status summary, metric strip, progress tracker, and information-card hierarchy match; the intentional difference is that the project page contains exactly one request project.
- The focused comparison confirms matching typography, border treatment, column height, progress spacing, and top-of-page alignment in the dense summary region where full-view text is otherwise too small to judge.

## Interaction Verification

- `查看进度`, `查看详情`, and `处理失败` open the selected request project instead of a payment batch or creator-only drawer.
- Processing and completed records show the appropriate channel progress and final result counts.
- Failed records automatically expose the first failed payment. The return dialog keeps confirmation disabled until an issue type and required reason are entered.
- Confirming failure handling moves the request from `已付款` to `已退回`; the observed tab counts changed from `已付款 6 / 已退回 0` to `已付款 5 / 已退回 1`, and `REQ-202607-000011` appeared in the returned list.
- Returning from the detail page restores the `已付款` tab and its current workbench context.
- Browser console contained 0 warnings and 0 errors during the verified desktop and mobile flows.

## Comparison History

1. The existing payment-batch detail established the target hierarchy and interaction language, while the user entry-point reference identified the three project actions requiring implementation.
2. The project detail page reused that hierarchy and reduced the data scope from multiple request projects to the selected single request project and all of its payment items.
3. Same-viewport full and focused comparisons found no P0/P1/P2 visual drift. Desktop, mobile, validation, and post-return state checks then passed without a post-capture visual correction.

## Implementation Checklist

- [x] Shared project detail route for progress, details, and failure handling.
- [x] Single-request project scope with all associated payment items.
- [x] Batch-detail visual hierarchy and channel progress presentation.
- [x] Required failure classification and return reason.
- [x] Returned-state synchronization with workbench tab counts and list.
- [x] Desktop and 390 px responsive verification.

final result: passed

---

# Provider Highlight Scope And Creator Badge Sizing Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-d4b7247a-20d0-4ad7-ba3c-bd429a3918c6.png`.
- Desktop implementation: `artifacts/provider-scope-qa/creator-list-desktop.jpg`, captured at a 1280 x 720 CSS viewport.
- State: signed in as `admin.demo`, opened `达人档案`, then opened a payment batch detail from `付款批次` to verify the non-list treatment.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- The creator-list provider label and its adjacent account description both resolve to `9.5px`; the provider frame uses a stable 20px CSS height and a compact 15px initial mark.
- The smaller label retains the existing Airwallex, PayPal, and PayMax color mapping, border, visible provider name, and letter mark, so color is not the only identifying signal.
- Provider highlighting remains in top-level payment tables and lists. The transaction channel summary, payment batch detail, payment execution workspace, payment-list review, request creation/detail, and resource review areas render provider names as ordinary text.
- The verified creator list and payment batch detail have no page-level horizontal overflow. The badge dimensions remain fixed inside the existing horizontally scrollable table structure on narrow layouts.

## Interaction And Technical Verification

- The creator list rendered 10 scoped provider badges and no unscoped provider badge.
- The payment batch list rendered provider badges; opening the first batch detail rendered zero provider badges and preserved the provider and transfer-method text.
- Source and implementation were opened together for direct visual comparison. The implementation keeps the source color treatment while reducing its visual weight to match the adjacent account copy.
- Full Vitest passed 59 files and 371 tests; TypeScript/Vite build and the final diff check passed.

final result: passed

---

# Partial Payment Failure Recovery Design QA

## Evidence

- Desktop retry candidate: `artifacts/payment-failure-recovery-qa/desktop-retry-candidate-1440x900.png`.
- Mobile failure return dialog: `artifacts/payment-failure-recovery-qa/mobile-return-dialog-390x844.png`.
- Mobile system select open state: `artifacts/payment-failure-recovery-qa/mobile-return-select-open-390x844.png`.
- Mobile payment-list recovery panel: `artifacts/payment-failure-recovery-qa/mobile-recovery-panel-390x844.png`.
- Mobile retry candidate: `artifacts/payment-failure-recovery-qa/mobile-retry-candidate-390x844.png`.

## Dimensions And States

- Desktop verification used a 1440 x 900 CSS viewport. The page-level scroll width remained within the browser content width.
- Mobile verification used a 390 x 844 CSS viewport; the in-app browser content capture was 375 px wide after browser chrome. The page reported no horizontal overflow.
- Verified states: untreated partial failure, payment-list issue return, creator notification pending, dual-channel notification recorded, creator updated, revalidation ready, retry candidate, and retry submitted.

## Findings

- No actionable P0, P1, or P2 issue remains.
- The failure classification control uses the shared `SelectField` form treatment, fixed menu strategy, existing radii, shadows, typography, and selected/disabled states.
- Returning a payment-list issue preserves the four successful payments and project approval result, while only the failed creator enters recovery.
- The project status and warning use the existing failure palette and provide text labels in addition to color.
- Deep linking opens the correct payment list, focuses the failed creator row, and keeps the recovery actions reachable in the 390 px dialog.
- The prototype notice explicitly states that in-app messages, Gmail, creator feedback, and account changes are simulated.
- The retry row is promoted to the top of the batch candidate list, marked `失败重试`, remains unchecked by default, and becomes selectable only after revalidation.

## Interaction Verification

- Selecting `付款清单问题` and entering a required reason records one shared failure-return source used by the batch, workbench, and project views.
- Simulated notification records both in-app and Gmail results; the missing-recipient branch is covered by unit tests.
- Simulated creator feedback increments the account version and updates the prototype fingerprint and beneficiary identity.
- Revalidation updates the frozen payment snapshot only after all account identity fields match; mismatches remain blocking with field-level reasons.
- Creating a retry batch marks the payout as `RETRY_SUBMITTED` and removes it from candidates, preventing duplicate submission.
- Browser console contained 0 warnings and 0 errors during the final desktop and mobile verification.
- Full Vitest passed 62 files and 383 tests. TypeScript/Vite production build and `git diff --check` passed.

final result: passed

---

# Payment Account Failure Return Card Design QA

## Evidence

- Source card reference: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-dbf7fabe-a7cc-4ff2-b13d-b39df0735d57.png`.
- Desktop implementation: `artifacts/payment-failure-recovery-qa/my-project-failure-card-1591x744.png`, captured at a 1591 x 744 CSS viewport.
- Mobile implementation: `artifacts/payment-failure-recovery-qa/my-project-failure-card-390x844.png` and `artifacts/payment-failure-recovery-qa/my-project-failure-card-390x844-focused.png`, captured at a 390 x 844 CSS viewport.
- Same-viewport comparison: `artifacts/payment-failure-recovery-qa/source-vs-implementation-1591x744.png`.

## Findings

- No actionable P0, P1, or P2 visual issue remains.
- The failure card keeps the system's existing red warning semantics while separating the recovery summary, creator and payment metadata, failure reason, current recovery state, and next action into a clearer hierarchy.
- The failure reason is explicitly labeled `付款失败原因：`, preventing it from being confused with the recovery status or general project notes.
- The `查看付款清单` action uses the existing button language with a receipt icon, stable height, visible focus state, and sufficient contrast.
- At 390 px, metadata, reason, status, and action stack into one column without text clipping, overlap, or horizontal page overflow.

## Interaction Verification

- The return dialog displays `付款账户问题` while preserving the existing explanation `仅恢复失败达人的收款账户`.
- Opening the project recovery card and selecting `查看付款清单` locates and highlights the matching failed creator payment row.
- Simulated creator account feedback synchronizes the recovery state to `达人已更新，待重新校验`; successful revalidation synchronizes it to `已重新校验，可重试` in the new-batch candidate list.
- Submitting the retry marks the payment as `付款处理中` and removes it from selectable retry candidates.
- Browser console contained no application errors during the desktop and mobile recovery flow.

final result: passed

---

# Payment Execution Equal Dual Cards Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-91cc0c48-c131-4216-ac76-30f2ac7d6561.png` (1891 x 862 px).
- Execution implementation: `artifacts/payment-execution-equal-cards/execution-desktop-1892x864.jpg`, captured at a 1892 x 864 CSS viewport.
- Returned-detail implementation: `artifacts/payment-execution-equal-cards/returned-desktop-1892x864.jpg`, captured at the same viewport.
- Mobile implementation: `artifacts/payment-execution-equal-cards/returned-mobile-top-390x844.jpg` and `returned-mobile-approval-390x844.jpg`.
- Same-input comparison: `artifacts/payment-execution-equal-cards/reference-vs-equal-cards.jpg`.

## State And Normalization

- The supplied source shows the execution state with an approximately 8:2 main/approval split. The requested target intentionally changes only that relationship to two equal cards while preserving the content and fixed footer.
- The source's 30 px browser-chrome strip was removed for the comparison. Source and implementation content were then resized from their native dimensions to equal 900 px widths and placed together without density interpolation beyond that common scale.
- Verified states: `执行打款`, a finance return created in the current prototype session, and the resulting `已退回详情`.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Fonts and typography: the existing workspace font stack, heading hierarchy, data labels, status pills, and footer copy remain unchanged and readable in both equal columns.
- Spacing and layout rhythm: desktop uses two measured 922 px cards with a 16 px gap inside the 1892 px viewport. Both cards share the same 8 px radius, border, surface, and height, and each retains independent vertical scrolling.
- Colors and visual tokens: the existing neutral surfaces, purple section icons, green approval states, orange execution state, and red returned state remain unchanged.
- Image and icon fidelity: the screen uses the product's existing Lucide interface icons and contains no new raster asset, placeholder, custom SVG, or decorative illustration.
- Copy and content: project details, payee records, approval nodes, return reason, totals, and action labels are unchanged; only the main-panel proportion and card framing changed.
- At 390 x 844, the cards stack in normal document flow at 347 px width with no horizontal page overflow.

## Interaction Verification

- `执行打款` and `已退回详情` both render exactly two `.payment-execution-board-card` regions.
- The return dialog still requires a reason, moves the project to `已退回`, and opens the same equal-card layout through `查看原因`.
- The fixed footer remains visible and the action set continues to follow the active execution or returned state.
- Browser console contained 0 warnings and 0 errors during desktop and mobile checks.
- Full Vitest passed 70 files and 438 tests; TypeScript/Vite production build and `git diff --check` passed.

## Comparison History

1. The supplied reference and initial implementation were compared together. The intentional 8:2 to 5:5 change was correct and the two desktop card widths matched exactly.
2. The first 390 px pass exposed a P2 issue where CSS Grid compressed the first card to almost zero height. The mobile container was changed to normal block flow with a 14 px card gap.
3. Post-fix mobile captures show the project card followed by the approval card without overlap, clipping, or horizontal overflow.

final result: passed

---

# Finance Review Progressive Drawer Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-c9ca7fcb-86a8-4c4b-8244-a766a659def9.png` (1911 x 814 px).
- Intended implementation URL: `http://127.0.0.1:5173/`.
- Requested viewports: 1911 x 814, 1440 x 900, and 390 px wide at device scale factor 1.
- Intended states: payment workbench with the project overview drawer open; expanded three-board validation; returned overview with preserved review state.

## Findings

- Browser-rendered implementation evidence is unavailable because the in-app browser opens at the account login screen and no authenticated payment-workbench state is currently accessible.
- The source visual was opened and inspected. Code, focused tests, full Vitest, TypeScript/Vite build, and `git diff --check` pass, but these do not replace a same-state visual comparison.
- Fonts and typography, spacing and layout rhythm, colors and visual tokens, icon fidelity, copy, desktop transition, mobile full-screen behavior, and interaction state cannot be truthfully signed off without the authenticated rendered screen.

## Interaction Verification

- Source-level tests verify that the workspace defaults to the overview stage, uses a 520 px right-side drawer, exposes `校验审核`, switches to validation without resetting review state, supports `返回项目概览`, and uses a full-screen overview below 900 px.
- Full Vitest passes 74 files and 466 tests. TypeScript/Vite production build and `git diff --check` pass.
- Actual drawer opening, expansion animation, contract/Invoice dialogs, project export, responsive layouts, focus transitions, and browser console state remain blocked by authentication.

## Comparison History

1. The source visual was opened at its native resolution.
2. The local implementation was opened in the in-app browser, but it stopped at the login screen before the target payment-workbench state could be reached.
3. No implementation screenshot was captured because a login-screen capture is not valid comparison evidence for the requested review workspace.

final result: blocked

---

# Payment Execution Workspace Design QA

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-ad2e324d-d811-41af-a8ae-d90b75489be7.png`
- Implementation screenshot: `design-qa-assets/payment-execution-desktop-1898x838-final.png`
- Mobile screenshot: `design-qa-assets/payment-execution-mobile-390x844-final.png`
- Combined comparison: `design-qa-assets/payment-execution-side-by-side.png`
- Viewports: desktop 1898 x 838 CSS px; mobile 390 x 844 CSS px
- Pixel density: source 1896 x 838, implementation normalized to 1896 x 838 for comparison, deviceScaleFactor 1
- State: payment workbench, pending-payment project `REQ-202607-000006`, execution confirmation open

## Full-view Comparison

The implementation intentionally changes the source from a balanced card layout into the approved task-first 7:3 structure. The left region now prioritizes payment amount, payment order, validation readiness and the 15-row payee table. Historical approval information is compressed into a conventional vertical stepper, while project-level evidence is consolidated below it.

## Focused Checks

- Typography: Noto Sans SC remains consistent with the application; title, data and utility text use a stable 12/13/16/24 scale without negative letter spacing.
- Spacing and layout: desktop measured approximately 68.5% main content and 29.5% aside after gutters; table and aside scroll independently and the footer remains visible.
- Colors and tokens: existing purple action accents, green validation state and orange payment state are retained; no decorative gradients or new palette family were introduced.
- Image quality: no raster imagery is required by this operational screen. All interface icons use the existing Lucide family.
- Copy and content: project, payout, account, validation and resource labels are sourced from the existing domain models. Repeated status and project metadata were removed.
- Responsive: at 390 x 844, payee rows become two-column detail blocks, the main area precedes the aside, and measured horizontal overflow is 0 px.
- Accessibility: status uses icon plus text, buttons have visible focus treatment, evidence controls include record-specific accessible names, and reduced motion is respected.

## Interaction Verification

- Expanded the approval stepper from 3 summarized nodes to all 6 nodes.
- Opened `INV-260727-06-01` from its payee row and verified the corresponding Invoice detail.
- Verified the execute action remains enabled only when all 15 records pass validation.
- Verified project-level contract and Invoice view/download controls render with enabled and loading states.
- Fresh browser session console: no warnings or errors.

## Comparison History

1. P1: mobile grid constrained the main region and allowed the approval aside to appear before the payee table. Fixed by changing the execution main and aside to normal document flow below 900 px.
2. P2: mobile payee rows were 423 px tall. Fixed by retaining the two-column detail grid, reducing each row to approximately 221 px.
3. P2: the mobile payee header exceeded its container by approximately 12 px. Fixed by using a block header layout and explicit 100% inner widths; final measured main scroll width equals client width.

## Findings

No remaining P0, P1 or P2 visual or interaction findings. The project continues to be a client-side prototype; download generation and payment transitions are not server-backed production workflows.

final result: passed

---

# Payment Execution Two-Card Layout Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-66244cad-3789-4fd4-9160-164de01179cc.png` (1903 x 880 px).
- Browser implementation: `design-qa-assets/payment-execution-two-cards-1280x720.png`, captured in the in-app browser at a 1280 x 720 CSS viewport and device scale factor 1.
- Combined comparison: `design-qa-assets/payment-execution-two-cards-comparison.png`. The two screenshots are aspect-fit without cropping; they intentionally retain their different native viewports, so the comparison is structural rather than pixel-equivalent.
- State: payment workbench, pending-payment project `REQ-202607-000006`, execution modal open.

## Findings

- No actionable P0, P1, or P2 visual issue remains at the browser-supported desktop viewport.
- Fonts and typography: the existing Noto Sans SC hierarchy is preserved. Labels, values, table headers, and row content remain at readable operational sizes with zero letter spacing and no forced viewport font scaling.
- Spacing and layout: the modal contains exactly two large cards at approximately 7:3. The left card follows project information, five payment summary cards, validation alert, and payout list; the right card combines approval and resources with one internal divider.
- Colors and tokens: existing neutral surfaces, purple action accents, green validation state, and orange payment state remain consistent with the system. No new gradient or decorative palette is introduced.
- Image and icon quality: this operational screen requires no raster product imagery. Existing Lucide icons remain crisp and consistent with the surrounding application.
- Copy and content: the five summaries are payment total, payment order, provider, payment currency, and expected payment date. The table reads the receive currency, fee bearer, payment reason, and transaction reference from the frozen payment-list data.
- Responsive behavior: the in-app browser remained fixed at 1280 x 720 even when mobile viewport options were supplied, so a browser-rendered 390 px screenshot is unavailable. CSS and render tests verify the below-900 px card layout, nine mobile labels, zero table minimum width, and the two-column record grid below 560 px.

## Interaction Verification

- The all/pending filter control is absent and all waiting-payment rows remain visible.
- Waiting-payment items are presented as validated and eligible for execution; any item outside waiting-payment remains blocking.
- All nine table headers and first-row values are left-aligned.
- At 1280 px, the page itself has zero horizontal overflow and the fixed footer remains visible. The dense nine-column table keeps a 1080 px readable minimum width and scrolls only inside its own list region.
- The approval stepper can expand from the compact three-node summary, and contract/Invoice resource actions remain available.
- Browser logs contain no application warning or error. Full Vitest passes 74 files and 471 tests; TypeScript/Vite production build and `git diff --check` pass.

## Comparison History

1. The initial implementation compressed nine columns into the 830 px left-card table at 1280 px, truncating the fee and transaction-reference values.
2. The table received a 1080 px readable minimum width while the modal retained zero page overflow; post-fix measurements show all first-row values fit and the list alone owns horizontal scrolling.
3. The execution eligibility source was unified with the workbench state: `等待付款` now directly means the row is validated for this screen, removing contradictory secondary validation states.

final result: passed

---

# Invoice 草稿、批量发布与审核记录设计验收

验收日期：2026-08-24

final result: passed

## 覆盖范围

- 桌面端 Invoice 五页签、开票主体列、状态颜色与已退回原因展示。
- 内部 Invoice 草稿生成、独立付款记录、发布、通知记录与撤销二次确认。
- 待签署内部草稿及待采集外部任务的勾选、一键发布和不可发布项禁用。
- 内部、外部 Invoice 统一审核记录骨架：版本摘要、五阶段时间线、当前待办和当前状态。
- 内部详情顶部五按钮及 390px 窄屏换行；页面无横向整体溢出。

## 浏览器结果

- 桌面端：内部与外部详情、审核记录、待采集发布、已退回原因均正常。
- 390px：四张指标卡、文件区、审核区和顶部五按钮均可用，无页面级横向溢出。
- 浏览器控制台：无 warning 或 error。

## 验收中修复

- 新 Invoice 改为始终使用独立的原型付款记录 ID，避免复用同达人同项目历史付款记录并继承旧电子签或签署时间。
- 窄屏顶部操作按钮组跨满外层网格，保持两列排列，下载按钮独占整行。

## 自动化验证

- `npm test`：91 个测试文件、596 项测试通过。
- `npm run build`：TypeScript 检查与 Vite 生产构建通过。
- `git diff --check`：通过。

---

# 请款项目付款清单七列表格设计验收

验收日期：2026-08-27

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-8e32ac75-4ca6-4a88-8394-46ba9f5b2d6a.png`.
- Desktop implementation: `design-qa-payment-list-desktop.png`.
- Mobile implementation: `design-qa-payment-list-mobile.png`.
- Full comparison: `design-qa-payment-list-comparison.png`.
- State: 管理员账号打开请款项目 `REQ-202607-000001` 的已提交付款清单，自动 Airwallex 校验完成。

## Normalization

- Source image: 1253 x 373 px.
- Desktop capture: 1265 x 712 px at the in-app browser default 1265 x 712 CSS viewport and device scale factor 1.
- Mobile capture: 375 x 812 px while testing a 390 x 844 CSS viewport; the browser image excludes its outer chrome.
- The comparison keeps the unchanged source at native width and uses a focused crop of the desktop modal. The source contains nine example columns, while the implementation intentionally keeps only the seven columns explicitly requested by the user.

## Findings

- No actionable P0, P1, or P2 visual or interaction issue remains.
- Fonts and typography: the table inherits the existing Noto Sans SC hierarchy; labels, figures and compact helper text match the surrounding system without introducing a foreign type scale.
- Spacing and layout: the existing “全部付款明细”和“项目核对”区域保留，导出操作移至标题右上角；七列表格使用固定表头和独立纵向滚动。
- Colors and tokens: neutral table surfaces, restrained purple icon treatment and green/red validation states follow the existing COMETS Pay palette. Validation uses icon plus text, not color alone.
- Image and icon quality: the reference contains no product imagery. The implementation uses the existing Lucide icon set and does not add handcrafted or placeholder assets.
- Copy and content: the table contains only 达人名称、收款账户、支付币种、收款方币种、Invoice 金额、手续费承担方和 API 校验结果。
- Responsive behavior: below 640 px, each payment becomes a two-column card; the 390 px test measured modal `clientWidth === scrollWidth === 335`, so there is no horizontal overflow.

## Interaction Verification

- Opening the payment list automatically starts Airwallex validation; no manual validation button is rendered.
- The legacy “账户快照完整，待 Airwallex API 校验”提示卡 is absent in the project view.
- Automatic validation settles at `已通过 16/17`; the one failed fixture exposes the specific IBAN Schema error instead of remaining in a loading state.
- The seven visible header labels exactly match the requested fields, and “导出 Excel” remains visible in the heading action area.
- No new browser console errors were recorded during desktop and mobile verification.

## Comparison History

1. The first browser pass remained on “校验中” because a parent-created `creators` array repeatedly restarted and cancelled the validation effect.
2. The effect now keys off a stable serialized payment/creator data signature, so identity-only parent rerenders do not restart validation.
3. Post-fix desktop and mobile captures show a settled API result, consistent table hierarchy and no mobile horizontal overflow.

## Automated Verification

- Full Vitest: 97 files, 668 tests passed.
- TypeScript and Vite production build passed.
- `git diff --check` passed.

final result: passed

---

# 付款清单底部滚动与审批操作区验收

验收日期：2026-08-27

## Evidence

- Desktop payment-list bottom: `design-qa-payment-list-bottom-scroll.png`.
- Mobile payment-list bottom: `design-qa-payment-list-bottom-scroll-390.png`.
- Approval action alignment: `design-qa-request-approval-actions.png`.

## Findings

- 桌面付款清单移除外层与表格的嵌套纵向滚动，仅保留表格内部滚动，避免滚轮停在错误容器。
- 最后一笔付款下方保留 12px 安全留白；滚动到底后，最后一行完整位于表格滚动视口内。
- 390px 下继续由弹窗内容区统一滚动，最后一张付款卡与固定底部关闭区之间保留 34px 以上间距。
- “退回媒介修改”与“审批通过”在桌面操作区右对齐相邻排列，退回按钮位于审批按钮左侧；窄屏保持同一顺序纵向排列。
- 桌面和 390px 均无页面级横向溢出，浏览器控制台无新增 warning 或 error。

## Automated Verification

- 定向 Vitest：3 个测试文件、29 项测试通过。
- 完整 Vitest：97 个测试文件、669 项测试通过。
- TypeScript 与 Vite 生产构建通过。
- `git diff --check` 通过。

final result: passed

---

# 付款清单 API 核对口径与收款身份验收

验收日期：2026-08-28

## Source Evidence

- 用户浏览器批注中的付款清单桌面截图，状态为项目关键字段 17/17 一致、API 通过 0/17。
- 目标字段：收款人名称、收款主体、收款账户、支付币种、收款方币种、Invoice 金额、手续费承担方、API 校验结果。

## Findings

- 项目核对通过改为双条件：Invoice 关键字段一致，并且当前付款清单全部 API 校验通过。
- 达人付款信息中的通过数只统计 API 返回 `passed` 的付款明细，与 API 校验结果列使用同一口径。
- API 结果列不再混入付款快照复核状态，避免顶部计数与逐行结果不一致。
- 首列改为“收款人名称”，复用系统头像组件并展示收款人、Handle 和社媒平台。
- 新增“收款主体”列：个人账户读取冻结 Real Name，公司账户读取 Airwallex Schema 的 Company Name。
- 桌面表格扩展为八列并保持固定列宽；640px 以下继续转换为两列信息卡片，收款人身份占完整首行。

## Verification

- `PaymentListReviewContent` 定向测试：19 项通过。
- 完整 Vitest：99 个测试文件、677 项测试通过。
- TypeScript 与 Vite 生产构建通过。
- `git diff --check` 通过。
- 已检查现有浏览器页面状态；本地 URL 安全策略阻止刷新当前标签页，因此未生成更新后的浏览器截图，需在页面手动刷新后查看新构建。

final result: passed
