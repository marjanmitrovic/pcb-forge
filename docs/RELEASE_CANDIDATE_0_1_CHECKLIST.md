# PCB Forge 0.1 Release Candidate Checklist

Goal: freeze features, verify existing tools, and prepare for Linux/Windows desktop packaging.

## 1. Startup
- [ ] `npm run build` passes.
- [ ] `npm run dev` opens the browser app.
- [ ] `npm run server` starts catalog API on port 5174.
- [ ] `npm run desktop` opens the Electron app.
- [ ] Electron window is not blank.

## 2. Core PCB workflow
- [ ] Place resistor/capacitor/LED/IC/connector.
- [ ] Select and move components.
- [ ] Delete selected component.
- [ ] Rotate selected component.
- [ ] Route pad-to-pad.
- [ ] Create multi-segment route.
- [ ] Delete selected route.
- [ ] Add via and switch layer.
- [ ] Delete selected via.

## 3. UI / workspace
- [ ] Left panel can be hidden/shown.
- [ ] Right inspector can be hidden/shown.
- [ ] PCB can be panned by mouse.
- [ ] Zoom, fit board, reset view work.
- [ ] Dark/light mode works and is remembered.

## 4. Advanced board objects
- [ ] Silkscreen text can be added, edited, deleted.
- [ ] Copper zone can be added, edited, deleted.
- [ ] Mounting holes can be added, edited, deleted.
- [ ] Selection filters and locks work.
- [ ] Object navigator selects objects correctly.

## 5. Catalog / BOM / Netlist
- [ ] Live search finds NE555.
- [ ] Add to library works.
- [ ] Place once works.
- [ ] Footprint mapping works for NE555P, NE555DR, BC547, 1N4007, IRFZ44N.
- [ ] BOM groups repeated parts correctly.
- [ ] Netlist lists connected and unconnected pads.

## 6. DRC
- [ ] DRC runs without crashing.
- [ ] Trace width rule works.
- [ ] Clearance rules work.
- [ ] Copper-zone DRC works.
- [ ] Unconnected pad warnings are understandable.

## 7. Schematic workspace
- [ ] Schematic opens separately from PCB editor.
- [ ] Symbols can be placed.
- [ ] Pin-to-pin wires create net names.
- [ ] Sync parts + nets to PCB creates PCB parts.
- [ ] Repeated sync does not duplicate existing PCB components.
- [ ] PCB component positions survive repeated sync.

## 8. Project file
- [ ] Save `.pcbforge` works.
- [ ] Import `.pcbforge` works.
- [ ] Import old `.json` still works.
- [ ] Autosave recovery works.

## 9. Manufacturing export
- [ ] Export produces copper files.
- [ ] Export produces silkscreen files.
- [ ] Export produces drill file.
- [ ] Export produces BOM, positions, netlist pads.
- [ ] Files open as text and contain expected board data.

## Release decision
Only build Linux/Windows packages after all critical items above pass.
