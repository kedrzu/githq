import { expect, test } from 'bun:test';

import { createTestContainer } from '@nzyme/ioc-testing/createTestContainer.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { waitUntil } from '@nzyme/utils/waitUntil.js';

import { createDesktopWindowControls } from './DesktopWindowControls.js';
import type { NativeBridgeShape } from './NativeBridge.js';

const WAIT = { intervalMs: 1, timeoutMs: 1000 };

test('the controls are over the window until a resize finds it in full screen, and back when it left', async () => {
    const native = createFakeNative();
    const controls = createControls(native);
    await waitUntil(() => native.calls.length === 2, WAIT);
    expect(native.calls).toEqual(['listen', 'isFullscreen']);
    expect(controls.overlaid).toBe(true);

    native.fullscreen = true;
    native.resize();
    await waitUntil(() => !controls.overlaid, WAIT);

    native.fullscreen = false;
    native.resize();
    await waitUntil(() => controls.overlaid, WAIT);
});

test('a window already in full screen when the page loads has no controls over it', async () => {
    const native = createFakeNative();
    native.fullscreen = true;

    const controls = createControls(native);

    await waitUntil(() => !controls.overlaid, WAIT);
});

test('an older answer arriving after a newer one does not count', async () => {
    const native = createFakeNative();
    const controls = createControls(native);
    await waitUntil(() => native.calls.length === 2, WAIT);

    const older = createPromise<boolean>();
    const newer = createPromise<boolean>();
    native.answers.push(() => older.promise, () => newer.promise);
    native.resize();
    native.resize();

    newer.resolve(true);
    await waitUntil(() => !controls.overlaid, WAIT);

    older.resolve(false);
    await older.promise;
    await Promise.resolve();
    expect(controls.overlaid).toBe(false);
});

test('when the window cannot be asked, the corner stays kept clear', async () => {
    const native = createFakeNative();
    native.answers.push(() => Promise.reject(new Error('refused')));

    const controls = createControls(native);

    await waitUntil(() => native.calls.length === 2, WAIT);
    await Promise.resolve();
    expect(controls.overlaid).toBe(true);
});

function createControls(native: FakeNative) {
    const { container } = createTestContainer();
    return createDesktopWindowControls({ bridge: native.bridge, logger: container.resolve(Logger) });
}

interface FakeNative {
    readonly bridge: NativeBridgeShape;
    readonly calls: string[];
    /** What the next questions answer, in turn, before {@link fullscreen}. */
    readonly answers: (() => Promise<boolean>)[];
    fullscreen: boolean;
    /** The window resizes. */
    resize(): void;
}

function createFakeNative(): FakeNative {
    const notExpected = () => Promise.reject(new Error('Not expected'));
    let resized: () => void = () => undefined;
    const native: FakeNative = {
        calls: [],
        answers: [],
        fullscreen: false,
        resize: () => resized(),
        bridge: {
            loadToken: notExpected,
            saveToken: notExpected,
            deleteToken: notExpected,
            openExternal: notExpected,
            startDeviceSignIn: notExpected,
            finishDeviceSignIn: notExpected,
            readJobLog: notExpected,
            onUpdateState: notExpected,
            updateStatus: notExpected,
            checkForUpdate: notExpected,
            setUpdateStream: notExpected,
            restartToUpdate: notExpected,
            onWindowResized: listener => {
                native.calls.push('listen');
                resized = listener;
                return Promise.resolve();
            },
            isFullscreen: () => {
                native.calls.push('isFullscreen');
                return native.answers.shift()?.() ?? Promise.resolve(native.fullscreen);
            },
        },
    };

    return native;
}
