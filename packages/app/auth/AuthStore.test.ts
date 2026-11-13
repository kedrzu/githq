/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

import {
    OAUTH_AUTHORIZE_PATH,
    OAUTH_CALLBACK_PATH,
    OAUTH_REFRESH_PATH,
    OAUTH_REVOKE_PATH,
    OAUTH_SCOPES,
    OAUTH_STATE_PATTERN,
    OAUTH_TOKEN_PATH,
    SIGNED_IN_HINT_COOKIE,
} from '@githq/github/oauth.js';
import type { OAuthCredentials } from '@githq/github/oauth.js';
import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import type { BrowserShape, BrowserStorage } from '@/services/Browser.js';
import { Browser } from '@/services/Browser.js';
import type { ClockShape } from '@/services/Clock.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { createTestClock } from '@/testing/createTestClock.js';
import { settle } from '@/testing/settle.js';
import { storedToken } from '@/testing/storedToken.js';

import type { SignInResult, TokenRejection, Viewer } from './AuthStore.js';
import { AuthStore, PENDING_SIGN_IN_KEY, TOKEN_REJECTIONS_KEY, VIEWER_KEY } from './AuthStore.js';
import { TOKEN_KEY } from './TokenVault.js';
import { stringifyOAuthCredentials } from './utils/stringifyOAuthCredentials.js';

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
    expect(JSON.parse(browser.local.get(TOKEN_KEY) ?? '')).toEqual({
        accessToken: 'gho_new',
        refreshToken: 'ghr_new',
        expiresAt: expect.any(Number),
    });
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
        [TOKEN_KEY]: storedToken('gho_revoked'),
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

test('a rejected token leaves a record of the sign-out that GitHub’s security log can match, never the token', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, rejectToken: true });
    const earlier = Array.from({ length: 10 }, (_, index) => ({ at: `earlier ${index}` }));
    const { auth, browser } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_revoked'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
        [TOKEN_REJECTIONS_KEY]: JSON.stringify(earlier),
    });

    await auth.refreshViewer();
    await waitUntil(() => browser.local.get(TOKEN_REJECTIONS_KEY) !== JSON.stringify(earlier));

    const stored = browser.local.get(TOKEN_REJECTIONS_KEY) ?? '';
    const rejections = JSON.parse(stored) as TokenRejection[];
    // GitHub's `hashed_token`: the SHA-256 of the token, base64.
    const hash = createHash('sha256').update('gho_revoked').digest('base64');
    expect(rejections).toHaveLength(10);
    expect(rejections[0]).toEqual({ at: 'earlier 1' } as unknown as TokenRejection);
    expect(rejections.at(-1)).toEqual({
        at: expect.any(String),
        tokenHash: hash,
        status: 401,
        githubMessage: 'Bad credentials',
    });
    expect(stored).not.toContain('gho_revoked');
});

test('a 401 that GitHub takes back on a later check keeps the session', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, rejectFirst: 2 });
    const { auth, browser, waits } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_ok'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });

    await auth.refreshViewer();

    expect(github.tokensSeen).toEqual(['gho_ok', 'gho_ok', 'gho_ok']);
    expect(waits.length).toBe(2);
    expect(auth.signedIn).toBe(true);
    expect(auth.failure).toBeNull();
    expect(browser.local.get(TOKEN_KEY)).toBe(storedToken('gho_ok'));
    expect(browser.local.has(TOKEN_REJECTIONS_KEY)).toBe(false);
});

test('a token is checked three times before a sign-out, once for all the refreshes asked for meanwhile', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, rejectToken: true });
    const { auth, waits } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_revoked'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });

    // Each sync loop that gets a 401 asks for a refresh.
    await Promise.all([auth.refreshViewer(), auth.refreshViewer(), auth.refreshViewer()]);

    expect(github.tokensSeen).toEqual(['gho_revoked', 'gho_revoked', 'gho_revoked']);
    expect(waits).toEqual([3_000, 15_000]);
    expect(auth.failure).toBe('tokenRejected');
});

