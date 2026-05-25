# Schematic Workspace 0.1

This patch restores the schematic editor as a separate workspace, not mixed with PCB Layout.

## Added

- Top menu item: `Schematic`
- Separate central schematic canvas
- Add symbols: resistor, capacitor, LED/diode, NE555 IC, connector
- Connect pins by clicking one pin and then another
- Net naming prompt
- Export schematic JSON
- Export schematic netlist CSV
- Send schematic net names to PCB nets

## Scope

This is not yet full schematic-to-PCB synchronization. Version 0.1 only sends net names to the PCB layout so PCB routing can use those nets. Full symbol-to-footprint synchronization comes later.

## Next step

- Symbol library from component catalog
- Assign footprints to schematic symbols
- Update PCB from schematic: place missing footprints and generate ratsnest
