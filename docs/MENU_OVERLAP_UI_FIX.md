# Menu overlap UI fix

This patch makes the PCB Forge top menu responsive and prevents menu/quick-action buttons from covering each other.

## Changes

- Main menu uses a fixed responsive grid instead of a crowded flex row.
- Quick tools wrap safely inside their own compact strip.
- Long labels were shortened:
  - Schematic → Sch
  - +Text → Text
  - +Zone → Zone
  - +Hole → Hole
  - Hide tools / Show tools → Tools
  - Hide inspector / Show inspector → Inspector
- Panel visibility buttons now show active orange state when the panel is hidden.
- Board canvas height is adjusted so the larger compact header does not cover the canvas.

## Files changed

- `src/App.tsx`
- `src/styles.css`
