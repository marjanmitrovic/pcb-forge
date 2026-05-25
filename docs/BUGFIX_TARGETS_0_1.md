# PCB Forge 0.1 — Bugfix targets

Priority order:

## P0 — Must fix before packaging
1. Blank Electron window.
2. Node version mismatch.
3. Backend port 5174 already in use causing desktop crash.
4. Import/export project losing new fields.
5. Save/load losing live catalog parts.
6. Delete key deleting locked object.
7. DRC crash on older project files.

## P1 — Important
1. Improve Inspector when nothing selected.
2. Make top toolbar remain one row on 1366px width.
3. Improve layer visibility persistence.
4. Keep selected object after editing properties.
5. Avoid route selection when routing mode is active.
6. Better error message when live catalog API is offline.

## P2 — Later
1. True solder mask export.
2. Real manufacturing ZIP without npm install problems.
3. Separate Schematic workspace.
4. Segment-level route editing.
5. 3D preview.
