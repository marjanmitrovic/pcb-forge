# PCB Forge — Schematic sync 0.1

This patch improves Schematic → PCB behavior.

## What changed

- `Sync parts + nets to PCB` replaces the previous one-way add behavior.
- Re-syncing the same schematic updates existing PCB components instead of creating duplicates.
- PCB component position and rotation are preserved when the schematic is synced again.
- Pins from schematic symbols are mapped to PCB pads again during sync.
- New nets are added only if they do not already exist.
- Existing nets are reused by name.

## Test

1. Open **Schematic**.
2. Add NE555, resistor, capacitor, LED and connector.
3. Connect pins and name nets: `GND`, `VCC`, `OUT`.
4. Click **Sync parts + nets to PCB**.
5. Move components manually in PCB view.
6. Return to Schematic and change a value, e.g. `R1 = 1k`.
7. Click **Sync parts + nets to PCB** again.
8. Components should update instead of duplicating.
9. Moved positions should stay preserved.
