# PCB Forge stabilization feature restore patch

This patch restores and stabilizes the requested features without changing Node, Electron, package files, server files or Vite configuration.

Included:

- Dark / Light mode toggle in the compact top toolbar.
- Smart DRC suggestions with explanation, steps and quick actions.
- DRC target selection and safe automatic fixes for common cases.
- Board side view modes: Top, Bottom, Both and mirrored bottom view.
- Circuit Test Lite: basic electrical sanity checks for power nets, IC power pins, NE555 pins, LED current-limiting resistor check and floating components.

Files changed:

- src/App.tsx
- src/components/DrcPanel.tsx
- src/utils/drcSuggestions.ts
- src/utils/circuitTest.ts
- src/styles.css

Not touched:

- package.json
- package-lock.json
- node_modules
- electron/
- server/
- vite.config.ts
- tsconfig files
