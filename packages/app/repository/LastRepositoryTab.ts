import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';

import { REPOSITORY_KINDS } from './buildRepositoryList.js';
import type { RepositoryKind } from './buildRepositoryList.js';

/** Where the tabs are kept, per user: `githq.repositoryTabs.<login>`. */
const KEY_PREFIX = 'githq.repositoryTabs.';

/**
 * The tab each repository was last on, so coming back opens the same one (D5). It describes what the user is looking
 * at, so it stays on this device and never goes into the saved settings; forgotten when they sign out.
 */
export type LastRepositoryTab = Resolved<typeof LastRepositoryTab>;
export const LastRepositoryTab = defineService({
    name: 'LastRepositoryTab',
    deps: {
        accounts: AccountSession,
        browser: Browser,
    },
    setup({ accounts, browser }) {
        const slot = createAccountSlot({
            accounts,
            browser,
            keyPrefix: KEY_PREFIX,
            parse: read,
            follow: () => undefined,
        });

        return { get, remember };

        /** The repository's last tab, read again: another tab may have changed it; `null` when it has none. */
        function get(nameWithOwner: string): RepositoryKind | null {
            return slot.read()?.[nameWithOwner] ?? null;
        }

        function remember(nameWithOwner: string, kind: RepositoryKind) {
            slot.save({ ...slot.read(), [nameWithOwner]: kind });
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
