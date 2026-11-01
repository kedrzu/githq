import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, shallowRef } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { AppUpdateShape } from '@/services/AppUpdate.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import AppCommands from './AppCommands.vue';

test('`,` opens Settings; the command menu offers it once, under "Go to" with its key, and its sections', async () => {
    const router = mount();

    await userEvent.keyboard(',');
    await expect.poll(() => router.currentRoute.value.path).toBe('/settings');

    await router.push('/');
    await userEvent.keyboard('{Meta>}k{/Meta}');
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    const settings = menu.getByRole('option', { name: 'Settings', exact: true });
    await expect.element(settings).toBeInTheDocument();
    expect(settings.elements()).toHaveLength(1);
    await expect.element(settings).toHaveTextContent(',');
    for (const section of ['Repositories', 'Projects', 'Saving to GitHub', 'Account']) {
        await expect.element(menu.getByRole('option', { name: `Settings: ${section}` })).toBeInTheDocument();
    }

    await userEvent.keyboard('settings: saving{Enter}');
    await expect.poll(() => router.currentRoute.value.fullPath).toBe('/settings?tab=saving');
});

test('on the web the command menu offers no update', async () => {
    mount();

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /^Sign out/ })).toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /Restart to update/ })).not.toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /Update later/ })).not.toBeInTheDocument();
});

test('while an update is ready the menu offers "Restart to update" and "Update later", gone once dismissed', async () => {
    const update = createUpdate('1.4.0');
    mount(update);

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /^Restart to update\s*githq 1\.4\.0$/ })).toBeInTheDocument();
    expect(update.restart).not.toHaveBeenCalled();

    await userEvent.keyboard('update later{Enter}');
    expect(update.later).toHaveBeenCalledOnce();
    expect(update.restart).not.toHaveBeenCalled();

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await expect.element(menu.getByRole('option', { name: /^Sign out/ })).toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /Restart to update/ })).not.toBeInTheDocument();
});

test('"Restart to update" restarts into the update', async () => {
    const update = createUpdate('1.4.0');
    mount(update);

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await userEvent.keyboard('restart to update{Enter}');

    expect(update.restart).toHaveBeenCalledOnce();
});

/** An update ready to run, hidden by `later` as the desktop app's is. */
function createUpdate(version: string) {
    const ready = shallowRef<string | null>(version);
    const update = {
        get readyVersion() {
            return ready.value;
        },
        restart: vi.fn(),
        later: vi.fn(() => {
            ready.value = null;
        }),
    } satisfies AppUpdateShape;
    return update;
}

/** The app's commands in an app of their own; `update` stands in for the desktop app's updates. */
function mount(update?: AppUpdateShape) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    setIndexedDbPersistence(container);
    if (update) {
        container.set(AppUpdate, update);
    }

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
    });
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp(AppCommands);
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });
    return router;
}
