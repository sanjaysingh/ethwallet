import { describe, expect, it, vi } from 'vitest';
import {
    CHAINLINK_AGGREGATOR_V3_ABI,
    CHAINLINK_USD_FEEDS,
    fetchNativeUsdPriceFromRpc,
    formatTokenUsd,
    formatUsdValue,
    getChainlinkUsdFeed,
    parseAggregatorRoundPrice,
    tokenAmountToUsd,
    usdPriceForSymbol,
} from '../price.js';

describe('getChainlinkUsdFeed', () => {
    it('returns the ETH feed for Base and Ethereum', () => {
        expect(getChainlinkUsdFeed(8453)).toEqual(CHAINLINK_USD_FEEDS[8453]);
        expect(getChainlinkUsdFeed('1')).toEqual(CHAINLINK_USD_FEEDS[1]);
        expect(getChainlinkUsdFeed(8453).symbol).toBe('ETH');
    });

    it('returns the POL feed on Polygon and null when unknown', () => {
        expect(getChainlinkUsdFeed(137).symbol).toBe('POL');
        expect(getChainlinkUsdFeed(4663)).toBe(null);
        expect(getChainlinkUsdFeed(undefined)).toBe(null);
    });
});

describe('parseAggregatorRoundPrice', () => {
    it('divides the answer by 10^decimals', () => {
        expect(parseAggregatorRoundPrice(268435000000, 8)).toBe(2684.35);
        expect(parseAggregatorRoundPrice(10953190n, 8n)).toBe(0.1095319);
    });

    it('rejects missing or non-positive answers', () => {
        expect(parseAggregatorRoundPrice(null, 8)).toBe(null);
        expect(parseAggregatorRoundPrice(0, 8)).toBe(null);
        expect(parseAggregatorRoundPrice(-1, 8)).toBe(null);
        expect(parseAggregatorRoundPrice(100, 20)).toBe(null);
        expect(parseAggregatorRoundPrice('nope', 8)).toBe(null);
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

describe('fetchNativeUsdPriceFromRpc', () => {
    it('reads latestRoundData from the current-chain feed', async () => {
        const latestRoundData = vi.fn().mockResolvedValue({ answer: 2500n * 100000000n });
        const decimals = vi.fn().mockResolvedValue(8n);
        const Contract = vi.fn(() => ({ latestRoundData, decimals }));
        const provider = { id: 'mock' };

        await expect(fetchNativeUsdPriceFromRpc({
            provider,
            chainId: 8453,
            ethersLib: { Contract },
        })).resolves.toEqual({ ETH: 2500 });

        expect(Contract).toHaveBeenCalledWith(
            CHAINLINK_USD_FEEDS[8453].address,
            CHAINLINK_AGGREGATOR_V3_ABI,
            provider,
        );
    });

    it('returns POL from the Polygon feed', async () => {
        const Contract = vi.fn(() => ({
            latestRoundData: vi.fn().mockResolvedValue({ answer: 10950000 }),
            decimals: vi.fn().mockResolvedValue(8),
        }));

        await expect(fetchNativeUsdPriceFromRpc({
            provider: {},
            chainId: 137,
            ethersLib: { Contract },
        })).resolves.toEqual({ POL: 0.1095 });
    });

    it('returns null when the chain has no feed', async () => {
        const Contract = vi.fn();
        await expect(fetchNativeUsdPriceFromRpc({
            provider: {},
            chainId: 4663,
            ethersLib: { Contract },
        })).resolves.toBe(null);
        expect(Contract).not.toHaveBeenCalled();
    });

    it('throws when the aggregator answer is unusable', async () => {
        const Contract = vi.fn(() => ({
            latestRoundData: vi.fn().mockResolvedValue({ answer: 0n }),
            decimals: vi.fn().mockResolvedValue(8n),
        }));

        await expect(fetchNativeUsdPriceFromRpc({
            provider: {},
            chainId: 1,
            ethersLib: { Contract },
        })).rejects.toThrow(/Invalid on-chain price/);
    });
});
