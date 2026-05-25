# UI Stabilization Step 1: Dark Mode

Added:
- Light/Dark toggle in the compact top quick toolbar.
- Theme is saved in localStorage as `pcb-forge-theme`.
- Dark styling for panels, inspector, library, forms, DRC, BOM, netlist, object navigator, quick toolbar and board shell.
- No changes to Electron, Node scripts, package.json, server, or build configuration.

Manual QA:
1. Start the existing app normally.
2. Click `Dark` in the top quick toolbar.
3. Confirm the editor switches to dark mode.
4. Reload the app.
5. Confirm dark mode is remembered.
6. Click `Light` and confirm the UI returns to light mode.
7. Test: place component, route trace, select object, open catalog, run DRC.
