import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';

/**
 * A place or an item the user opened: a tracked project or repository by its place's id in the command menu
 * (`project:<id>`, `repository:owner/name`), an issue or pull request by its id in the local copy.
 */
export interface RecentVisit {
    readonly kind: 'place' | 'item';
    readonly id: string;
}

/** Where the visits are kept, per user: `githq.recent.<login>`. */
const KEY_PREFIX = 'githq.recent.';

/** How many visits are kept; the menu lists fewer, as some may be gone or be the screen shown. */
const KEPT_LIMIT = 10;

/**
 * The places and items the signed-in user opened lately, newest first, each once — what the empty command menu lists
 * under "Recent". Kept in this browser per user, since they name the account's repositories, projects and items, and
 * forgotten when they sign out; a rebuildable cache, so whatever is kept and not understood is dropped.
 *
 * The user's tabs share it: a visit is put over what is kept now, and a visit another tab keeps shows here.
 */
export type RecentVisitsStore = Resolved<typeof RecentVisitsStore>;
export const RecentVisitsStore = defineService({
    name: 'RecentVisitsStore',
    deps: {
        accounts: AccountSession,
        browser: Browser,
    },
    setup({ accounts, browser }) {
        const keptRef = shallowRef<readonly RecentVisit[]>([]);
        const slot = createAccountSlot({
            accounts,
            browser,
            keyPrefix: KEY_PREFIX,
            parse: parseVisits,
            follow: kept => {
                keptRef.value = kept ?? [];
            },
        });
        browser.onLocalStorageChange(key => {
            if (key === null || key.startsWith(KEY_PREFIX)) {
                keptRef.value = slot.read() ?? [];
            }
        });

        return {
            /** Newest first; reactive. */
            get visits() {
                return keptRef.value;
            },
            /** Puts `visit` first: one already kept moves there. */
            record(visit: RecentVisit) {
                const others = (slot.read() ?? keptRef.value).filter(
                    kept => kept.kind !== visit.kind || kept.id !== visit.id,
                );
                const next = [{ kind: visit.kind, id: visit.id }, ...others].slice(0, KEPT_LIMIT);
                keptRef.value = next;
                slot.save(next);
            },
        };
    },
});

function parseVisits(stored: unknown): RecentVisit[] {
    if (!Array.isArray(stored)) {
        return [];
    }

    const entries: readonly unknown[] = stored;
    const visits: RecentVisit[] = [];
    for (const entry of entries) {
        if (!isPlainObject(entry)) {
            continue;
        }

        const { kind, id } = entry;
        if ((kind === 'place' || kind === 'item') && typeof id === 'string') {
            if (!visits.some(visit => visit.kind === kind && visit.id === id)) {
                visits.push({ kind, id });
            }
        }
    }

    return visits.slice(0, KEPT_LIMIT);
}
