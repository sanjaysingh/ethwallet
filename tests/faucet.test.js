import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    FAUCET_API_BASE,
    isFaucetTurnstileAlreadyMounted,
    requestFaucetDrip,
    shouldMountFaucetTurnstileOnNetworkChange,
} from '../faucet.js';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('requestFaucetDrip', () => {
    it('posts address and turnstile token to the faucet API', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    ok: true,
                    amount: '0.01',
                    symbol: 'ETH',
                    txHash: '0xabc',
                    explorerTxUrl: 'https://sepolia.etherscan.io/tx/0xabc',
                }),
            }),
        );

        const result = await requestFaucetDrip({
            address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            turnstileToken: 'tok',
        });

        expect(fetch).toHaveBeenCalledWith(
            `${FAUCET_API_BASE}/api/sepolia/drip`,
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
                    turnstileToken: 'tok',
                }),
            }),
        );
        expect(result.amount).toBe('0.01');
    });

    it('surfaces API error messages', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 429,
                json: async () => ({
                    error: 'Address is on cooldown',
                    nextClaimAt: 123,
                }),
            }),
        );

        await expect(
            requestFaucetDrip({
                address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
                turnstileToken: 'tok',
            }),
        ).rejects.toMatchObject({
            message: 'Address is on cooldown',
            nextClaimAt: 123,
        });
    });
});

describe('isFaucetTurnstileAlreadyMounted', () => {
    it('is false until a widget id and DOM node both exist', () => {
        const container = { childNodes: { length: 1 } };
        expect(isFaucetTurnstileAlreadyMounted(null, container)).toBe(false);
        expect(isFaucetTurnstileAlreadyMounted(0, { childNodes: { length: 0 } })).toBe(false);
        expect(isFaucetTurnstileAlreadyMounted(0, null)).toBe(false);
    });

    it('is true when a widget is already in the container', () => {
        expect(isFaucetTurnstileAlreadyMounted(0, { childNodes: { length: 1 } })).toBe(true);
        expect(isFaucetTurnstileAlreadyMounted('widget-1', { childNodes: { length: 2 } })).toBe(true);
    });
});

describe('shouldMountFaucetTurnstileOnNetworkChange', () => {
    it('mounts on Sepolia only when Receive is already visible', () => {
        const hidden = { classList: { contains: (name) => name === 'fade' } };
        const visible = { classList: { contains: (name) => name === 'show' } };
        expect(shouldMountFaucetTurnstileOnNetworkChange('sepolia', hidden)).toBe(false);
        expect(shouldMountFaucetTurnstileOnNetworkChange('sepolia', visible)).toBe(true);
        expect(shouldMountFaucetTurnstileOnNetworkChange('base', visible)).toBe(false);
        expect(shouldMountFaucetTurnstileOnNetworkChange('sepolia', null)).toBe(false);
    });
});
