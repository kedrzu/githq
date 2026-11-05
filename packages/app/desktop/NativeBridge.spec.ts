import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { expect, onTestFinished, test } from 'vitest';

import { NativeBridge } from './NativeBridge.js';

const STATE = {
    version: '0.2.0',
    commit: null,
    stream: 'stable',
    canChoose: true,
    manual: false,
    checkedAt: null,
    activity: { kind: 'idle' },
} as const;

test("the updater's state is listened for as Tauri listens, unknown fields tolerated and anything malformed ignored", async () => {
    const tauri = fakeTauri();
    const bridge = createContainer().resolve(NativeBridge);
    const states: unknown[] = [];

    await bridge.onUpdateState(state => states.push(state));

    expect(tauri.invoked).toEqual([
        { command: 'plugin:event|listen', args: { event: 'update-state', target: { kind: 'Any' }, handler: 1 } },
    ]);

    const downloading = { ...STATE, activity: { kind: 'downloading', version: '0.3.0', percent: null } };
    const withMore = { ...STATE, checkedAt: 5, added: 1, activity: { kind: 'ready', version: '0.3.0', added: 2 } };
    tauri.call(1, { event: 'update-state', id: 1, payload: downloading });
    tauri.call(1, { event: 'update-state', id: 2, payload: withMore });

    for (const malformed of [
        null,
        { ...STATE, version: 2 },
        { ...STATE, stream: 'nightly' },
        { ...STATE, activity: { kind: 'somethingNew' } },
        { ...STATE, activity: { kind: 'ready' } },
        { ...STATE, activity: { kind: 'failed', reason: 'other' } },
    ]) {
        tauri.call(1, { event: 'update-state', id: 3, payload: malformed });
    }

    // Anything else on the callback is not the updater's.
    tauri.call(1, { event: 'something-else', id: 4, payload: STATE });
    expect(states).toEqual([downloading, withMore]);
});

test("the updater's commands are the native ones, the stream its argument", async () => {
    const tauri = fakeTauri();
    const bridge = createContainer().resolve(NativeBridge);

    await bridge.updateStatus();
    await bridge.checkForUpdate();
    await bridge.setUpdateStream('development');
    await bridge.restartToUpdate();

    expect(tauri.invoked).toEqual([
        { command: 'update_status' },
        { command: 'update_check' },
        { command: 'update_set_stream', args: { stream: 'development' } },
        { command: 'update_restart' },
    ]);
});

test("the window's resizing is listened for as Tauri listens, and full screen asked of Tauri's own window command", async () => {
    const tauri = fakeTauri();
    const bridge = createContainer().resolve(NativeBridge);
    let resized = 0;

    await bridge.onWindowResized(() => resized++);
    await bridge.isFullscreen();

    expect(tauri.invoked).toEqual([
        { command: 'plugin:event|listen', args: { event: 'tauri://resize', target: { kind: 'Any' }, handler: 1 } },
        { command: 'plugin:window|is_fullscreen' },
    ]);

    tauri.call(1, { event: 'tauri://resize', id: 1, payload: { width: 1, height: 1 } });
    tauri.call(1, { event: 'something-else', id: 2, payload: null });
    expect(resized).toBe(1);
});

/** Puts a fake of what Tauri injects into the window for the test's length. */
function fakeTauri() {
    const callbacks = new Map<number, (message: unknown) => void>();
    const invoked: { command: string; args?: Record<string, unknown> }[] = [];
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
        configurable: true,
        value: {
            invoke: (command: string, args?: Record<string, unknown>) => {
                invoked.push(args === undefined ? { command } : { command, args });
                return Promise.resolve(null);
            },
            transformCallback: (callback: (message: unknown) => void) => {
                const id = callbacks.size + 1;
                callbacks.set(id, callback);
                return id;
            },
        },
    });
    onTestFinished(() => {
        Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    });

    return {
        invoked,
        /** Calls a registered callback, as the native side does. */
        call: (id: number, message: unknown) => callbacks.get(id)?.(message),
    };
}
