# QA Checklist 0.1 — Schematic Sync

## Import
- [ ] Import .pcbforge file succeeds.
- [ ] Old board fields are migrated safely.
- [ ] Autosave does not overwrite valid project with broken data.

## Schematic
- [ ] Add resistor symbol.
- [ ] Add capacitor symbol.
- [ ] Add LED/diode symbol.
- [ ] Add NE555 IC symbol.
- [ ] Add connector symbol.
- [ ] Connect two pins and assign net.
- [ ] Export schematic JSON.
- [ ] Export schematic netlist CSV.

## Sync
- [ ] First sync creates PCB components.
- [ ] Second sync does not duplicate components.
- [ ] Existing PCB positions stay unchanged after second sync.
- [ ] Component values update from schematic.
- [ ] Nets update from schematic.
- [ ] Pad net assignments update where possible.

## PCB editor after sync
- [ ] Components can be selected.
- [ ] Components can be moved.
- [ ] Routes can be drawn between synced pads.
- [ ] Trace selection works.
- [ ] Delete selected trace/component/via works.
- [ ] Undo/redo works after sync.

## Output
- [ ] BOM export includes synced parts.
- [ ] Netlist panel includes synced pads.
- [ ] DRC runs.
- [ ] Manufacturing export runs.
