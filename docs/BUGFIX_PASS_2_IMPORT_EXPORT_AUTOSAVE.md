# Bugfix pass 2 — Import / export / autosave recovery

Scope: stabilization only. This patch does not touch Node, Electron, server, Vite, TypeScript config, package.json, package-lock.json, or node_modules.

## Fixed / improved

- Browser save now keeps a backup copy before overwriting the main saved project.
- Autosave now keeps a backup copy before overwriting the main autosave.
- Restore autosave falls back to the backup if the main autosave is corrupted or missing.
- Load browser project falls back to the backup if the main browser save is corrupted or missing.
- Import now gives a more useful error message when the project file is invalid.
- Imported projects are always migrated through the current board schema before being applied.
- Active net is repaired after importing/loading if the previous active net no longer exists.
- Clear autosave now clears both primary autosave and autosave backup.

## Test checklist

1. Open PCB Forge.
2. Add one component and save in browser.
3. Add another component and wait a moment for autosave.
4. Reload the app.
5. Use Project → Load browser.
6. Use Project → Restore autosave.
7. Import an old `.json` project.
8. Import a `.pcbforge` project.
9. Try importing an invalid JSON file and confirm the app stays alive and shows an error.

## Storage keys

- `pcb-forge-project`
- `pcb-forge-project-backup`
- `pcb-forge-autosave`
- `pcb-forge-autosave-backup`
