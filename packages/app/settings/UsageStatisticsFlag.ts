import { USAGE_STATISTICS_OFF_KEY, USAGE_STATISTICS_OFF_VALUE } from '@githq/github/usageStatistics.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { watch } from 'vue';

import { Browser } from '@/services/Browser.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

/**
 * Mirrors the account's usage statistics setting into the device's opt-out flag in `localStorage`, which the OAuth
 * requests, the landing page and the docs read without knowing the account. Only once the account's settings are
 * loaded: before that the setting reads as its default (on), which would clear a flag set earlier. Signed out, the
 * flag stays as the last account left it.
 */
export const UsageStatisticsFlag = defineService({
    name: 'UsageStatisticsFlag',
    deps: { tracking: TrackingStore, browser: Browser },
    setup({ tracking, browser }) {
        watch(
            () => (tracking.loaded ? tracking.usageStatistics : null),
            on => {
                if (on === null) {
                    return;
                }

                if (on) {
                    browser.localStorage.removeItem(USAGE_STATISTICS_OFF_KEY);
                } else {
                    browser.localStorage.setItem(USAGE_STATISTICS_OFF_KEY, USAGE_STATISTICS_OFF_VALUE);
                }
            },
            { immediate: true },
        );
    },
});
