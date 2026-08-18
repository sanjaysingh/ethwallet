# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single static, client-side Ethereum wallet SPA (Vue 3 + Ethers.js). There is no backend, database, or build/bundle step.

### Services
- The only service is a static HTTP server for the app files (`index.html`, `app.js`, `utils.js`, `libs/`). A server is required (not `file://`) because `app.js` uses ES module imports.
- Start it with `python3 -m http.server 8000` from the repo root, then open `http://localhost:8000`.

### Test / build / run
- Tests: `npm test` (Vitest, runs `tests/**/*.test.js`, covers pure helpers in `utils.js`). See `package.json`.
- No lint tooling and no build step are configured.
- Blockchain features (balances, gas estimation, sending) require reachable public EVM RPC endpoints (external network). Wallet generation/import and QR/receive work fully offline.

### Gotchas
- Keys/seed phrases are held in browser memory only and cleared on refresh; the "Previous sessions" dropdown is in-memory per page load.
- Serving over a static file server does not hot-reload; refresh the browser after editing files.
