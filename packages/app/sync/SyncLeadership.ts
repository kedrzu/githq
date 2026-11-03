import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Browser } from '@/services/Browser.js';
import { LOCAL_DATABASE_VERSION } from '@/store/IndexedDbPersistence.js';
import { LocalCopyVersion } from '@/store/LocalCopyVersion.js';

/** This tab's bid for the lock of one account. */
interface Claim {
    readonly account: Account;
    /** Gives the lock up, or withdraws the request still waiting for it. */
    release: () => void;
}

/**
 * Which of the app's tabs asks GitHub for changes (Q10): the one holding the Web Lock `githq-sync-<login>-v<N>`, so
 * that several tabs do not use the API allowance up several times as fast. The other tabs wait for the lock in
 * line and take in the syncing tab's changes (`TabChannel`); when it closes — or the browser freezes it, and it
 * gives the lock up — the next one in line takes over, from the local copy they share.
 *
 * `N` is the local copy's layout ({@link LOCAL_DATABASE_VERSION}), as in the channel's name: a tab of another layout
 * shares neither the copy nor the channel with this one, so waiting for it would leave this tab with nothing, for as
 * long as that tab stays open. A tab told of a newer layout gives the lock up and does not ask for it again: it can no
 * longer keep what it would read (`OutdatedTabReload` brings it up to date).
 *
 * It follows the signed-in account: another one (or none) gives the lock of the one before up. Without Web Locks
 * (an old browser) every tab syncs, as if alone.
 */
export type SyncLeadership = Resolved<typeof SyncLeadership>;
export const SyncLeadership = defineService({
    name: 'SyncLeadership',
    deps: {
        accounts: AccountSession,
        browser: Browser,
        localCopyVersion: LocalCopyVersion,
        logger: Logger,
    },
    setup({ accounts, browser, localCopyVersion, logger }) {
        const leaderRef = shallowRef(false);
        let account: Account | null = null;
        let claim: Claim | null = null;
        let frozen = false;
        let outdated = false;

        accounts.onChange(follow);
        localCopyVersion.onNewerVersion(() => {
            outdated = true;
            resign();
        });
        browser.onPageLifecycle(event => {
            switch (event) {
                case 'freeze':
                    // A frozen tab runs no timers: holding the lock, it would keep every tab from syncing.
                    frozen = true;
                    resign();
                    break;
                case 'resume':
                    frozen = false;
                    campaign();
                    break;
                case 'pagehide':
                    break;
            }
        });

        return {
            /** Whether this tab syncs the signed-in account; reactive. */
            get isLeader() {
                return leaderRef.value;
            },
        };

        function follow(next: Account | null) {
            resign();
            account = next;
            campaign();
        }

        function campaign() {
            const current = account;
            if (!current || frozen || outdated || claim) {
                return;
            }

            const name = `githq-sync-${current.login}-v${LOCAL_DATABASE_VERSION}`;
            const thisClaim: Claim = { account: current, release: () => {} };
            claim = thisClaim;
            const release = browser.requestLock(name, () => {
                if (claim === thisClaim) {
                    leaderRef.value = true;
                    logger.info('This tab syncs the account', { name });
                }
            });

            if (release === null) {
                logger.warn('No Web Locks in this browser: every tab syncs on its own', { name });
                leaderRef.value = true;
                return;
            }

            thisClaim.release = release;
        }

        function resign() {
            if (claim && leaderRef.value) {
                logger.info('This tab stops syncing the account', { login: claim.account.login });
            }

            claim?.release();
            claim = null;
            leaderRef.value = false;
        }
    },
});
