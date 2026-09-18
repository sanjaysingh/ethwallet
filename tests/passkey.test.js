import { describe, expect, it, vi } from 'vitest';
import {
    PASSKEY_PRF_SALT_LABEL,
    PASSKEY_RP_NAME,
    PASSKEY_USER_DISPLAY_NAME,
    base64UrlToBuffer,
    bufferToBase64Url,
    bufferToHex,
    buildCreateOptions,
    buildGetOptions,
    createPasskeyWallet,
    derivePrivateKeyHexFromPrf,
    extractPrfOutput,
    isPasskeyCancellation,
    isPasskeySupported,
    isValidPasskeyRpId,
    passkeyErrorMessage,
    readPrfFromCredential,
    unlockPasskeyWallet
} from '../passkey.js';

function mockCredential({ prf, id = new Uint8Array([1, 2, 3, 4]) } = {}) {
    return {
        rawId: id,
        getClientExtensionResults: () => (
            prf
                ? { prf: { results: { first: prf } } }
                : {}
        )
    };
}

describe('isValidPasskeyRpId', () => {
    it('allows localhost and DNS names, rejects IP literals', () => {
        expect(isValidPasskeyRpId('localhost')).toBe(true);
        expect(isValidPasskeyRpId('ethwallet.sanjaysingh.net')).toBe(true);
        expect(isValidPasskeyRpId('127.0.0.1')).toBe(false);
        expect(isValidPasskeyRpId('::1')).toBe(false);
        expect(isValidPasskeyRpId('')).toBe(false);
    });
});

describe('isPasskeySupported', () => {
    it('is false without a secure context and WebAuthn API', () => {
        expect(isPasskeySupported({})).toBe(false);
        expect(isPasskeySupported({ isSecureContext: true })).toBe(false);
    });

    it('is true when WebAuthn is available in a secure context', () => {
        expect(isPasskeySupported({
            isSecureContext: true,
            PublicKeyCredential: function PublicKeyCredential() {},
            navigator: {
                credentials: {
                    create: () => {},
                    get: () => {}
                }
            }
        })).toBe(true);
    });

    it('is false for IP-literal origins even in a secure context', () => {
        const env = {
            isSecureContext: true,
            PublicKeyCredential: function PublicKeyCredential() {},
            navigator: {
                credentials: {
                    create: () => {},
                    get: () => {}
                }
            }
        };
        expect(isPasskeySupported({ ...env, location: { hostname: '127.0.0.1' } })).toBe(false);
        expect(isPasskeySupported({ ...env, location: { hostname: 'localhost' } })).toBe(true);
    });
});

describe('encoding helpers', () => {
    it('round-trips base64url and hex', () => {
        const bytes = new Uint8Array([0, 1, 250, 255]);
        expect(bufferToHex(bytes)).toBe('0x0001faff');
        expect(Array.from(base64UrlToBuffer(bufferToBase64Url(bytes)))).toEqual(Array.from(bytes));
    });
});

describe('WebAuthn option builders', () => {
    const challenge = new Uint8Array([9, 8, 7]);
    const userId = new Uint8Array([5, 6]);
    const salt = new Uint8Array(32).fill(7);

    it('requests a discoverable passkey with PRF eval on create', () => {
        const options = buildCreateOptions({
            challenge,
            userId,
            rpId: 'ethwallet.example',
            salt
        });

        expect(options.rp).toEqual({ name: PASSKEY_RP_NAME, id: 'ethwallet.example' });
        expect(options.user.id).toBe(userId);
        expect(options.user.displayName).toBe(PASSKEY_USER_DISPLAY_NAME);
        expect(options.authenticatorSelection).toEqual({
            residentKey: 'required',
            requireResidentKey: true,
            userVerification: 'required'
        });
        expect(options.extensions.prf.eval.first).toBe(salt);
        expect(options.pubKeyCredParams.map((p) => p.alg)).toContain(-7);
    });

    it('omits allowCredentials unless a credential id is provided', () => {
        const open = buildGetOptions({
            challenge,
            rpId: 'ethwallet.example',
            salt
        });
        expect(open.allowCredentials).toBeUndefined();
        expect(open.extensions.prf.eval.first).toBe(salt);

        const scoped = buildGetOptions({
            challenge,
            rpId: 'ethwallet.example',
            salt,
            credentialId: new Uint8Array([1, 2])
        });
        expect(scoped.allowCredentials).toEqual([
            { type: 'public-key', id: new Uint8Array([1, 2]) }
        ]);
    });
});

