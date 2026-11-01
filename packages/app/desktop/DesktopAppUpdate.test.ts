import { expect, test } from 'bun:test';

import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import { createDesktopAppUpdate } from './DesktopAppUpdate.js';
import type { NativeBridgeShape } from './NativeBridge.js';

test('an update the native side readies is offered, and nothing restarts until the user says so', async () => {
    const native = createFakeNative();
    const update = createUpdate(native);
    await waitUntil(() => native.calls.includes('update_status'), WAIT);

    native.emitReady('1.4.0');

    expect(update.readyVersion).toBe('1.4.0');
    // Offered, never forced: no restart while the user has not asked for one.
    await settle();
    expect(native.calls).not.toContain('update_restart');

    update.restart();
    await waitUntil(() => native.calls.includes('update_restart'), WAIT);
    expect(native.calls.filter(call => call === 'update_restart')).toHaveLength(1);
});

test('it listens before it asks, so an update readied before the app listened is offered too', async () => {
    const native = createFakeNative();
    native.status = '1.4.0';

    const update = createUpdate(native);

    await waitUntil(() => update.readyVersion === '1.4.0', WAIT);
    expect(native.calls).toEqual(['listen', 'update_status']);
    expect(native.calls).not.toContain('update_restart');
});

test('"Later" hides the update until the app next starts', async () => {
    const native = createFakeNative();
    const update = createUpdate(native);
    await waitUntil(() => native.calls.includes('update_status'), WAIT);
    native.emitReady('1.4.0');

    update.later();

    expect(update.readyVersion).toBeNull();
    // Told again in this run, it stays hidden.
    native.emitReady('1.4.0');
    expect(update.readyVersion).toBeNull();
    await settle();
    expect(native.calls).not.toContain('update_restart');

    // The next start offers it again.
    const nextStart = createFakeNative();
    nextStart.status = '1.4.0';
    const restarted = createUpdate(nextStart);
    await waitUntil(() => restarted.readyVersion === '1.4.0', WAIT);
});

test('a native side that cannot listen offers nothing and breaks nothing', async () => {
    const native = createFakeNative();
    native.listenFails = true;

    const update = createUpdate(native);
    await settle();

    expect(update.readyVersion).toBeNull();
});

const WAIT = { intervalMs: 1, timeoutMs: 1000 };

function createUpdate(native: FakeNative) {
    const { container } = createTestContainer();
    return createDesktopAppUpdate({ bridge: native.bridge, logger: container.resolve(Logger) });
}

/** Lets pending promises run. */
function settle() {
    return new Promise(resolve => {
        setTimeout(resolve, 10);
    });
}

/** The native side's updater, faked: it readies updates when told to. */
interface FakeNative {
    readonly bridge: NativeBridgeShape;
    /** The commands run (and `listen`), in order. */
    readonly calls: string[];
    /** What `update_status` answers. */
    status: string | null;
    /** `listen` fails. */
    listenFails: boolean;
    /** Emits `update-ready` to whoever listens. */
    emitReady(version: string): void;
}

function createFakeNative(): FakeNative {
    const listeners: ((version: string) => void)[] = [];
    const notExpected = () => Promise.reject(new Error('Not expected'));
    const native: FakeNative = {
        bridge: {
            loadToken: notExpected,
            saveToken: notExpected,
            deleteToken: notExpected,
            openExternal: notExpected,
            startDeviceSignIn: notExpected,
            finishDeviceSignIn: notExpected,
            onUpdateReady: listener => {
                native.calls.push('listen');
                if (native.listenFails) {
                    return Promise.reject(new Error('No event plugin'));
                }

                listeners.push(listener);
                return Promise.resolve();
            },
            updateStatus: () => {
                native.calls.push('update_status');
                return Promise.resolve(native.status);
            },
            restartToUpdate: () => {
                native.calls.push('update_restart');
                return Promise.resolve();
            },
        },
        calls: [],
        status: null,
        listenFails: false,
        emitReady: version => {
            for (const listener of listeners) {
                listener(version);
            }
        },
    };
    return native;
}
