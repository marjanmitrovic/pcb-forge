# NE555 Schematic → PCB Sync Validation

Goal: verify that the separated Schematic workspace can generate parts and nets for PCB without duplicating existing components.

## Expected workflow

1. Open PCB Forge.
2. Go to **Project** and import `examples/ne555_schematic_sync_demo.pcbforge`.
3. Go to **Schematic** workspace.
4. Verify schematic contains:
   - U1 NE555 timer
   - R1 timing resistor
   - R2 LED resistor
   - C1 timing capacitor
   - C2 decoupling capacitor
   - D1 LED
   - J1 power connector
5. Click **Sync parts + nets to PCB**.
6. Go to **PCB** workspace.
7. Verify components appear once and not duplicated.
8. Move components on board.
9. Return to Schematic and run sync again.
10. Verify moved PCB positions are preserved.
11. Verify nets exist: GND, VCC, OUT, DISCH, THRESH_TRIG, CTRL.
12. Verify NE555 pad names are visible if pinout feature is enabled.

## Pass criteria

- No duplicated components after second sync.
- Existing PCB component positions preserved after sync.
- Nets are added or updated without duplicates.
- BOM shows grouped components.
- Netlist shows pins assigned to nets.
- DRC runs without application crash.
- Manufacturing export produces files without crash.

## Known limitations for v0.1

- Schematic symbols are basic.
- Sync uses approximate footprints.
- Automatic routing is not included.
- User still manually places/reroutes final PCB layout.
