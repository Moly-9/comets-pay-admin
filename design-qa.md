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
