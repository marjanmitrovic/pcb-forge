# Mouser API integration for PCB Forge

This patch adds Mouser Search API support to the local catalog server.

## Files changed

- `server/index.js`
- `src/components/LiveCatalogSearch.tsx`

No changes are made to `package.json`, `electron/`, `vite.config.ts`, `tsconfig*`, or `node_modules`.

## Environment variables

Create or edit `/home/marjan/pcb-forge/.env`:

```env
CATALOG_PROVIDER=mouser
MOUSER_API_KEY=PASTE_YOUR_MOUSER_SEARCH_API_KEY_HERE

# Optional fallback / legacy Nexar config:
NEXAR_COUNTRY=CZ
NEXAR_API_URL=https://api.nexar.com/graphql
```

Provider modes:

- `CATALOG_PROVIDER=auto` — use Mouser if key exists, otherwise Nexar, otherwise offline.
- `CATALOG_PROVIDER=mouser` — use Mouser, fallback offline if key/API fails.
- `CATALOG_PROVIDER=nexar` — use Nexar, fallback offline if key/API fails.
- `CATALOG_PROVIDER=offline` — never call an online API.

## Test backend

```bash
cd /home/marjan/pcb-forge
fuser -k 5174/tcp 2>/dev/null || true
npm run server
```

In another terminal:

```bash
curl -X POST http://localhost:5174/api/catalog/search \
  -H "Content-Type: application/json" \
  -d '{"q":"NE555","limit":5,"provider":"mouser"}'
```

If no `MOUSER_API_KEY` is configured, the server returns offline fallback results instead of crashing.

## Frontend usage

Open Live Catalog Search and choose provider:

- Auto
- Mouser
- Nexar
- Offline

Then search for:

- `NE555`
- `BC547`
- `1N4007`
- `ATMEGA328P`

Use **Place once** or **Add to library**.
