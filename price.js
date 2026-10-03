/** Native-token USD quotes from Chainlink feeds over the current RPC. */

export const CHAINLINK_AGGREGATOR_V3_ABI = [
    'function decimals() view returns (uint8)',
    'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
];

/** Chainlink USD aggregators keyed by chain id. */
export const CHAINLINK_USD_FEEDS = {
    1: { address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', symbol: 'ETH' },
    11155111: { address: '0x694AA1769357215DE4FAC081bf1f309aDC325306', symbol: 'ETH' },
    8453: { address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', symbol: 'ETH' },
    10: { address: '0x13e3Ee699D1909E989722E753853AE30b17e08c5', symbol: 'ETH' },
    42161: { address: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612', symbol: 'ETH' },
    137: { address: '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0', symbol: 'POL' },
};

const usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Return the Chainlink USD feed for a chain, or null when none is known. */
export function getChainlinkUsdFeed(chainId) {
    const id = Number(chainId);
    if (!Number.isFinite(id)) {
        return null;
    }
    return CHAINLINK_USD_FEEDS[id] || null;
}

/**
 * Convert an aggregator `answer` and `decimals` into a USD number.
 * Accepts number or bigint values from ethers.
 */
export function parseAggregatorRoundPrice(answer, decimals) {
    if (answer == null || decimals == null || answer === '' || decimals === '') {
        return null;
    }
    const priceAnswer = Number(answer);
    const priceDecimals = Number(decimals);
    if (
        !Number.isFinite(priceAnswer) ||
        priceAnswer <= 0 ||
        !Number.isFinite(priceDecimals) ||
        priceDecimals < 0 ||
        priceDecimals > 18
    ) {
        return null;
    }
    return priceAnswer / (10 ** priceDecimals);
}

/** Look up a USD price for a native symbol (`ETH`, `POL`, …). */
export function usdPriceForSymbol(prices, symbol) {
    if (!prices || !symbol) return null;
    const price = Number(prices[String(symbol).toUpperCase()]);
    return Number.isFinite(price) && price > 0 ? price : null;
}

/** Convert a token amount and a USD price into a fiat number, or null. */
export function tokenAmountToUsd(tokenAmount, usdPrice) {
    const amount = Number(tokenAmount);
    const price = Number(usdPrice);
    if (!Number.isFinite(amount) || !Number.isFinite(price) || price <= 0) {
        return null;
    }
    return amount * price;
}

/** Format a USD number as `$1,234.56`. Tiny nonzero values become `<$0.01`. */
export function formatUsdValue(usdAmount) {
    if (usdAmount == null || usdAmount === '') {
        return '';
    }
    const n = Number(usdAmount);
    if (!Number.isFinite(n)) {
        return '';
    }
    if (n === 0) {
        return usdFormatter.format(0);
    }
    if (Math.abs(n) < 0.01) {
        return n < 0 ? '-<$0.01' : '<$0.01';
    }
    return usdFormatter.format(n);
}

/** Format tokenAmount × usdPrice, or '' when the quote is unavailable. */
export function formatTokenUsd(tokenAmount, usdPrice) {
    const usd = tokenAmountToUsd(tokenAmount, usdPrice);
    return usd == null ? '' : formatUsdValue(usd);
}

/**
 * Read the native-token USD price from a Chainlink feed on the current RPC.
 * Returns `{ ETH: 2684.12 }` / `{ POL: 0.11 }`, or null when the chain has no feed.
 */
export async function fetchNativeUsdPriceFromRpc({
    provider,
    chainId,
    ethersLib = globalThis.ethers,
} = {}) {
    const feed = getChainlinkUsdFeed(chainId);
    if (!feed) {
        return null;
    }
    if (!provider) {
        throw new Error('RPC provider is required');
    }
    if (!ethersLib?.Contract) {
        throw new Error('ethers is required');
    }

    const contract = new ethersLib.Contract(feed.address, CHAINLINK_AGGREGATOR_V3_ABI, provider);
    const [round, decimals] = await Promise.all([
        contract.latestRoundData(),
        contract.decimals(),
    ]);
    const price = parseAggregatorRoundPrice(round?.answer, decimals);
    if (price == null) {
        throw new Error('Invalid on-chain price');
    }
    return { [feed.symbol]: price };
}
