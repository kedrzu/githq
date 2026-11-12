/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { effectScope, nextTick } from 'vue';

import { createTestSession } from '@/testing/createTestSession.js';

import { Browser } from './Browser.js';
import { LocalPreferences } from './LocalPreferences.js';

test('what an earlier githq kept in this browser is read back under the same keys', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    storage.setItem('githq.sidebarCollapsed', 'true');
    storage.setItem('githq.panelWidth.itemPanel', '412');

    const preferences = session.container.resolve(LocalPreferences);

    expect(preferences.sidebarCollapsed.value).toBe(true);
    expect(preferences.getPanelWidth('itemPanel').value).toBe(412);
});

test('with nothing kept, or something that is not a valid value, the defaults are used', () => {
    const empty = createTestSession({ login: 'octocat', answer: () => undefined }).container.resolve(LocalPreferences);
    expect(empty.sidebarCollapsed.value).toBe(false);
    expect(empty.getPanelWidth('sidebar').value).toBeNull();

    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    storage.setItem('githq.sidebarCollapsed', 'yes');
    storage.setItem('githq.panelWidth.sidebar', 'wide');

    const invalid = session.container.resolve(LocalPreferences);
    expect(invalid.sidebarCollapsed.value).toBe(false);
    expect(invalid.getPanelWidth('sidebar').value).toBeNull();
});

test('a change is kept under the same keys, as the plain strings githq always kept', async () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    const preferences = session.container.resolve(LocalPreferences);

    preferences.sidebarCollapsed.value = true;
    preferences.getPanelWidth('itemSide.page').value = 300;
    await nextTick();

    expect(storage.getItem('githq.sidebarCollapsed')).toBe('true');
    expect(storage.getItem('githq.panelWidth.itemSide.page')).toBe('300');
    // One panel is one ref, whoever asks for it.
    expect(preferences.getPanelWidth('itemSide.page')).toBe(preferences.getPanelWidth('itemSide.page'));
});

test("a panel's share is kept beside its width, and only a share of something is read back", async () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    const preferences = session.container.resolve(LocalPreferences);

    preferences.getPanelShare('commitGraph').value = 0.25;
    await nextTick();
    expect(storage.getItem('githq.panelShare.commitGraph')).toBe('0.25');
    expect(storage.getItem('githq.panelWidth.commitGraph')).toBeNull();

    for (const raw of ['wide', '0', '-0.1', '1.5', 'Infinity']) {
        session.fromAnotherTab({ 'githq.panelShare.commitGraph': raw });
        expect(preferences.getPanelShare('commitGraph').value).toBeNull();
    }
});

test("a panel's width first asked for by a component is still kept once that component is gone", async () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    const preferences = session.container.resolve(LocalPreferences);

    // The item's page asks first, then gives way to the panel, and the page comes back to the same width.
    const page = effectScope();
    page.run(() => preferences.getPanelWidth('itemSide.page'));
    page.stop();
    preferences.getPanelWidth('itemSide.page').value = 400;
    await nextTick();

    expect(storage.getItem('githq.panelWidth.itemSide.page')).toBe('400');
});

test('what another tab changes reaches this one, a cleared storage bringing back the defaults', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const preferences = session.container.resolve(LocalPreferences);
    const width = preferences.getPanelWidth('sidebar');

    session.fromAnotherTab({
        'githq.sidebarCollapsed': 'true',
        'githq.panelWidth.sidebar': '300',
    });
    expect(preferences.sidebarCollapsed.value).toBe(true);
    expect(width.value).toBe(300);

    session.fromAnotherTab({ 'githq.panelWidth.sidebar': null });
    expect(width.value).toBeNull();
    expect(preferences.sidebarCollapsed.value).toBe(true);

    session.fromAnotherTab({ 'githq.panelWidth.sidebar': '320' });
    session.clearFromAnotherTab();
    expect(preferences.sidebarCollapsed.value).toBe(false);
    expect(width.value).toBeNull();
});

test('how a job’s log shows starts plain, is kept as it changes, and is shared with another tab', async () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    const preferences = session.container.resolve(LocalPreferences);
    expect(preferences.logWrap.value).toBe(false);
    expect(preferences.logTimes.value).toBe(false);

    preferences.logWrap.value = true;
    await nextTick();
    expect(storage.getItem('githq.logWrap')).toBe('true');

    session.fromAnotherTab({ 'githq.logTimes': 'true' });
    expect(preferences.logTimes.value).toBe(true);
});
