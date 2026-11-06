import { expect, test } from 'bun:test';

import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import type { UpdateActivity, UpdateState } from '@/services/AppUpdate.js';
import type { BrowserStorage } from '@/services/Browser.js';

import { createDesktopAppUpdate } from './DesktopAppUpdate.js';
import type { NativeBridgeShape } from './NativeBridge.js';

const READY: UpdateActivity = { kind: 'ready', version: '1.4.0' };
const OFFLINE: UpdateActivity = { kind: 'failed', reason: 'offline' };

test('an update the native side readies is offered in the toast, and nothing restarts until the user says so', async () => {
    const { native, update } = await start();

    native.emit(READY);

    expect(update.offer).toEqual(READY);
    // The toast says it: the status bar does not too.
    expect(update.notice).toBeNull();
    // Offered, never forced: no restart while the user has not asked for one.
    await settle();
    expect(native.calls).not.toContain('update_restart');

    update.restart();
    await waitUntil(() => native.calls.includes('update_restart'), WAIT);
    expect(native.calls.filter(call => call === 'update_restart')).toHaveLength(1);
});

test('it listens before it asks, so what happened before the app listened is known too', async () => {
    const native = createFakeNative();
    native.status = { ...STATE, activity: READY };

    const update = createUpdate(native);
    expect(update.state).toBeNull();
    expect(update.offer).toBeNull();

    await waitUntil(() => update.offer?.kind === 'ready', WAIT);
    expect(native.calls).toEqual(['listen', 'update_status']);
});

test('an event that arrives before the answer is not overwritten by it', async () => {
    const native = createFakeNative();
    native.onStatus = () => native.emit(READY);

    const update = createUpdate(native);
    await waitUntil(() => native.calls.includes('update_status'), WAIT);
    await settle();

    expect(update.offer).toEqual(READY);
});

test('"Later" dismisses the toast until the app next starts, whatever a check nobody asked for does; the bar keeps it', async () => {
    const { native, update } = await start();
    native.emit(READY);

    update.later();

    expect(update.offer).toBeNull();
    expect(update.notice).toEqual(READY);
    // Told again in this run, the toast stays dismissed.
    native.emit(READY);
    expect(update.offer).toBeNull();
    native.emit({ kind: 'checking' });
    native.emit(READY);
    expect(update.offer).toBeNull();
    expect(update.notice).toEqual(READY);
    await settle();
    expect(native.calls).not.toContain('update_restart');

    // The next start offers it in the toast again.
    const nextStart = createFakeNative();
    nextStart.status = { ...STATE, activity: READY };
    const restarted = createUpdate(nextStart);
    await waitUntil(() => restarted.offer?.kind === 'ready', WAIT);
    expect(restarted.notice).toBeNull();
});

test('a check the user asks for brings an offer put off by "Later" back', async () => {
    const { native, update } = await start();
    native.emit(READY);
    update.later();

    native.emit({ kind: 'checking' }, { manual: true });
    expect(update.notice).toEqual({ kind: 'checking' });
    expect(update.offer).toBeNull();
    native.emit(READY, { manual: true });

    expect(update.offer).toEqual(READY);
    expect(update.notice).toBeNull();
});

test('a check nobody asked for says nothing until an update is ready', async () => {
    const { native, update } = await start();

    for (const activity of [
        { kind: 'checking' },
        { kind: 'upToDate' },
        { kind: 'checking' },
        OFFLINE,
        { kind: 'checking' },
        { kind: 'noRelease' },
        { kind: 'checking' },
        { kind: 'downloading', version: '1.4.0', percent: 38 },
    ] satisfies UpdateActivity[]) {
        native.emit(activity);
        expect(update.notice).toBeNull();
        expect(update.offer).toBeNull();
    }

    native.emit(READY);
    expect(update.offer).toEqual(READY);
});

test('a check the user asks for shows each step, the running version in "up to date"', async () => {
    const { native, update } = await start();

    native.emit({ kind: 'checking' }, { manual: true });
    expect(update.notice).toEqual({ kind: 'checking' });
    native.emit({ kind: 'downloading', version: '1.4.0', percent: null }, { manual: true });
    expect(update.notice).toEqual({ kind: 'downloading', version: '1.4.0', percent: null });

    native.emit({ kind: 'checking' }, { manual: true });
    native.emit({ kind: 'upToDate' }, { manual: true });
    expect(update.notice).toEqual({ kind: 'upToDate', version: '1.3.0' });
});

test('no release says which stream has none', async () => {
    const { native, update } = await start();

    native.emit({ kind: 'checking' }, { manual: true });
    native.emit({ kind: 'noRelease' }, { manual: true, stream: 'development' });

    expect(update.notice).toEqual({ kind: 'noRelease', stream: 'development' });
});