test('a stored token keeps the session when GitHub cannot be reached', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, offline: true });
    const { auth } = setup(github, { [TOKEN_KEY]: storedToken('gho_ok'), [VIEWER_KEY]: JSON.stringify(VIEWER) });

    await auth.refreshViewer();

    expect(auth.signedIn).toBe(true);
    expect(auth.failure).toBeNull();
});

test('a stored token without a known user waits for GitHub before the app opens', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth } = setup(github, { [TOKEN_KEY]: storedToken('gho_ok') });

    expect(auth.signedIn).toBe(false);
    await auth.ready();

    expect(auth.signedIn).toBe(true);
    expect(auth.viewer).toEqual(VIEWER);
});

test('signing out revokes the token at GitHub through the Worker, behind the sign-out', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth, browser } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_ok'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });

    auth.signOut();

    // Signed out at once, before the Worker has answered.
    expect(auth.signedIn).toBe(false);
    expect(browser.local.has(TOKEN_KEY)).toBe(false);
    await waitUntil(() => github.revoked.length > 0);
    expect(github.revoked).toEqual([{ method: 'POST', body: { token: 'gho_ok' } }]);

    // Signed out already: nothing more to revoke.
    auth.signOut();
    await Promise.resolve();
    expect(github.revoked).toHaveLength(1);
});

test('signing out works offline: a revocation that cannot reach the Worker neither throws nor keeps the session', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, revokeOffline: true });
    const { auth, browser } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_ok'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });

    expect(() => auth.signOut()).not.toThrow();
    await new Promise(resolve => {
        setTimeout(resolve, 0);
    });

    expect(auth.signedIn).toBe(false);
    expect(browser.local.has(TOKEN_KEY)).toBe(false);
});

test('a token GitHub rejected is not sent to be revoked', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, rejectToken: true });
    const { auth } = setup(github, { [TOKEN_KEY]: storedToken('gho_revoked'), [VIEWER_KEY]: JSON.stringify(VIEWER) });

    await auth.refreshViewer();

    expect(auth.failure).toBe('tokenRejected');
    expect(github.revoked).toEqual([]);
});

test('signing out in another tab signs this tab out, and nothing more goes to GitHub with the old token', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth, browser } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_ok'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });
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
    // The tab that signed out revokes the token; this one only follows.
    expect(github.revoked).toEqual([]);
});

test('signing in as someone else in another tab moves this tab to that user', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, viewers: { gho_other: OTHER_VIEWER } });
    const { auth, browser } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_ok'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });

    browser.fromAnotherTab({ [TOKEN_KEY]: storedToken('gho_other'), [VIEWER_KEY]: JSON.stringify(OTHER_VIEWER) });

    expect(auth.token).toBe('gho_other');
    expect(auth.viewer).toEqual(OTHER_VIEWER);
    // GitHub is asked again whose the new token is.
    await waitUntil(() => github.tokensSeen.includes('gho_other'), { intervalMs: 1, timeoutMs: 1000 });
    expect(auth.signedIn).toBe(true);
});

test('a tab signed out meanwhile takes over a sign-in made in another tab', () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const { auth, browser } = setup(github);

    browser.fromAnotherTab({ [TOKEN_KEY]: storedToken('gho_ok'), [VIEWER_KEY]: JSON.stringify(VIEWER) });

    expect(auth.signedIn).toBe(true);
    expect(auth.viewer).toEqual(VIEWER);
});

