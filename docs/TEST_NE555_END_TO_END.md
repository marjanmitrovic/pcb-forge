# NE555 End-to-End Test

## Goal
Prove that PCB Forge can complete a small board workflow from schematic/netlist to PCB manufacturing export.

## Test flow
1. Import `examples/ne555_schematic_sync_demo.pcbforge`.
2. Open Schematic workspace.
3. Check symbols: NE555, resistors, capacitor, LED, connector.
4. Click `Sync parts + nets to PCB`.
5. Open PCB editor.
6. Confirm components appear once only.
7. Move components into a simple layout.
8. Add GND copper zone.
9. Add silkscreen labels: VCC, GND, OUT, PCB Forge NE555 Demo.
10. Add four mounting holes.
11. Route VCC/GND/OUT nets.
12. Run DRC.
13. Review BOM.
14. Review Netlist.
15. Export manufacturing package.

## Pass criteria
- No duplicate components after second sync.
- Component pin labels are visible for NE555.
- BOM contains NE555, resistors, capacitor, LED, connector.
- Netlist contains GND, VCC, OUT.
- DRC has no critical short-circuit errors after routing.
- Manufacturing export downloads expected files.
