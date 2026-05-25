# PCB Forge 0.1 Stabilization Plan

Goal: finish the current PCB editor prototype into a stable 0.1.0 version before building Windows/Linux installers.

## Phase A — UI finalization
- Keep one compact top menu.
- Left panel: active tool group only.
- Center: PCB board.
- Right panel: Inspector for selected object.
- Bottom/secondary panels: DRC, Netlist, BOM, Console.
- Avoid adding new permanent sidebar sections.

## Phase B — Function QA
Test each existing feature with the demo board:
- Project import/export `.pcbforge`
- Component placement
- Live catalog add/place
- Footprint placement
- Component move/rotate/delete/duplicate
- Route draw/edit/delete
- Via place/edit/delete
- Copper zones
- Silkscreen text
- Mounting holes
- Design rules
- DRC
- Netlist panel
- BOM panel
- Manufacturing export
- Undo/redo
- Zoom/pan/grid/snap/measure
- Layer visibility
- Selection lock/filter

## Phase C — Bug fixing
Fix only reproducible bugs. Do not add new modules during stabilization unless they unblock QA.

## Phase D — Demo project
Use `examples/ne555_led_blinker_demo.pcbforge` as the primary test project.

## Phase E — Manufacturing package
Export and inspect:
- top/bottom copper
- silkscreen
- outline
- drill
- BOM
- pick-and-place / positions
- netlist CSV

## Phase F — Schematic workspace later
Only after 0.1.0 PCB editor is stable, add schematic as a separate workspace, not inside the PCB editor UI.
