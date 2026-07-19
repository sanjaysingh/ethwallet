# Testing Enhancement Proposal

## Executive Summary

This document reviews the current testing status of the Ethereum Wallet project and proposes enhancements to ensure that adding features does not break existing functionality. The proposal includes unit tests, integration tests, and CI integration that runs on every pull request.

---

## 1. Current Status

### 1.1 Test Coverage

| Category | Status | Details |
|----------|--------|---------|
| **Unit Tests** | ❌ None | No test files exist in the project |
| **Integration Tests** | ❌ None | No end-to-end or integration tests |
| **CI Test Execution** | ❌ None | Tests are not run in CI |
| **Test Framework** | ❌ Not configured | No package.json, no test runner |

### 1.2 CI Configuration

The project has a single GitHub Actions workflow (`.github/workflows/static.yml`):

- **Trigger**: Push to `main` branch only
- **Purpose**: Deploy static content to GitHub Pages
- **Gap**: No workflow runs on pull requests; no tests are executed before merge

### 1.3 Project Architecture

- **Type**: Single-page application (SPA)
- **Stack**: Vue 3, Bootstrap 5, Ethers.js 6
- **Build**: No build step—vanilla JS loaded via script tags
- **Dependencies**: All libraries in `libs/` directory (no npm)

---

## 2. Testable Components Analysis

### 2.1 Pure Functions (High Priority—Easy to Test)

These functions have no external dependencies and can be unit tested immediately:

| Function | Location | Purpose |
|----------|----------|---------|
| `formatAddressShort(address)` | app.js | Formats Ethereum addresses for display |
| `getNetworkName()` | app.js | Returns display name for selected network |
| `getNetworkFromUrl()` | app.js | Parses network from URL query params |
| `updateUrlWithNetwork(networkId)` | app.js | Updates URL with network param |
| `currentPrivateKeyDisplay` (computed) | app.js | Masks private key for display |
| `getQRCodeUrl(address)` | app.js | Generates QR code URL for address |
| Network config in `detectChainInfo()` | app.js | Predefined chain metadata (ethereum, base, etc.) |

### 2.2 Functions Requiring Mocking (Medium Priority)

These depend on `ethers`, `provider`, or browser APIs:

| Function | Dependencies | Test Strategy |
|----------|--------------|---------------|
| `initializeWallet()` | ethers, RPC | Mock ethers.HDNodeWallet, ethers.JsonRpcProvider |
| `refreshAccounts()` | provider.getBalance | Mock provider |
| `updateTokenBalance()` | ethers.Contract, provider | Mock contract calls |
| `estimateGas()` | provider.estimateGas | Mock provider |
| `sendTransaction()` | provider, wallet | Mock full tx flow |
| `copyAddress()`, `copyPrivateKey()` | navigator.clipboard | Mock clipboard API |

### 2.3 Integration/E2E (Lower Priority—Higher Confidence)

| Scenario | Description |
|----------|-------------|
| App mount | Vue app renders without errors |
| Tab navigation | Wallet, Send, Receive tabs switch correctly |
| Theme toggle | Dark/light theme applies |
| Network selection | Dropdown updates RPC endpoint |
| Wallet initialization flow | Import/generate → accounts displayed |

---

## 3. Proposed Enhancements

### 3.1 Phase 1: Foundation (Recommended First)

**Goal**: Establish test infrastructure and cover critical pure logic.

#### 3.1.1 Introduce Minimal Build Tooling

Add `package.json` for test tooling only (app remains deployable as static files):

```json
{
  "name": "ethereum-wallet",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "jsdom": "^24.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

**Rationale**: Vitest is fast, has excellent ESM support, and requires minimal config. The app does not need a build step for deployment—tests run in Node with jsdom.

#### 3.1.2 Extract Testable Logic

Refactor `app.js` to expose pure utility functions in a way that can be imported by tests:

**Option A (Recommended)**: Create `src/utils.js` with extracted pure functions:

```javascript
// src/utils.js - Pure functions, no Vue/ethers
export function formatAddressShort(address) { ... }
export function getNetworkName(selectedNetwork, availableNetworks) { ... }
export function getNetworkFromUrl() { ... }
export function getQRCodeUrl(address) { ... }
```

Then `app.js` imports from `utils.js`. For the current static setup, use a simple build step (e.g., esbuild) only for producing a single `app.js` bundle, or inline the utils in app.js and test via a test-specific entry that imports the same functions.

**Option B (Simpler)**: Keep `app.js` as-is and use Vitest's ability to load scripts that define globals. Export functions by attaching to `window` in a test build, or use dynamic imports with a small adapter.

**Recommended approach**: Create `src/utils.js` with pure functions. Add a minimal build (e.g., `esbuild app.js --bundle --outfile=dist/app.js`) for production if desired, or keep `app.js` as the main file and have it `import` from `utils.js`—this would require adding `type="module"` to the script tag. The least invasive approach: **extract utils to a separate file, load it as a module before app.js, and test utils directly**.

#### 3.1.3 Unit Test Examples

```javascript
// tests/utils.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatAddressShort, getQRCodeUrl } from '../src/utils.js';

describe('formatAddressShort', () => {
  it('formats full address to short form', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    expect(formatAddressShort(addr)).toBe('0x1234...5678');
  });
  it('returns address as-is if too short', () => {
    expect(formatAddressShort('0x123')).toBe('0x123');
  });
});

