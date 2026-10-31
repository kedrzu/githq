/// <reference types="bun" />
import { expect, test } from 'bun:test';

import {
    OAUTH_AUTHORIZE_PATH,
    OAUTH_CALLBACK_PATH,
    OAUTH_SCOPES,
    OAUTH_STATE_PATTERN,
    OAUTH_TOKEN_PATH,
} from '@githq/github/oauth.js';
import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import type { BrowserLocalStorage, BrowserShape } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { createTestTabs } from '@/testing/createTestTabs.js';

import type { SignInResult, Viewer } from './AuthStore.js';
import { AuthStore, PENDING_SIGN_IN_KEY, TOKEN_KEY, VIEWER_KEY } from './AuthStore.js';

const ORIGIN = 'https://githq.test';
const VIEWER: Viewer = { login: 'octocat', name: 'The Octocat', avatarUrl: 'https://avatars.test/octocat' };
const OTHER_VIEWER: Viewer = { login: 'hubot', name: null, avatarUrl: 'https://avatars.test/hubot' };
const ALL_SCOPES = [...OAUTH_SCOPES];

test('signing in leaves for the Worker with a fresh state kept in this tab, and the callback with it signs in', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth, browser } = setup(github);

    auth.startSignIn('/review');

    const state = new URL(browser.navigatedTo[0] ?? '', ORIGIN).searchParams.get('state') ?? '';
    expect(browser.navigatedTo[0]).toStartWith(`${OAUTH_AUTHORIZE_PATH}?state=`);
    expect(state).toMatch(OAUTH_STATE_PATTERN);

    const result = await auth.completeSignIn({ code: 'the-code', state });

    const expected: SignInResult = { ok: true, returnTo: '/review' };
    expect(result).toEqual(expected);
    expect(github.exchanges).toEqual([{ code: 'the-code', redirectUri: `${ORIGIN}${OAUTH_CALLBACK_PATH}` }]);
    expect(github.tokensSeen).toEqual(['gho_new']);
    expect(browser.local.get(TOKEN_KEY)).toBe('gho_new');
    expect(auth.signedIn).toBe(true);
    expect(auth.viewer).toEqual(VIEWER);
    // The state is good for one return only.
    expect(browser.session.has(PENDING_SIGN_IN_KEY)).toBe(false);
});

test('a callback whose state is not the one kept before leaving — or with none — exchanges nothing and stores nothing', async () => {
    for (const [kept, returned] of [
        ['kept-state-0123456789', 'other-state-0123456789'],
        ['kept-state-0123456789', undefined],
        [undefined, 'some-state-0123456789'],
    ] as const) {
        const github = fakeGitHub({ scopes: ALL_SCOPES });
        const { auth, browser } = setup(github);
        if (kept !== undefined) {
            browser.session.set(PENDING_SIGN_IN_KEY, JSON.stringify({ state: kept, returnTo: '/' }));
        }

        const result = await auth.completeSignIn({ code: 'the-code', state: returned });

        const expected: SignInResult = { ok: false, failure: 'failed' };
        expect(result).toEqual(expected);
        expect(auth.failure).toBe('failed');
        expect(github.exchanges).toEqual([]);
        expect(browser.local.has(TOKEN_KEY)).toBe(false);
        expect(auth.signedIn).toBe(false);
    }
});

test('cancelling on GitHub is told apart from failing', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth, browser } = setup(github);
    auth.startSignIn('/');
    const state = new URL(browser.navigatedTo[0] ?? '', ORIGIN).searchParams.get('state') ?? '';

    const result = await auth.completeSignIn({ error: 'access_denied', state });

    expect(result).toEqual({ ok: false, failure: 'cancelled' });
    expect(github.exchanges).toEqual([]);
});

test('a token without every scope githq needs is not kept', async () => {
    const github = fakeGitHub({ scopes: ['repo', 'read:org'] });
    const { auth, browser } = setup(github);
    browser.session.set(PENDING_SIGN_IN_KEY, JSON.stringify({ state: 'kept-state-0123456789', returnTo: '/' }));

    const result = await auth.completeSignIn({ code: 'the-code', state: 'kept-state-0123456789' });

    expect(result).toEqual({ ok: false, failure: 'missingScopes' });
    expect(github.tokensSeen).toEqual([]);
    expect(browser.local.has(TOKEN_KEY)).toBe(false);
});

test('an exchange whose answer is cut off on the way fails the sign-in, without throwing', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, exchangeCutOff: true });
    const { auth, browser } = setup(github);
    browser.session.set(PENDING_SIGN_IN_KEY, JSON.stringify({ state: 'kept-state-0123456789', returnTo: '/' }));

    const result = await auth.completeSignIn({ code: 'the-code', state: 'kept-state-0123456789' });

    expect(result).toEqual({ ok: false, failure: 'failed' });
    expect(auth.failure).toBe('failed');
    expect(browser.local.has(TOKEN_KEY)).toBe(false);
});

