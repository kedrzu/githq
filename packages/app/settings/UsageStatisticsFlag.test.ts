/// <reference types="bun" />

import 'fake-indexeddb/auto';

import { expect, test } from 'bun:test';
import { nextTick } from 'vue';

import { USAGE_STATISTICS_OFF_KEY, USAGE_STATISTICS_OFF_VALUE } from '@githq/github/usageStatistics.js';

import type { SettingsDocument } from '@/settings/sync/SettingsDocument.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { UsageStatisticsFlag } from './UsageStatisticsFlag.js';

test('the flag follows the setting only once the account’s settings are loaded, and stays after signing out', async () => {
    // A flag an earlier session set; this account's setting is on (the default), which only its loaded settings say.
    const login = uniqueLogin();
    const session = createTestSession({
        login,
        answer: () => undefined,
        localStorage: new Map([[USAGE_STATISTICS_OFF_KEY, USAGE_STATISTICS_OFF_VALUE]]),
    });
    setIndexedDbPersistence(session.container);
    session.container.resolve(ItemStore);
    session.container.resolve(UsageStatisticsFlag);
    const tracking = session.container.resolve(TrackingStore);
    const flag = () => session.localStorage.get(USAGE_STATISTICS_OFF_KEY);

    // Not loaded yet: the default reading as on clears nothing.
    expect(tracking.loaded).toBe(false);
    await nextTick();
    expect(flag()).toBe(USAGE_STATISTICS_OFF_VALUE);

    await tracking.ready();
    await nextTick();
    expect(flag()).toBeUndefined();

    tracking.setUsageStatistics(false);
    await nextTick();
    expect(flag()).toBe(USAGE_STATISTICS_OFF_VALUE);

    session.signOutFromAnotherTab();
    await nextTick();
    expect(tracking.loaded).toBe(false);
    expect(flag()).toBe(USAGE_STATISTICS_OFF_VALUE);
});

test('an account whose kept settings have statistics off sets the flag when they load', async () => {
    const login = uniqueLogin();
    const document: SettingsDocument = { version: 1, repositories: [], projects: [], usageStatistics: false };
    const session = createTestSession({
        login,
        answer: () => undefined,
        localStorage: new Map([
            [`githq.settings.${login}`, JSON.stringify({ chosen: true, document, saving: { state: 'off' } })],
        ]),
    });
    setIndexedDbPersistence(session.container);
    session.container.resolve(ItemStore);
    session.container.resolve(UsageStatisticsFlag);
    const tracking = session.container.resolve(TrackingStore);

    await tracking.ready();
    await nextTick();
    expect(session.localStorage.get(USAGE_STATISTICS_OFF_KEY)).toBe(USAGE_STATISTICS_OFF_VALUE);
});
