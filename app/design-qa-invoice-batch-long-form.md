# Design QA - Invoice 批量生成长表单

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-39cee5d1-acac-4552-bace-2bbde7341fa5.png`
- Source pixels: `1473 x 790`
- Existing product reference: `app/src/pages/InvoiceBuilderPage.tsx` and the shared `.invoice-builder-*` styles in `app/src/index.css`
- Implementation URL: `http://127.0.0.1:5173/`
- Browser viewport: `1280 x 720` CSS px
- Implementation screenshot: unavailable because the selected Codex in-app browser reports that `playwright_element_screenshot` and `tab_content_export` are unsupported.
- State: media account, six project creators selected, one shared Description, Price values from USD 800 to USD 1,300, Amount `1`, and all six Invoice files generated.

## Comparison evidence

- The supplied screenshot shows the previous project-and-creator step. The requested implementation intentionally removes the five-step progress navigation and keeps its compact three-column creator picker inside a continuous long form.
- Browser-rendered DOM measurements show a `821.73px` form inside a `1280px` viewport, with `document.scrollWidth = document.clientWidth = 1265px`.
- Search for `oliver` reduced the selected project's creator list from 18 rows to one matching creator.
- A different project exposed six eligible creators. “全选项目内达人” selected all six and created six fee rows in place.
- All six rows rendered `USD` and `默认空中云汇`; the shared Description propagated to every row.
- No compared screenshot could be captured from the selected browser surface, so side-by-side visual evidence and focused-region image evidence are blocked.

## Required fidelity surfaces

- Fonts and typography: DOM and CSS inspection confirm reuse of the existing Noto Sans SC stack, Invoice builder heading sizes, field labels, helper copy, and input typography. Screenshot comparison is blocked.
- Spacing and layout rhythm: the implementation reuses `.invoice-builder-form`, `.invoice-builder-section`, `.invoice-form-grid`, and `.invoice-builder-footer`. Desktop DOM checks found no text-container overflow. Screenshot comparison is blocked.
- Colors and visual tokens: the existing neutral surfaces, coral focus state, semantic success/warning/error colors, borders, radii, and shared button styles are reused. Screenshot comparison is blocked.
- Image and icon fidelity: the target contains no product imagery. Existing Lucide icons are used for controls; no custom SVG, CSS illustration, or placeholder image was added.
- Copy and content: passed by browser DOM inspection. The page presents one continuous flow and explicitly labels the fixed `USD` currency and `默认空中云汇` account.

## Interaction and runtime checks

- Project options are limited to the projects owned by the current media user; administrators and owners can access all projects.
- Creator search works for name, Handle, and platform.
- Project-wide select-all skips collaborations that already have a generated Invoice.
- Shared Description propagates to all selected creator rows.
- Price and Amount updates recalculate row totals and the batch total in real time.
- Six valid rows changed from `需补充` to `可生成` and produced six independent PDF/DOCX results.
- Successful rows entered `待签署` through the existing generated-Invoice integration.
- Desktop document-level horizontal overflow: none.
- Browser console errors: none.
- Responsive `390px` screenshot capture is blocked by the selected browser surface; the CSS contains the mobile row-panel and two-column-to-one-column breakpoints.
- `npm test`: 26 files and 145 tests passed.
- `npm run build`: passed.

## Findings and comparison history

1. Initial P1: the existing implementation divided the task into five mutually exclusive screens.
   - Fix: removed the step state, progress bar, next/back controls, and conditional stage rendering; all sections now remain visible in one long form.
   - Post-fix evidence: browser DOM contains all five business sections simultaneously.
2. Initial P1: media users had no selectable projects because Invoice generation reused project-content editing permissions.
   - Fix: batch Invoice projects now use media ownership, while administrators and owners retain full access.
   - Post-fix evidence: the media test account receives seven project options.
3. Initial P2: creator selection lacked search and only supported the current step's basic select-all.
   - Fix: added name/Handle/platform search, project-wide select-all, existing-Invoice exclusion, selected count, and immediate row synchronization.
   - Post-fix evidence: search and six-person select-all browser checks passed.
4. Remaining blocker: the chosen in-app browser cannot export a browser-rendered screenshot. Source and implementation could not be placed in a combined visual comparison, and a 390px viewport capture could not be produced from that surface.

final result: blocked
