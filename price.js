/** ETH/USD quotes from the Base Chainlink feed. One RPC, every network. */

export const PRICE_RPC_URL = 'https://mainnet.base.org';
export const PRICE_CHAIN_ID = 8453;

export const BASE_ETH_USD_FEED = {
    address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    symbol: 'ETH',
};

export const CHAINLINK_AGGREGATOR_V3_ABI = [
    'function decimals() view returns (uint8)',
    'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
];

const usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

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
 * Read ETH/USD from the Base Chainlink feed over the Base RPC.
 * The selected wallet network is ignored — ETH price is the same everywhere.
 */
export async function fetchEthUsdPriceFromBaseRpc({
    ethersLib = globalThis.ethers,
    rpcUrl = PRICE_RPC_URL,
} = {}) {
    if (!ethersLib?.Contract || !ethersLib?.JsonRpcProvider) {
        throw new Error('ethers is required');
    }

    const provider = new ethersLib.JsonRpcProvider(rpcUrl, PRICE_CHAIN_ID);
    const contract = new ethersLib.Contract(
        BASE_ETH_USD_FEED.address,
        CHAINLINK_AGGREGATOR_V3_ABI,
        provider,
    );
    const [round, decimals] = await Promise.all([
        contract.latestRoundData(),
        contract.decimals(),
    ]);
    const price = parseAggregatorRoundPrice(round?.answer, decimals);
    if (price == null) {
        throw new Error('Invalid on-chain price');
    }
    return { ETH: price };
}
