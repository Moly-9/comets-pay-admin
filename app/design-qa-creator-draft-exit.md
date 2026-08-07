# Creator Draft Exit Design QA

## Comparison Target

- Source design truth: `enhancements/project-draft-guard.css` and `enhancements/project-draft-guard.js`.
- Reported mismatch screenshot: `/var/folders/rf/2q5dyfp52bl2053nt7fy31yr0000gn/T/codex-clipboard-dfc41c9c-68c4-4844-be95-de1580cd5444.png`.
- Desktop implementation: `app/design-qa-creator-draft-exit-desktop.png`.
- Mobile implementation: `app/design-qa-creator-draft-exit-mobile.png`.
- State: new creator form contains a display name, then the user clicks outside the form.

## Viewport And Density

- Reported mismatch screenshot: 790 x 484 pixels.
- Desktop browser capture: 775 x 475 pixels at device density 1; dialog measured 448 x 162.23 CSS pixels.
- Mobile browser capture: 375 x 812 pixels at device density 1; browser viewport override 390 x 844 CSS pixels.
- Mobile dialog measured 335 x 206.23 CSS pixels with two 146.5px action columns.
- The in-app browser excludes its scrollbar area from screenshot pixels. Dialog geometry and responsive layout were compared using browser-computed CSS measurements.

## Full-View Comparison

- The reported generic modal used a wider 520px frame, a visible close icon, a white footer, and no destructive visual treatment.
- The implementation restores the original 448px compact frame, 8px radius, 42% dark backdrop, blurred background, and light-gray action bar.
- The implementation removes the close icon and uses the original hierarchy: red outlined discard, neutral save, and dark primary continue.

## Focused Region Comparison

- Typography: Noto Sans SC inheritance, 17px/700 title and 13px secondary copy match the original component source.
- Spacing: 24px title inset, 8px title-to-copy gap, 20px lower copy inset, and 13px x 16px action-bar padding match the source.
- Colors: source foreground, muted copy, borders, destructive red, neutral white, and primary black values are preserved.
- Image quality: no raster or decorative image assets are used by the source component; the existing Lucide-free confirmation treatment is preserved.
- Copy: adapted only from "project" to "creator profile" while retaining the original action text and sentence structure.

## Interaction QA

- Empty form plus outside click closes directly.
- Non-empty form plus outside click opens the confirmation layer.
- Save exits and restores the draft on the next create action.
- Discard exits and clears the draft.
- Continue and Escape return focus to the underlying editor.
- The underlying editor is inert while the confirmation layer is open.
- Mobile action layout uses two columns with Continue Editing spanning the full second row.
- No page-level horizontal overflow was observed at the mobile viewport.

## Comparison History

- Earlier P1: the creator flow reused the generic application Modal and did not match the original weekend interaction design.
- Fix: introduced a creator-specific confirmation component using the original `cp-draft-confirm` dimensions, spacing, color hierarchy, animation, and responsive rules.
- Post-fix evidence: desktop and mobile screenshots above, plus computed dialog and action-grid measurements.

## Findings

- No actionable P0, P1, or P2 differences remain against the original weekend component source.

## Follow-up Polish

- None required for this component.

final result: passed
