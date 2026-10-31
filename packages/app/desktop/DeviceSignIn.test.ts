/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { createPromise } from '@nzyme/utils/createPromise.js';
import type { PromiseWrapper } from '@nzyme/utils/createPromise.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import { AuthStore } from '@/auth/AuthStore.js';
import { TokenVault } from '@/auth/TokenVault.js';
import { createTestSession } from '@/testing/createTestSession.js';

import type { DeviceSignInState } from './DeviceSignIn.js';
import { DeviceSignIn } from './DeviceSignIn.js';
import type { DeviceCode, DeviceGrant, NativeBridgeShape } from './NativeBridge.js';
import { NativeBridge } from './NativeBridge.js';

const CODE: DeviceCode = { userCode: 'WDJB-MJHT', verificationUri: 'https://github.com/login/device', expiresIn: 900 };
const ALL_SCOPES = 'repo,project,read:org';

test('a token with every scope githq asks for signs in and is kept', async () => {
    const { signIn, auth, vault, native } = setup();

    await signIn.start();
    expect(signIn.state).toEqual({ kind: 'waiting', code: CODE });
    // `write:org` includes `read:org`.
    native.finishes[0]?.resolve({ token: 'gho_octocat', scope: 'repo, project, write:org' });

    await waitUntil(() => auth.signedIn, { intervalMs: 1, timeoutMs: 1000 });
    expect(auth.viewer?.login).toBe('octocat');
    expect(vault.read()).toBe('gho_octocat');
});

test('a token GitHub granted with fewer scopes than githq asks for is refused and never kept', async () => {
    const { signIn, auth, vault, native, operations } = setup();

    await signIn.start();
    native.finishes[0]?.resolve({ token: 'gho_octocat', scope: 'repo,read:org' });

    await waitUntil(() => signIn.state.kind !== 'waiting', { intervalMs: 1, timeoutMs: 1000 });
    const expected: DeviceSignInState = { kind: 'failed', failure: 'missingScopes' };
    expect(signIn.state).toEqual(expected);
    expect(auth.signedIn).toBe(false);
    expect(auth.token).toBeNull();
    expect(vault.read()).toBeNull();
    // Not even shown to GitHub.
    expect(operations()).toEqual([]);
});

test('every way an attempt fails ends in a failure that offers a new code, never in a wait', async () => {
    for (const error of ['expired', 'denied', 'offline', 'failed', 'superseded', new Error('IPC')] as const) {
        const { signIn, native } = setup();

        await signIn.start();
        native.finishes[0]?.reject(error);
        await waitUntil(() => signIn.state.kind === 'failed', { intervalMs: 1, timeoutMs: 1000 });
        expect(signIn.state).toEqual({
            kind: 'failed',
            failure: error === 'superseded' || error instanceof Error ? 'failed' : error,
        });

        // "Get a new code".
        await signIn.start();
        expect(signIn.state).toEqual({ kind: 'waiting', code: CODE });
    }
});

test('no code from GitHub, and no connection to ask it: the attempt fails at once', async () => {
    const { signIn, native } = setup();
    // As the native side rejects: with the bare code.
    const answer = createPromise<DeviceCode>();
    answer.reject('offline');
    native.startAnswer = answer.promise;

    await signIn.start();

    expect(signIn.state).toEqual({ kind: 'failed', failure: 'offline' });
    expect(native.finishes).toEqual([]);
});

test('a token GitHub cannot be asked about fails the attempt', async () => {
    const { signIn, auth, vault, native, session } = setup();
    session.github.holdIf = () => Promise.reject(new TypeError('Failed to fetch'));

    await signIn.start();
    native.finishes[0]?.resolve({ token: 'gho_octocat', scope: ALL_SCOPES });

    await waitUntil(() => signIn.state.kind === 'failed', { intervalMs: 1, timeoutMs: 1000 });
    expect(signIn.state).toEqual({ kind: 'failed', failure: 'failed' });
    expect(auth.signedIn).toBe(false);
    expect(vault.read()).toBeNull();
});

