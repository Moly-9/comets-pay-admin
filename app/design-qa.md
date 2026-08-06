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