describe('PRF extraction and derivation', () => {
    it('reads PRF bytes from extension results and credentials', () => {
        const prf = new Uint8Array([11, 12, 13]);
        expect(extractPrfOutput({})).toBeNull();
        expect(extractPrfOutput({ prf: { results: { first: prf } } })).toEqual(prf);
        expect(readPrfFromCredential(mockCredential({ prf }))).toEqual(prf);
        expect(readPrfFromCredential(mockCredential())).toBeNull();
        expect(readPrfFromCredential(null)).toBeNull();
    });

    it('derives a stable private key from PRF output (v1 SHA-256)', async () => {
        const emptyHash = '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        await expect(derivePrivateKeyHexFromPrf(new Uint8Array())).rejects.toThrow(/empty/i);

        const key = await derivePrivateKeyHexFromPrf(new Uint8Array([1, 2, 3, 4]));
        expect(key).toMatch(/^0x[0-9a-f]{64}$/);
        expect(await derivePrivateKeyHexFromPrf(new Uint8Array([1, 2, 3, 4]))).toBe(key);

        const emptyDigest = await crypto.subtle.digest('SHA-256', new Uint8Array());
        expect(bufferToHex(emptyDigest)).toBe(emptyHash);
        expect(PASSKEY_PRF_SALT_LABEL).toBe('ethwallet:v1:prf');
    });
});

describe('passkey error helpers', () => {
    it('maps WebAuthn failures to user-facing messages', () => {
        expect(isPasskeyCancellation({ name: 'NotAllowedError' })).toBe(true);
        expect(isPasskeyCancellation({ name: 'AbortError' })).toBe(true);
        expect(passkeyErrorMessage({ name: 'NotAllowedError' })).toMatch(/cancelled/i);
        expect(passkeyErrorMessage({ name: 'SecurityError' })).toMatch(/localhost/i);
        expect(passkeyErrorMessage({ name: 'InvalidStateError' })).toMatch(/Open Passkey Wallet/i);
        expect(passkeyErrorMessage({ message: 'no prf' })).toBe('no prf');
    });
});

describe('createPasskeyWallet', () => {
    const prf = new Uint8Array(32).fill(42);
    const salt = new Uint8Array(32).fill(1);

    it('uses PRF output from create when the authenticator returns it', async () => {
        const credentials = {
            create: vi.fn(async () => mockCredential({ prf, id: new Uint8Array([9, 8]) })),
            get: vi.fn()
        };

        const result = await createPasskeyWallet({
            credentials,
            rpId: 'localhost',
            salt,
            challenge: new Uint8Array(32).fill(2),
            userId: new Uint8Array(16).fill(3)
        });

        expect(credentials.get).not.toHaveBeenCalled();
        expect(result.source).toBe('passkey');
        expect(result.credentialId).toBe(bufferToBase64Url(new Uint8Array([9, 8])));
        expect(result.privateKey).toBe(await derivePrivateKeyHexFromPrf(prf));
    });

    it('falls back to get() when create does not evaluate PRF', async () => {
        const credentials = {
            create: vi.fn(async () => mockCredential({ id: new Uint8Array([7]) })),
            get: vi.fn(async () => mockCredential({ prf, id: new Uint8Array([7]) }))
        };

        const result = await createPasskeyWallet({
            credentials,
            rpId: 'localhost',
            salt,
            challenge: new Uint8Array(32).fill(2),
            userId: new Uint8Array(16).fill(3)
        });

        expect(credentials.get).toHaveBeenCalledOnce();
        expect(result.privateKey).toBe(await derivePrivateKeyHexFromPrf(prf));
    });

    it('throws when PRF is unavailable', async () => {
        const credentials = {
            create: vi.fn(async () => mockCredential()),
            get: vi.fn(async () => mockCredential())
        };

        await expect(createPasskeyWallet({
            credentials,
            rpId: 'localhost',
            salt,
            challenge: new Uint8Array(32).fill(2),
            userId: new Uint8Array(16).fill(3)
        })).rejects.toThrow(/PRF/);
    });
});

describe('unlockPasskeyWallet', () => {
    it('derives the same key from an existing passkey assertion', async () => {
        const prf = new Uint8Array(32).fill(99);
        const credentials = {
            get: vi.fn(async () => mockCredential({ prf, id: new Uint8Array([4, 5, 6]) }))
        };

        const result = await unlockPasskeyWallet({
            credentials,
            rpId: 'localhost',
            salt: new Uint8Array(32).fill(1),
            challenge: new Uint8Array(32).fill(2)
        });

        expect(result.source).toBe('passkey');
        expect(result.privateKey).toBe(await derivePrivateKeyHexFromPrf(prf));
        expect(credentials.get).toHaveBeenCalledOnce();
    });
});
