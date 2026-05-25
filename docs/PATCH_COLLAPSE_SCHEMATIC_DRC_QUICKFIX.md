# PCB Forge patch: side panels, schematic, DRC quick fix

This patch restores/adds:

- Hide/Show left Tools panel
- Hide/Show right Inspector panel
- Schematic workspace in the top menu
- Schematic → PCB net/parts sync
- Smart DRC suggestions
- DRC quick actions: Select object, Quick fix, Rules

It only changes `src/` and `docs/`.
It does not change Node, Electron, package.json, server, vite config, or TypeScript config.
