import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, shallowRef } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import type { AppUpdateShape, VersionChange } from '@/services/AppUpdate.js';

import UpdatedToast from './UpdatedToast.vue';

const toast = () => page.getByRole('region', { name: 'Notifications' }).getByRole('listitem');

test('U23: says from which version to which, is told once, and What changed goes to the Changelog', async () => {
    const { update, router } = mount({ version: '0.2.0', previousVersion: '0.1.0' });

    await expect.element(toast()).toHaveTextContent('Updated to githq 0.2.0');
    await expect.element(toast()).toHaveTextContent('You were on 0.1.0.');
    expect(update.markUpdateTold).toHaveBeenCalledOnce();

    await userEvent.click(page.getByRole('button', { name: 'What changed' }));

    await expect.poll(() => router.currentRoute.value.fullPath).toBe('/settings?tab=changelog');
    await expect.element(toast()).not.toBeInTheDocument();
});

test('U24: a Development build says the same, with ⌥W as its key', async () => {
    const { registry, router } = mount({ version: '0.3.0-dev.214', previousVersion: '0.3.0-dev.207' });

    await expect.element(toast()).toHaveTextContent('Updated to githq 0.3.0-dev.214');
    const command = registry.commands.find(candidate => candidate.id === 'updates.whatChanged');
    expect(command?.key).toBe('Alt+W');
    expect(command?.menu).toBeUndefined();

    command?.run?.();
    await expect.poll(() => router.currentRoute.value.fullPath).toBe('/settings?tab=changelog');
    expect(registry.commands.some(candidate => candidate.id === 'updates.whatChanged')).toBe(false);
});

test('U25: going back to an older version says which runs and offers no list, no key and no command', async () => {
    const { registry } = mount({ version: '0.2.0', previousVersion: '0.3.0-dev.214' });

    await expect.element(toast()).toHaveTextContent("You're on githq 0.2.0");
    await expect.element(page.getByRole('button', { name: 'What changed' })).not.toBeInTheDocument();
    expect(registry.commands.some(candidate => candidate.id === 'updates.whatChanged')).toBe(false);
});

test('it stays until dismissed, and its command goes with it', async () => {
    const { registry } = mount({ version: '0.2.0', previousVersion: '0.1.0' });
    await expect.element(toast()).toBeInTheDocument();

    await userEvent.click(toast().getByRole('button', { name: 'Dismiss' }).first());

    await expect.element(toast()).not.toBeInTheDocument();
    expect(registry.commands.some(candidate => candidate.id === 'updates.whatChanged')).toBe(false);
});

test('nothing to tell, the first ever run among it, shows nothing', async () => {
    const { update } = mount(null);

    await expect.element(page.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    await expect.element(toast()).not.toBeInTheDocument();
    expect(update.markUpdateTold).not.toHaveBeenCalled();
});

function mount(change: VersionChange | null) {
    const untold = shallowRef(change);
    const update = {
        state: null,
        readyVersion: null,
        notice: null,
        previousVersion: change?.previousVersion ?? null,
        get untoldChange() {
            return untold.value;
        },
        markUpdateTold: vi.fn(() => {
            untold.value = null;
        }),
        check: vi.fn(),
        setStream: vi.fn(),
        restart: vi.fn(),
        later: vi.fn(),
        dismiss: vi.fn(),
    } satisfies AppUpdateShape;

    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(AppUpdate, update);
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
    });
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ render: () => h(Toaster, null, { default: () => h(UpdatedToast) }) });
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });
    return { update, router, registry: container.resolve(CommandRegistry) };
}
