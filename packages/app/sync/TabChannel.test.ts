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
