# Request Project Extra Fields Design QA

- Source visual truth: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-ea97a7f1-963e-4d4a-878b-57cefd0cce67.png`
- Implementation full view: `artifacts/request-project-extra-fields/form-reference-viewport.png`
- Implementation focused view: `artifacts/request-project-extra-fields/form-focused.png`
- Responsive evidence: `artifacts/request-project-extra-fields/form-ipad.png`, `artifacts/request-project-extra-fields/form-mobile.png`
- Source pixels: 962 x 796
- Implementation pixels: 955 x 784 from a 970 x 796 CSS viewport, device scale factor 1; in-app browser chrome accounts for the 15 x 12 pixel capture delta
- Additional CSS viewports: 1284 x 904 desktop, 1024 x 768 iPad, 390 x 844 narrow screen
- State: empty New Project form, with the added cost type, fee bearer, remark, and attachment controls

## Full-view comparison

The implementation keeps the reference's single modal hierarchy, white surface, subdued border treatment, compact typography, field rhythm, fixed footer, and scrollable content area. The existing product standard uses an 820px modal, which is intentionally preserved; the reference capture has a narrower modal. The two added required fields form a balanced row below the payment plan, while the optional remark follows the existing full-width textarea pattern.

## Focused comparison

The focused modal comparison confirms consistent label weights, required marks, input heights, 9px input radii, neutral placeholder color, and 12px row gaps. No raster imagery or custom decorative assets are present in the source; Lucide icons are retained for the upload, attachment, removal, and close actions.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Typography: Noto Sans SC, weights, sizes, line heights, and zero letter spacing follow the existing system and remain readable across all checked viewports.
- Spacing and layout: desktop and iPad preserve the two-column payment/detail rows; 390px switches them to one column without horizontal overflow. The fixed footer does not cover inaccessible content because the modal body remains vertically scrollable.
- Colors and tokens: controls use the existing neutral borders and peach focus token; attachment affordances use the system's restrained purple accent.
- Image quality: not applicable; neither source nor implementation contains product imagery. Standard interface icons come from the installed Lucide library.
- Copy: labels, placeholders, required/optional states, fee-bearer options, and local-only attachment note match the requested behavior.

## Interaction QA

- Required validation reports both `请填写成本类型` and `请选择手续费承担方`.
- Fee bearer exposes `付款方`, `收款方`, and `各自承担`.
- A complete draft was created with `达人合作费`, `各自承担`, and a remark; all values appeared in My Projects > Request Project Information.
- Request Project detail includes the same shared fields and attachment presentation through source and regression assertions.
- File chooser injection was blocked by the in-app browser's native chooser timeout. The upload input, metadata mapping, duplicate prevention, remove action, and edit hydration passed TypeScript/build validation, but automated binary selection remains a residual test gap.
- Browser console: no application errors or warnings.

## Comparison history

- Initial implementation: no P0/P1/P2 visual mismatch. Added the missing full-width grid rule for `.project-info-wide` before the final capture so remarks and attachment rows span the detail card consistently.
- Final capture: desktop, iPad, and 390px layouts are coherent with no clipped fields or horizontal overflow.

## Follow-up polish

- P3: a future backend implementation should replace browser-memory attachment metadata with authenticated upload, durable storage, download controls, and server-side validation.

final result: passed
