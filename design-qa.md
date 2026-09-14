# 合同达人签署确认弹窗 Design QA

## Evidence

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-6faa2565-65a2-4b7a-a69f-ff4cb01dfc68.png`
- Source pixels: `927 × 792`, RGBA, treated as a 1× desktop reference.
- Primary implementation capture: `outputs/design-qa-contract-signature/implementation-927x792.jpg`
- Implementation CSS viewport: `927 × 792`; captured content pixels: `912 × 779` because the in-app browser capture excludes scrollbar gutters.
- Density normalization: the source was resampled to `912 × 779` at 1× for equal-pixel comparison and saved as `outputs/design-qa-contract-signature/source-normalized-912x779.jpg`.
- Full-view comparison: `outputs/design-qa-contract-signature/comparison-full.jpg` (`1836 × 779`).
- Focused modal-chrome comparison: `outputs/design-qa-contract-signature/comparison-modal-chrome.jpg` (`1836 × 192`).
- Additional responsive captures:
  - `outputs/design-qa-contract-signature/implementation-1640x908.jpg` — CSS viewport `1640 × 908`, captured pixels `1625 × 900`.
  - `outputs/design-qa-contract-signature/implementation-1024x768.jpg` — CSS viewport `1024 × 768`, captured pixels `1009 × 559`.
  - `outputs/design-qa-contract-signature/implementation-768x1024.jpg` — CSS viewport `768 × 1024`, captured pixels `753 × 1004`.
  - `outputs/design-qa-contract-signature/implementation-390x844.jpg` — CSS viewport `390 × 844`, captured pixels `375 × 812`.
- Compared state: the media user has applied an uploaded contract whose confirmed signature state is “未签署” and has opened “发送达人签署”.

## Full-view comparison

The implementation preserves the reference modal grammar: dimmed gray backdrop, white rounded panel, separated title bar, independently scrollable body, and fixed footer actions. The contract-specific confirmation content is intentionally denser than the generic request form in the reference, so it uses grouped read-only sections and a desktop two-column grid instead of reproducing unrelated request fields. At the normalized viewport the signer flow remains fully contained, with the footer visible while the body scrolls.

## Focused comparison

The focused header/footer comparison confirms equivalent chrome hierarchy: left-aligned title, right close control, subtle dividers, secondary cancel button, and high-contrast primary action aligned at the lower right. The implementation uses the existing COMETS Pay typography, Lucide icon family, neutral borders, and pale-purple focus/notice tokens rather than introducing a parallel visual system.

## Findings

- No actionable P0, P1, or P2 visual mismatches remain.
- Typography: the app keeps its existing Noto Sans SC/system fallback, compact form scale, readable weight hierarchy, and safe wrapping for long payment values. The visual density is consistent with the surrounding contract detail UI.
- Spacing and layout: desktop and tablet views retain the two-column summary/payment grids; the `390px` view collapses cleanly to one column. The title bar and footer remain fixed, and the body provides vertical scrolling without hiding actions.
- Colors and tokens: neutral borders, white surfaces, gray backdrop, pale-purple information treatment, error red, and dark primary action follow the existing COMETS Pay tokens and the supplied modal reference.
- Image quality and assets: the source contains no product imagery requiring recreation. Existing Lucide icons remain sharp at all checked viewports; no placeholder image, CSS illustration, or custom SVG substitute was introduced.
- Copy and content: the popup clearly distinguishes confirmed contract data, payment data, signer identity, simulated DocuSign behavior, and the resulting “待签署” state.
- Accessibility and interaction: the shared modal supplies `role="dialog"`, `aria-modal`, focus trapping, Escape handling, and focus restoration. The signer error uses `aria-invalid`, `aria-describedby`, and `role="alert"`; fixed footer controls remain reachable on narrow screens.

## Interaction verification

- Opened the signing dialog from the right side of the “合同尚未完成签署” validation card.
- Cleared the signer and verified “请填写签署人。” appears while the dialog and contract state remain unchanged.
- Restored the signer, sent the local simulated DocuSign request, and verified the contract entered `SENT_FOR_SIGNATURE` with summary text “待达人签署”.
- Used “模拟达人完成签署” and verified the contract entered `CONFIRMED` with summary text “已签署”.
- Checked `1640 × 908`, `1024 × 768`, `768 × 1024`, and `390 × 844` layouts; no horizontal viewport overflow or hidden footer action was observed.
- Checked browser console warning/error logs after the flow: none.

## Comparison history

### Iteration 1

- P0: none.
- P1: none.
- P2: none.
- Fixes required after visual comparison: none. The first equal-pixel comparison passed because the implementation follows the reference modal structure while appropriately adapting the body to the contract-signing task.
- Post-comparison evidence: `comparison-full.jpg`, `comparison-modal-chrome.jpg`, and the four responsive captures listed above.

## Follow-up polish

- No P3 item is required for this scope.

final result: passed
