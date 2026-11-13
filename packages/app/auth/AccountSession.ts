import type { GitHubSdk } from '@githq/github/createGitHubRequester.js';
import type { GitHubRestRequester } from '@githq/github/rest/createGitHubRestRequester.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef, watch } from 'vue';

import { GitHubRestFactory } from '@/services/GitHubRestFactory.js';
import { GitHubSdkFactory } from '@/services/GitHubSdkFactory.js';

import { AuthStore } from './AuthStore.js';

/**
 * A signed-in user as the work done for them holds it: who, and the GraphQL SDK and REST requester sending their
 * token. The account outlives its access token: GitHub's expires every 8 hours and the one refreshed is the same
 * account's.
 */
export interface Account {
    readonly login: string;
    /**
     * The token to send a request with, asked for when it goes: the auth store's fresh one while this account is
     * signed in, the last one it had once it is not — what goes then is answered for nobody ({@link isCurrent}).
     */
    readonly getToken: () => Promise<string>;
    /** Sends this account's token as {@link getToken} gives it. */
    readonly sdk: GitHubSdk;
    /** The REST twin of {@link sdk}, for what GraphQL cannot do (a merge). */
    readonly rest: GitHubRestRequester;
}

/**
 * The account signed in now, for the stores and queues that work for it (D17): each keeps what it does for the
 * account it started for, drops it when another signs in or none ({@link onChange}), and keeps an answer only
 * while the account that asked is still the one signed in ({@link isCurrent}). Another login is another account —
 * here or in another tab — and so is the same one signed in again; a new token for the login signed in is not.
 */
export type AccountSession = Resolved<typeof AccountSession>;
export const AccountSession = defineService({
    name: 'AccountSession',
    deps: {
        auth: AuthStore,
        createSdk: GitHubSdkFactory,
        createRest: GitHubRestFactory,
    },
    setup({ auth, createSdk, createRest }) {
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
            if (login === null || token === null) {
                accountRef.value = null;
            } else if (accountRef.value?.login !== login) {
                accountRef.value = createAccount(login, token);
            }
        }

        function createAccount(login: string, token: string): Account {
            let lastToken = token;
            const account: Account = { login, getToken, sdk: createSdk(getToken), rest: createRest(getToken) };
            return account;

            async function getToken() {
                if (isCurrent(account)) {
                    const fresh = await auth.getFreshToken();
                    // Signed out or in as another while it was fetched: that token is not this account's.
                    if (isCurrent(account)) {
                        lastToken = fresh;
                    }
                }

                return lastToken;
            }
        }
    },
});