test('a token arriving after the attempt was cancelled is dropped', async () => {
    const { signIn, auth, vault, native, operations } = setup();

    await signIn.start();
    signIn.cancel();
    expect(signIn.state).toEqual({ kind: 'idle' });

    native.finishes[0]?.resolve({ token: 'gho_octocat', scope: ALL_SCOPES });
    await Bun.sleep(10);

    expect(signIn.state).toEqual({ kind: 'idle' });
    expect(auth.signedIn).toBe(false);
    expect(vault.read()).toBeNull();
    expect(operations()).toEqual([]);
});

test('cancelled while GitHub is saying whose the token is: nothing is kept', async () => {
    const { signIn, auth, vault, native, session, operations } = setup();
    const github = createPromise();
    session.github.hold = github.promise;

    await signIn.start();
    native.finishes[0]?.resolve({ token: 'gho_octocat', scope: ALL_SCOPES });
    await waitUntil(() => operations().length === 1, { intervalMs: 1, timeoutMs: 1000 });
    signIn.cancel();
    github.resolve();
    await Bun.sleep(10);

    expect(signIn.state).toEqual({ kind: 'idle' });
    expect(auth.signedIn).toBe(false);
    expect(vault.read()).toBeNull();
});

test('a new code supersedes the attempt before it: what the old one answers is not heard', async () => {
    const { signIn, auth, native } = setup();

    await signIn.start();
    await signIn.start();
    // The native side answers the replaced attempt's wait with `superseded`; had it got a token, that is dropped too.
    native.finishes[0]?.reject('superseded');
    await Bun.sleep(10);

    expect(signIn.state).toEqual({ kind: 'waiting', code: CODE });

    native.finishes[1]?.resolve({ token: 'gho_octocat', scope: ALL_SCOPES });
    await waitUntil(() => auth.signedIn, { intervalMs: 1, timeoutMs: 1000 });
    expect(auth.token).toBe('gho_octocat');
});

test('cancelled while asking for a code: the code that comes is not shown', async () => {
    const { signIn, native } = setup();
    const answer = createPromise<DeviceCode>();
    native.startAnswer = answer.promise;

    const starting = signIn.start();
    expect(signIn.state).toEqual({ kind: 'requesting' });
    signIn.cancel();
    answer.resolve(CODE);
    await starting;

    expect(signIn.state).toEqual({ kind: 'idle' });
    expect(native.finishes).toEqual([]);
});

/** The device sign-in over a signed-out session, with GitHub faked and the native commands answered by the test. */
function setup() {
    const session = createTestSession({ login: null, answer: () => undefined });
    const native = createFakeNative();
    session.container.set(NativeBridge, native.bridge);

    return {
        session,
        native,
        operations: session.operations,
        signIn: session.container.resolve(DeviceSignIn),
        auth: session.container.resolve(AuthStore),
        vault: session.container.resolve(TokenVault),
    };
}

/** The native side of {@link setup}: `device_finish` waits for the test to answer it. */
interface FakeNative {
    readonly bridge: NativeBridgeShape;
    /** Each `device_finish` call, in order, for the test to resolve or reject. */
    readonly finishes: PromiseWrapper<DeviceGrant>[];
    /** `device_start` answers with this when set; with {@link CODE} at once otherwise. */
    startAnswer: Promise<DeviceCode> | null;
}

function createFakeNative(): FakeNative {
    const native: FakeNative = {
        bridge: {
            loadToken: () => Promise.reject(new Error('Not expected')),
            saveToken: () => Promise.reject(new Error('Not expected')),
            deleteToken: () => Promise.reject(new Error('Not expected')),
            openExternal: () => Promise.reject(new Error('Not expected')),
            startDeviceSignIn: () => native.startAnswer ?? Promise.resolve(CODE),
            finishDeviceSignIn: () => {
                const finish = createPromise<DeviceGrant>();
                native.finishes.push(finish);
                return finish.promise;
            },
        },
        finishes: [],
        startAnswer: null,
    };
    return native;
}
