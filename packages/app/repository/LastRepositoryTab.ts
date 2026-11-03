import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';
import { getRepositoryPath } from '@/tracking/trackingRoutes.js';

import { REPOSITORY_SECTIONS } from './RepositorySection.js';
import type { RepositorySection } from './RepositorySection.js';

/** Where the tabs are kept, per user: `githq.repositoryTabs.<login>`. */
const KEY_PREFIX = 'githq.repositoryTabs.';

/**
 * The section each repository was last on, so coming back opens the same one (D5). It describes what the user is
 * looking at, so it stays on this device and never goes into the saved settings; forgotten when they sign out. The
 * links to a repository carry it ({@link LastRepositoryTab.getPath}), so its page opens on that section at once, with
 * no redirect; a section another tab of the browser chose shows here too.
 */
export type LastRepositoryTab = Resolved<typeof LastRepositoryTab>;
export const LastRepositoryTab = defineService({
    name: 'LastRepositoryTab',
    deps: {
        accounts: AccountSession,
        browser: Browser,
    },
    setup({ accounts, browser }) {
        const tabsRef = shallowRef<Readonly<Record<string, RepositorySection>>>({});
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

        return { get, getPath, getShown, remember };

        /** The repository's last section, `null` when it has none; reactive. */
        function get(nameWithOwner: string): RepositorySection | null {
            return tabsRef.value[nameWithOwner] ?? null;
        }

        /**
         * The section the repository's view shows at an address naming `addressSection`: that one, else — at the
         * repository's own address — the one it was last on, Issues the first time; reactive.
         */
        function getShown(nameWithOwner: string, addressSection: RepositorySection | null): RepositorySection {
            return addressSection ?? get(nameWithOwner) ?? 'issues';
        }

        /** The address of the repository's view on the section it was last on, Issues before it has one; reactive. */
        function getPath(nameWithOwner: string) {
            return getRepositoryPath(nameWithOwner, getShown(nameWithOwner, null));
        }

        function remember(nameWithOwner: string, section: RepositorySection) {
            const next = { ...(slot.read() ?? tabsRef.value), [nameWithOwner]: section };
            tabsRef.value = next;
            slot.save(next);
        }

        function read(stored: unknown) {
            const tabs: Record<string, RepositorySection> = {};
            if (isPlainObject(stored)) {
                for (const [nameWithOwner, section] of Object.entries(stored)) {
                    const known = REPOSITORY_SECTIONS.find(candidate => candidate === section);
                    if (known) {
                        tabs[nameWithOwner] = known;
                    }
                }
            }

            return tabs;
        }
    },
});