test('a user GitHub names after the session was signed out in another tab is not stored back', async () => {
    const answer = createPromise();
    const github = fakeGitHub({ scopes: ALL_SCOPES, answerAfter: answer.promise });
    const { auth, browser } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_ok'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });

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
    const { auth, browser } = setup(github, {
        [TOKEN_KEY]: storedToken('gho_revoked'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });

    const refreshing = auth.refreshViewer();
    browser.local.set(TOKEN_KEY, storedToken('gho_other'));
    answer.resolve();
    await refreshing;

    expect(browser.local.get(TOKEN_KEY)).toBe(storedToken('gho_other'));
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

const START = Date.UTC(2026, 10, 13, 9, 0, 0);
const HOUR = 3_600_000;
/** A session GitHub's web flow signed in: its access token expires in an hour. */
const EXPIRING: OAuthCredentials = { accessToken: 'gho_old', refreshToken: 'ghr_old', expiresAt: START + HOUR };

test('the token is renewed on a timer 5 minutes before it expires, kept only in the vault and never logged', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const clock = createTestClock(START);
    const { auth, browser, logs } = setup(github, signedIn(EXPIRING), { clock });

    await clock.advance(HOUR - 5 * 60_000 - 1);
    expect(github.refreshes).toEqual([]);
    await clock.advance(1);

    expect(github.refreshes).toEqual(['ghr_old']);
    expect(auth.token).toBe('gho_renewed1');
    const expected: OAuthCredentials = {
        accessToken: 'gho_renewed1',
        refreshToken: 'ghr_renewed1',
        expiresAt: clock.now() + 28_800_000,
    };
    expect(JSON.parse(browser.local.get(TOKEN_KEY) ?? '')).toEqual(expected);
    expect(auth.signedIn).toBe(true);
    // The renewed token is renewed again in its turn.
    await clock.advance(8 * HOUR);
    expect(github.refreshes).toEqual(['ghr_old', 'ghr_renewed1']);

    // Credentials nowhere but under the vault's key, and in no log line.
    const secrets = ['gho_old', 'ghr_old', 'gho_renewed1', 'ghr_renewed1', 'gho_renewed2', 'ghr_renewed2'];
    const elsewhere = [...browser.local].filter(([key]) => key !== TOKEN_KEY).map(([, value]) => value);
    const logged = JSON.stringify(logs);
    for (const secret of secrets) {
        expect(elsewhere.filter(value => value.includes(secret))).toEqual([]);
        expect(logged).not.toContain(secret);
    }
});

test('a request about to go with a token expiring within 2 minutes waits for its renewal and goes with the new one', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const clock = createTestClock(START);
    const nearExpiry: OAuthCredentials = { ...EXPIRING, expiresAt: START + 90_000 };
    const { auth } = setup(github, signedIn(nearExpiry), { clock });

    expect(await auth.getFreshToken()).toBe('gho_renewed1');
    expect(github.refreshes).toEqual(['ghr_old']);
    // A token far from expiry goes as it is.
    expect(await auth.getFreshToken()).toBe('gho_renewed1');
    expect(github.refreshes).toHaveLength(1);
});

test('the timer, a request and a 401 asking for a renewal at once renew the token once, with Web Locks or without', async () => {
    for (const webLocks of [true, false]) {
        const answer = createPromise();
        const github = fakeGitHub({ scopes: ALL_SCOPES, rejectTokens: ['gho_old'], refreshAfter: answer.promise });
        const clock = createTestClock(START);
        const nearExpiry: OAuthCredentials = { ...EXPIRING, expiresAt: START + 60_000 };
        const { auth } = setup(github, signedIn(nearExpiry), { clock, webLocks });
        // The check at start, which GitHub answers 401, asks for a renewal too.
        await waitUntil(() => github.refreshes.length === 1, { intervalMs: 1, timeoutMs: 1000 });

        await clock.advance(0);
        const request = auth.getFreshToken();
        const check = auth.refreshViewer();
        answer.resolve();

        expect(await request).toBe('gho_renewed1');
        await check;
        expect(github.refreshes).toEqual(['ghr_old']);
        expect(auth.signedIn).toBe(true);
    }
});

test('after a sleep past the expiry, the first 401 renews the token and the session goes on', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, rejectTokens: ['gho_old'] });
    // The token expired while the Mac slept; the timer has not run yet.
    const clock = createTestClock(START + 2 * HOUR);
    const { auth } = setup(github, signedIn(EXPIRING), { clock });

    await auth.refreshViewer();

    expect(github.refreshes).toEqual(['ghr_old']);
    expect(auth.token).toBe('gho_renewed1');
    expect(auth.signedIn).toBe(true);
    expect(auth.failure).toBeNull();
    // The user read again with the new token.
    expect(github.tokensSeen).toEqual(['gho_old', 'gho_renewed1']);
});