test('a stored user opens the app at once; a stored token GitHub rejects signs out cleanly', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, rejectToken: true });
    const { auth, browser } = setup(github, {
        [TOKEN_KEY]: 'gho_revoked',
        [VIEWER_KEY]: JSON.stringify(VIEWER),
        'githq.sidebarCollapsed': 'true',
    });

    // Signed in straight from storage, before GitHub has answered.
    expect(auth.signedIn).toBe(true);
    expect(auth.viewer).toEqual(VIEWER);

    await auth.refreshViewer();

    expect(github.tokensSeen).toContain('gho_revoked');
    expect(auth.signedIn).toBe(false);
    expect(auth.viewer).toBeNull();
    expect(auth.token).toBeNull();
    expect(auth.failure).toBe('tokenRejected');
    expect(browser.local.has(TOKEN_KEY)).toBe(false);
    expect(browser.local.has(VIEWER_KEY)).toBe(false);
    // Only the session is forgotten.
    expect(browser.local.get('githq.sidebarCollapsed')).toBe('true');
});

test('a stored token keeps the session when GitHub cannot be reached', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, offline: true });
    const { auth } = setup(github, { [TOKEN_KEY]: 'gho_ok', [VIEWER_KEY]: JSON.stringify(VIEWER) });

    await auth.refreshViewer();

    expect(auth.signedIn).toBe(true);
    expect(auth.failure).toBeNull();
});

test('a stored token without a known user waits for GitHub before the app opens', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth } = setup(github, { [TOKEN_KEY]: 'gho_ok' });

    expect(auth.signedIn).toBe(false);
    await auth.ready();

    expect(auth.signedIn).toBe(true);
    expect(auth.viewer).toEqual(VIEWER);
});

test('signing out in another tab signs this tab out, and nothing more goes to GitHub with the old token', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth, browser } = setup(github, { [TOKEN_KEY]: 'gho_ok', [VIEWER_KEY]: JSON.stringify(VIEWER) });
    await auth.refreshViewer();
    const seen = github.tokensSeen.length;

    browser.fromAnotherTab({ [TOKEN_KEY]: null, [VIEWER_KEY]: null });

    expect(auth.signedIn).toBe(false);
    expect(auth.token).toBeNull();
    expect(auth.viewer).toBeNull();
    // Not a failure to explain: the user signed out.
    expect(auth.failure).toBeNull();
    await auth.refreshViewer();
    expect(github.tokensSeen).toHaveLength(seen);
});

test('signing in as someone else in another tab moves this tab to that user', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, viewers: { gho_other: OTHER_VIEWER } });
    const { auth, browser } = setup(github, { [TOKEN_KEY]: 'gho_ok', [VIEWER_KEY]: JSON.stringify(VIEWER) });

    browser.fromAnotherTab({ [TOKEN_KEY]: 'gho_other', [VIEWER_KEY]: JSON.stringify(OTHER_VIEWER) });

    expect(auth.token).toBe('gho_other');
    expect(auth.viewer).toEqual(OTHER_VIEWER);
    // GitHub is asked again whose the new token is.
    await waitUntil(() => github.tokensSeen.includes('gho_other'), { intervalMs: 1, timeoutMs: 1000 });
    expect(auth.signedIn).toBe(true);
});

test('a tab signed out meanwhile takes over a sign-in made in another tab', () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth, browser } = setup(github);

    browser.fromAnotherTab({ [TOKEN_KEY]: 'gho_ok', [VIEWER_KEY]: JSON.stringify(VIEWER) });

    expect(auth.signedIn).toBe(true);
    expect(auth.viewer).toEqual(VIEWER);
});

test('a user GitHub names after the session was signed out in another tab is not stored back', async () => {
    const answer = createPromise();
    const github = fakeGitHub({ scopes: ALL_SCOPES, answerAfter: answer.promise });
    const { auth, browser } = setup(github, { [TOKEN_KEY]: 'gho_ok', [VIEWER_KEY]: JSON.stringify(VIEWER) });

    const refreshing = auth.refreshViewer();
    // The other tab has cleared the storage; this tab has not been told yet.
    browser.local.clear();
    answer.resolve();
    await refreshing;

    expect(browser.local.has(VIEWER_KEY)).toBe(false);
});

test('a 401 for a session another tab has replaced does not sign out the new one', async () => {
    const answer = createPromise();
    const github = fakeGitHub({ scopes: ALL_SCOPES, rejectToken: true, answerAfter: answer.promise });
    const { auth, browser } = setup(github, { [TOKEN_KEY]: 'gho_revoked', [VIEWER_KEY]: JSON.stringify(VIEWER) });

    const refreshing = auth.refreshViewer();
    browser.local.set(TOKEN_KEY, 'gho_other');
    answer.resolve();
    await refreshing;

    expect(browser.local.get(TOKEN_KEY)).toBe('gho_other');
    expect(auth.failure).toBeNull();
});

