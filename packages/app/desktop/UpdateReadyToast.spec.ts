import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h, shallowRef } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import type { AppUpdateShape, UpdateOffer } from '@/services/AppUpdate.js';

import UpdateReadyToast from './UpdateReadyToast.vue';

const toast = () => page.getByRole('region', { name: 'Notifications' }).getByRole('listitem');

test('U49: an update ready stays offered with Restart on ⌥R, and nothing restarts until the user says so', async () => {
    const { update } = mount({ kind: 'ready', version: '1.4.0' });

    await expect.element(toast()).toHaveTextContent('githq 1.4.0 is ready');
    await expect.element(toast()).toHaveTextContent("Restart to switch to it. You're on 1.3.0 until then.");
    // Pinned: no countdown.
    expect(document.querySelector('[tid="toast-countdown"]')).toBeNull();
    const restart = toast().getByRole('button', { name: 'Restart' });
    await expect.element(restart).toHaveAttribute('aria-keyshortcuts', 'Alt+R');
    expect(update.restart).not.toHaveBeenCalled();

    await userEvent.click(restart);
    expect(update.restart).toHaveBeenCalledOnce();
});

test('⌥R is the toast\'s key alone: the command menu keeps its own "Restart to update"', async () => {
    const { update, registry } = mount({ kind: 'ready', version: '1.4.0' });
    await expect.element(toast()).toBeInTheDocument();

    const command = registry.commands.find(candidate => candidate.id === 'updates.restart');
    expect(command?.key).toBe('Alt+R');
    expect(command?.menu).toBe(false);

    command?.run?.();
    expect(update.restart).toHaveBeenCalledOnce();
});

test('Dismiss is "Later": the toast and its key go', async () => {
    const { update, registry } = mount({ kind: 'ready', version: '1.4.0' });
    await expect.element(toast()).toBeInTheDocument();

    await userEvent.click(toast().getByRole('button', { name: 'Dismiss' }).first());

    expect(update.later).toHaveBeenCalledOnce();
    await expect.element(toast()).not.toBeInTheDocument();
    expect(registry.commands.some(candidate => candidate.id === 'updates.restart')).toBe(false);
    expect(update.restart).not.toHaveBeenCalled();
});

test('U51: a failed install says nothing is lost and offers Try again, which restarts', async () => {
    const { update } = mount({ kind: 'installFailed', version: '1.4.0' });

    await expect.element(toast()).toHaveTextContent("githq 1.4.0 couldn't be installed");
    await expect.element(toast()).toHaveTextContent("You're still on 1.3.0. Nothing is lost.");
    await expect.element(toast().getByRole('button', { name: 'Restart' })).not.toBeInTheDocument();

    await userEvent.click(toast().getByRole('button', { name: 'Try again' }));
    expect(update.restart).toHaveBeenCalledOnce();
});

test('nothing offered shows nothing', async () => {
    mount(null);

    await expect.element(page.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    await expect.element(toast()).not.toBeInTheDocument();
});

/** The toast in the shell's toaster, over a desktop app on 1.3.0 offering `offer`. */
function mount(offer: UpdateOffer | null) {
    const offered = shallowRef(offer);
    const update = {
        state: {
            version: '1.3.0',
            commit: null,
            stream: 'stable',
            canChoose: true,
            manual: false,
            checkedAt: null,
            activity: offer ?? { kind: 'idle' },
        },
        notice: null,
        get offer() {
            return offered.value;
        },
        previousVersion: null,
        untoldChange: null,
        markUpdateTold: vi.fn(),
        check: vi.fn(),
        setStream: vi.fn(),
        restart: vi.fn(),
        later: vi.fn(() => {
            offered.value = null;
        }),
        dismiss: vi.fn(),
    } satisfies AppUpdateShape;

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(AppUpdate, update);
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ render: () => h(Toaster, null, { default: () => h(UpdateReadyToast) }) });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });
    return { update, registry: container.resolve(CommandRegistry) };
}