test('a refresh token the Worker refuses records the rejection and signs out', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES, refresh: 'refused' });
    const clock = createTestClock(START);
    const { auth, browser } = setup(github, signedIn(EXPIRING), { clock });

    await clock.advance(HOUR);

    expect(auth.signedIn).toBe(false);
    expect(auth.token).toBeNull();
    expect(auth.failure).toBe('tokenRejected');
    expect(browser.local.has(TOKEN_KEY)).toBe(false);
    const stored = browser.local.get(TOKEN_REJECTIONS_KEY) ?? '';
    const expected: TokenRejection[] = [
        {
            at: new Date(START + HOUR - 5 * 60_000).toISOString(),
            tokenHash: createHash('sha256').update('gho_old').digest('base64'),
            status: 400,
            githubMessage: 'bad_refresh_token',
        },
    ];
    expect(JSON.parse(stored)).toEqual(expected);
    expect(stored).not.toContain('ghr_old');
    // Signed out: the timer renews nothing more.
    await clock.advance(HOUR);
    expect(github.refreshes).toEqual(['ghr_old']);
});

test('a Worker that fails or cannot be reached keeps the session; requests go with the token held, the timer tries again', async () => {
    for (const refresh of ['offline', 'fails'] as const) {
        const github = fakeGitHub({ scopes: ALL_SCOPES, refresh });
        const clock = createTestClock(START);
        const nearExpiry: OAuthCredentials = { ...EXPIRING, expiresAt: START + 60_000 };
        const { auth, browser } = setup(github, signedIn(nearExpiry), { clock });

        expect(await auth.getFreshToken()).toBe('gho_old');
        // Within the minute, requests do not ask the Worker again.
        expect(await auth.getFreshToken()).toBe('gho_old');
        expect(github.refreshes).toEqual(['ghr_old']);
        expect(auth.signedIn).toBe(true);
        expect(auth.failure).toBeNull();
        expect(browser.local.get(TOKEN_KEY)).toBe(stringifyOAuthCredentials(nearExpiry));

        await clock.advance(60_000);
        expect(github.refreshes).toEqual(['ghr_old', 'ghr_old']);
    }
});

test('two tabs renewing at once spend the refresh token once: the second takes over what the first stored', async () => {
    const github = fakeGitHub({ scopes: ALL_SCOPES });
    const shared: SharedBrowser = { local: new Map(), tabs: createTestTabs() };
    const nearExpiry: OAuthCredentials = { ...EXPIRING, expiresAt: START + 60_000 };
    const first = setup(github, signedIn(nearExpiry), { clock: createTestClock(START), browser: shared });
    const second = setup(github, {}, { clock: createTestClock(START), browser: shared });

    const tokens = await Promise.all([first.auth.getFreshToken(), second.auth.getFreshToken()]);

    expect(tokens).toEqual(['gho_renewed1', 'gho_renewed1']);
    expect(github.refreshes).toEqual(['ghr_old']);
    for (const tab of [first, second]) {
        expect(tab.auth.token).toBe('gho_renewed1');
        expect(tab.auth.signedIn).toBe(true);
        expect(tab.auth.failure).toBeNull();
    }
});

