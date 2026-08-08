import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAUCET_API_BASE, requestFaucetDrip } from '../faucet.js';

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
