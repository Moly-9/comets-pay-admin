# Contract Recognition Field Visual QA

## Visual truth

- Source: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-9957f3d0-6c78-48d4-bcc6-5b2f0ad2bc19.png`
- Implementation: `app/design-qa-implementation.png`
- Comparison: `app/design-qa-comparison.png`
- Browser viewport: 900 x 900 CSS pixels
- Focused source: 558 x 572 pixels
- Focused implementation: 505 x 572 pixels
- Comparison normalization: implementation resized to 558 x 572 pixels to match the source canvas height and width.

## Current state

The implementation screenshot uses a real contract detail review state with 14 recognition fields. Most fields are missing, while the system contract number is present and awaiting confirmation. This covers missing, detected, source, status, and confirmation-button presentation in one view.

## Comparison

- Full view: the contract detail inspector retains the existing tabs, section heading, and scroll behavior.
- Focused view: field cards were replaced by compact three-column definition rows with separators.
- Typography: label, value, source, and state sizes follow the hierarchy in the source; field values remain the strongest text.
- Spacing: row height and vertical rhythm closely match the source while preserving room for editable values and source links.
- Colors: neutral labels, dark values, blue source links, and low-emphasis status backgrounds remain consistent with the existing contract UI.
- Icons/assets: the existing source-location icon is retained. Confirmation uses text only at this size to avoid wrapping and visual weight.
- Copy: existing field labels, source descriptions, status labels, and business wording are unchanged.

## Iteration history

1. Removed bordered field cards and introduced compact label/value/action rows.
2. Reduced field, source, conflict, and account-warning typography and spacing.
3. Initial browser QA found the 48 x 26 confirmation control wrapped onto two lines.
4. Hid confirmation controls for empty fields and changed available confirmation controls to a single-line 36 x 22 text button.
5. Re-captured the focused comparison at 900 x 900; no browser warnings or errors remained.

Final result: passed
