import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { expect, onTestFinished, test } from 'vitest';

import { NativeBridge } from './NativeBridge.js';

test('an update is listened for as Tauri listens, and the event hands its version over', async () => {
    const tauri = fakeTauri();
    const bridge = createContainer().resolve(NativeBridge);
    const versions: string[] = [];

    await bridge.onUpdateReady(version => versions.push(version));

    expect(tauri.invoked).toEqual([
        { command: 'plugin:event|listen', args: { event: 'update-ready', target: { kind: 'Any' }, handler: 1 } },
    ]);
    tauri.call(1, { event: 'update-ready', id: 7, payload: { version: '1.4.0' } });
    // Anything else on the callback is not an update.
    tauri.call(1, { event: 'update-ready', id: 8, payload: { version: 2 } });
    tauri.call(1, { event: 'something-else', id: 9, payload: { version: '9.9.9' } });
    expect(versions).toEqual(['1.4.0']);
});

test('asking for a ready update and restarting into it are the native commands', async () => {
    const tauri = fakeTauri();
    const bridge = createContainer().resolve(NativeBridge);

    expect(await bridge.updateStatus()).toBeNull();
    await bridge.restartToUpdate();

    expect(tauri.invoked.map(call => call.command)).toEqual(['update_status', 'update_restart']);
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
