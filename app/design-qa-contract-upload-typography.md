# Design QA - 合同上传识别字段字号

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-cf427dd4-2328-4e4c-8961-e6d35f48e049.png`
- Implementation URL: `http://127.0.0.1:5173/`
- Desktop implementation: `/tmp/comets-contract-upload-typography-tall.png`
- Mobile implementation: `/tmp/comets-contract-upload-typography-mobile.png`
- Combined comparison: `/tmp/comets-contract-upload-typography-comparison.png`
- Source pixels: `980 x 683`
- Desktop implementation pixels and CSS viewport: `1280 x 900`; device density: `1`
- Mobile implementation pixels and CSS viewport: `390 x 844`; device density: `1`
- Comparison normalization: cropped the desktop implementation to the same file-and-recognition region, scaled it proportionally to the source height, and placed both images in one `1972 x 683` comparison.
- State: one locally parsed, synthetic DOCX with the source-file row and two-column recognition fields visible.

## Comparison evidence

- The source shows file names and recognition-field labels at the inherited body size, making every bold line compete with the `识别结果` section title.
- The implementation establishes an explicit hierarchy: section title `13px`, file name and field title `12px`, detected value `11px`, status/source copy `9.5px`.
- The combined comparison shows the reduced bold labels preserve scanning and bilingual legibility while no longer dominating each card.
- The long filename remains a single-line ellipsis and the document-type control retains its original width.

## Required fidelity surfaces

- Fonts and typography: passed. Noto Sans SC, existing 700 weight, zero negative letter spacing, and all existing value/status sizes remain unchanged. Only the oversized inherited bold sizes were scoped to `12px` with `1.4` line height.
- Spacing and layout rhythm: passed. Card dimensions, padding, two-column tracks, section spacing, and fixed footer are unchanged.
- Colors and visual tokens: passed. No colors, borders, backgrounds, or semantic states changed.
- Image quality and asset fidelity: passed. No raster assets or icons changed.
- Copy and content: passed. File names, values, sources, labels, and statuses are unchanged.

## Interaction and runtime checks

- Confirmed computed file-name size: `12px / 16.8px`.
- Confirmed computed recognition-title size: `12px / 16.8px`.
- Confirmed recognition value remains `11px / 16.5px`.
- Confirmed desktop and `390 x 844` mobile layouts have no horizontal overflow.
- Browser console warnings/errors from the local application: none.

## Findings and comparison history

1. Initial P2 from the supplied screenshot: inherited bold text was too large and weakened the form hierarchy.
2. Fix: added scoped file-name and recognition-title typography rules without changing layout or behavior.
3. Post-fix comparison: no actionable P0, P1, or P2 findings remain.

## Follow-up polish

- None required for this focused adjustment.

final result: passed
