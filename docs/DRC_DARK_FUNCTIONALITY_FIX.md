# PCB Forge DRC + Dark Theme functionality fix

This patch fixes the DRC panel so suggestions and quick-fix buttons are not cosmetic anymore.

## Working quick actions

- Select object: selects trace, via, component, copper zone, pad owner, or net.
- Increase width: sets trace width to the minimum value from Design Rules.
- Assign active net: assigns the active net to invalid traces or copper zones.
- Fix via size: sets via drill/diameter to Design Rules minimums.
- Fix clearance: sets copper zone clearance to Design Rules minimum.
- Move inward: clamps component, trace points, or copper zone inside the board.
- Delete trace/via: removes selected problematic trace/via.
- Rules: opens the DRC/Design Rules panel.
- Review net: opens the Nets panel.

## Dark theme

Dark mode is now applied to the whole app shell, panels, forms, library, BOM, netlist, DRC, schematic, board area and controls using `theme-dark` plus document/body theme attributes.

## Files changed

- src/App.tsx
- src/components/DrcPanel.tsx
- src/utils/drcQuickActions.ts
- src/styles.css
