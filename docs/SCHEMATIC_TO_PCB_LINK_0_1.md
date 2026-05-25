# Schematic to PCB link 0.1

This patch connects the separate Schematic workspace to the PCB layout.

## Added

- `Send parts + nets to PCB` button in Schematic workspace.
- Generates PCB components from schematic symbols.
- Sends schematic net names to PCB nets.
- Assigns schematic pin net names to matching PCB pads where possible.
- Places generated components on the PCB board in a simple grid.

## Scope

This is still a 0.1 implementation. It does not yet do full annotation synchronization, unique reference conflict resolution, or schematic back-annotation.

## Test

1. Open Schematic workspace.
2. Add NE555, resistor, capacitor, LED and connector.
3. Connect pins and name nets such as GND, VCC and OUT.
4. Click `Send parts + nets to PCB`.
5. Return to PCB editor.
6. Confirm parts are placed and pads have corresponding net assignments.
