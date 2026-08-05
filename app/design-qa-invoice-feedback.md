# Invoice Feedback And Contract Selector Design QA

## Evidence

- Source visual truth:
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-ba49732f-c47c-4ab8-8581-7c8ad4d2bd0f.png`
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-939fb3e8-ba2e-479d-b014-204430af8835.png`
  - `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-93b0b61f-981b-4811-a191-ef9f3d6fa00f.png`
- Browser-rendered implementation:
  - `/tmp/comets-pay-feedback-modal-crop-converted.png`
  - `/tmp/comets-pay-invoice-contracts-crop.png`
  - `/tmp/comets-pay-feedback-modal-narrow.png`
  - `/tmp/comets-pay-invoice-edit-narrow-closed.png`
- Combined feedback comparison: `/tmp/comets-pay-feedback-modal-comparison.png`
- Desktop viewport: `1280 x 720` CSS px, device scale factor `1`.
- Narrow viewport: `390 x 844` CSS px, device scale factor `1`.
- Source pixels:
  - Feedback modal: `572 x 457`.
  - Audit timeline: `266 x 388`.
  - Invoice edit page: `843 x 670`.
- Implementation pixels:
  - Feedback modal crop: `560 x 587`.
  - Contract selector crop: `760 x 202`.
  - Narrow screenshots: `375 x 812`.
- Density normalization: all inspected captures use 1x density. The feedback comparison
  places the source and implementation crops side by side without resampling.
- State:
  - Invoice `INV-240801` in `达人反馈`.
  - Invoice `INV-301164-01` in edit mode with two linked contracts selected.

## Full-View Comparison

- The feedback modal preserves the existing title, original feedback, reply input and footer
  hierarchy. Its additional height is intentional and contains the requested delivery-channel
  and prototype-boundary content; it remains fully visible at both tested viewports.
- The Invoice edit page keeps the existing two-column desktop layout and single-column narrow
  layout. The linked-contract control stays within the first form section and does not resize or
  overlap adjacent fields.

## Focused Comparison

- The source modal's single sentence incorrectly said that no reply would be sent. The
  implementation replaces it with explicit in-app and email channels, a masked recipient email,
  and a separate prototype limitation and delivery-audit note.
- The source timeline marked creator signing as complete. The implementation keeps
  `Invoice 已生成` complete and presents `达人签署` as the current step with
  `达人反馈 · 待重新签署`.
- The source contract selector used separate purple outlined cards. The implementation uses one
  `9px` gray form boundary, white rows, neutral selected backgrounds and the same focus token as
  other Invoice fields.

## Required Fidelity Surfaces

- Fonts and typography: existing Noto Sans SC stack, weights and compact form hierarchy are
  preserved. New copy wraps without clipping at desktop and `390px`.
- Spacing and layout rhythm: reply channels use a compact two-column desktop layout and one
  column on narrow screens. Contract rows use consistent `9px` field radius and `52px` row height.
- Colors and visual tokens: new controls reuse the page's neutral borders, muted text,
  peach focus ring and restrained purple icon accent. No status relies on color alone.
- Image quality and assets: the changed areas contain no raster imagery. All visible icons use
  the project's existing Lucide library.
- Copy and content: the UI distinguishes intended production delivery from current front-end-only
  simulation and includes delivery status, retry and audit requirements.

## Interaction And Accessibility

- Feedback reply is disabled when empty, enables after input and appends to the local audit
  history after submission.
- The recipient email is masked in the delivery notice.
- Linked contracts remain keyboard-operable native checkboxes inside a labeled `role="group"`.
- Desktop and narrow document scroll width remain within the viewport.
- Browser console warning/error check returned no entries.

## Comparison History

1. Initial source:
   - Reply delivery was described only as a non-sending front-end record.
   - Creator feedback appeared after creator signing in the timeline.
   - Linked contracts appeared as visually separate purple cards.
2. Implemented fix:
   - Added explicit delivery channels and prototype/production boundary.
   - Moved creator feedback back to the signing step.
   - Consolidated contract choices into one form-style selector.
3. Post-fix evidence:
   - Desktop and narrow screenshots show readable content without overlap.
   - Browser interaction confirms reply submission and status history.
   - No actionable P0, P1 or P2 issue remains.

final result: passed
