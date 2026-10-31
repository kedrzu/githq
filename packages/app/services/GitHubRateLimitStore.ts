import type { GitHubRateLimit } from '@githq/github/GitHubRateLimit.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { Clock } from './Clock.js';

/**
 * GitHub's allowance per bucket (`graphql`, `search`, `core`, …) as the last answer drawing on it reported it
 * (`x-ratelimit-*`): for the status bar, and for the sync loops to stop asking while a bucket is used up.
 *
 * The allowance is the account's, whichever tab spends it: the sync engine sends what this tab learns
 * ({@link onUpdate}) to the others, and takes theirs in ({@link merge}).
 */
export type GitHubRateLimitStore = Resolved<typeof GitHubRateLimitStore>;
export const GitHubRateLimitStore = defineService({
    name: 'GitHubRateLimitStore',
    deps: {
        clock: Clock,
    },
    setup({ clock }) {
        const bucketsRef = shallowRef<ReadonlyMap<string, GitHubRateLimit>>(new Map());
        const listeners: ((rateLimit: GitHubRateLimit) => void)[] = [];

        return {
            /** The latest allowance of the bucket `resource`, or `null` before an answer drew on it; reactive. */
            get(resource: string) {
                return bucketsRef.value.get(resource) ?? null;
            },
            /**
             * What is left of the bucket `resource` now; `null` when unknown — no answer drew on it yet, or its
             * window has reset since.
             */
            remaining(resource: string) {
                const limit = bucketsRef.value.get(resource);
                return limit && limit.resetAt.getTime() > clock.now() ? limit.remaining : null;
            },
            /** Every bucket an answer drew on, as last reported. */
            all(): readonly GitHubRateLimit[] {
                return [...bucketsRef.value.values()];
            },
            /** Takes the allowance of a new answer (`onRateLimit` of the requesters). */
            update(rateLimit: GitHubRateLimit) {
                bucketsRef.value = new Map(bucketsRef.value).set(rateLimit.resource, rateLimit);
                for (const listener of listeners) {
                    listener(rateLimit);
                }
            },
            /**
             * Takes an allowance another tab learned, as the latest — unless its window has reset since. Not compared
             * with the one known here: GitHub's answers disagree by a few points and seconds of the reset from one
             * request to the next, so neither says which is newer.
             */
            merge(rateLimit: GitHubRateLimit) {
                if (rateLimit.resetAt.getTime() > clock.now()) {
                    bucketsRef.value = new Map(bucketsRef.value).set(rateLimit.resource, rateLimit);
                }
            },
            /** Calls `listener` with each allowance an answer in this tab reports. */
            onUpdate(listener: (rateLimit: GitHubRateLimit) => void) {
                listeners.push(listener);
            },
        };
    },
});
