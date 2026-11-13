import { USAGE_STATISTICS_OFF_KEY, USAGE_STATISTICS_OFF_VALUE } from '@githq/github/usageStatistics.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { watch } from 'vue';

import { Browser } from '@/services/Browser.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

/**
 * Keeps the device's opt-out flag in `localStorage` and the account's usage statistics setting in agreement. The OAuth
 * requests, the landing page and the docs read the flag without knowing the account.
 *
 * Only once the account's settings are loaded: before that the setting reads as its default (on), which would clear a
 * flag set earlier. Then an account that chose (the key is in its settings) decides the flag. An account that never
 * chose takes the flag's off instead: settings that are not saved to GitHub are gone after signing out, and a user who
 * turned statistics off must not find them back on after signing in again. Signed out, the flag stays as the last
 * account left it.
 */
export const UsageStatisticsFlag = defineService({
    name: 'UsageStatisticsFlag',
    deps: { tracking: TrackingStore, browser: Browser },
    setup({ tracking, browser }) {
        watch(
            () =>
                tracking.loaded
                    ? { chosen: 'usageStatistics' in tracking.document, on: tracking.usageStatistics }
                    : null,
            choice => {
                if (choice === null) {
                    return;
                }

                const flagOff = browser.localStorage.getItem(USAGE_STATISTICS_OFF_KEY) === USAGE_STATISTICS_OFF_VALUE;
                if (!choice.chosen && flagOff) {
                    tracking.setUsageStatistics(false);
                } else if (choice.on) {
                    browser.localStorage.removeItem(USAGE_STATISTICS_OFF_KEY);
                } else {
                    browser.localStorage.setItem(USAGE_STATISTICS_OFF_KEY, USAGE_STATISTICS_OFF_VALUE);
                }
            },
            { immediate: true },
        );
    },
});