test('every GitHub answer reports its allowance', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth, container } = setup(github);

    await auth.signInWithToken('gho_dev');

    expect(container.resolve(GitHubRateLimitStore).get('graphql')).toEqual({
        resource: 'graphql',
        limit: 5000,
        remaining: 4812,
        resetAt: new Date(1_800_000_000_000),
    });
});

interface FakeGitHubOptions {
    /** The scopes the token exchange reports as granted. */
    scopes: string[];
    /** GitHub answers every GraphQL call with 401. */
    rejectToken?: boolean;
    /** The token exchange's answer breaks off after its status, while its body arrives. */
    exchangeCutOff?: boolean;
    /** GraphQL calls fail at the network. */
    offline?: boolean;
    /** Whom GitHub names for each token; {@link VIEWER} for any other. */
    viewers?: Record<string, Viewer>;
    /** GraphQL calls wait for this before answering. */
    answerAfter?: Promise<unknown>;
}

/** The Worker's token exchange and GitHub's GraphQL `viewer`, recording what reached them. */
function fakeGitHub(options: FakeGitHubOptions) {
    const exchanges: unknown[] = [];
    const tokensSeen: string[] = [];

    async function fetch(input: string | Request | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const body = typeof init?.body === 'string' ? init.body : '';

        if (url === OAUTH_TOKEN_PATH) {
            exchanges.push(JSON.parse(body));
            if (options.exchangeCutOff) {
                const cutOff = new ReadableStream({
                    start: controller => {
                        controller.error(new TypeError('network error'));
                    },
                });
                return new Response(cutOff, { headers: { 'content-type': 'application/json' } });
            }

            return Response.json({ accessToken: 'gho_new', scopes: options.scopes });
        }

        if (url === 'https://api.github.com/graphql') {
            if (options.offline) {
                throw new TypeError('Failed to fetch');
            }

            const authorization = new Headers(init?.headers).get('Authorization') ?? '';
            const token = authorization.replace('Bearer ', '');
            tokensSeen.push(token);
            await options.answerAfter;
            const headers = {
                'x-ratelimit-resource': 'graphql',
                'x-ratelimit-limit': '5000',
                'x-ratelimit-remaining': '4812',
                'x-ratelimit-reset': '1800000000',
            };
            return options.rejectToken
                ? Response.json({ message: 'Bad credentials' }, { status: 401, headers })
                : Response.json({ data: { viewer: options.viewers?.[token] ?? VIEWER } }, { headers });
        }

        throw new Error(`Unexpected request to ${url}`);
    }

    return { fetch, exchanges, tokensSeen };
}

function setup(github: ReturnType<typeof fakeGitHub>, stored: Record<string, string> = {}) {
    const local = new Map(Object.entries(stored));
    const session = new Map<string, string>();
    const navigatedTo: string[] = [];
    const storageListeners: ((key: string | null) => void)[] = [];
    const browser: BrowserShape = {
        fetch: github.fetch,
        localStorage: mapStorage(local),
        sessionStorage: mapStorage(session),
        origin: ORIGIN,
        getRandomValues: bytes => {
            crypto.getRandomValues(bytes);
        },
        navigate: url => {
            navigatedTo.push(url);
        },
        openInNewTab: () => {},
        onLocalStorageChange: listener => {
            storageListeners.push(listener);
        },
        isVisible: () => true,
        onVisibilityChange: () => {},
        isOnline: () => true,
        onOnlineChange: () => {},
        estimateStorage: () => Promise.resolve(null),
        ...createTestTabs().open(),
    };

    const { container } = createTestContainer();
    container.set(Browser, browser);
    const auth = container.resolve(AuthStore);

    /** Another tab writes `changes` (`null` removes a key), and this tab gets a `storage` event for each. */
    function fromAnotherTab(changes: Record<string, string | null>) {
        for (const [key, value] of Object.entries(changes)) {
            if (value === null) {
                local.delete(key);
            } else {
                local.set(key, value);
            }
        }

        for (const key of Object.keys(changes)) {
            for (const listener of storageListeners) {
                listener(key);
            }
        }
    }

    return { auth, container, browser: { local, session, navigatedTo, fromAnotherTab } };
}

function mapStorage(map: Map<string, string>): BrowserLocalStorage {
    return {
        getItem: key => map.get(key) ?? null,
        setItem: (key, value) => {
            map.set(key, value);
        },
        removeItem: key => {
            map.delete(key);
        },
        key: index => [...map.keys()][index] ?? null,
        get length() {
            return map.size;
        },
    };
}
