import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { ItemStore } from '@/store/ItemStore.js';
import { pause } from '@/utils/pause.js';

import { formatItemReference, getItemReference } from './itemRoutes.js';
import type { ItemReference } from './itemRoutes.js';

/** The waits before asking GitHub again after no answer: about half a minute in all, then the address reads as failed. */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16_000];

/**
 * Finds the node id of an item an address names by repository and number (`itemRoutes.ts`): in the local copy
 * when it holds the item — at once, without asking GitHub — else through `ItemByNumber`, remembered for the
 * session. An id found in the copy is remembered too: an item's id never changes, and its row can leave the copy
 * while the item is open (it left "my work"). Follows the signed-in user: what was found for one is forgotten when
 * they sign out.
 */
export type ItemResolver = Resolved<typeof ItemResolver>;
export const ItemResolver = defineService({
    name: 'ItemResolver',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, clock, logger }) {
        /** What GitHub said, by `owner/name/number` in lower case: the id, or `null` for no such item. */
        const foundRef = shallowRef<ReadonlyMap<string, string | null>>(new Map());
        /** The ids seen in the local copy, by the same key. Plain: {@link peek} fills it while it reads the copy. */
        const seenInCopy = new Map<string, string>();
        /** The keys GitHub could not be asked about, for now: {@link resolve} tries again. */
        const failedRef = shallowRef<ReadonlySet<string>>(new Set());
        const inFlight = new Map<string, Promise<void>>();

        accounts.onChange(() => {
            foundRef.value = new Map();
            seenInCopy.clear();
            failedRef.value = new Set();
            inFlight.clear();
        });

        return {
            peek,
            hasFailed,
            resolve,
        };

        /**
         * The item's id: `null` when GitHub says there is no such item (or the user may not see it), `undefined`
         * while it is not known — {@link resolve} asks; reactive.
         */
        function peek(reference: ItemReference): string | null | undefined {
            const key = toKey(reference);
            for (const item of items.all) {
                if (item.number === reference.number && toKey(getItemReference(item)) === key) {
                    seenInCopy.set(key, item.id);
                    return item.id;
                }
            }

            return seenInCopy.get(key) ?? foundRef.value.get(key);
        }

        /** Whether asking GitHub for the item's id gave up; reactive. */
        function hasFailed(reference: ItemReference) {
            return failedRef.value.has(toKey(reference));
        }

        /**
         * Asks GitHub for the item's id unless {@link peek} knows it, again and again while no answer comes. Never
         * rejects; a failure leaves it unknown, and {@link hasFailed} says so until it is asked for again.
         */
        function resolve(reference: ItemReference): Promise<void> {
            const key = toKey(reference);
            if (peek(reference) !== undefined) {
                return Promise.resolve();
            }

            let running = inFlight.get(key);
            if (!running) {
                if (failedRef.value.has(key)) {
                    failedRef.value = new Set([...failedRef.value].filter(other => other !== key));
                }

                running = ask(key, reference).finally(() => inFlight.delete(key));
                inFlight.set(key, running);
            }

            return running;
        }

        async function ask(key: string, reference: ItemReference) {
            const account = accounts.current;
            if (!account) {
                return;
            }

            for (const delay of [...RETRY_DELAYS_MS, null]) {
                try {
                    const { repository } = await account.sdk.ItemByNumber(
                        { owner: reference.owner, name: reference.name, number: reference.number },
                        // A repository or item that does not exist comes as `null` with a NOT_FOUND entry.
                        { onPartialErrors: () => undefined },
                    );
                    if (accounts.isCurrent(account)) {
                        foundRef.value = new Map([
                            ...foundRef.value,
                            [key, repository?.issueOrPullRequest?.id ?? null],
                        ]);
                    }

                    return;
                } catch (error) {
                    if (delay === null || !isWorthAskingAgain(error)) {
                        logger.warn('Could not find the item an address names', { reference: key, error });
                        if (accounts.isCurrent(account)) {
                            failedRef.value = new Set([...failedRef.value, key]);
                        }

                        return;
                    }
                }

                await pause(clock, delay);
                if (!accounts.isCurrent(account) || peek(reference) !== undefined) {
                    return;
                }
            }
        }
    },
});

/**
 * No answer, or GitHub failing on its side, may pass; what GitHub refused — a rate limit above all — it would refuse
 * again, and asking again only spends the allowance.
 */
function isWorthAskingAgain(error: unknown) {
    return !(error instanceof GitHubApiError) || error.status >= 500;
}

function toKey(reference: ItemReference) {
    return formatItemReference(reference).toLowerCase();
}
