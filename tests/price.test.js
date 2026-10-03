import { describe, expect, it, vi } from 'vitest';
import {
    BASE_ETH_USD_FEED,
    CHAINLINK_AGGREGATOR_V3_ABI,
    PRICE_CHAIN_ID,
    PRICE_RPC_URL,
    fetchEthUsdPriceFromBaseRpc,
    formatTokenUsd,
    formatUsdValue,
    parseAggregatorRoundPrice,
    tokenAmountToUsd,
    usdPriceForSymbol,
} from '../price.js';

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

describe('fetchEthUsdPriceFromBaseRpc', () => {
    it('reads the Base ETH/USD feed over the Base RPC', async () => {
        const provider = { id: 'base' };
        const latestRoundData = vi.fn().mockResolvedValue({ answer: 2500n * 100000000n });
        const decimals = vi.fn().mockResolvedValue(8n);
        const Contract = vi.fn(() => ({ latestRoundData, decimals }));
        const JsonRpcProvider = vi.fn(() => provider);

        await expect(fetchEthUsdPriceFromBaseRpc({
            ethersLib: { Contract, JsonRpcProvider },
        })).resolves.toEqual({ ETH: 2500 });

        expect(JsonRpcProvider).toHaveBeenCalledWith(PRICE_RPC_URL, PRICE_CHAIN_ID);
        expect(Contract).toHaveBeenCalledWith(
            BASE_ETH_USD_FEED.address,
            CHAINLINK_AGGREGATOR_V3_ABI,
            provider,
        );
    });

    it('uses the supplied RPC URL when one is passed', async () => {
        const JsonRpcProvider = vi.fn(() => ({}));
        const Contract = vi.fn(() => ({
            latestRoundData: vi.fn().mockResolvedValue({ answer: 2000n * 100000000n }),
            decimals: vi.fn().mockResolvedValue(8n),
        }));

        await fetchEthUsdPriceFromBaseRpc({
            rpcUrl: 'https://example.invalid/base',
            ethersLib: { Contract, JsonRpcProvider },
        });

        expect(JsonRpcProvider).toHaveBeenCalledWith('https://example.invalid/base', PRICE_CHAIN_ID);
    });

    it('throws when the aggregator answer is unusable', async () => {
        const Contract = vi.fn(() => ({
            latestRoundData: vi.fn().mockResolvedValue({ answer: 0n }),
            decimals: vi.fn().mockResolvedValue(8n),
        }));

        await expect(fetchEthUsdPriceFromBaseRpc({
            ethersLib: { Contract, JsonRpcProvider: vi.fn(() => ({})) },
        })).rejects.toThrow(/Invalid on-chain price/);
    });
});
