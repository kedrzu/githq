import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { TOAST_LASTS } from '@/components/Toast.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import Shell from './shell.vue';

const WEB = 'acme/web';
const API = 'acme/api';
const ROADMAP = 'Roadmap';
const WEB_TARGET: TrackedTarget = { kind: 'repository', nameWithOwner: WEB };

const toast = () => page.getByRole('region', { name: 'Notifications' }).getByRole('listitem');

test('an entry being untracked leaves the sidebar at once and the toast says so; Undo brings it back with no write', async () => {
    const { pending, tracking } = await open();
    await expect.element(sidebarLink(WEB)).toBeInTheDocument();

    pending.untrack(WEB_TARGET, WEB);

    await expect.element(sidebarLink(WEB)).not.toBeInTheDocument();
    await expect.element(sidebarLink(API)).toBeInTheDocument();
    await expect.element(toast()).toHaveTextContent(`Stopped tracking ${WEB}`);
    await expect.element(toast()).toHaveTextContent('Its copy in this browser goes when this closes.');
    expect(tracking.isTracked(WEB_TARGET)).toBe(true);

    await userEvent.click(toast().getByRole('button', { name: 'Undo' }));

    await expect.element(toast()).not.toBeInTheDocument();
    await expect.element(sidebarLink(WEB)).toBeInTheDocument();
    expect(pending.isPending(WEB_TARGET)).toBe(false);
    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
});

for (const [name, target] of [
    [WEB, WEB_TARGET],
    [ROADMAP, { kind: 'project', id: 'PVT_1' }],
] satisfies [string, TrackedTarget][]) {
    test(`Stop tracking in the sidebar menu of ${name} is pending with Undo: out of the sidebar at once, tracked until the toast goes`, async () => {
        const { pending, tracking } = await open();

        await userEvent.click(sidebarLink(name), { button: 'right' });
        await userEvent.click(page.getByRole('menuitem', { name: 'Stop tracking' }));

        await expect.element(sidebarLink(name)).not.toBeInTheDocument();
        await expect.element(toast()).toHaveTextContent(`Stopped tracking ${name}`);
        expect(pending.isPending(target)).toBe(true);
        expect(tracking.isTracked(target)).toBe(true);

        await userEvent.click(toast().getByRole('button', { name: 'Dismiss' }).first());
        await expect.element(toast()).not.toBeInTheDocument();
        expect(tracking.isTracked(target)).toBe(false);
    });
}

test('the command menu offers neither a repository nor a project being untracked', async () => {
    const { pending } = await open();

    pending.untrack(WEB_TARGET, WEB);
    pending.untrack({ kind: 'project', id: 'PVT_1' }, ROADMAP);

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: API })).toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: WEB })).not.toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: ROADMAP })).not.toBeInTheDocument();
});

test('each untrack has its toast; ⌘Z undoes the newest, and the one before it then takes the key', async () => {
    const { pending, tracking } = await open();

    pending.untrack(WEB_TARGET, WEB);
    pending.untrack({ kind: 'repository', nameWithOwner: API }, API);
    await expect.element(toast().filter({ hasText: `Stopped tracking ${API}` })).toBeInTheDocument();
    await expect.element(toast().filter({ hasText: `Stopped tracking ${WEB}` })).toBeInTheDocument();

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');

    await expect.element(toast()).toHaveTextContent(`Stopped tracking ${WEB}`);
    await expect.element(toast().getByRole('button', { name: 'Undo' })).toHaveAttribute('aria-keyshortcuts');
    await expect.element(sidebarLink(API)).toBeInTheDocument();
    expect(pending.isPending(WEB_TARGET)).toBe(true);
    expect(tracking.isTracked({ kind: 'repository', nameWithOwner: API })).toBe(true);
});

