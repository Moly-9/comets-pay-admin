# Payout Account Actions Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-110d93d4-fc68-49f6-b7fe-fa210e4603eb.png`
- Desktop implementation:
  - `tmp/qa/payout-account-actions-clean-1125x865.png`
  - `tmp/qa/payout-account-actions-menu-1125x865.png`
  - `tmp/qa/payout-account-actions-delete-dialog-fixed-1125x865.png`
  - `tmp/qa/payout-account-actions-switch-dialog-1125x865.png`
- Responsive implementation:
  - `tmp/qa/payout-account-actions-narrow-accounts-390x844.png`
  - `tmp/qa/payout-account-actions-narrow-menu-390x844.png`
  - `tmp/qa/payout-account-actions-narrow-switch-dialog-390x844.png`
- Side-by-side comparisons:
  - `tmp/qa/payout-account-actions-comparison-clean.png`
  - `tmp/qa/payout-account-actions-comparison-menu.png`

## Normalization

- Source pixels: 1125 x 865.
- Desktop browser viewport request: 1125 x 865 CSS px.
- Desktop browser capture: 1110 x 853 px because the in-app browser reserves scrollbar/chrome space.
- Comparison normalization: implementation capture resized to 1125 x 865 and placed beside the unmodified source on a 2250 x 865 canvas.
- Narrow viewport request: 390 x 844 CSS px.
- Narrow browser capture: 375 x 812 px after in-app browser chrome reservation.
- Device scale factor: 1; no density conversion was required.

## State

Mina Kato creator edit modal, payout-account section, with one verified default
Airwallex account, one pending PayPal account, and one incomplete Airwallex
account. Desktop and narrow states cover the card list, open action menu,
delete confirmation, and default-account replacement blocker.

## Findings

- No actionable P0, P1, or P2 issues remain.
- Typography: the enhancement inherits the existing system font stack and uses
  the same compact hierarchy, weights, line heights, and zero letter spacing as
  the surrounding account editor.
- Spacing and layout: menu triggers stay inside every card without overlapping
  the default star. Desktop cards retain the existing three-column layout;
  narrow cards stack without horizontal overflow. The narrow confirmation
  dialog becomes a bottom sheet and keeps both actions visible.
- Colors and tokens: borders, neutral surfaces, focus rings, warning state, and
  destructive red match the existing COMETS Pay editor. Disabled actions remain
  visually distinct.
- Image and icon quality: no raster assets are required for this control-only
  change. All new icons use Lucide React, including `MoreHorizontal`, and render
  sharply at both tested sizes.
- Copy: menu labels, confirmation titles, descriptions, account summary fields,
  empty state, disabled reason, and success messages match the requested
  Chinese copy. The source screenshot is an annotated location reference, so
  the implementation intentionally preserves the existing modal width and
  responsive behavior rather than reproducing the annotation border.

## Focused Comparison

Focused review covered the payout-account card header, default star, persistent
menu trigger, menu alignment, danger item, dialog account summary, disabled
replacement action, and narrow bottom-sheet controls. These details are legible
in the dedicated menu and dialog captures, so no additional crop was needed.

## Interaction Verification

- Menu opens with mouse and keyboard focus moves to the first item.
- Arrow keys, Home, End, Enter, outside click, and Escape behavior were tested.
- Escape returns focus to the menu trigger.
- Delete confirmation defaults focus to Cancel and Escape cancels.
- The default account does not show Set as default.
- A default account with no verified replacement blocks confirmation and
  explains that a new verified account is required.
- Delete, disable, switch-and-disable, and re-enable flows were exercised.
- Available-account count, default star, disabled status, and success toasts
  update after actions.
- Browser `console` and `pageerror` events were monitored during menu,
  cancellation, and edit interactions; no errors were emitted.

## Comparison History

1. Initial pass found one P2 issue: after opening a delete or disable
   confirmation, the originating action menu remained visible beneath the
   backdrop.
2. The destructive-action entry point now closes the menu before opening the
   dialog.
3. Post-fix evidence:
   `tmp/qa/payout-account-actions-delete-dialog-fixed-1125x865.png` shows only
   the confirmation dialog, and the accessibility snapshot confirms the menu
   is absent while Cancel owns focus.

## Follow-up Polish

- No P3 visual issue is required for handoff.

final result: passed
