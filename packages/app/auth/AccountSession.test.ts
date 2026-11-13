/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { OAUTH_REFRESH_PATH } from '@githq/github/oauth.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { createTestSession, TEST_START } from '@/testing/createTestSession.js';

import { AccountSession } from './AccountSession.js';
import type { Account } from './AccountSession.js';
import { AuthStore } from './AuthStore.js';
import { TOKEN_KEY } from './TokenVault.js';
import { stringifyOAuthCredentials } from './utils/stringifyOAuthCredentials.js';

test('another sign-in is another account: the one before is no longer current, and only a change is told', async () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const accounts = session.container.resolve(AccountSession);
    const seen: (Account | null)[] = [];
    accounts.onChange(account => seen.push(account));

    const first = accounts.current;
    expect(first?.login).toBe('octocat');
    expect(await first?.getToken()).toBe('gho_octocat');

    session.signInFromAnotherTab('hubot');
    const second = accounts.current;
    expect(second?.login).toBe('hubot');
    expect(isCurrent(accounts, first)).toBe(false);
    expect(isCurrent(accounts, second)).toBe(true);

    session.signOutFromAnotherTab();
    expect(accounts.current).toBeNull();
    expect(isCurrent(accounts, second)).toBe(false);
    // The token and the viewer arrive one after the other; each step is told, none twice.
    expect(seen[0]).toBe(first);
    expect(seen).toContain(second);
    expect(seen.at(-1)).toBeNull();
    expect(seen.filter((account, index) => index > 0 && account === seen[index - 1])).toEqual([]);
});

test('a renewed token is the same account: still current, and its next request carries the new token', async () => {
    const session = createTestSession({
        login: 'octocat',
        answer: () => undefined,
        answerWorker: (path, body) =>
            path === OAUTH_REFRESH_PATH && isPlainObject(body) && body.refreshToken === 'ghr_octocat'
                ? {
                      status: 200,
                      body: {
                          accessToken: 'gho_renewed',
                          refreshToken: 'ghr_renewed',
                          expiresIn: 28_800,
                          scopes: ['repo', 'project', 'read:org'],
                      },
                  }
                : undefined,
    });
    session.localStorage.set(
        TOKEN_KEY,
        stringifyOAuthCredentials({
            accessToken: 'gho_octocat',
            refreshToken: 'ghr_octocat',
            expiresAt: TEST_START + 3_600_000,
        }),
    );
    const accounts = session.container.resolve(AccountSession);
    const seen: (Account | null)[] = [];
    accounts.onChange(account => seen.push(account));
    const first = accounts.current;

    await session.clock.advance(3_600_000);

    expect(session.container.resolve(AuthStore).token).toBe('gho_renewed');
    expect(accounts.current).toBe(first);
    expect(isCurrent(accounts, first)).toBe(true);
    expect(seen).toEqual([first]);
    await first?.sdk.Viewer();
    expect(session.github.requests.at(-1)).toMatchObject({ operation: 'Viewer', token: 'gho_renewed' });
});

function isCurrent(accounts: AccountSession, account: Account | null) {
    return account !== null && accounts.isCurrent(account);
}
