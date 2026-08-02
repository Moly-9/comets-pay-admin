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

## Five-Step Contract Upload

### Evidence

- Project and project-creator linkage:
  `qa/contract-upload-project-creator.png`
- Extracted fields confirmed before saving:
  `qa/contract-upload-five-step.png`
- Saved contract detail with upload associations:
  `qa/contract-upload-linked-detail.png`

### Verification

- The upload action now opens the ordered flow: project, project creator, file,
  extracted-field confirmation, and save.
- The creator select remains disabled until a project is selected.
- Projects with only a creator count and no linked creator profiles show a
  blocking explanation instead of displaying guessed creators.
- After a creator profile is linked from the project detail, only that
  project's linked creators appear in the upload select.
- DOCX parsing populated Advertiser, IO number, platform/channel, dates, fees,
  and payment terms before save.
- Project and Publisher use the selected system relationship as the
  authoritative value and carry into the saved contract detail.
- PDF and Word files both reach the original contract detail flow. Existing
  preview, original-file download, field editing, and final payment-readiness
  confirmation remain available.
- Browser warning/error logs were empty after Word and PDF end-to-end tests.

## Searchable Contract Project Selector

### Evidence

- Searchable selector with draft projects:
  `qa/contract-upload-project-search.png`
- Reference and implementation comparison:
  `qa/contract-upload-project-search-comparison.png`

### Verification

- The project field accepts project-name or project-number searches and opens
  the matching dropdown while typing.
- Dropdown rows display only the project name, customer, and status; project
  numbers remain searchable without being shown in the option text.
- Draft projects created in “我的项目” are persisted locally and appear with
  a restrained draft badge in the upload selector.
- Mouse selection and Arrow Up/Down plus Enter selection both work.
- Changing the project still resets the creator, file, extracted fields, and
  save readiness. The creator selector remains limited to profiles linked to
  the selected project.
- Browser warning/error logs were empty after the interaction checks.

## Contract Payment Readiness States

### Evidence

- Uploaded contract awaiting review:
  `qa/contract-readiness-pending.png`
- Confirmed contract ready for payment projects:
  `qa/contract-readiness-confirmed.png`
- Confirmed-state reference and implementation comparison:
  `qa/contract-readiness-comparison.png`

### Verification

- A newly uploaded contract displays `等待解析中` in the payment-readiness
  metric and in the contract list through both parsing and manual-review phases.
- The pending list state follows the existing attention treatment with an
  orange 6px circular marker and orange status text.
- The readiness state changes only after the user clicks `确认解析内容` and all
  required fields are complete.
- After confirmation, both the detail metric and contract-list status display
  `可用于付款项目`.
- The confirmed list state follows the existing ready treatment with a green
  6px circular marker and green status text.
- Contract metadata continues to show its separate processing phase
  (`待确认` or `已确认`) without being conflated with payment readiness.
- Browser warning/error logs were empty after the complete upload, review,
  confirmation, and list-return flow.

final result: passed
