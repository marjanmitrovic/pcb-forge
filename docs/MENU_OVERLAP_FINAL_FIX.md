# Menu overlap final fix

This patch prevents top-menu overlap by separating the main menu and quick tools into two compact lanes and moving secondary quick actions into a small More dropdown.

Changed files:
- src/App.tsx
- src/styles.css

It does not touch package.json, server, electron, vite config, or node_modules.
