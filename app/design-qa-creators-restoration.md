# Design QA - 达人档案还原与本地清算方式交互

## Reference and environment

- Original source baseline: commit `1513bd6`.
- Source visual truth: `app/qa/creators-restoration/source-local-clearing-clipped.png` (`940 x 682`).
- Desktop creator detail: `app/qa/creators-restoration/implementation-detail-desktop.png` (`1265 x 712` captured pixels).
- Desktop clearing menu: `app/qa/creators-restoration/implementation-clearing-desktop.png` (`1265 x 712` captured pixels).
- Mobile creator detail: `app/qa/creators-restoration/implementation-detail-mobile.png` (`375 x 812` captured pixels).
- Mobile clearing menu: `app/qa/creators-restoration/implementation-clearing-mobile.png` (`375 x 812` captured pixels).
- CSS viewport and device density: desktop `1280 x 720`, mobile `390 x 844`, device pixel ratio `1`. Browser-owned scrollbar and window insets account for the smaller captured content pixels; no density resampling was used.
- State: Mina Kato detail and edit dialogs; Airwallex `JP / JPY / PERSONAL / LOCAL / ZENGIN` account; local clearing menu open.

## Comparison evidence

- The supplied clipped-menu screenshot and the revised desktop open-menu screenshot were inspected together at native density.
- The source is a focused defect screenshot rather than a different target theme. The implementation therefore retains the same COMETS Pay controls, colors, typography, spacing, card borders, and selected-option treatment.
- The source uses a US / USD / ACH example while the current creator account uses JP / JPY / ZENGIN. This is an expected data difference and does not change the interaction or visual treatment.
- A separate crop was not required: the source already focuses on the affected control, and the desktop and mobile implementation screenshots keep the trigger, full option copy, and following Airwallex card readable in one frame.

## Required fidelity surfaces

- Fonts and typography: passed. The existing Noto Sans SC stack, weights, sizes, line heights, and zero letter spacing remain unchanged; long option descriptions wrap instead of truncating.
- Spacing and layout rhythm: passed. The creator header, original four-item profile detail grid, social cards, section spacing, and compact field density match the source baseline.
- Colors and visual tokens: passed. No color token, semantic status color, border, radius, shadow, or channel-card treatment changed.
- Image and icon fidelity: passed. Existing avatars and Lucide icons are retained; no image, custom SVG, or placeholder asset was introduced.
- Copy and content: passed. The baseline `收款账户`, four profile fields, and `查看主页` labels are restored. Existing Airwallex, PayPal, PayerMax, Schema, account version, and downstream payout copy remain available.

## Interaction and responsive checks

- Desktop: the menu is portaled directly under `document.body`; it has no hidden-overflow ancestor and remains entirely inside the viewport.
- Desktop geometry: trigger `170.5, 338.5 - 617, 378.5`; menu `170.5, 385.5 - 617, 448.2`.
- Mobile: after the trigger is scrolled into view and opened, the menu remains entirely inside the `390 x 844` viewport.
- Mobile geometry: trigger `56, 401.1 - 337.4, 441.1`; menu `56, 448.1 - 337.4, 510.8`.
- Pointer interaction opens the menu above the following Airwallex card without clipping; the option title and fee-priority description are both visible.
- Keyboard interaction passes: `ArrowDown` opens the menu and focuses the selected option; `Escape` closes it and returns focus to the `本地清算方式` trigger.
- Desktop detail DOM includes `.profile-summary`, `.profile-details`, two `查看主页` links, and the current three-channel payout tablist; the superseded `.creator-profile-overview` is absent.
- Mobile detail preserves the same information hierarchy without overlap or horizontal overflow in the affected controls.
- Browser warning and error log: none.
- Full Vitest suite: 28 files and 161 tests passed.
- Production source TypeScript check excluding test files and Vite production build: passed.
- Repository `npm run build`: currently blocked by the pre-existing `ProjectResourceManager.test.tsx` fixture missing `onGeneratePaymentOrder` and `onEditPaymentOrder`; that unrelated project/Invoice test was intentionally not changed in this task.

## Findings and comparison history

1. Initial P1: the local clearing menu rendered inside a card with hidden overflow, so its option row was clipped by the next Airwallex section.
   - Fix: added an opt-in fixed portal strategy and enabled it only for `beneficiary.bank_details.local_clearing_system`.
   - Post-fix evidence: desktop and mobile captures show the full menu and option copy above the next card.
2. Initial P1: the creator detail screen had drifted from the original source package into a denser custom summary and four-card overview.
   - Fix: restored the original summary, four profile fields, social-card copy, and text link while preserving the current payout-account implementation.
   - Post-fix evidence: desktop and mobile detail captures match the original profile hierarchy and retain the three-channel payout tablist.
3. Post-fix visual, responsive, pointer, keyboard, DOM, console, and regression checks found no actionable P0, P1, or P2 issue in the requested scope.

final result: passed
