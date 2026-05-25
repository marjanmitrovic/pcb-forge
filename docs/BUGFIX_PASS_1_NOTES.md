# PCB Forge 0.1 — Bugfix pass 1

Scope: stability fixes only. No Node, Electron, package, server, Vite, or TypeScript config files are changed.

## Fixed

- Global keyboard shortcuts no longer hijack normal form editing.
- Backspace/Delete inside inputs no longer deletes selected PCB objects.
- Ctrl+Z/Ctrl+Y inside inputs no longer triggers board Undo/Redo while editing text or numeric fields.
- Escape still cancels active route/measurement because it is an editor-level action.

## QA focus

Retest:

1. Select a component, then click a Properties input and press Backspace.
2. Confirm the component is not deleted.
3. Edit text fields and use Ctrl+Z inside the field.
4. Confirm board history does not jump while typing.
5. Select a trace/via/component on the board and press Delete while not typing.
6. Confirm the object deletes normally.
