import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { ItemStore } from '@/store/ItemStore.js';

import { formatItemReference, getItemReference } from './itemRoutes.js';
import type { ItemReference } from './itemRoutes.js';

/**
 * Finds the node id of an item an address names by repository and number (`itemRoutes.ts`): in the local copy
 * when it holds the item — at once, without asking GitHub — else through `ItemByNumber`, remembered for the
 * session. Follows the signed-in user: what was found for one is forgotten when they sign out.
 */
export type ItemResolver = Resolved<typeof ItemResolver>;
export const ItemResolver = defineService({
    name: 'ItemResolver',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        logger: Logger,
    },
    setup({ accounts, items, logger }) {
        /** What GitHub said, by `owner/name/number` in lower case: the id, or `null` for no such item. */
        const foundRef = shallowRef<ReadonlyMap<string, string | null>>(new Map());
        const inFlight = new Map<string, Promise<void>>();

        accounts.onChange(() => {
            foundRef.value = new Map();
            inFlight.clear();
        });

        return {
            peek,
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
                    return item.id;
                }
            }

            return foundRef.value.get(key);
        }

        /** Asks GitHub for the item's id unless {@link peek} knows it. Never rejects; a failure leaves it unknown. */
        function resolve(reference: ItemReference): Promise<void> {
            const key = toKey(reference);
            if (peek(reference) !== undefined) {
                return Promise.resolve();
            }

            let running = inFlight.get(key);
            if (!running) {
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

            try {
                const { repository } = await account.sdk.ItemByNumber(
                    { owner: reference.owner, name: reference.name, number: reference.number },
                    // A repository or item that does not exist comes as `null` with a NOT_FOUND entry.
                    { onPartialErrors: () => undefined },
                );
                if (!accounts.isCurrent(account)) {
                    return;
                }

                foundRef.value = new Map([...foundRef.value, [key, repository?.issueOrPullRequest?.id ?? null]]);
            } catch (error) {
                logger.warn('Could not find the item an address names', { reference: key, error });
            }
        }
    },
});

function toKey(reference: ItemReference) {
    return formatItemReference(reference).toLowerCase();
}
