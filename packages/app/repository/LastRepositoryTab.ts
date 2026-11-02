import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';
import { getRepositoryPath } from '@/tracking/trackingRoutes.js';

import { REPOSITORY_KINDS } from './buildRepositoryList.js';
import type { RepositoryKind } from './buildRepositoryList.js';

/** Where the tabs are kept, per user: `githq.repositoryTabs.<login>`. */
const KEY_PREFIX = 'githq.repositoryTabs.';

/**
 * The tab each repository was last on, so coming back opens the same one (D5). It describes what the user is looking
 * at, so it stays on this device and never goes into the saved settings; forgotten when they sign out. The links to a
 * repository carry it ({@link LastRepositoryTab.getPath}), so its page opens on that tab at once; a tab another tab
 * of the browser chose shows here too.
 */
export type LastRepositoryTab = Resolved<typeof LastRepositoryTab>;
export const LastRepositoryTab = defineService({
    name: 'LastRepositoryTab',
    deps: {
        accounts: AccountSession,
        browser: Browser,
    },
    setup({ accounts, browser }) {
        const tabsRef = shallowRef<Readonly<Record<string, RepositoryKind>>>({});
        const slot = createAccountSlot({
            accounts,
            browser,
            keyPrefix: KEY_PREFIX,
            parse: read,
            follow: tabs => {
                tabsRef.value = tabs ?? {};
            },
        });
        browser.onLocalStorageChange(key => {
            if (key === null || key.startsWith(KEY_PREFIX)) {
                tabsRef.value = slot.read() ?? {};
            }
        });

        return { get, getPath, remember };

        /** The repository's last tab, `null` when it has none; reactive. */
        function get(nameWithOwner: string): RepositoryKind | null {
            return tabsRef.value[nameWithOwner] ?? null;
        }

        /** The address of the repository's view on the tab it was last on (`/owner/name/issues`); reactive. */
        function getPath(nameWithOwner: string) {
            return getRepositoryPath(nameWithOwner, get(nameWithOwner) ?? 'all');
        }

        function remember(nameWithOwner: string, kind: RepositoryKind) {
            const next = { ...(slot.read() ?? tabsRef.value), [nameWithOwner]: kind };
            tabsRef.value = next;
            slot.save(next);
        }

        function read(stored: unknown) {
            const tabs: Record<string, RepositoryKind> = {};
            if (isPlainObject(stored)) {
                for (const [nameWithOwner, kind] of Object.entries(stored)) {
                    const known = REPOSITORY_KINDS.find(candidate => candidate === kind);
                    if (known) {
                        tabs[nameWithOwner] = known;
                    }
                }
            }

            return tabs;
        }
    },
});
