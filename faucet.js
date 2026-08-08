/** Sepolia faucet client (Cloudflare Worker API). */

export const FAUCET_API_BASE = 'https://faucet-api.times2.workers.dev';
export const FAUCET_TURNSTILE_SITE_KEY = '0x4AAAAAAEKkKF6Ziy76EcQI';
export const FAUCET_CHAIN_SLUG = 'sepolia';

/**
 * Request a drip from the faucet API.
 * @param {{ address: string, turnstileToken: string, apiBase?: string, chain?: string }} params
 */
export async function requestFaucetDrip({
    address,
    turnstileToken,
    apiBase = FAUCET_API_BASE,
    chain = FAUCET_CHAIN_SLUG,
}) {
    const base = apiBase.replace(/\/$/, '');
    const res = await fetch(
        `${base}/api/${encodeURIComponent(chain)}/drip`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, turnstileToken }),
        },
    );

    let data = {};
    try {
        data = await res.json();
    } catch {
        // ignore JSON parse errors
    }

    if (!res.ok) {
        const err = new Error(
            typeof data.error === 'string'
                ? data.error
                : `Faucet request failed (${res.status})`,
        );
        if (typeof data.nextClaimAt === 'number') {
            err.nextClaimAt = data.nextClaimAt;
        }
        throw err;
    }

    return data;
}
