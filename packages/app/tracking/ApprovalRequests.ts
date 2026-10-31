import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import { createAccountSlot } from '@/auth/createAccountSlot.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';

/** Where the requests are kept, per user: `githq.approvalRequests.<login>`. */
const KEY_PREFIX = 'githq.approvalRequests.';

/**
 * When the signed-in user last opened GitHub's page to request an organisation's approval of githq (G5, G8) —
 * githq's own memory of the click, not GitHub's state, which it cannot read (D14). Kept in this browser per user,
 * and forgotten when they sign out.
 */
export type ApprovalRequests = Resolved<typeof ApprovalRequests>;
export const ApprovalRequests = defineService({
    name: 'ApprovalRequests',
    deps: {
        accounts: AccountSession,
        browser: Browser,
        clock: Clock,
    },
    setup({ accounts, browser, clock }) {
        const requestsRef = shallowRef<Readonly<Record<string, number>>>({});
        const slot = createAccountSlot({
            accounts,
            browser,
            keyPrefix: KEY_PREFIX,
            parse: read,
            follow: requests => {
                requestsRef.value = requests ?? {};
            },
        });

        return {
            /** When the user requested each organisation's approval (epoch ms), by its login; reactive. */
            get requests() {
                return requestsRef.value;
            },
            getRequestedAt,
            record,
        };

        /** When the user requested the organisation's approval (epoch ms), or `null`; reactive. */
        function getRequestedAt(organization: string) {
            return requestsRef.value[organization] ?? null;
        }

        /** Remembers that the user opened GitHub's page to request the organisation's approval now. */
        function record(organization: string) {
            if (accounts.current === null) {
                return;
            }

            requestsRef.value = { ...requestsRef.value, [organization]: clock.now() };
            slot.save(requestsRef.value);
        }

        function read(stored: unknown) {
            const requests: Record<string, number> = {};
            if (isPlainObject(stored)) {
                for (const [organization, at] of Object.entries(stored)) {
                    if (typeof at === 'number') {
                        requests[organization] = at;
                    }
                }
            }

            return requests;
        }
    },
});
