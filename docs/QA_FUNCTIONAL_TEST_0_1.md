# PCB Forge 0.1 — Functional QA test

This checklist is for stabilization before Linux/Windows packaging.

## 1. Startup
- Start backend with `npm run server` or Electron desktop.
- Start frontend with `npm run dev` or Electron desktop.
- Confirm board appears without blank screen.
- Confirm dark/light toggle works and persists after reload.

## 2. Project files
- Save project as `.pcbforge`.
- Import same `.pcbforge`.
- Import older `.json` project.
- Confirm components, traces, vias, zones, holes, silkscreen and live library survive reload.

## 3. Components
- Add resistor from local library.
- Add NE555P from live catalog.
- Add NE555DR from live catalog.
- Confirm NE555P maps to DIP-8 and NE555DR maps to SOIC-8.
- Select component and edit value/package/MPN in Inspector.
- Delete component with Delete key.
- Undo and Redo deletion.

## 4. Routing
- Select Route.
- Route pad-to-pad.
- Add multi-segment route.
- Finish route with right-click.
- Cancel route with ESC.
- Add via and continue on opposite layer.
- Select trace and edit net/layer/width.
- Delete trace and via.

## 5. Silkscreen
- Select +Text or Silkscreen tool.
- Place `GND`, `VCC`, `PCB v0.1`.
- Select text and edit text, size, rotation and layer.
- Toggle silkscreen visibility.

## 6. Copper zones
- Place full-board GND zone.
- Place manual zone.
- Edit size, clearance, opacity, net and layer.
- Run DRC against wrong-net trace.

## 7. Mechanical
- Add 4 corner mounting holes.
- Add one manual hole.
- Edit drill/diameter/plated flag.
- Delete hole.

## 8. DRC
- Run DRC on clean demo.
- Force trace too thin and verify warning.
- Force trace short between different nets and verify error.
- Force zone short against another net and verify error.
- Force component overlap and verify warning.

## 9. BOM / Netlist
- Confirm BOM groups identical components.
- Export grouped BOM CSV.
- Confirm Netlist shows pads and pin names.
- Export netlist CSV.

## 10. Manufacturing export
- Export manufacturing package.
- Confirm files include copper, outline, drill, silkscreen, BOM, positions and netlist.
- Open Gerber files in a viewer before real production.

## Known stabilization rule
Do not add new UI panels during QA. Fix only broken behavior, missing display, import/export mismatch, selection bugs and DRC false positives.
