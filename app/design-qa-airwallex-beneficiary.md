# Airwallex 达人收款资料 Design QA

## Comparison Evidence

- Source visual truth:
  - `qa/airwallex-beneficiary/source-address-fields.png` (`886 x 671`)
  - `qa/airwallex-beneficiary/source-payment-path.png` (`846 x 432`)
- Browser-rendered implementation:
  - `qa/airwallex-beneficiary/implementation-current-address.jpg` (`1265 x 712`)
  - `qa/airwallex-beneficiary/implementation-payment-path.jpg` (`1265 x 712`)
- Side-by-side comparison:
  - `qa/airwallex-beneficiary/comparison-address-source-left-implementation-right.png`
  - `qa/airwallex-beneficiary/comparison-payment-source-left-implementation-right.png`
- Browser viewport: `1280 x 720` CSS px, `devicePixelRatio: 1`.
- State: 新建达人档案，Airwallex 本地 Schema 预览，`US / USD / PERSONAL / LOCAL / ACH`。
- Density normalization: source and implementation focused crops were normalized to `846px`
  width before side-by-side comparison. Source is on the left and implementation is on the right.
- The reference uses `GB / GBP / LOCAL / FPS`, while the implementation screenshot uses the
  default local-preview data. The compared target is the field hierarchy, control styling,
  spacing and interaction state rather than those fixture values.

## Findings

No actionable P0, P1 or P2 mismatch remains.

- Fonts and typography: the implementation continues to use the product's Noto Sans SC stack,
  with field labels, aliases and helper text matching the compact hierarchy in the reference.
- Spacing and layout rhythm: the two-column payment controls, full-width transfer method and
  compact section treatment match the reference. Removing three address inputs substantially
  reduces the address section without leaving dead space.
- Colors and visual tokens: borders, neutral surfaces, muted aliases and peach selected states
  continue to use the existing COMETS Pay tokens visible in the reference.
- Image and icon quality: no source image asset was required. Existing Lucide icons remain sharp
  at the rendered size and no custom SVG or placeholder asset was introduced.
- Copy and content: `Current address` replaces the old state label and has no required marker.
  `beneficiary.address.street_address`, `beneficiary.address.city` and
  `beneficiary.address.postcode` are absent from the local preview. The payment path now includes
  recipient type before Airwallex determines subsequent fields.

## Interaction Verification

- Changed `LOCAL` to `SWIFT`; the local clearing field was removed and SWIFT-specific fields appeared.
- Entered a three-character bank keyword in a `DYNAMIC_SELECT`; the request used the fixed COMETS Pay
  proxy and displayed the proxy error instead of accepting an unverified free-text value.
- Confirmed `Current address` exists once and the three removed beneficiary address paths exist zero times.
- Confirmed the browser console contained no warning or error entries.
- Confirmed a missing Form Schema proxy leaves the form in clearly labelled local-preview mode.

## Comparison History

- Initial comparison: passed. No P0, P1 or P2 visual issue required a repair iteration.
- Intentional product difference: the implementation adds `收款人类型`, because the requested
  workflow requires country, currency, recipient type and transfer method before schema generation.
- Intentional integration difference: fields returned as required by a real Airwallex Schema remain
  authoritative even if the local preview omits the legacy address inputs.

## Follow-up Polish

- Re-capture the same scenarios with sandbox Airwallex data after the server proxy is implemented,
  so field labels and country-specific requirements can be compared against live Schema responses.

final result: passed