test('a renewal answered after the session was signed out, or replaced, does not bring it back', async () => {
    for (const meanwhile of ['signedOut', 'replaced'] as const) {
        const answer = createPromise();
        const github = fakeGitHub({ scopes: ALL_SCOPES, refreshAfter: answer.promise });
        const clock = createTestClock(START);
        const { auth, browser } = setup(github, signedIn(EXPIRING), { clock });

        await clock.advance(HOUR);
        expect(github.refreshes).toEqual(['ghr_old']);
        if (meanwhile === 'signedOut') {
            auth.signOut();
        } else {
            browser.fromAnotherTab({
                [TOKEN_KEY]: storedToken('gho_other'),
                [VIEWER_KEY]: JSON.stringify(OTHER_VIEWER),
            });
        }

        answer.resolve();
        await settle();

        expect(auth.token).toBe(meanwhile === 'signedOut' ? null : 'gho_other');
        expect(browser.local.get(TOKEN_KEY)).toBe(meanwhile === 'signedOut' ? undefined : storedToken('gho_other'));
        expect(auth.failure).toBeNull();
    }
});

test('a stored value that is not credentials — a bare token from before, junk — opens signed out, without a throw', () => {
    for (const value of [
        'gho_bare',
        '{"accessToken":"gho_x"}',
        '{"accessToken":"","refreshToken":null,"expiresAt":null}',
        '{',
    ]) {
        const github = fakeGitHub({ scopes: ALL_SCOPES });
        const { auth, browser } = setup(github, { [TOKEN_KEY]: value, [VIEWER_KEY]: JSON.stringify(VIEWER) });

        expect(auth.token).toBeNull();
        expect(auth.signedIn).toBe(false);
        expect(browser.cookies).toEqual([`${CLEARED}; Secure`]);
        expect(github.tokensSeen).toEqual([]);
    }
});

interface FakeGitHubOptions {
    /** The scopes the token exchange reports as granted. */
    scopes: string[];
    /** GitHub answers every GraphQL call with 401. */
    rejectToken?: boolean;
    /** GitHub answers this many GraphQL calls with 401, then accepts the token. */
    rejectFirst?: number;
    /** The token exchange's answer breaks off after its status, while its body arrives. */
    exchangeCutOff?: boolean;
    /** GraphQL calls fail at the network. */
    offline?: boolean;
    /** Whom GitHub names for each token; {@link VIEWER} for any other. */
    viewers?: Record<string, Viewer>;
    /** GraphQL calls wait for this before answering. */
    answerAfter?: Promise<unknown>;
    /** The Worker's revocation fails at the network. */
    revokeOffline?: boolean;
    /** GitHub answers GraphQL calls with these tokens with 401, and accepts any other. */
    rejectTokens?: string[];
    /** How the Worker's refresh answers: renews (as without it), refuses the refresh token, fails, or is not reached. */
    refresh?: 'renews' | 'refused' | 'fails' | 'offline';
    /** The Worker's refresh waits for this before answering. */
    refreshAfter?: Promise<unknown>;
}

/**
 * The Worker's token exchange, refresh and revocation and GitHub's GraphQL `viewer`, recording what reached them. A
 * refresh token is good for one refresh, as GitHub's: each renews to `gho_renewed<n>` and `ghr_renewed<n>`.
 */
