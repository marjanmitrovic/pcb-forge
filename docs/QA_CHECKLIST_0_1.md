# PCB Forge 0.1 QA Checklist

## Start
- [ ] `npm run build` passes.
- [ ] `npm run dev` opens frontend.
- [ ] `npm run server` opens catalog API.
- [ ] Electron desktop opens without blank page.

## Project
- [ ] Import `examples/ne555_led_blinker_demo.pcbforge`.
- [ ] Save project to browser.
- [ ] Restore autosave.
- [ ] Export `.pcbforge`.
- [ ] Import exported `.pcbforge`.

## Board editing
- [ ] Move component.
- [ ] Rotate component.
- [ ] Delete component.
- [ ] Undo delete.
- [ ] Duplicate component from Inspector.
- [ ] Select by Object Navigator.

## Routing
- [ ] Draw route between pads.
- [ ] Draw multi-segment route.
- [ ] Finish route with right click.
- [ ] Cancel route with ESC.
- [ ] Select route.
- [ ] Change route width.
- [ ] Change route net.
- [ ] Delete route.
- [ ] Place via.
- [ ] Edit via drill/diameter.
- [ ] Delete via.

## Visual tools
- [ ] Zoom with wheel.
- [ ] Pan with Shift-drag or middle mouse.
- [ ] Change grid size.
- [ ] Toggle snap.
- [ ] Toggle layer visibility.
- [ ] Use measure tool.

## Manufacturing objects
- [ ] Add silkscreen text.
- [ ] Edit silkscreen text.
- [ ] Delete silkscreen text.
- [ ] Add mounting hole.
- [ ] Edit mounting hole.
- [ ] Add copper zone.
- [ ] Edit copper zone.
- [ ] Delete copper zone.

## DRC
- [ ] Run DRC on demo project.
- [ ] Create intentional short between GND and VCC and verify DRC catches it.
- [ ] Set high minimum trace width and verify thin routes are flagged.
- [ ] Check copper zone clearance warnings.

## BOM / Netlist
- [ ] BOM lists NE555, resistors, capacitors, LED, connector.
- [ ] BOM grouped export works.
- [ ] Netlist shows VCC/GND/OUT/TIMING/CTRL.
- [ ] Unconnected pins are visible when intentionally created.

## Export
- [ ] Manufacturing export downloads files.
- [ ] Gerber-like files contain copper, silkscreen, outline, drill.
- [ ] BOM CSV contains MPN/value/package.
