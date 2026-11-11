/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { computed } from 'vue';

import { createTestSession } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';

import { RepositoryHolds } from './RepositoryHolds.js';

const TEN_MINUTES = 600_000;

test('a released hold lasts ten more minutes, taken again it stays, and it is let go once with the name it was held by', async () => {
    const tab = openTab(createTestTabs(), uniqueLogin());
    const held = computed(() => tab.holds.isHeld('acme/web'));

    const release = tab.holds.hold('Acme/Web');
    expect(held.value).toBe(true);

    release();
    await tab.session.clock.advance(TEN_MINUTES - 1);
    expect(held.value).toBe(true);

    // Back in time: the ten minutes that ran out are not the ones that count any more.
    const again = tab.holds.hold('acme/WEB');
    await tab.session.clock.advance(TEN_MINUTES);
    expect(held.value).toBe(true);
    expect(tab.letGo).toEqual([]);

    again();
    // A release called twice is one release, not the end of another screen's hold.
    again();
    await tab.session.clock.advance(TEN_MINUTES - 1);
    expect(held.value).toBe(true);

    await tab.session.clock.advance(1);
    expect(held.value).toBe(false);
    expect(tab.letGo).toEqual(['Acme/Web']);
});

test('while another screen holds it, a screen leaving starts no ten minutes', async () => {
    const tab = openTab(createTestTabs(), uniqueLogin());

    const leaving = tab.holds.hold('acme/web');
    const staying = tab.holds.hold('acme/web');
    leaving();
    leaving();
    await tab.session.clock.advance(TEN_MINUTES * 2);
    expect(tab.holds.isHeld('acme/web')).toBe(true);

    staying();
    await tab.session.clock.advance(TEN_MINUTES);
    expect(tab.holds.isHeld('acme/web')).toBe(false);
    expect(tab.letGo).toEqual(['acme/web']);
});

test('another tab knows of a hold while it lasts, and when it is over', async () => {
    const browser = createTestTabs();
    const login = uniqueLogin();
    const holding = openTab(browser, login);
    const other = openTab(browser, login);
    const held = computed(() => other.holds.isHeld('acme/web'));
    expect(held.value).toBe(false);

    const release = holding.holds.hold('Acme/Web');
    await advance([holding, other], 0);
    expect(held.value).toBe(true);

    release();
    // In steps, each tab hearing the other's heartbeats in time.
    for (let minute = 0; minute < 9; minute++) {
        await advance([holding, other], 60_000);
    }

    await advance([holding, other], 59_000);
    expect(held.value).toBe(true);

    await advance([holding, other], 1000);
    expect(held.value).toBe(false);
    // Its own tab's hold it never had.
    expect(other.letGo).toEqual([]);
});

test('a tab joining later hears of the holds already there', async () => {
    const browser = createTestTabs();
    const login = uniqueLogin();
    const holding = openTab(browser, login);
    holding.holds.hold('acme/web');

    const late = openTab(browser, login);
    await advance([holding, late], 0);

    expect(late.holds.isHeld('acme/web')).toBe(true);
});

test('the hold of a tab closed ends at once; of a tab gone without a word, once its presence expires', async () => {
    const browser = createTestTabs();
    const login = uniqueLogin();
    const stays = openTab(browser, login);
    const closed = openTab(browser, login);
    const crashed = openTab(browser, login);
    closed.holds.hold('acme/closed');
    crashed.holds.hold('acme/crashed');
    await advance([stays, closed, crashed], 0);
    expect(stays.holds.isHeld('acme/closed')).toBe(true);
    expect(stays.holds.isHeld('acme/crashed')).toBe(true);

    closed.session.tab.close();
    crashed.session.tab.crash();
    await advance([stays], 0);
    expect(stays.holds.isHeld('acme/closed')).toBe(false);
    expect(stays.holds.isHeld('acme/crashed')).toBe(true);

    await advance([stays], 90_000);
    expect(stays.holds.isHeld('acme/crashed')).toBe(false);
});

test('a hold ends with the account: here, in the other tabs, and for a release called after', async () => {
    const browser = createTestTabs();
    const login = uniqueLogin();
    const tab = openTab(browser, login);
    const other = openTab(browser, login);
    const before = tab.holds.hold('acme/web');
    const lasting = tab.holds.hold('acme/lasting');
    lasting();
    await advance([tab, other], 0);
    expect(other.holds.isHeld('acme/web')).toBe(true);

    tab.session.signOutFromAnotherTab();
    await advance([tab, other], 0);
    expect(tab.holds.isHeld('acme/web')).toBe(false);
    expect(other.holds.isHeld('acme/web')).toBe(false);
    expect(other.holds.isHeld('acme/lasting')).toBe(false);
    expect(tab.letGo.toSorted()).toEqual(['acme/lasting', 'acme/web']);

    // The next account's hold of the same name: what the last account's screen leaves behind does not touch it.
    tab.session.signInFromAnotherTab(uniqueLogin());
    tab.holds.hold('acme/web');
    before();
    await tab.session.clock.advance(TEN_MINUTES * 2);
    expect(tab.holds.isHeld('acme/web')).toBe(true);
    // Nor did the first account's ten minutes outlive it.
    expect(tab.letGo.toSorted()).toEqual(['acme/lasting', 'acme/web']);
});

function openTab(browser: TestTabs, login: string) {
    const session = createTestSession({ login, answer: () => undefined, tabs: browser });
    const holds = session.container.resolve(RepositoryHolds);
    const letGo: string[] = [];
    holds.onLetGo(name => letGo.push(name));
    return { session, holds, letGo };
}

/** Moves the tabs' clocks on together, what they tell each other crossing between them on the way. */
async function advance(tabs: readonly ReturnType<typeof openTab>[], ms: number) {
    for (const tab of tabs) {
        await tab.session.clock.advance(ms);
    }

    for (const tab of tabs) {
        await tab.session.clock.advance(0);
    }
}
