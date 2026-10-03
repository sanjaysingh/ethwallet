import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    COINBASE_SPOT_URLS,
    COINGECKO_SIMPLE_PRICE_URL,
    fetchNativeUsdPrices,
    formatTokenUsd,
    formatUsdValue,
    parseCoinbaseSpotPrice,
    parseCoinGeckoUsdPrice,
    tokenAmountToUsd,
    usdPriceForSymbol,
} from '../price.js';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('parseCoinbaseSpotPrice', () => {
    it('reads a positive spot amount', () => {
        expect(parseCoinbaseSpotPrice({ data: { amount: '2684.435', base: 'ETH', currency: 'USD' } }))
            .toBe(2684.435);
    });

    it('rejects missing or non-positive amounts', () => {
        expect(parseCoinbaseSpotPrice(null)).toBe(null);
        expect(parseCoinbaseSpotPrice({})).toBe(null);
        expect(parseCoinbaseSpotPrice({ data: { amount: '0' } })).toBe(null);
        expect(parseCoinbaseSpotPrice({ data: { amount: '-1' } })).toBe(null);
        expect(parseCoinbaseSpotPrice({ data: { amount: 'nope' } })).toBe(null);
    });
});

describe('parseCoinGeckoUsdPrice', () => {
    it('reads a positive usd field for the given id', () => {
        expect(parseCoinGeckoUsdPrice({ ethereum: { usd: 2684.12 } }, 'ethereum')).toBe(2684.12);
    });

    it('rejects missing ids or invalid prices', () => {
        expect(parseCoinGeckoUsdPrice({ ethereum: { usd: 2684.12 } }, 'missing')).toBe(null);
        expect(parseCoinGeckoUsdPrice({ ethereum: { usd: 0 } }, 'ethereum')).toBe(null);
        expect(parseCoinGeckoUsdPrice(null, 'ethereum')).toBe(null);
        expect(parseCoinGeckoUsdPrice({ ethereum: { usd: 1 } }, '')).toBe(null);
    });
});

describe('usdPriceForSymbol', () => {
    const prices = { ETH: 2500, POL: 0.11 };

    it('looks up symbols case-insensitively', () => {
        expect(usdPriceForSymbol(prices, 'eth')).toBe(2500);
        expect(usdPriceForSymbol(prices, 'POL')).toBe(0.11);
    });

    it('returns null when the quote is missing', () => {
        expect(usdPriceForSymbol(prices, 'BTC')).toBe(null);
        expect(usdPriceForSymbol(null, 'ETH')).toBe(null);
        expect(usdPriceForSymbol(prices, '')).toBe(null);
    });
});

describe('tokenAmountToUsd', () => {
    it('multiplies a token amount by the USD price', () => {
        expect(tokenAmountToUsd('1.5', 2000)).toBe(3000);
        expect(tokenAmountToUsd(0, 2000)).toBe(0);
    });

    it('returns null when either input is unusable', () => {
        expect(tokenAmountToUsd('abc', 2000)).toBe(null);
        expect(tokenAmountToUsd(1, 0)).toBe(null);
        expect(tokenAmountToUsd(1, -10)).toBe(null);
        expect(tokenAmountToUsd(1, NaN)).toBe(null);
    });
});

describe('formatUsdValue', () => {
    it('formats dollars with two decimal places', () => {
        expect(formatUsdValue(0)).toBe('$0.00');
        expect(formatUsdValue(1.2)).toBe('$1.20');
        expect(formatUsdValue(1234.567)).toBe('$1,234.57');
    });

    it('shows a floor for dust and blanks invalid values', () => {
        expect(formatUsdValue(0.004)).toBe('<$0.01');
        expect(formatUsdValue(-0.004)).toBe('-<$0.01');
        expect(formatUsdValue(NaN)).toBe('');
        expect(formatUsdValue(undefined)).toBe('');
        expect(formatUsdValue(null)).toBe('');
    });
});

describe('formatTokenUsd', () => {
    it('formats a token amount using the given price', () => {
        expect(formatTokenUsd('2', 2500)).toBe('$5,000.00');
        expect(formatTokenUsd('0.000001', 2500)).toBe('<$0.01');
        expect(formatTokenUsd('1', null)).toBe('');
    });
});

describe('fetchNativeUsdPrices', () => {
    it('uses Coinbase spot prices when both assets succeed', async () => {
        const fetchImpl = vi.fn(async (url) => {
            if (url === COINBASE_SPOT_URLS.ETH) {
                return { ok: true, json: async () => ({ data: { amount: '2500' } }) };
            }
            if (url === COINBASE_SPOT_URLS.POL) {
                return { ok: true, json: async () => ({ data: { amount: '0.2' } }) };
            }
            throw new Error(`unexpected url ${url}`);
        });

        await expect(fetchNativeUsdPrices({ fetchImpl })).resolves.toEqual({
            ETH: 2500,
            POL: 0.2,
        });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('fills missing Coinbase quotes from CoinGecko', async () => {
        const fetchImpl = vi.fn(async (url) => {
            if (url === COINBASE_SPOT_URLS.ETH) {
                return { ok: true, json: async () => ({ data: { amount: '2600' } }) };
            }
            if (url === COINBASE_SPOT_URLS.POL) {
                return { ok: false, json: async () => ({}) };
            }
            if (url === COINGECKO_SIMPLE_PRICE_URL) {
                return {
                    ok: true,
                    json: async () => ({
                        ethereum: { usd: 2599 },
                        'polygon-ecosystem-token': { usd: 0.15 },
                    }),
                };
            }
            throw new Error(`unexpected url ${url}`);
        });

        await expect(fetchNativeUsdPrices({ fetchImpl })).resolves.toEqual({
            ETH: 2600,
            POL: 0.15,
        });
    });

    it('falls back to CoinGecko when Coinbase fails entirely', async () => {
        const fetchImpl = vi.fn(async (url) => {
            if (url === COINBASE_SPOT_URLS.ETH || url === COINBASE_SPOT_URLS.POL) {
                throw new Error('network');
            }
            if (url === COINGECKO_SIMPLE_PRICE_URL) {
                return {
                    ok: true,
                    json: async () => ({ ethereum: { usd: 2400 } }),
                };
            }
            throw new Error(`unexpected url ${url}`);
        });

        await expect(fetchNativeUsdPrices({ fetchImpl })).resolves.toEqual({
            ETH: 2400,
        });
    });

    it('throws when no source returns a usable price', async () => {
        const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
        await expect(fetchNativeUsdPrices({ fetchImpl })).rejects.toThrow(/Price request failed/);
    });
});
