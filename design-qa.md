# Contract Recognition Design QA

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-7b2a92d1-3080-45d1-94a8-bb2cc816edf4.png`
- Upload screenshot: `qa/contract-upload-dialog.png`
- Review screenshot: `qa/contract-recognition-review-final.png`
- Combined comparison: `qa/reference-vs-review.png`
- Viewport: 1595 x 682 CSS px
- Source pixels: 1595 x 682 at 1x
- Implementation pixels: 1595 x 682 at 1x
- State: contract management visual reference compared with parsed DOCX review workspace

## Full-view comparison

The implementation preserves the existing COMETS Pay top bar, navigation, canvas color,
typography, compact controls, border treatment, and restrained shadow/radius language.
The review workspace stays inside the original main content bounds and does not replace
or restyle the contract management list.

## Focused comparison

The upload modal was checked separately because the reference does not show an upload
state. It uses the existing system's compact title hierarchy, black primary action,
neutral secondary action, 7-8 px radii, thin borders, and Noto Sans SC typography.
The review split view was checked for table-like density, field alignment, source links,
status colors, disabled state, and scroll containment.

## Findings

- No actionable P0, P1, or P2 findings remain.
- P3: the DOCX preview intentionally uses a document serif font so contract content is
  distinguishable from management UI text.

## Comparison history

1. P1: the first review workspace started at the top of the main element and covered the
   right side of the global top bar.
2. Fix: derive the workspace top edge from the rendered header bottom, retain the main
   element's left/width bounds, and lock the underlying page scroll while reviewing.
3. Post-fix evidence: `qa/contract-recognition-review-final.png` shows the complete top
   bar, unchanged navigation, one workspace scrollbar, and no overlap.

## Interaction verification

- Opened the original contract management page and its existing upload action.
- Uploaded a local DOCX through the browser file chooser.
- Parsed 14 summary/payment fields and displayed paragraph-level sources.
- Switched to Payment & Invoice, confirmed Project Total Fees, and observed 1/14.
- Returned to the unchanged original contract list.
- Browser console errors and warnings: none.

final result: passed
