# Word Contract Preview Design QA

## Evidence

- Source visual truth:
  `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-73bf7187-4b58-413c-a989-53d8a702fb2c.png`
- Browser-rendered implementation:
  `qa/word-contract-preview-final-1142x773.png`
- Side-by-side comparison:
  `qa/word-contract-preview-comparison.png`

## Normalization

- Source image: 1157 x 783 px.
- Browser viewport request: 1157 x 783 CSS px at device scale factor 1.
- Implementation screenshot: 1142 x 773 px after the in-app browser reserved
  its scrollbar/chrome area.
- Comparison: the implementation capture is normalized to 1157 x 783 px and
  placed beside the unchanged 1157 x 783 px source image.

## State

Contract management detail after uploading `nebula-io.docx`. The uploaded DOCX
is rendered in the existing "合同全文" panel. Both existing file actions read
"下载原件" and reference the original Word blob.

## Findings

- No actionable P0, P1, or P2 issue remains.
- Typography: the surrounding contract detail continues to use the existing
  COMETS Pay typography. Word body copy uses a document-oriented serif stack
  inside the preview only, with the original accents and capitalization intact.
- Spacing and layout: the existing detail header, summary cards, preview panel,
  tabs, and structured field area are unchanged. The Word page is centered
  within the original preview viewport and scrolls inside that panel.
- Colors and tokens: the preview uses the existing neutral document canvas,
  white page, subtle border, and restrained shadow. Existing system buttons and
  semantic status colors are untouched.
- Image and asset quality: this change contains no new raster or decorative
  assets. Existing system icons remain unchanged and sharp.
- Copy and content: the former Word action "新窗口打开" now reads "下载原件".
  PDF still retains its original "下载原文件" and "新窗口打开" actions.

## Focused Comparison

The focused comparison covers the user-marked "合同全文" region. The reference
shows the Word panel empty; the implementation shows the DOCX title,
paragraphs, headings, and table-capable document surface inside the same panel.
No additional crop was needed because the relevant controls and preview body
are legible in the full viewport.

## Interaction Verification

- DOCX upload created no new browser tab and did not open or download the
  original automatically.
- DOCX text, including `INSERTION ORDER`, rendered inside the existing iframe.
- Both Word file links point to the original blob, include
  `download="nebula-io.docx"`, and have no new-window target.
- The original DOCX is available through the manual download link.
- Legacy `.doc` uploads stay in the dashboard and show a clear unsupported
  preview message with manual original download.
- PDF upload still uses its original PDF blob iframe, has no `srcdoc`, and keeps
  the original PDF actions.
- Browser console warning/error log was empty after the tested flows.

## Comparison History

1. The first implementation attempted to override `URL.createObjectURL`, which
   is immutable in the target browser and allowed the old Word behavior to run.
2. Word uploads now use a capture-phase file proxy: React receives a local
   HTML preview blob while the original Word blob is retained for download.
3. A repeated download-label rewrite caused a mutation loop during verification.
   The label update is now idempotent.
4. Post-fix evidence shows DOCX content rendered in the original panel, no new
   blob tab after upload, and no console errors.

## Follow-up Polish

- No P3 visual issue is required for this scoped change.

final result: passed
