# Manufacturing export stabilization pass

This patch replaces only `src/utils/manufacturingExport.ts`.

It does not touch:
- package.json
- package-lock.json
- node_modules
- electron/
- server/
- vite.config.ts
- tsconfig*

## Exported files

- top_copper.GTL
- bottom_copper.GBL
- top_silkscreen.GTO
- bottom_silkscreen.GBO
- board_outline.GKO
- drill.DRL
- bom.csv
- positions.csv
- netlist_pads.csv
- copper_zones.csv
- project.pcbforge.json
- README.txt

## Test

1. Open NE555 demo project.
2. Run DRC.
3. Export manufacturing package.
4. Check that all files download.
5. Open Gerber files in an external Gerber viewer before ordering.