for (const [name, activity] of [
    ['up to date', { kind: 'upToDate' }],
    ['no release', { kind: 'noRelease' }],
] satisfies [string, UpdateActivity][]) {
    test(`${name} goes away by itself and comes back with the next check the user asks for`, async () => {
        const { native, update } = await start();

        native.emit({ kind: 'checking' }, { manual: true });
        native.emit(activity, { manual: true });
        expect(update.notice).not.toBeNull();

        await waitUntil(() => update.notice === null, WAIT);
        // The state is sent again on any change: that is no new outcome.
        native.emit(activity, { manual: true });
        expect(update.notice).toBeNull();

        native.emit({ kind: 'checking' }, { manual: true });
        native.emit(activity, { manual: true });
        expect(update.notice).not.toBeNull();
    });
}

test('a failure stays past a timed check, until Dismiss; the next check the user asks for can fail again', async () => {
    const { native, update } = await start();
    native.emit({ kind: 'checking' }, { manual: true });
    native.emit(OFFLINE, { manual: true });

    await settle();
    expect(update.notice).toEqual(OFFLINE);

    // A timed check replaces the state, not what the user was told.
    native.emit({ kind: 'checking' });
    expect(update.notice).toEqual(OFFLINE);
    native.emit({ kind: 'upToDate' });
    expect(update.notice).toEqual(OFFLINE);

    update.dismiss();
    expect(update.notice).toBeNull();
    native.emit(OFFLINE, { manual: true });
    expect(update.notice).toBeNull();

    native.emit({ kind: 'checking' }, { manual: true });
    native.emit({ kind: 'failed', reason: 'unreachable' }, { manual: true });
    expect(update.notice).toEqual({ kind: 'failed', reason: 'unreachable' });
});

test('an update readied after a failure replaces it, and "Later" does not bring it back', async () => {
    const { native, update } = await start();
    native.emit({ kind: 'checking' }, { manual: true });
    native.emit(OFFLINE, { manual: true });

    native.emit(READY);
    expect(update.notice).toBeNull();
    expect(update.offer).toEqual(READY);

    update.later();
    expect(update.notice).toEqual(READY);
});

test('the install says so whether or not anyone asked, and offers nothing while it runs', async () => {
    const { native, update } = await start();

    for (const manual of [false, true]) {
        native.emit({ kind: 'installing', version: '1.4.0' }, { manual });
        expect(update.notice).toEqual({ kind: 'installing', version: '1.4.0' });
    }
});

test('a failed install is offered in the toast, and "Later" leaves it to the bar', async () => {
    const { native, update } = await start();

    native.emit({ kind: 'installFailed', version: '1.4.0' });
    expect(update.offer).toEqual({ kind: 'installFailed', version: '1.4.0' });
    expect(update.notice).toBeNull();

    update.later();
    expect(update.offer).toBeNull();
    expect(update.notice).toEqual({ kind: 'installFailed', version: '1.4.0' });
});

test('an install the user starts after "Later" is news again: its failure comes back in the toast', async () => {
    const { native, update } = await start();
    native.emit(READY);
    update.later();

    native.emit({ kind: 'installing', version: '1.4.0' });
    expect(update.offer).toBeNull();
    native.emit({ kind: 'installFailed', version: '1.4.0' });

    expect(update.offer).toEqual({ kind: 'installFailed', version: '1.4.0' });
    expect(update.notice).toBeNull();
});

test('checking and switching are the native commands, and a refusal breaks nothing', async () => {
    const { native, update } = await start();

    update.check();
    update.setStream('development');
    await waitUntil(() => native.streams.length > 0, WAIT);

    expect(native.calls).toContain('update_check');
    expect(native.streams).toEqual(['development']);

    native.setStreamFails = true;
    update.setStream('stable');
    await settle();
    expect(update.state?.stream).toBe('stable');
});

test('a native side that cannot listen offers nothing and breaks nothing', async () => {
    const native = createFakeNative();
    native.listenFails = true;

    const update = createUpdate(native);
    await settle();

    expect(update.state).toBeNull();
    expect(update.notice).toBeNull();
});

test('each launch records the version and says once what changed, also after a reload', async () => {
    const storage = createStorage();

    const first = await launch(storage, '0.1.0');
    expect(first.previousVersion).toBeNull();
    expect(first.untoldChange).toBeNull();

    const updated = await launch(storage, '0.2.0');
    expect(updated.previousVersion).toBe('0.1.0');
    expect(updated.untoldChange).toEqual({ version: '0.2.0', previousVersion: '0.1.0' });

    // Not told yet, signed out say: it waits.
    const again = await launch(storage, '0.2.0');
    expect(again.untoldChange).toEqual({ version: '0.2.0', previousVersion: '0.1.0' });
    again.markUpdateTold();
    expect(again.untoldChange).toBeNull();

    const reloaded = await launch(storage, '0.2.0');
    expect(reloaded.untoldChange).toBeNull();
    expect(reloaded.previousVersion).toBe('0.1.0');
});