describe('getQRCodeUrl', () => {
  it('encodes address in base64 for QR URL', () => {
    const addr = '0xabc';
    expect(getQRCodeUrl(addr)).toContain('qrcode.sanjaysingh.net');
    expect(getQRCodeUrl(addr)).toContain(btoa(addr));
  });
});
```

### 3.2 Phase 2: CI Integration

**Goal**: Run tests on every pull request.

#### 3.2.1 New Workflow: `test.yml`

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test

  e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

#### 3.2.2 Optional: Require Tests to Pass Before Merge

In repository settings: **Settings → Branches → Branch protection rules** for `main`:
- Require status checks to pass before merging
- Add `unit-tests` (and optionally `e2e-tests`) as required checks

### 3.3 Phase 3: Integration & E2E Tests

**Goal**: Catch regressions in user flows.

#### 3.3.1 Playwright E2E Setup

```javascript
// tests/e2e/wallet.spec.js
import { test, expect } from '@playwright/test';

test.describe('Ethereum Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080');
  });

  test('app loads and shows wallet tab', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Ethereum Wallet/ })).toBeVisible();
    await expect(page.getByText('Network & RPC Configuration')).toBeVisible();
  });

  test('theme toggle works', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-bs-theme', 'dark');
    await page.click('.theme-toggle');
    await expect(html).toHaveAttribute('data-bs-theme', 'light');
  });

  test('network selection updates RPC endpoint', async ({ page }) => {
    await page.selectOption('#network-select', 'sepolia');
    await expect(page.locator('#rpc-endpoint')).toHaveValue('https://1rpc.io/sepolia');
  });
});
```

E2E tests require a local server. Add to `package.json`:

```json
"scripts": {
  "serve": "npx serve . -p 8080",
  "test:e2e": "npx concurrently -k -s first -n \"server,e2e\" -c \"magenta,blue\" \"npm run serve\" \"npx wait-on tcp:8080 && playwright test\""
}
```

Or use Playwright's built-in static server in config.

### 3.4 Phase 4: Mocked Unit Tests for Wallet Logic

**Goal**: Test wallet initialization, gas estimation, and transaction flow without hitting real RPC.

Use Vitest's `vi.mock()` to mock `ethers`:

```javascript
// tests/wallet.test.js
import { vi } from 'vitest';

vi.mock('ethers', () => ({
  JsonRpcProvider: vi.fn(),
  Wallet: { createRandom: vi.fn() },
  HDNodeWallet: { fromMnemonic: vi.fn() },
  Mnemonic: { fromPhrase: vi.fn() },
  formatEther: (x) => x.toString(),
  parseEther: (x) => BigInt(x),
  // ... other ethers exports
}));
```

---

## 4. Implementation Roadmap

| Phase | Effort | Deliverables |
|-------|--------|--------------|
| **Phase 1a** | 2–4 hours | Add package.json, Vitest, extract utils, 5–10 unit tests |
| **Phase 1b** | 1 hour | Create `.github/workflows/test.yml` for PRs |
| **Phase 2** | 2–3 hours | Playwright setup, 3–5 E2E smoke tests |
| **Phase 3** | 4–6 hours | Mock ethers, test initializeWallet, estimateGas, sendTransaction |

**Recommended order**: Phase 1a → Phase 1b (get CI running) → Phase 2 (E2E) → Phase 3 (mocked wallet tests).

---

## 5. File Structure After Implementation

```
/
├── .github/
│   └── workflows/
│       ├── static.yml      # Existing: deploy to Pages
│       └── test.yml        # New: run tests on PR
├── src/
│   └── utils.js            # Extracted pure functions
├── tests/
│   ├── utils.test.js      # Unit tests for utils
│   ├── wallet.test.js     # Unit tests (mocked ethers)
│   └── e2e/
│       └── wallet.spec.js  # Playwright E2E tests
├── app.js                  # Main app (imports from src/utils.js or inlines)
├── index.html
├── package.json
├── vitest.config.js
├── playwright.config.js
└── TESTING_ENHANCEMENT_PROPOSAL.md  # This document
```

---

## 6. Success Criteria

- [ ] Unit tests run locally via `npm test`
- [ ] E2E tests run locally via `npm run test:e2e`
- [ ] CI runs tests on every pull request
- [ ] At least 80% coverage of pure utility functions
- [ ] E2E smoke tests cover: app load, theme toggle, network selection
- [ ] No regression: existing deployment (GitHub Pages) continues to work

---

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Adding npm may complicate "zero-install" usage | DevDependencies only; deployment stays static |
| Refactoring app.js could introduce bugs | Extract small, pure functions first; add tests before refactor |
| E2E tests flaky on CI | Use stable selectors, retries, avoid timing-dependent assertions |
| ethers mocking is complex | Start with pure functions; add mocked tests incrementally |

---

## 8. Conclusion

The project currently has **no tests** and **no CI validation on pull requests**. This proposal introduces:

1. **Unit tests** for pure logic (formatAddressShort, getNetworkName, URL helpers, etc.)
2. **Integration/E2E tests** for critical user flows
3. **CI workflow** that runs on every PR
4. **Incremental path** so each phase delivers value independently

Implementing Phase 1a and 1b first will provide immediate benefit: CI will block merges when tests fail, and new features can be developed with confidence that core utilities remain correct.
