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
