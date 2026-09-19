# Vendored browser libraries

This app is a static site. Runtime UI/crypto libraries live in this folder, are committed to git, and are referenced from `index.html` with `libs/...` paths. Versions are pinned in `manifest.json`.

## Current status (2026-09-19)

| Library | Pinned | Latest on npm (checked 2026-09-19) | In repo? | Notes |
| --- | --- | --- | --- | --- |
| Vue | 3.5.43 | 3.5.43 | Yes | Current stable 3.5 (not 3.6 RC) |
| Ethers | 6.17.0 | 6.17.0 | Yes | Current |
| Bootstrap | 5.3.8 | 5.3.8 | Yes | Current 5.3 |
| Bootstrap Icons | 1.13.1 | 1.13.1 | Yes | Current; CSS + `fonts/*.woff{2}` |
| qrcode (soldair) | 1.5.4 | 1.5.4 | Yes | Current; browser IIFE bundle of `lib/browser.js` |

Pinned copies of Vue, Ethers, Bootstrap, and Bootstrap Icons match the official npm tarball bytes (SHA-256 in `manifest.json`). The qrcode file is a custom browser bundle because that package does not ship a UMD build.

### Already local (no CDN)

`index.html` loads Vue, Ethers, Bootstrap, Bootstrap Icons, and qrcode from `libs/`. Icon fonts are local (`fonts/bootstrap-icons.woff2` and `.woff`), as required by the icons CSS.

### Still external (not libraries we can vendor)

These are **services**, not copyable libraries:

| Dependency | Where | Why it stays external |
| --- | --- | --- |
| Cloudflare Turnstile `api.js` | `index.html` `<script src="https://challenges.cloudflare.com/turnstile/...">` | Bot-check widget must talk to Cloudflare; copying the script would break the faucet captcha |
| JSON-RPC endpoints | `app.js` network list | Blockchain access |
| Sepolia faucet API | `faucet.js` (`faucet-api.times2.workers.dev`) | Server-side drip + captcha verification |

Turnstile is the **only** remaining CDN script/style in `index.html`. Tests fail if another `http(s):` `src`/`href` is added there.

### Dev-only (npm, not shipped)

| Package | Pinned in `package.json` | Lockfile | Latest (2026-09-19) |
| --- | --- | --- | --- |
| vitest | 3.2.7 (was `^3.2.4`) | 3.2.7 | 5.0.1 |
| jsdom | 26.1.0 | 26.1.0 | 30.1.0 |

These are for `npm test` / CI only. They are not loaded by `index.html`. GitHub Actions (`actions/checkout`, `actions/setup-node`, Pages deploy actions) are CI infrastructure, not app libraries.

## Gaps before this change

1. Versions lived only in **filenames** and README prose — no single pin file, no hashes, no upgrade command.
2. Bumping a library meant manually downloading a dist file, renaming it, and editing `index.html` + README (see PR #13).
3. `package.json` used `^` ranges for test tools, so `npm install` could float patch versions.
4. Bootstrap min files still point at missing `.map` files (`sourceMappingURL`), which 404 in DevTools.

## How to upgrade a vendored library

1. Edit `version` for that library in `manifest.json`.
2. Run `npm run vendor` (needs network once: `npm pack` / `npx esbuild` for qrcode).
3. Run `npm test`.
4. Smoke-test the app: open `index.html`, generate/import a wallet, render Receive QR codes, send on a testnet if the bump was Ethers/Bootstrap.

`npm run vendor` will:

- Copy (or rebuild qrcode) into versioned dest names
- Rewrite `index.html` tags marked with `data-lib="..."`
- Refresh the README file tree and architecture version markers
- Write new SHA-256 values into `manifest.json`
- Delete stale top-level files in `libs/` that are no longer listed

`npm run vendor:check` (also covered by unit tests) verifies dest files, hashes, HTML refs, and that Turnstile remains the only CDN URL — **no network**.

Re-bundle qrcode even when the version is unchanged:

```bash
npm run vendor -- --force
```

## Follow-ups

- Optional: vendor Bootstrap `.map` files **or** strip `sourceMappingURL` on copy so DevTools stop 404ing
- Optional: load Turnstile only when the Sepolia faucet widget mounts, so the default Wallet tab does not contact Cloudflare
- Keep Vitest 3.2.7 / jsdom 26.1.0 until there is a reason to take Vitest 5 and jsdom 30 (major, test-only)
- Vue 3.6 is still RC (`3.6.0-rc.9`); stay on 3.5.43 until 3.6 is stable

## Policy

- **Do not** add jsDelivr, unpkg, cdnjs, or other CDN tags for UI libraries.
- **Do** commit the minified (or font) files this folder. The GitHub Pages workflow deploys the repo as-is; there is no bundler step.
- **Do** pin exact versions in `manifest.json` (runtime) and `package.json` (test tools).
- Blockchain RPCs, the faucet worker, and Turnstile are allowed network calls. They are not third-party UI libraries.