test('dismissing the toast untracks at once, by its button or by Escape', async () => {
    const { pending, tracking } = await open();

    pending.untrack(WEB_TARGET, WEB);
    await userEvent.click(toast().getByRole('button', { name: 'Dismiss' }).first());
    await expect.element(toast()).not.toBeInTheDocument();
    expect(tracking.isTracked(WEB_TARGET)).toBe(false);

    const api: TrackedTarget = { kind: 'repository', nameWithOwner: API };
    pending.untrack(api, API);
    await expect.element(toast()).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(toast()).not.toBeInTheDocument();
    expect(tracking.isTracked(api)).toBe(false);
});

test('the toast running out of time untracks; until then it is only pending', async () => {
    const { pending, tracking } = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    onTestFinished(() => {
        vi.useRealTimers();
    });

    pending.untrack(WEB_TARGET, WEB);
    await nextTick();
    expect(toast().query()).not.toBeNull();

    await vi.advanceTimersByTimeAsync(TOAST_LASTS.long - 1);
    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await nextTick();
    expect(toast().query()).toBeNull();
    expect(tracking.isTracked(WEB_TARGET)).toBe(false);
    expect(pending.isPending(WEB_TARGET)).toBe(false);
});

test('a change of screen gives the keys back from what Tab focused; Escape doing so leaves a toast alone', async () => {
    const { pending, router } = await open();
    const link = sidebarLink(WEB);
    await expect.element(link).toBeInTheDocument();
    const focusByTab = async () => {
        for (let tabs = 0; tabs < 40 && document.activeElement !== link.element(); tabs++) {
            await userEvent.tab();
        }

        expect(link.element().hasAttribute('data-tab-focus')).toBe(true);
    };

    await focusByTab();
    await router.push('/somewhere');
    await expect.element(link).not.toHaveFocus();

    await focusByTab();
    pending.untrack({ kind: 'repository', nameWithOwner: API }, API);
    await expect.element(toast()).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await expect.element(link).not.toHaveFocus();
    await expect.element(toast()).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await expect.element(toast()).not.toBeInTheDocument();
});

test('moving to another screen keeps the toast and Undo', async () => {
    const { pending, router, tracking } = await open();

    pending.untrack(WEB_TARGET, WEB);
    await expect.element(toast()).toBeInTheDocument();

    await router.push('/settings');
    await expect.element(toast()).toHaveTextContent(`Stopped tracking ${WEB}`);

    await userEvent.click(toast().getByRole('button', { name: 'Undo' }));
    await expect.element(sidebarLink(WEB)).toBeInTheDocument();
    expect(tracking.isTracked(WEB_TARGET)).toBe(true);
});

test('with nothing known broken the sidebar has no "Broken workflows", but shows it on its own screen', async () => {
    const { router } = await open();
    await expect.element(sidebarLink(WEB)).toBeInTheDocument();
    await expect.element(page.getByRole('link', { name: /^Broken workflows/u })).not.toBeInTheDocument();

    await router.push('/dashboard/workflows');

    // Nothing read yet: no zero is claimed.
    await expect.element(page.getByRole('link', { name: 'Broken workflows –' })).toBeVisible();

    await router.push('/settings');
    await expect.element(page.getByRole('link', { name: /^Broken workflows/u })).not.toBeInTheDocument();
});

function sidebarLink(name: string) {
    return page.getByRole('link', { name });
}

/** The shell around a blank screen, tracking two repositories and a project, with GitHub answering nothing. */
async function open() {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser());
    setIndexedDbPersistence(container);
    const tracking = container.resolve(TrackingStore);
    await tracking.ready();
    tracking.choose({
        repositories: [
            { nameWithOwner: WEB, id: 'R_web' },
            { nameWithOwner: API, id: 'R_api' },
        ],
        projects: [{ id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: ROADMAP }],
    });

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/dashboard/workflows', name: 'workflows', component: defineComponent({ render: () => null }) },
            { path: '/:path(.*)*', component: defineComponent({ render: () => null }) },
        ],
    });
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ setup: () => () => h(Shell) });
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { pending: container.resolve(PendingUntracks), tracking, router };
}
