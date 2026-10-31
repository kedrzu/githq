/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { nextTick } from 'vue';

import { ItemNavigation } from '@/item/ItemNavigation.js';
import { createTestSession } from '@/testing/createTestSession.js';

import { Browser } from './Browser.js';
import { LocalPreferences } from './LocalPreferences.js';

test('what an earlier githq kept in this browser is read back under the same keys', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    storage.setItem('githq.itemArrangement', 'modal');
    storage.setItem('githq.sidebarCollapsed', 'true');
    storage.setItem('githq.panelWidth.itemPanel', '412');

    const preferences = session.container.resolve(LocalPreferences);

    expect(preferences.itemArrangement.value).toBe('modal');
    expect(session.container.resolve(ItemNavigation).arrangement).toBe('modal');
    expect(preferences.sidebarCollapsed.value).toBe(true);
    expect(preferences.getPanelWidth('itemPanel').value).toBe(412);
});

test('with nothing kept, or something that is not a valid value, the defaults are used', () => {
    const empty = createTestSession({ login: 'octocat', answer: () => undefined }).container.resolve(LocalPreferences);
    expect(empty.itemArrangement.value).toBe('panel');
    expect(empty.sidebarCollapsed.value).toBe(false);
    expect(empty.getPanelWidth('sidebar').value).toBeNull();

    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    storage.setItem('githq.itemArrangement', '"modal"');
    storage.setItem('githq.sidebarCollapsed', 'yes');
    storage.setItem('githq.panelWidth.sidebar', 'wide');

    const invalid = session.container.resolve(LocalPreferences);
    expect(invalid.itemArrangement.value).toBe('panel');
    expect(invalid.sidebarCollapsed.value).toBe(false);
    expect(invalid.getPanelWidth('sidebar').value).toBeNull();
});

test('a change is kept under the same keys, as the plain strings githq always kept', async () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const storage = session.container.resolve(Browser).localStorage;
    const preferences = session.container.resolve(LocalPreferences);

    session.container.resolve(ItemNavigation).setArrangement('page');
    preferences.sidebarCollapsed.value = true;
    preferences.getPanelWidth('itemSide.modal').value = 300;
    await nextTick();

    expect(preferences.itemArrangement.value).toBe('page');
    expect(storage.getItem('githq.itemArrangement')).toBe('page');
    expect(storage.getItem('githq.sidebarCollapsed')).toBe('true');
    expect(storage.getItem('githq.panelWidth.itemSide.modal')).toBe('300');
    // One panel is one ref, whoever asks for it.
    expect(preferences.getPanelWidth('itemSide.modal')).toBe(preferences.getPanelWidth('itemSide.modal'));
});

test('what another tab changes reaches this one, a cleared storage bringing back the defaults', () => {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const preferences = session.container.resolve(LocalPreferences);
    const navigation = session.container.resolve(ItemNavigation);
    const width = preferences.getPanelWidth('sidebar');

    session.fromAnotherTab({
        'githq.itemArrangement': 'modal',
        'githq.sidebarCollapsed': 'true',
        'githq.panelWidth.sidebar': '300',
    });
    expect(navigation.arrangement).toBe('modal');
    expect(preferences.sidebarCollapsed.value).toBe(true);
    expect(width.value).toBe(300);

    session.fromAnotherTab({ 'githq.panelWidth.sidebar': null });
    expect(width.value).toBeNull();
    expect(navigation.arrangement).toBe('modal');

    session.fromAnotherTab({ 'githq.panelWidth.sidebar': '320' });
    session.clearFromAnotherTab();
    expect(navigation.arrangement).toBe('panel');
    expect(preferences.sidebarCollapsed.value).toBe(false);
    expect(width.value).toBeNull();
});
