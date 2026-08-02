# Contract Parsing Review Design QA

## Evidence

- Source visual truth:
  `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-3f5f8991-7655-44d6-951a-cf70cb8834c9.png`
- Awaiting confirmation:
  `qa/contract-review-awaiting-confirmation.png`
- Field editing:
  `qa/contract-review-field-editing.png`
- Confirmed and available for request:
  `qa/contract-review-confirmed.png`
- Side-by-side comparison:
  `qa/contract-review-comparison.png`

## Normalization

- Source image: 1566 x 794 px.
- Awaiting-confirmation capture: 1551 x 786 px at device scale factor 1.
- The comparison normalizes the implementation capture to 1566 x 794 px and
  places it beside the unchanged source image.
- Focused editing and confirmed captures: 1265 x 712 px at device scale factor
  1, using the in-app browser's default viewport.

## State

The contract detail is shown after local DOCX parsing. The source layout,
document preview, summary cards, tabs, and field rows remain in place. The
implementation adds field-level edit controls, a compact review-status banner,
and a top-right confirmation action.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Typography: all new controls inherit the existing COMETS Pay font stack,
  weights, compact sizes, and zero letter spacing. Input text matches the
  surrounding field-value hierarchy.
- Spacing and layout: pencil controls occupy a stable 28 px column and do not
  move field labels or source text. The three top-right actions fit on desktop;
  the confirmation action spans the mobile action row.
- Colors and tokens: editing uses the existing restrained purple used by the
  contract inspector. Confirmation uses the system's established success green,
  while download remains the existing black primary action.
- Image and icon quality: edit and confirmation controls use the exact Lucide
  Pencil and CircleCheckBig assets. No handcrafted or placeholder icons are
  used.
- Copy and content: parsing, awaiting confirmation, field editing, confirmed,
  and request-ready states use concise Chinese labels consistent with the
  current module.

## Focused Comparison

The full-view comparison verifies that the existing contract detail layout is
preserved. The focused editing capture verifies the user-marked inspector area:
fields remain read-only until their pencil icon is clicked, then only that row
shows an input with Cancel and Save actions.

## Interaction Verification

- A newly uploaded DOCX entered the parsing workflow and produced detected
  values and source labels.
- The inspector contained zero inputs before an edit icon was clicked.
- Clicking the Publisher pencil displayed one editor; Cancel restored the
  read-only row without changing the value.
- Saving `Léa Martin Studio` updated only Publisher and marked it as an
  unconfirmed manual edit.
- Payment and Invoice fields were parsed and received their own edit buttons.
- The confirmation button changed the contract to `已确认`, the readiness card
  to `可用于请款`, and the list row to `可用于请款`.
- Editing and saving after confirmation revoked readiness and returned the
  contract to `待确认`, requiring another unified confirmation.
- The contract amount card updated from the parsed Project Total Fees value.
- Browser console warning/error logs were empty after the complete flow.

## Comparison History

1. The first verification pass exposed repeated DOM writes that caused a
   mutation loop during upload.
2. Status and banner updates were made idempotent, removing the loop.
3. A subsequent pass found the review banner could move above the section
   heading after a React tab render.
4. The enhancer now restores the heading-first order only when needed.
5. Post-fix screenshots and DOM snapshots show stable layout, working editing,
   correct confirmation gating, and list-state synchronization.

## Follow-up Polish

- No P3 issue is required for this scoped workflow.

final result: passed
