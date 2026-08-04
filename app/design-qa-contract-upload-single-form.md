# Design QA - 合同上传单页大型表单

## Reference and environment

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-895de8fd-f0ca-4b3d-84ea-178b893764d2.png`
- Implementation URL: `http://127.0.0.1:5173/`
- Browser-rendered initial state: `/tmp/comets-contract-upload-single-form-initial.png`
- Browser-rendered parsed state: `/tmp/comets-contract-upload-single-form-parsed.png`
- Browser-rendered bottom section: `/tmp/comets-contract-upload-single-form-bottom.png`
- Browser-rendered mobile state: `/tmp/comets-contract-upload-single-form-mobile.png`
- Combined comparison: `/tmp/comets-contract-upload-single-form-comparison.png`
- Source pixels: `890 x 588`
- Desktop implementation pixels: `1265 x 712`
- Desktop CSS viewport: `1280 x 720`; device density: `1`
- Mobile implementation pixels and CSS viewport: `390 x 844`; device density: `1`
- Comparison normalization: cropped the implementation to its `1080 x 688` modal and proportionally scaled it to the source height before placing both images in one `1837 x 588` comparison.
- State: initial contract upload form, followed by project and creator selection, parsed synthetic DOCX, and saved contract detail.

## Full-view comparison evidence

- The combined image compares the supplied modal reference and browser-rendered implementation in one input.
- The stepper and project-card pages are intentionally absent because the requested information architecture is one scrollable form rather than four separate screens.
- The implementation preserves the reference's large modal frame, fixed title bar and action footer, white content surfaces, fine gray borders, compact B-side density, restrained radius, and visible scroll affordance.
- The requested low-saturation pink-purple accent replaces the reference's coral selection accent in icons, focus rings, association summary, and count pills.
- The initial viewport exposes association, file upload, recognition, and footer context without hiding the primary action.

## Focused evidence

- The parsed-state capture verifies the two-column association fields, selected project and creator summary, file upload panel, parsed-file row, and enabled primary action.
- The bottom-section capture verifies the two-column recognition cards, source/status hierarchy, save-information section, and fixed footer while the modal body is scrolled.
- A separate source-focused comparison was not useful for parsed and saved states because the supplied reference only depicts the former step-one project list; those additional implementation states were checked at original pixel size instead.

## Required fidelity surfaces

- Fonts and typography: passed. The existing Noto Sans SC stack is preserved with compact B-side sizes, clear section hierarchy, zero negative letter spacing, stable wrapping, and ellipsis for long association labels.
- Spacing and layout rhythm: passed. The modal uses a fixed header/footer, independently scrollable body, `14px` section rhythm, two-column desktop grids, and single-column mobile grids. No desktop or mobile horizontal overflow was detected.
- Colors and visual tokens: passed. White panels, light gray canvas/borders, dark neutral copy, and muted pink-purple accents match the requested professional and restrained direction without relying on color alone for status.
- Image quality and asset fidelity: passed. This form has no raster content; existing Lucide UI icons remain sharp and consistent at desktop and mobile sizes.
- Copy and content: passed. All four sections remain in one form, required relationships are explicit, local-only parsing is stated, recognition status and source are visible, and the footer summarizes save readiness.

## Interaction and runtime checks

- Logged in with the local administrator demo account and opened `合同管理 -> 上传合同`.
- Confirmed the form renders as one semantic form with no step switching or next/previous controls.
- Confirmed creator selection is disabled until a project is selected and only project-linked creators appear.
- Created a temporary in-memory QA project with one linked creator to exercise the existing stable-ID association path.
- Uploaded a synthetic, redacted DOCX containing Advertiser, Publisher, IO number, campaign period, and total fee.
- Confirmed the file parsed locally into `14` recognition fields and the footer changed to `1 份文件已解析`.
- Confirmed the save action stayed disabled before parsing, became enabled after parsing, and opened the saved contract detail with the selected project and creator.
- Confirmed the `390 x 844` viewport has no horizontal document overflow; header, scroll body, and footer remain usable.
- Browser console warnings/errors from the local application: none.
- Automated verification: `44/44` tests passed; TypeScript and Vite production build passed.

## Findings and comparison history

1. First comparison: no actionable P0, P1, or P2 findings.
2. Intentional difference: the reference's five-step navigation and project-card list were replaced by the requested single-form information architecture.
3. Intentional difference: coral emphasis was replaced by the requested low-saturation pink-purple accent.
4. Post-interaction evidence: parsed, scrolled-bottom, and mobile captures show no new layout or usability regression.

## Follow-up polish

- No P3 change is required for this focused request.

final result: passed
