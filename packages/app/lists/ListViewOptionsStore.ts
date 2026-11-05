import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';

/** Where the options are kept, per user: `githq.listViews.<login>`. */
const KEY_PREFIX = 'githq.listViews.';

/**
 * What the signed-in user changed of each list's view options (D9, D13), by list (`myWork`,
 * `repository:acme/api`, a project view's id) — as kept, read by `useListViewOptions`. Kept in this browser per
 * user, since the lists name their repositories and projects, and forgotten when they sign out.
 *
 * The user's tabs share it: a change is written over what is kept now — another tab's changes of other lists
 * stay — and a change another tab writes shows here.
 */
export type ListViewOptionsStore = Resolved<typeof ListViewOptionsStore>;
export const ListViewOptionsStore = defineService({
    name: 'ListViewOptionsStore',
    deps: {
        accounts: AccountSession,
        browser: Browser,
    },
    setup({ accounts, browser }) {
        const keptRef = shallowRef<Readonly<Record<string, unknown>>>({});
        const slot = createAccountSlot({
            accounts,
            browser,
            keyPrefix: KEY_PREFIX,
            parse: stored => (isPlainObject(stored) ? stored : {}),
            follow: kept => {
                keptRef.value = kept ?? {};
            },
        });
        browser.onLocalStorageChange(key => {
            if (key === null || key.startsWith(KEY_PREFIX)) {
                keptRef.value = slot.read() ?? {};
            }
        });

        return {
            /** What is kept of `list`'s options, unchecked, or `undefined`; reactive. */
            get(list: string): unknown {
                return keptRef.value[list];
            },
            /** Whether anything of `list`'s options is kept; reactive. */
            has(list: string) {
                return list in keptRef.value;
            },
            /** Keeps `value` as `list`'s options, or — `null` — nothing of them. */
            set(list: string, value: unknown) {
                const others = Object.entries(slot.read() ?? keptRef.value).filter(([key]) => key !== list);
                const next = Object.fromEntries(value === null ? others : [...others, [list, value]]);
                keptRef.value = next;
                slot.save(next);
            },
        };
    },
});