function fakeGitHub(options: FakeGitHubOptions) {
    const exchanges: unknown[] = [];
    const tokensSeen: string[] = [];
    const revoked: unknown[] = [];
    /** The refresh tokens sent to the Worker, in order. */
    const refreshes: string[] = [];
    const spentRefreshTokens = new Set<string>();

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

            return Response.json({
                accessToken: 'gho_new',
                refreshToken: 'ghr_new',
                expiresIn: 28_800,
                scopes: options.scopes,
            });
        }

        if (url === OAUTH_REFRESH_PATH) {
            const sent: unknown = JSON.parse(body);
            const refreshToken = isPlainObject(sent) && typeof sent.refreshToken === 'string' ? sent.refreshToken : '';
            refreshes.push(refreshToken);
            await options.refreshAfter;
            switch (options.refresh ?? 'renews') {
                case 'offline':
                    throw new TypeError('Failed to fetch');
                case 'fails':
                    return Response.json({ error: 'github_unreachable' }, { status: 502 });
                case 'refused':
                    return Response.json({ error: 'bad_refresh_token' }, { status: 400 });
                case 'renews':
                    break;
            }

            if (spentRefreshTokens.has(refreshToken)) {
                return Response.json({ error: 'bad_refresh_token' }, { status: 400 });
            }

            spentRefreshTokens.add(refreshToken);
            return Response.json({
                accessToken: `gho_renewed${refreshes.length}`,
                refreshToken: `ghr_renewed${refreshes.length}`,
                expiresIn: 28_800,
                scopes: options.scopes,
            });
        }

        if (url === OAUTH_REVOKE_PATH) {
            if (options.revokeOffline) {
                throw new TypeError('Failed to fetch');
            }

            revoked.push({ method: init?.method, body: JSON.parse(body) });
            return new Response(null, { status: 204 });
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
            return options.rejectToken ||
                tokensSeen.length <= (options.rejectFirst ?? 0) ||
                options.rejectTokens?.includes(token)
                ? Response.json({ message: 'Bad credentials' }, { status: 401, headers })
                : Response.json({ data: { viewer: options.viewers?.[token] ?? VIEWER } }, { headers });
        }

        throw new Error(`Unexpected request to ${url}`);
    }

    return { fetch, exchanges, tokensSeen, revoked, refreshes };
}

interface SetupOptions {
    origin?: string;
    /** The clock; without it, every wait ends at once and is counted (`waits`). */
    clock?: ClockShape;
    /** The `localStorage` and the Web Locks of the browser, shared with another tab's setup. */
    browser?: SharedBrowser;
    /** `false`: a browser without Web Locks (an insecure origin, an old browser). */
    webLocks?: boolean;
}

/** What tabs of one browser share. */
interface SharedBrowser {
    local: Map<string, string>;
    tabs: TestTabs;
}

function setup(
    github: ReturnType<typeof fakeGitHub>,
    stored: Record<string, string> = {},
    { origin = ORIGIN, clock, browser: shared, webLocks = true }: SetupOptions = {},
) {
    const local = shared?.local ?? new Map<string, string>();
    for (const [key, value] of Object.entries(stored)) {
        local.set(key, value);
    }

    const session = new Map<string, string>();
    const navigatedTo: string[] = [];
    const cookies: string[] = [];
    const storageListeners: ((key: string | null) => void)[] = [];
    const browser: BrowserShape = {
        fetch: github.fetch,
        localStorage: mapStorage(local),
        sessionStorage: mapStorage(session),
        origin,
        getRandomValues: bytes => {
            crypto.getRandomValues(bytes);
        },
        reload: () => {},
        navigate: url => {
            navigatedTo.push(url);
        },
        replaceLocation: () => {},
        openInNewTab: () => {},
        writeCookie: cookie => {
            cookies.push(cookie);
        },
        onLocalStorageChange: listener => {
            storageListeners.push(listener);
        },
        isVisible: () => true,
        onVisibilityChange: () => {},
        onFocus: () => {},
        isOnline: () => true,
        onOnlineChange: () => {},
        estimateStorage: () => Promise.resolve(null),
        ...(shared?.tabs ?? createTestTabs()).open(),
        ...(webLocks ? {} : { requestLock: () => null }),
    };

    // Every wait for a further check ends at once, and is counted.
    const waits: number[] = [];
    const { container, logs } = createTestContainer();
    container.set(Browser, browser);
    container.set(
        Clock,
        clock ?? {
            now: () => Date.now(),
            schedule: (callback, delayMs) => {
                waits.push(delayMs);
                const timer = setTimeout(callback, 0);
                return () => clearTimeout(timer);
            },
        },
    );
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

    return { auth, container, logs, waits, browser: { local, session, navigatedTo, cookies, fromAnotherTab } };
}

