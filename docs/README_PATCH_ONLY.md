# Patch-only package

This patch only contains:

- `src/`
- `docs/`
- `examples/`

It does not change:

- `package.json`
- `package-lock.json`
- `node_modules/`
- `electron/`
- `server/`
- `vite.config.ts`
- `tsconfig*`

Apply it by replacing only `src` if you want the UI/darkmode source, or copy only `docs` if you only need QA materials.
