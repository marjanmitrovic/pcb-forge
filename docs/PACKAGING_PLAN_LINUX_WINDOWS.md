# Packaging Plan: Linux and Windows

Packaging starts only after release candidate checklist passes.

## Linux
Target:
- AppImage first
- optional `.deb` later

Required:
- Electron app opens without blank window.
- Vite uses `base: "./"`.
- API server starts inside Electron or detects existing API server.
- No manual terminal required.

## Windows
Target:
- portable `.exe` first
- NSIS installer later

Required:
- Test with Node 22 during build.
- Verify path handling for spaces in file names.
- Verify import/export file dialogs.
- Verify catalog server starts from Electron.

## Files not to change during final packaging
- Source feature logic unless a packaging-specific bug is confirmed.
- Project format without migration.
