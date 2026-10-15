# Changes made to vendored Untitled UI files

`src/components/{base,application,foundations,shared-assets}` come from Untitled UI (`npx untitledui@latest add ...`). They are ours to edit, but re-adding a component overwrites the file: **re-apply the change listed here** (and keep this list complete). Prefer wrapping a component in `src/components/` over editing it.

| file | change | why | where described |
|---|---|---|---|
| `components/application/tabs/tabs.tsx` | The line under (or beside) the chosen tab of `underline` / `line` tabs is drawn from CSS variables written by `components/motion/useTabIndicator`, so it glides to the chosen tab; the selected tab no longer draws its own border. | Animated tab switch (CSS-driven, not a layout animation: that version was jittery). | CLAUDE.md section 61 |
| `components/base/dropdown/dropdown.tsx` | `DropdownDotsButton` uses the `aria-label` it is given (default "Open menu"); it ignored it before. | Every ⋮ menu announced the same to a screen reader. | audit-2 item 15 |

Reverted (nothing to re-apply): `components/base/button-group/button-group.tsx` (a sliding highlight was tried and removed).
