# PCB Forge — Schematic Sync Bugfix 0.1.1

This patch fixes a TypeScript build error in the schematic-to-PCB sync workflow.

## Fixed

- Replaced invalid panel key `parts` with valid panel key `components`.
- `Sync parts + nets to PCB` now returns the UI to the Components panel after sync.

## Not changed

This patch does not touch:

- `package.json`
- `package-lock.json`
- `node_modules/`
- `electron/`
- `server/`
- `vite.config.ts`
- `tsconfig*`

## Test

1. Open Schematic workspace.
2. Add NE555 + passive components.
3. Connect pins and name nets.
4. Click `Sync parts + nets to PCB`.
5. Verify PCB components are created/updated without duplicates.
6. Run `npm run build`.