test('a storage that refuses costs the memory, not the updates', async () => {
    const native = createFakeNative();
    const { container } = createTestContainer();
    const update = createDesktopAppUpdate({
        bridge: native.bridge,
        logger: container.resolve(Logger),
        storage: {
            ...createStorage(),
            setItem: () => {
                throw new Error('Quota');
            },
        },
    });
    await waitUntil(() => update.state !== null, WAIT);

    native.emit(READY);
    expect(update.offer).toEqual(READY);
});

const WAIT = { intervalMs: 1, timeoutMs: 1000 };
const STATE: UpdateState = {
    version: '1.3.0',
    commit: null,
    stream: 'stable',
    canChoose: true,
    manual: false,
    checkedAt: null,
    activity: { kind: 'idle' },
};

function createUpdate(native: FakeNative) {
    const { container } = createTestContainer();
    return createDesktopAppUpdate({
        bridge: native.bridge,
        logger: container.resolve(Logger),
        storage: createStorage(),
        outcomeMs: 20,
    });
}

function createStorage(): BrowserStorage {
    const kept = new Map<string, string>();
    return {
        getItem: key => kept.get(key) ?? null,
        setItem: (key, value) => {
            kept.set(key, value);
        },
        removeItem: key => {
            kept.delete(key);
        },
    };
}

/** The app started with `version` running, on what `storage` kept. */
async function launch(storage: BrowserStorage, version: string) {
    const native = createFakeNative();
    native.status = { ...native.status, version };
    const { container } = createTestContainer();
    const update = createDesktopAppUpdate({ bridge: native.bridge, logger: container.resolve(Logger), storage });
    await waitUntil(() => update.state !== null, WAIT);
    return update;
}

/** The update service over a fake native side that has answered once. */
async function start() {
    const native = createFakeNative();
    const update = createUpdate(native);
    await waitUntil(() => update.state !== null, WAIT);
    return { native, update };
}

/** Lets pending promises run. */
function settle() {
    return new Promise(resolve => {
        setTimeout(resolve, 10);
    });
}

/** The native side's updater, faked: its state changes when told to. */
interface FakeNative {
    readonly bridge: NativeBridgeShape;
    /** The commands run (and `listen`), in order. */
    readonly calls: string[];
    /** The streams `update_set_stream` was told, in order. */
    readonly streams: string[];
    /** What `update_status` answers. */
    status: UpdateState;
    /** Runs as `update_status` is asked, before it answers. */
    onStatus?: () => void;
    /** `listen` fails. */
    listenFails: boolean;
    /** `update_set_stream` refuses. */
    setStreamFails: boolean;
    /** Emits `update-state` to whoever listens. */
    emit(activity: UpdateActivity, state?: Partial<UpdateState>): void;
}

function createFakeNative(): FakeNative {
    const listeners: ((state: UpdateState) => void)[] = [];
    const notExpected = () => Promise.reject(new Error('Not expected'));
    const native: FakeNative = {
        bridge: {
            loadToken: notExpected,
            saveToken: notExpected,
            deleteToken: notExpected,
            openExternal: notExpected,
            startDeviceSignIn: notExpected,
            finishDeviceSignIn: notExpected,
            readJobLog: notExpected,
            onWindowResized: notExpected,
            isFullscreen: notExpected,
            onScrollPhase: notExpected,
            onUpdateState: listener => {
                native.calls.push('listen');
                if (native.listenFails) {
                    return Promise.reject(new Error('No event plugin'));
                }

                listeners.push(listener);
                return Promise.resolve();
            },
            updateStatus: () => {
                native.calls.push('update_status');
                native.onStatus?.();
                return Promise.resolve(native.status);
            },
            checkForUpdate: () => {
                native.calls.push('update_check');
                return Promise.resolve();
            },
            setUpdateStream: stream => {
                if (native.setStreamFails) {
                    return Promise.reject(new Error('notAvailable'));
                }

                native.streams.push(stream);
                return Promise.resolve();
            },
            restartToUpdate: () => {
                native.calls.push('update_restart');
                return Promise.resolve();
            },
        },
        calls: [],
        streams: [],
        status: STATE,
        listenFails: false,
        setStreamFails: false,
        emit: (activity, state) => {
            for (const listener of listeners) {
                listener({ ...STATE, ...state, activity });
            }
        },
    };
    return native;
}
