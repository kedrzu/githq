/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createTestSession } from '@/testing/createTestSession.js';

import { AccountSession } from './AccountSession.js';
import type { Account } from './AccountSession.js';

test('another sign-in is another account: the one before is no longer current, and only a change is told', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const accounts = session.container.resolve(AccountSession);
    const seen: (Account | null)[] = [];
    accounts.onChange(account => seen.push(account));

    const first = accounts.current;
    expect(first?.login).toBe('octocat');
    expect(first?.token).toBe('gho_octocat');

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

function isCurrent(accounts: AccountSession, account: Account | null) {
    return account !== null && accounts.isCurrent(account);
}
