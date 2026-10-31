import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Browser } from '@/services/Browser.js';

/** This tab's bid for the lock of one account. */
interface Claim {
    readonly account: Account;
    /** Gives the lock up, or withdraws the request still waiting for it. */
    release: () => void;
}

/**
 * Which of the app's tabs asks GitHub for changes (Q10): the one holding the Web Lock `githq-sync-<login>`, so
 * that several tabs do not use the API allowance up several times as fast. The other tabs wait for the lock in
 * line and take in the syncing tab's changes (`TabChannel`); when it closes — or the browser freezes it, and it
 * gives the lock up — the next one in line takes over, from the local copy they share.
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
        logger: Logger,
    },
    setup({ accounts, browser, logger }) {
        const leaderRef = shallowRef(false);
        let account: Account | null = null;
        let claim: Claim | null = null;
        let frozen = false;

        accounts.onChange(follow);
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
            if (!current || frozen || claim) {
                return;
            }

            const name = `githq-sync-${current.login}`;
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
