/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { TokenVault } from '@/auth/TokenVault.js';
import type { BrowserShape, BrowserStorage } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';
import { createTestTabs } from '@/testing/createTestTabs.js';

import { createDesktopTokenVault } from './DesktopTokenVault.js';
import type { NativeBridgeShape, StoredToken } from './NativeBridge.js';

const VIEWER = { login: 'octocat', name: null, avatarUrl: 'https://avatars.test/octocat' };

test('the session starts from the token the credential store kept, and the webview keeps none of it', async () => {
    const { auth, native, storages } = setup({ stored: { token: 'gho_kept', keychain: true } });

    await auth.ready();

    expect(auth.signedIn).toBe(true);
    expect(auth.token).toBe('gho_kept');
    expect(storages.values().filter(value => value.includes('gho_kept'))).toEqual([]);
    expect(native.calls).toEqual([]);
});

test('signing in keeps the token in the credential store only; signing out deletes it from there', async () => {
    const { auth, native, vault, storages } = setup({ stored: { token: null, keychain: true } });

    await auth.signInWithToken('gho_new');

    expect(auth.signedIn).toBe(true);
    await waitUntil(() => native.kept === 'gho_new', { intervalMs: 1, timeoutMs: 1000 });
    expect(storages.values().filter(value => value.includes('gho_new'))).toEqual([]);

    auth.signOut();

    expect(vault.read()).toBeNull();
    await waitUntil(() => native.kept === null, { intervalMs: 1, timeoutMs: 1000 });
    expect(native.calls).toEqual(['token_save', 'token_delete']);
});

test('a token GitHub rejects is deleted from the credential store', async () => {
    const { auth, native } = setup({ stored: { token: 'gho_revoked', keychain: true }, rejected: ['gho_revoked'] });
    native.kept = 'gho_revoked';

    await auth.ready();

    expect(auth.failure).toBe('tokenRejected');
    await waitUntil(() => native.kept === null, { intervalMs: 1, timeoutMs: 1000 });
});

test('a sign-out right after a sign-in leaves no token kept, however slowly the credential store saves', async () => {
    const { auth, native } = setup({ stored: { token: null, keychain: true } });
    const saving = createPromise();
    native.saveAfter = saving.promise;

    await auth.signInWithToken('gho_new');
    auth.signOut();
    saving.resolve();

    await waitUntil(() => native.calls.length === 2, { intervalMs: 1, timeoutMs: 1000 });
    expect(native.kept).toBeNull();
});

test('without a working credential store the token is kept for this run only, and the vault says so', async () => {
    const { auth, native, vault } = setup({ stored: { token: null, keychain: true } });
    native.storeWorks = false;

    await auth.signInWithToken('gho_new');

    await waitUntil(() => !vault.persistent, { intervalMs: 1, timeoutMs: 1000 });
    expect(auth.signedIn).toBe(true);
    expect(native.kept).toBeNull();
});

interface SetupOptions {
    /** What `token_load` found when the app started. */
    stored: StoredToken;
    /** The tokens GitHub answers with 401. */
    rejected?: string[];
}

/** The session over the desktop vault, with a fake native side and a browser whose storages are looked at. */
function setup(options: SetupOptions) {
    const native = createFakeNative();
    const local = new Map<string, string>();
    const session = new Map<string, string>();

    const browser: BrowserShape = {
        fetch: fetchViewer,
        localStorage: {
            ...mapStorage(local),
            key: index => [...local.keys()][index] ?? null,
            get length() {
                return local.size;
            },
        },
        sessionStorage: mapStorage(session),
        origin: 'tauri://localhost',
        getRandomValues: bytes => {
            crypto.getRandomValues(bytes);
        },
        navigate: () => {},
        replaceLocation: () => {},
        openInNewTab: () => {},
        onLocalStorageChange: () => {},
        isVisible: () => true,
        onVisibilityChange: () => {},
        isOnline: () => true,
        onOnlineChange: () => {},
        estimateStorage: () => Promise.resolve(null),
        ...createTestTabs().open(),
    };

    const { container } = createTestContainer();
    container.set(Browser, browser);
    const vault = createDesktopTokenVault({
        bridge: native.bridge,
        stored: options.stored,
        logger: container.resolve(Logger),
    });
    container.set(TokenVault, vault);
    const auth = container.resolve(AuthStore);

    return {
        auth,
        native,
        vault,
        /** Every value the webview's storages hold. */
        storages: { values: () => [...local.values(), ...session.values()] },
    };

    function fetchViewer(_input: string | URL | Request, init?: RequestInit): Promise<Response> {
        const token = (new Headers(init?.headers).get('Authorization') ?? '').replace('Bearer ', '');
        return Promise.resolve(
            options.rejected?.includes(token)
                ? Response.json({ message: 'Bad credentials' }, { status: 401 })
                : Response.json({ data: { viewer: VIEWER } }),
        );
    }
}

/** The native side of {@link setup}: a credential store holding one token. */
interface FakeNative {
    readonly bridge: NativeBridgeShape;
    /** What the credential store holds. */
    kept: string | null;
    /** The commands run, in the order they finished. */
    readonly calls: string[];
    /** Saving waits for this. */
    saveAfter: Promise<void> | null;
    /** `false`: the credential store fails, and saving keeps the token for this run only. */
    storeWorks: boolean;
}

function createFakeNative(): FakeNative {
    const native: FakeNative = {
        bridge: {
            loadToken: () => Promise.resolve({ token: native.kept, keychain: true }),
            saveToken: async token => {
                await native.saveAfter;
                native.calls.push('token_save');
                if (!native.storeWorks) {
                    return false;
                }
                native.kept = token;
                return true;
            },
            deleteToken: () => {
                native.kept = null;
                native.calls.push('token_delete');
                return Promise.resolve();
            },
            openExternal: () => Promise.reject(new Error('Not expected')),
            startDeviceSignIn: () => Promise.reject(new Error('Not expected')),
            finishDeviceSignIn: () => Promise.reject(new Error('Not expected')),
        },
        kept: null,
        calls: [],
        saveAfter: null,
        storeWorks: true,
    };
    return native;
}

function mapStorage(map: Map<string, string>): BrowserStorage {
    return {
        getItem: key => map.get(key) ?? null,
        setItem: (key, value) => {
            map.set(key, value);
        },
        removeItem: key => {
            map.delete(key);
        },
    };
}
