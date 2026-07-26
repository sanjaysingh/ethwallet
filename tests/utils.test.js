import { describe, it, expect } from 'vitest';
import {
    DEFAULT_NETWORK_ID,
    EXPLORER_TX_URLS,
    formatAddressShort,
    getNetworkFromSearch,
    buildUrlWithNetwork,
    getTxExplorerUrl
} from '../utils.js';

describe('formatAddressShort', () => {
    it('shortens a full address', () => {
        const addr = '0x1234567890abcdef1234567890abcdef12345678';
        expect(formatAddressShort(addr)).toBe('0x1234...5678');
    });

    it('returns short values unchanged', () => {
        expect(formatAddressShort('0x123')).toBe('0x123');
        expect(formatAddressShort('')).toBe('');
        expect(formatAddressShort(null)).toBe(null);
    });
});

describe('getNetworkFromSearch', () => {
    it('reads the network query param', () => {
        expect(getNetworkFromSearch('?network=sepolia')).toBe('sepolia');
        expect(getNetworkFromSearch('?foo=1&network=base')).toBe('base');
    });

    it('returns null when network is absent', () => {
        expect(getNetworkFromSearch('')).toBe(null);
        expect(getNetworkFromSearch('?foo=1')).toBe(null);
    });
});

describe('buildUrlWithNetwork', () => {
    const href = 'https://ethwallet.example/';

    it('omits the param for the default network', () => {
        expect(buildUrlWithNetwork(href, DEFAULT_NETWORK_ID)).toBe(href);
        expect(buildUrlWithNetwork(`${href}?network=sepolia`, 'base')).toBe(href);
    });

    it('sets the param for non-default networks', () => {
        expect(buildUrlWithNetwork(href, 'sepolia')).toBe(`${href}?network=sepolia`);
        expect(buildUrlWithNetwork(`${href}?network=sepolia`, 'ethereum')).toBe(
            `${href}?network=ethereum`
        );
    });
});

describe('getTxExplorerUrl', () => {
    const hash = '0xabc123';

    it('builds explorer URLs for known networks', () => {
        expect(getTxExplorerUrl(hash, 'ethereum')).toBe(`${EXPLORER_TX_URLS.ethereum}${hash}`);
        expect(getTxExplorerUrl(hash, 'base')).toBe(`${EXPLORER_TX_URLS.base}${hash}`);
        expect(getTxExplorerUrl(hash, 'sepolia')).toBe(`${EXPLORER_TX_URLS.sepolia}${hash}`);
    });

    it('returns empty for custom, unknown, or missing hash', () => {
        expect(getTxExplorerUrl(hash, 'custom')).toBe('');
        expect(getTxExplorerUrl(hash, 'unknown-chain')).toBe('');
        expect(getTxExplorerUrl('', 'base')).toBe('');
        expect(getTxExplorerUrl(null, 'base')).toBe('');
    });
});
