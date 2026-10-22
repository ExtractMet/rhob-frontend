# Accessibility
* High-contrast dark industrial theme and a light theme (top-bar ◐); state colours are always paired with text (OK / NOT MET, severity words).
* Tabular numerals, units next to every value, no overlapping labels (responsive grids collapse at 1250 px and 860 px).
* All controls are native buttons/selects with titles; visible focus ring; tables sortable/filterable by keyboard.
* 3D view: keyboard alternatives (Space play/pause, ←/→ scrub, C cutaway, L labels); every 3D quantity is also available in the 2D schematic and charts; 2D fallback without WebGL.
* Live regions: toasts use `aria-live="polite"`; the safety strip uses `role="status"`.
* Known gaps: chart content is not fully screen-reader accessible (CSV export provided as the accessible alternative).
