import { hasOAuthScopes } from '@githq/github/oauth.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';

import type { DeviceCode, DeviceGrant } from './NativeBridge.js';
import { NativeBridge } from './NativeBridge.js';

/**
 * Why a device sign-in did not end signed in: GitHub's reasons (`expired`, `denied`, `offline`, `failed`), and
 * `missingScopes` — GitHub granted less than githq asks for, so the token was refused.
 */
export type DeviceSignInFailure = 'expired' | 'denied' | 'offline' | 'failed' | 'missingScopes';

/**
 * Where the device sign-in is: `idle` — nothing started (S1); `requesting` — asking GitHub for a code; `waiting` —
 * the code is shown and githq waits for the user to approve it on GitHub, then for GitHub to say whose the token is
 * (S2); `failed` — the attempt ended without signing in, and a new code is the way on (S3). Signed in, the session
 * moves the app on from the sign-in screen.
 */
export type DeviceSignInState =
    | { readonly kind: 'idle' }
    | { readonly kind: 'requesting' }
    | { readonly kind: 'waiting'; readonly code: DeviceCode }
    | { readonly kind: 'failed'; readonly failure: DeviceSignInFailure };

/** The desktop app's sign-in with GitHub's device flow, over the native commands `device_start` and `device_finish`. */
export interface DeviceSignInShape {
    /** Reactive. */
    readonly state: DeviceSignInState;
    /**
     * Asks GitHub for a new code, abandoning any attempt under way; resolves once the code is shown or the request
     * failed. The rest — waiting for the user, checking the token, signing in — goes on behind it.
     */
    start(): Promise<void>;
    /**
     * Abandons the attempt under way and goes back to `idle`: whatever it still answers — a token too — is dropped.
     * The native side keeps polling GitHub until the code expires or the next {@link start} supersedes it.
     */
    cancel(): void;
}

/**
 * The desktop app's sign-in (S1–S4): one attempt at a time, each a code from GitHub and a wait for the user to
 * approve it there. A token is accepted only from the attempt still current, only with every scope githq asks for
 * (`hasOAuthScopes`), and is kept through `AuthStore.signInWithToken` once GitHub has said whose it is.
 */
export type DeviceSignIn = Resolved<typeof DeviceSignIn>;
export const DeviceSignIn = defineService({
    name: 'DeviceSignIn',
    deps: {
        auth: AuthStore,
        bridge: NativeBridge,
    },
    setup({ auth, bridge }): DeviceSignInShape {
        const stateRef = shallowRef<DeviceSignInState>({ kind: 'idle' });
        // Aborted when the attempt is abandoned — started again or cancelled — so nothing it answers later counts.
        let attempt = new AbortController();

        return {
            get state() {
                return stateRef.value;
            },
            start,
            cancel,
        };

        async function start() {
            const signal = abandon();
            stateRef.value = { kind: 'requesting' };

            let code: DeviceCode;
            try {
                code = await bridge.startDeviceSignIn();
            } catch (error) {
                settle(signal, readFailure(error));
                return;
            }

            if (signal.aborted) {
                return;
            }

            stateRef.value = { kind: 'waiting', code };
            void finish(signal);
        }

        function cancel() {
            abandon();
            stateRef.value = { kind: 'idle' };
        }

        async function finish(signal: AbortSignal) {
            let grant: DeviceGrant;
            try {
                grant = await bridge.finishDeviceSignIn();
            } catch (error) {
                settle(signal, readFailure(error));
                return;
            }

            if (signal.aborted) {
                return;
            }

            if (!hasOAuthScopes(readScopes(grant.scope))) {
                settle(signal, 'missingScopes');
                return;
            }

            // Rejects only when abandoned while GitHub was saying whose the token is: then nothing was kept.
            const result = await auth.signInWithToken(grant.token, signal).catch(() => null);
            if (!result?.ok) {
                settle(signal, 'failed');
            }
        }

        /** Ends the attempt with `failure`, unless it was abandoned meanwhile. */
        function settle(signal: AbortSignal, failure: DeviceSignInFailure) {
            if (!signal.aborted) {
                stateRef.value = { kind: 'failed', failure };
            }
        }

        /** Abandons the current attempt; the signal of the next one. */
        function abandon() {
            attempt.abort();
            attempt = new AbortController();
            return attempt.signal;
        }
    },
});

/**
 * The failure a native command rejected with. `superseded` answers an attempt githq itself replaced, which is
 * abandoned by then and not heard; should the current one hear it, it is `failed`, so a new code is offered rather
 * than a wait that never ends.
 */
function readFailure(error: unknown): DeviceSignInFailure {
    switch (error) {
        case 'expired':
        case 'denied':
        case 'offline':
            return error;
        default:
            return 'failed';
    }
}

/** GitHub's granted scopes, comma-separated (`repo,project,read:org`), as a list. */
function readScopes(scope: string): string[] {
    return scope
        .split(',')
        .map(part => part.trim())
        .filter(part => part !== '');
}
