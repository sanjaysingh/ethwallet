/** Pure helpers shared by the wallet UI and unit tests. */

export const DEFAULT_NETWORK_ID = 'base';

export const EXPLORER_TX_URLS = {
    ethereum: 'https://etherscan.io/tx/',
    sepolia: 'https://sepolia.etherscan.io/tx/',
    base: 'https://basescan.org/tx/',
    optimism: 'https://optimistic.etherscan.io/tx/',
    polygon: 'https://polygonscan.com/tx/',
    arbitrum: 'https://arbiscan.io/tx/',
    'robinhood-mainnet': 'https://robinhoodchain.blockscout.com/tx/'
};

export function formatAddressShort(address) {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/** Parse `network` from a location search string (e.g. `?network=sepolia`). */
export function getNetworkFromSearch(search) {
    const urlParams = new URLSearchParams(search || '');
    return urlParams.get('network');
}

/**
 * Return a URL string with the network query param applied.
 * Omits the param when networkId is the default (Base).
 */
export function buildUrlWithNetwork(href, networkId, defaultNetworkId = DEFAULT_NETWORK_ID) {
    const url = new URL(href);
    if (networkId && networkId !== defaultNetworkId) {
        url.searchParams.set('network', networkId);
    } else {
        url.searchParams.delete('network');
    }
    return url.toString();
}

/** Build a block-explorer tx URL for a known network, or '' if unavailable. */
export function getTxExplorerUrl(txHash, networkId) {
    if (!txHash || networkId === 'custom') {
        return '';
    }
    const baseUrl = EXPLORER_TX_URLS[networkId];
    return baseUrl ? `${baseUrl}${txHash}` : '';
}
