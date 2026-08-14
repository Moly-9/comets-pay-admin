# 新建达人档案弹窗 Design QA

## Comparison Evidence

- Source visual truth: user-provided `codex-clipboard-6bd418cd-9c06-425a-8a92-437669df40e1.png` (`1031 x 794`).
- Browser-rendered implementation: local Vite app at `http://127.0.0.1:5174/`.
- Desktop viewport: `1280 x 720`; modal bounds `1040 x 680` with no horizontal overflow.
- Mobile viewport: `390 x 844`; modal bounds `335 x 780` with no horizontal overflow or clipped controls.
- State: new creator profile, default `US / USD / PERSONAL / LOCAL / ACH` Airwallex scenario.

## Findings

No actionable P0, P1 or P2 mismatch remains.

- The summary card retains the reference structure and now uses the COMETS Pay peach, pink and purple gradient.
- The profile ID is no longer displayed; region, project count and default-account status remain visible.
- PayPal and PayerMax tabs and create buttons have a clear disabled treatment and unopened-channel copy.
- The Airwallex section preserves the existing compact two-column rhythm while presenting the requested US payment checklist and per-field examples.
- Optional Schema fields outside the requested checklist are hidden; required API fields such as legal name and ACH routing number remain visible.
- Long English field names fit without clipping in the supplemental grid.

## Interaction Verification

- Clicking `建立达人档案` with missing profile data marks all missing fields and focuses the first field, `达人名称`.
- Clicking `校验账户` with incomplete Airwallex data scrolls `法定名` into the visible modal content area and focuses it.
- The save gate accepts only exactly one default account and requires that account to be a validated Airwallex account.
- PayPal and PayerMax cannot be selected or created in the editor; existing account data remains preserved.
- `出生日期`, `收款通知邮箱` and the unrelated Invoice signature note are not shown in payment information.
- After account validation, the success message is rendered below the revalidation action row.
- Browser console contained no warning or error entries.

final result: passed
