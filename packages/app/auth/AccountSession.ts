import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef, watch } from 'vue';

import { GitHubSdkFactory } from '@/services/GitHubSdkFactory.js';

import { AuthStore } from './AuthStore.js';

/** A signed-in user as the work done for them holds it: who, with which token, and the SDK sending that token. */
export interface Account {
    readonly login: string;
    readonly token: string;
    /** Sends this account's token, whatever the auth store holds by the time a request goes. */
    readonly sdk: GitHubSdk;
}

/**
 * The account signed in now, for the stores and queues that work for it (D17): each keeps what it does for the
 * account it started for, drops it when another signs in or none ({@link onChange}), and keeps an answer only
 * while the account that asked is still the one signed in ({@link isCurrent}). Another login or token is another
 * account — here or in another tab.
 */
export type AccountSession = Resolved<typeof AccountSession>;
export const AccountSession = defineService({
    name: 'AccountSession',
    deps: {
        auth: AuthStore,
        createSdk: GitHubSdkFactory,
    },
    setup({ auth, createSdk }) {
        const accountRef = shallowRef<Account | null>(null);

        watch(
            () => [auth.viewer?.login ?? null, auth.token] as const,
            ([login, token]) => follow(login, token),
            { immediate: true, flush: 'sync' },
        );

        return {
            /** The account signed in now, or `null`; reactive. */
            get current() {
                return accountRef.value;
            },
            isCurrent,
            onChange,
        };

        /** Whether `account` is still the one signed in — what it asked for may be kept. */
        function isCurrent(account: Account) {
            return accountRef.value === account;
        }

        /** Calls `listener` with the account signed in now, then — synchronously — each time another or none is. */
        function onChange(listener: (account: Account | null) => void) {
            watch(accountRef, listener, { immediate: true, flush: 'sync' });
        }

        function follow(login: string | null, token: string | null) {
            const current = accountRef.value;
            if (current?.login === login && current.token === token) {
                return;
            }

            accountRef.value = login !== null && token !== null ? { login, token, sdk: createSdk(() => token) } : null;
        }
    },
});
