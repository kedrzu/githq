import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';
import { getRepositoryPath } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { REPOSITORY_TABS } from './buildRepositoryList.js';
import type { RepositoryTab } from './buildRepositoryList.js';

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
        tracking: TrackingStore,
    },
    setup({ accounts, browser, tracking }) {
        const tabsRef = shallowRef<Readonly<Record<string, RepositoryTab>>>({});
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

        /**
         * The repository's last tab, `null` when it has none, or when that was its Workflows tab and it is no longer
         * tracked, which has none (actions D4); reactive.
         */
        function get(nameWithOwner: string): RepositoryTab | null {
            const tab = tabsRef.value[nameWithOwner] ?? null;
            return tab === 'workflows' && !tracking.isTracked({ kind: 'repository', nameWithOwner }) ? null : tab;
        }

        /** The address of the repository's view on the tab it was last on (`/owner/name/issues`); reactive. */
        function getPath(nameWithOwner: string) {
            return getRepositoryPath(nameWithOwner, get(nameWithOwner) ?? 'all');
        }

        function remember(nameWithOwner: string, kind: RepositoryTab) {
            const next = { ...(slot.read() ?? tabsRef.value), [nameWithOwner]: kind };
            tabsRef.value = next;
            slot.save(next);
        }

        function read(stored: unknown) {
            const tabs: Record<string, RepositoryTab> = {};
            if (isPlainObject(stored)) {
                for (const [nameWithOwner, kind] of Object.entries(stored)) {
                    const known = REPOSITORY_TABS.find(candidate => candidate === kind);
                    if (known) {
                        tabs[nameWithOwner] = known;
                    }
                }
            }

            return tabs;
        }
    },
});
