/** Native-token USD quotes for the wallet UI (public market APIs, no key). */

export const COINBASE_SPOT_URLS = {
    ETH: 'https://api.coinbase.com/v2/prices/ETH-USD/spot',
    POL: 'https://api.coinbase.com/v2/prices/POL-USD/spot',
};

export const COINGECKO_SIMPLE_PRICE_URL =
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,polygon-ecosystem-token&vs_currencies=usd';

export const COINGECKO_IDS = {
    ETH: 'ethereum',
    POL: 'polygon-ecosystem-token',
};

const usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Parse Coinbase `/v2/prices/{PAIR}/spot` JSON into a positive number, or null. */
export function parseCoinbaseSpotPrice(payload) {
    const amount = Number(payload?.data?.amount);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Parse CoinGecko `/simple/price` JSON for one coin id into a positive number, or null. */
export function parseCoinGeckoUsdPrice(payload, geckoId) {
    if (!geckoId) return null;
    const amount = Number(payload?.[geckoId]?.usd);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
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

async function fetchUsdPricesFromCoinbase(fetchImpl) {
    const entries = await Promise.all(
        Object.entries(COINBASE_SPOT_URLS).map(async ([symbol, url]) => {
            try {
                const res = await fetchImpl(url);
                if (!res.ok) {
                    return [symbol, null];
                }
                return [symbol, parseCoinbaseSpotPrice(await res.json())];
            } catch {
                return [symbol, null];
            }
        }),
    );
    return Object.fromEntries(entries.filter(([, price]) => price != null));
}

async function fetchUsdPricesFromCoinGecko(fetchImpl) {
    const res = await fetchImpl(COINGECKO_SIMPLE_PRICE_URL);
    if (!res.ok) {
        throw new Error(`Price request failed (${res.status})`);
    }
    const data = await res.json();
    const prices = {};
    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
        const price = parseCoinGeckoUsdPrice(data, geckoId);
        if (price != null) {
            prices[symbol] = price;
        }
    }
    return prices;
}

/**
 * Fetch ETH and POL USD prices. Coinbase is tried first; CoinGecko fills gaps.
 * Returns a sparse `{ ETH?, POL? }` map. Throws only when both sources fail
 * and no price could be parsed.
 */
export async function fetchNativeUsdPrices({ fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== 'function') {
        throw new Error('fetch is not available');
    }

    let prices = {};
    let lastError = null;

    try {
        prices = await fetchUsdPricesFromCoinbase(fetchImpl);
    } catch (err) {
        lastError = err;
    }

    if (prices.ETH == null || prices.POL == null) {
        try {
            const fallback = await fetchUsdPricesFromCoinGecko(fetchImpl);
            prices = { ...fallback, ...prices };
        } catch (err) {
            lastError = err;
        }
    }

    if (Object.keys(prices).length === 0) {
        throw lastError || new Error('Unable to fetch USD prices');
    }

    return prices;
}
