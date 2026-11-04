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
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { REPOSITORY_PATH, WORKFLOW_RUN_PATH } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import { Browser } from '@/services/Browser.js';

import AppCommands from './AppCommands.vue';

test('`,` opens Settings; the command menu offers it once, under "Go to" with its key, and its sections', async () => {
    const router = mount();

    await userEvent.keyboard(',');
    await expect.poll(() => router.currentRoute.value.path).toBe('/settings');

    await router.push('/');
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    const settings = menu.getByRole('option', { name: 'Settings', exact: true });
    await expect.element(settings).toBeInTheDocument();
    expect(settings.elements()).toHaveLength(1);
    await expect.element(settings).toHaveTextContent(',');
    for (const section of ['Repositories', 'Projects', 'Display', 'Sync settings', 'Account']) {
        await expect.element(menu.getByRole('option', { name: `Settings: ${section}` })).toBeInTheDocument();
    }

    await userEvent.keyboard('settings: sync{Enter}');
    await expect.poll(() => router.currentRoute.value.fullPath).toBe('/settings?tab=sync');
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

test('on a screen with no repository the menu has no chip and no group of one', async () => {
    mount();

    await openMenu();
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /^Sign out/ })).toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /^Open on GitHub/ })).not.toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /^Copy link/ })).not.toBeInTheDocument();
    await expect.element(menu.getByRole('group', { name: 'acme/web' })).not.toBeInTheDocument();
});

test("off its view the repository's group has its sections, page, link and settings, none of them on a key", async () => {
    const router = await mount({ tracked: ['acme/web'] });
    await router.push('/acme/web/actions/runs/7');

    await openMenu();
    const group = page.getByRole('listbox', { name: 'Command menu' }).getByRole('group', { name: 'acme/web' });
    for (const title of ['Issues', 'Pull requests', 'Commits', 'Workflows', 'Settings', 'Copy link']) {
        await expect.element(group.getByRole('option', { name: title, exact: true })).toBeInTheDocument();
    }
    await expect.element(group.getByRole('option', { name: /^Open on GitHub\s*acme\/web$/ })).toBeInTheDocument();
    for (const option of group.getByRole('option').elements()) {
        expect(option.querySelector('kbd')).toBeNull();
    }

    await userEvent.keyboard('commits{Enter}');
    await expect.poll(() => router.currentRoute.value.path).toBe('/acme/web/commits');
});

test("on a repository's view the group has only its page, link and settings: its sections are the view's, on keys", async () => {
    const router = await mount({ tracked: ['acme/web'] });
    await router.push('/acme/web/issues');

    await openMenu();
    const group = page.getByRole('listbox', { name: 'Command menu' }).getByRole('group', { name: 'acme/web' });
    await expect.element(group.getByRole('option', { name: /^Open on GitHub\s*acme\/web$/ })).toBeInTheDocument();
    await expect.element(group.getByRole('option', { name: 'Settings', exact: true })).toBeInTheDocument();
    for (const title of ['Issues', 'Pull requests', 'Commits', 'Workflows']) {
        await expect.element(group.getByRole('option', { name: title })).not.toBeInTheDocument();
    }
});

test('a repository that is not tracked is offered Commits but neither Workflows nor Settings', async () => {
    const router = await mount({});
    await router.push('/acme/web/actions/runs/7');

    await openMenu();
    const group = page.getByRole('listbox', { name: 'Command menu' }).getByRole('group', { name: 'acme/web' });
    await expect.element(group.getByRole('option', { name: 'Commits', exact: true })).toBeInTheDocument();
    await expect.element(group.getByRole('option', { name: 'Workflows' })).not.toBeInTheDocument();
    await expect.element(group.getByRole('option', { name: 'Settings', exact: true })).not.toBeInTheDocument();
});

async function openMenu() {
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await expect.element(page.getByRole('listbox', { name: 'Command menu' })).toBeInTheDocument();
}

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

interface MountOptions {
    /** `owner/name` of the repositories tracked; setting it makes mounting asynchronous. */
    readonly tracked?: readonly string[];
}

/** The app's commands in an app of their own; `update` stands in for the desktop app's updates. */
function mount(update?: AppUpdateShape): ReturnType<typeof createRouter>;
function mount(options: MountOptions): Promise<ReturnType<typeof createRouter>>;
function mount(arg?: AppUpdateShape | MountOptions) {
    const update = arg && 'restart' in arg ? arg : undefined;
    const options = arg && !('restart' in arg) ? arg : undefined;
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    setIndexedDbPersistence(container);
    if (update) {
        container.set(AppUpdate, update);
    }

    if (options === undefined) {
        return render(container);
    }

    container.set(Browser, createSignedInBrowser());
    const tracking = container.resolve(TrackingStore);
    return tracking.ready().then(() => {
        for (const nameWithOwner of options.tracked ?? []) {
            tracking.track({ repository: { nameWithOwner, id: `R_${nameWithOwner}` } });
        }

        return render(container);
    });
}

function render(container: ReturnType<typeof createContainer>) {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: REPOSITORY_PATH, name: 'repository', component: defineComponent({ render: () => null }) },
            { path: WORKFLOW_RUN_PATH, component: defineComponent({ render: () => null }) },
            { path: '/:path(.*)*', component: defineComponent({ render: () => null }) },
        ],
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
