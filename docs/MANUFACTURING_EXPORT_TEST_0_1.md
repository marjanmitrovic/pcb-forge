# Manufacturing Export Test — PCB Forge 0.1

Use the NE555 demo project for the first export smoke test.

## Test steps

1. Import the NE555 demo project.
2. Run DRC.
3. Open BOM / Export menu.
4. Run Manufacturing export.
5. Confirm files are downloaded or generated.

## Files to confirm

- top copper Gerber-like/Gerber file
- bottom copper Gerber-like/Gerber file
- top silkscreen file
- board outline file
- drill file
- BOM CSV
- positions CSV
- netlist CSV
- project file

## Manual checks

- U1 appears in BOM as NE555P / DIP-8.
- R1/R2/R3 have correct values.
- LED1 appears as LED.
- J1 appears as power connector.
- Mounting holes appear in drill file.
- Copper zone appears in copper export.

## Known limitation for 0.1

Before sending to a PCB manufacturer, the exported Gerbers must be inspected in an external Gerber viewer. This project is still a development-stage exporter.
