# Design QA - Invoice 模板隐藏关联项目

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-99351308-e509-4f9e-9030-3960b07a973c.png`
- Implementation URL: `http://127.0.0.1:5173/`
- Browser-rendered implementation: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/comets-invoice-project-hidden-focused.png`
- Combined comparison input: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/comets-invoice-project-hidden-comparison.png`
- Mobile implementation: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/comets-invoice-project-hidden-mobile-preview.png`
- Source pixels: `1431 x 759`
- Implementation comparison pixels: `1431 x 759`
- Browser viewport for the focused capture: `1706 x 1000` CSS pixels; implementation clip: `1431 x 759`; device density: `1`
- Mobile viewport: `390 x 844` CSS pixels; device density: `1`
- State: Invoice builder initial state with no creator or project selected, matching the supplied screenshot.

## Comparison evidence

- Full-view comparison: the combined comparison places the supplied screenshot and browser-rendered implementation in one image at identical pixel dimensions.
- Focused comparison: the source itself is already cropped to the Invoice builder form and live preview, so no additional crop was needed.
- The implementation preserves the supplied layout, field order, typography hierarchy, form controls, invoice table, payment section, and signature area.
- The only intentional content change is the removal of the `Project:` row. The fee table now follows the date and currency metadata without an empty project line.

## Required fidelity surfaces

- Fonts and typography: passed. Existing application and Invoice font families, sizes, weights, line heights, wrapping, and hierarchy are unchanged.
- Spacing and layout rhythm: passed. Removing the project row closes the unused vertical gap and moves the fee table upward without changing surrounding padding, grid proportions, borders, radii, or elevation.
- Colors and visual tokens: passed. No colors, semantic states, borders, or backgrounds changed.
- Image quality and asset fidelity: passed. This screen contains no new raster assets; existing icons and COMETS brand assets are unchanged.
- Copy and content: passed. Existing builder copy remains unchanged. `Project:` and the selected project name are absent from the Invoice template, while the internal `关联项目` control remains visible in the system form.

## Interaction and runtime checks

- Logged in with a local administrator demo account and opened `Invoice 管理 -> 生成 Invoice`.
- Selected `Mina Kato`; the project selector became enabled and showed only the two records associated with that creator.
- Selected `Once Human主机上线KOL合作项目`; currency, deliverable description, and `USD 3,240.00` were populated.
- Confirmed the selected project remains visible in the system association control but is absent from the live Invoice preview.
- Confirmed the blank screenshot state also omits the `Project:` row.
- Confirmed the `390 x 844` layout has no horizontal document overflow; the Invoice preview remains readable and does not contain the project label.
- Browser console warnings/errors: none.
- Automated checks: `37` tests passed; `npm run build` passed.

## Findings and comparison history

1. Earlier P2: the Invoice template exposed an internal project association as a visible `Project:` row.
   - Fix: removed that row from the live preview, PDF renderer, and DOCX renderer; also replaced project-based PDF/DOCX metadata descriptions with the Invoice number.
   - Post-fix evidence: the combined desktop comparison and mobile preview show date and currency followed directly by the fee table.
2. Post-fix comparison: no actionable P0, P1, or P2 findings remain.

## Follow-up polish

- None required for this focused change.

final result: passed