/** A stored session: `credentials` and their user. */
function signedIn(credentials: OAuthCredentials): Record<string, string> {
    return { [TOKEN_KEY]: stringifyOAuthCredentials(credentials), [VIEWER_KEY]: JSON.stringify(VIEWER) };
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

const SET = `${SIGNED_IN_HINT_COOKIE.name}=${SIGNED_IN_HINT_COOKIE.value}; Path=/; SameSite=Lax; Max-Age=31536000`;
const SET_SECURE = `${SET}; Secure`;
const CLEARED = `${SIGNED_IN_HINT_COOKIE.name}=; Path=/; SameSite=Lax; Max-Age=0`;
const CLEARED_SECURE = `${CLEARED}; Secure`;

test('the hint cookie follows the token: set at start, on sign-in and after another tab signs in; cleared on every sign-out', async () => {
    // A stored token sets it at start, before GitHub has answered; a rejection clears it.
    const rejecting = setup(fakeGitHub({ scopes: ALL_SCOPES, rejectToken: true }), {
        [TOKEN_KEY]: storedToken('gho_revoked'),
        [VIEWER_KEY]: JSON.stringify(VIEWER),
    });
    expect(rejecting.browser.cookies).toEqual([SET_SECURE]);
    await rejecting.auth.refreshViewer();
    expect(rejecting.browser.cookies).toEqual([SET_SECURE, CLEARED_SECURE]);

    // No token: cleared at start; signing in sets it, signing out clears it.
    const signedOut = setup(fakeGitHub({ scopes: ALL_SCOPES }));
    expect(signedOut.browser.cookies).toEqual([CLEARED_SECURE]);
    await signedOut.auth.signInWithToken('gho_new');
    expect(signedOut.browser.cookies).toEqual([CLEARED_SECURE, SET_SECURE]);
    signedOut.auth.signOut();
    expect(signedOut.browser.cookies).toEqual([CLEARED_SECURE, SET_SECURE, CLEARED_SECURE]);

    // Another tab signs in, then out.
    const followed = setup(fakeGitHub({ scopes: ALL_SCOPES }));
    followed.browser.fromAnotherTab({ [TOKEN_KEY]: storedToken('gho_ok'), [VIEWER_KEY]: JSON.stringify(VIEWER) });
    expect(followed.browser.cookies).toEqual([CLEARED_SECURE, SET_SECURE]);
    followed.browser.fromAnotherTab({ [TOKEN_KEY]: null, [VIEWER_KEY]: null });
    expect(followed.browser.cookies).toEqual([CLEARED_SECURE, SET_SECURE, CLEARED_SECURE]);
});

test('a failed sign-in, and a token whose user is being fetched, leave the cookie alone', async () => {
    const failing = setup(fakeGitHub({ scopes: ALL_SCOPES, rejectToken: true }));
    await failing.auth.signInWithToken('gho_bad');
    expect(failing.browser.cookies).toEqual([CLEARED_SECURE]);

    // Not signed in yet (no stored user), but the token is stored: the cookie is set and stays so.
    const fetching = setup(fakeGitHub({ scopes: ALL_SCOPES }), { [TOKEN_KEY]: storedToken('gho_ok') });
    expect(fetching.auth.signedIn).toBe(false);
    await fetching.auth.ready();
    expect(fetching.browser.cookies).toEqual([SET_SECURE]);
});

test('the hint cookie carries neither the token nor the user, and is Secure exactly on https', async () => {
    const https = setup(fakeGitHub({ scopes: ALL_SCOPES }), {}, { origin: 'https://githq.dev' });
    await https.auth.signInWithToken('gho_secret');
    https.auth.signOut();
    expect(https.browser.cookies).toEqual([`${CLEARED}; Secure`, `${SET}; Secure`, `${CLEARED}; Secure`]);

    const http = setup(fakeGitHub({ scopes: ALL_SCOPES }), {}, { origin: 'http://localhost:8787' });
    await http.auth.signInWithToken('gho_secret');
    expect(http.browser.cookies).toEqual([CLEARED, SET]);

    for (const cookie of [...https.browser.cookies, ...http.browser.cookies]) {
        expect(cookie).not.toContain('gho_');
        expect(cookie).not.toContain(VIEWER.login);
    }
});
