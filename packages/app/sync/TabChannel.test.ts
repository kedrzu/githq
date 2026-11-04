/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { AnsweredView } from '@/projects/ProjectViewAnswers.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { createTestTabs } from '@/testing/createTestTabs.js';
import type { TestTabs } from '@/testing/createTestTabs.js';

import { TabChannel } from './TabChannel.js';

const VIEW: AnsweredView = { projectId: 'PVT_1', filter: 'reviewers:octocat', term: 'reviewers:octocat' };

test('a tab gone without a word — crashed, discarded — is forgotten after two missed heartbeats; a live one never is', async () => {
    const browser = createTestTabs();
    const login = `user-${crypto.randomUUID()}`;
    const hidden = openTab(browser, login);
    const shown = openTab(browser, login);
    hidden.session.setVisible(false);
    shown.channel.setShownView(VIEW);
    await advance([hidden, shown], 0);

    expect(hidden.channel.anyVisible).toBe(true);
    expect(hidden.channel.otherViews).toEqual([VIEW]);

    // Both live: however long, each still knows the other.
    for (let minute = 0; minute < 5; minute++) {
        await advance([hidden, shown], 60_000);
    }

    expect(hidden.channel.anyVisible).toBe(true);
    expect(hidden.channel.otherViews).toEqual([VIEW]);

    shown.session.tab.crash();
    await advance([hidden], 60_000);
    // One heartbeat missed: it may be late.
    expect(hidden.channel.anyVisible).toBe(true);

    await advance([hidden], 30_000);
    expect(hidden.channel.anyVisible).toBe(false);
    expect(hidden.channel.otherViews).toEqual([]);
});

test('the repositories another tab has on screen are heard, and go with it', async () => {
    const browser = createTestTabs();
    const login = `user-${crypto.randomUUID()}`;
    const stays = openTab(browser, login);
    const leaves = openTab(browser, login);
    leaves.channel.setAnyRefRepositories(['acme/web']);
    await advance([stays, leaves], 0);
    expect(stays.channel.otherAnyRefRepositories).toEqual(['acme/web']);

    leaves.channel.setAnyRefRepositories([]);
    await advance([stays, leaves], 0);
    expect(stays.channel.otherAnyRefRepositories).toEqual([]);

    leaves.channel.setAnyRefRepositories(['acme/api']);
    await advance([stays, leaves], 0);
    leaves.session.tab.close();
    await advance([stays], 0);
    expect(stays.channel.otherAnyRefRepositories).toEqual([]);
});

test('the repositories another tab holds are heard when nothing else of it changed, and go with it', async () => {
    const browser = createTestTabs();
    const login = `user-${crypto.randomUUID()}`;
    const stays = openTab(browser, login);
    const leaves = openTab(browser, login);
    await advance([stays, leaves], 0);

    leaves.channel.setHeldRepositories(['acme/web']);
    await advance([stays, leaves], 0);
    expect(stays.channel.otherHeldRepositories).toEqual(['acme/web']);

    leaves.channel.setHeldRepositories([]);
    await advance([stays, leaves], 0);
    expect(stays.channel.otherHeldRepositories).toEqual([]);

    leaves.channel.setHeldRepositories(['acme/api']);
    await advance([stays, leaves], 0);
    leaves.session.tab.close();
    await advance([stays], 0);
    expect(stays.channel.otherHeldRepositories).toEqual([]);
});

function openTab(browser: TestTabs, login: string) {
    const session = createTestSession({ login, answer: () => undefined, tabs: browser });
    return { session, channel: session.container.resolve(TabChannel) };
}

/** Moves the tabs' clocks on together, the heartbeats crossing between them on the way. */
async function advance(tabs: readonly ReturnType<typeof openTab>[], ms: number) {
    for (const tab of tabs) {
        await tab.session.clock.advance(ms);
    }

    for (const tab of tabs) {
        await tab.session.clock.advance(0);
    }
}
