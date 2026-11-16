import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterView, useRoute, useRouter } from 'vue-router';

import { TOAST_LASTS } from '@/components/Toast.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { CommentDrafts } from '@/edits/CommentDrafts.js';
import { ITEM_PAGE_PATHS } from '@/item/itemRoutes.js';
import ItemPage from '@/item/ItemPage.vue';
import { ItemStore } from '@/store/ItemStore.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { sampleIssue } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import type { RepositorySection } from '@/repository/RepositorySection.js';
import RepositoryView from '@/repository/RepositoryView.vue';
import { REPOSITORY_VIEW_DEFAULTS } from '@/repository/repositoryViewOptions.js';
import { SAMPLE_NOW } from '@/testing/sampleMyWork.js';
import { SAMPLE_VIEWER } from '@/testing/sampleViewer.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { getRepositoryPath } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';
import type { TrackedTarget } from '@/tracking/TrackingTypes.js';

import Shell from './shell.vue';

const WEB = 'acme/web';
const API = 'acme/api';
const ROADMAP = 'Roadmap';
const WEB_TARGET: TrackedTarget = { kind: 'repository', nameWithOwner: WEB };

/** acme/web's Issues or Pull requests, its section switched by its address as the repository's page does. */
const WebList = defineComponent({
    setup() {
        const route = useRoute();
        const router = useRouter();
        return () =>
            h(RepositoryView, {
                nameWithOwner: WEB,
                isPrivate: false,
                tracked: true,
                openCounts: { issues: 12, pullRequests: 3 },
                viewerLogin: SAMPLE_VIEWER.login,
                now: SAMPLE_NOW,
                options: REPOSITORY_VIEW_DEFAULTS,
                state: 'open',
                section: route.params.section === 'pulls' ? 'pullRequests' : 'issues',
                'onUpdate:section': (section: RepositorySection) =>
                    void router.replace(getRepositoryPath(WEB, section)),
            });
    },
});

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

test('on a phone, the command line opens the command menu, and a toast sits above it', async () => {
    const { pending } = await open('phone');
    const line = page.getByRole('button', { name: /Do or find/u });
    await expect.element(line).toBeVisible();

    pending.untrack(WEB_TARGET, WEB);
    await expect.element(toast()).toBeVisible();
    expect(toast().element().getBoundingClientRect().bottom).toBeLessThanOrEqual(
        line.element().getBoundingClientRect().top,
    );

    await userEvent.click(line);
    await expect.element(page.getByRole('listbox', { name: 'Command menu' })).toBeVisible();
});

test("on a phone, an item's comment pill grows into its composer docked at the bottom — the cursor in it, ⌘ aside — and shows what is typed once left", async () => {
    const { router, container } = await open('phone');
    const items = container.resolve(ItemStore);
    await items.ready();
    items.upsertMany([{ ...sampleIssue('I_7'), number: 7 }]);

    await router.push('/acme/web/issues/7');
    await expect.element(page.getByRole('button', { name: /Do or find/u })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Leave a comment…' }));

    const box = page.getByRole('textbox', { name: 'Comment' });
    await expect.element(box).toHaveFocus();
    // Hidden, as the command line steps aside (mobile D18).
    await expect.element(page.getByRole('button', { name: 'Command menu' })).not.toBeInTheDocument();
    await userEvent.keyboard('Same here on mobile.');

    // A tap on the screen around it: back to the pill, which keeps the draft.
    await userEvent.click(page.getByRole('heading', { name: 'Issue I_7' }));
    await expect.element(box).not.toBeInTheDocument();
    await expect
        .element(page.getByRole('button', { name: 'Continue your comment: Same here on mobile.' }))
        .toBeVisible();
    expect(container.resolve(CommentDrafts).get('I_7')).toBe('Same here on mobile.');

    await userEvent.click(page.getByRole('button', { name: 'Command menu' }));
    await expect.element(page.getByRole('listbox', { name: 'Command menu' })).toBeVisible();
});

test("on a phone, the command line on a list opens the menu with the place's parts first; Pull requests switches the section", async () => {
    const { router } = await open('phone');
    await router.push('/acme/web/issues');
    await expect.element(page.getByRole('button', { name: /Issues\s*12/u })).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: /Do or find/u }));
    // From below: the first group is the last in the page, nearest the field (mobile D16).
    const parts = page.getByRole('listbox', { name: 'Command menu' }).getByRole('group').last();
    await expect.element(parts).toHaveTextContent(new RegExp(`^${WEB}`, 'u'));
    const rows = parts.getByRole('option');
    await expect.element(rows.nth(0)).toHaveAccessibleName('Issues 12 current');
    await expect.element(rows.nth(1)).toHaveAccessibleName('Pull requests 3');
    await expect.element(rows.nth(2)).toHaveAccessibleName(/^Commits opens on\sgithub\.com$/u);
    await expect.element(rows.nth(3)).toHaveAccessibleName(/^Workflows opens on\sgithub\.com$/u);
    expect(rows.elements()).toHaveLength(4);

    await userEvent.click(rows.nth(1));
    await expect.poll(() => router.currentRoute.value.path).toBe('/acme/web/pulls');
    await expect.element(page.getByRole('button', { name: /Pull requests\s*3/u })).toBeVisible();
});

test('on a phone, the command menu rises from below with its field unfocused, its first group nearest the field; the command line steps aside until it closes', async () => {
    const { router } = await open('phone');
    await router.push('/acme/web/issues');
    const line = page.getByRole('button', { name: /Do or find/u });
    await userEvent.click(line);

    const menu = page.getByRole('listbox', { name: 'Command menu' });
    const field = page.getByRole('textbox', { name: 'Do or find…' });
    await expect.element(menu).toHaveFocus();
    await expect.element(field).not.toHaveFocus();
    // Hidden, so no longer a button anyone can reach.
    await expect.element(line).not.toBeInTheDocument();

    // The place's parts sit right above the field, the row nearest it highlighted; ↑ goes up the screen.
    const parts = menu.getByRole('group').last();
    await expect.element(parts).toHaveTextContent(new RegExp(`^${WEB}`, 'u'));
    expect(parts.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(
        field.element().getBoundingClientRect().top,
    );
    const rows = parts.getByRole('option');
    await expect.element(rows.nth(3)).toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(rows.nth(2)).toHaveAttribute('data-highlighted');

    await userEvent.click(rows.nth(1));
    await expect.poll(() => router.currentRoute.value.path).toBe('/acme/web/pulls');
    await expect.element(menu).not.toBeInTheDocument();
    await expect.element(line).toBeVisible();
});

test("the open place's rows slide open in a Reveal with the animations on, and appear as they are with them off", async () => {
    const { router, tracking } = await open();
    await router.push('/acme/web/issues');
    const rows = () => openPlaceRows(WEB);
    await expect.poll(() => rows()?.parentElement?.tagName).toBe('DIV');
    const wrapper = rows()?.closest('li > div');
    expect(wrapper && getComputedStyle(wrapper).transitionProperty).toContain('height');

    tracking.setAnimations(false);

    await expect.poll(() => rows()?.parentElement?.tagName).toBe('LI');
});

function sidebarLink(name: string) {
    return page.getByRole('link', { name });
}

/** The list of rows under a tracked place in the sidebar, while it shows them. */
function openPlaceRows(name: string) {
    return page
        .getByRole('navigation', { name: 'Sidebar' })
        .getByRole('link', { name: new RegExp(`^${name}`, 'u') })
        .element()
        .closest('li')
        ?.querySelector('ul');
}

/**
 * The shell around a blank screen, tracking two repositories and a project, with GitHub answering nothing; in a
 * computer's window, or a phone's (the phone layout, mobile D5).
 */
async function open(device: 'computer' | 'phone' = 'computer') {
    await (device === 'phone' ? page.viewport(390, 844) : page.viewport(1280, 800));
    onTestFinished(() => page.viewport(414, 896));
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
            // The repository's route, by name, so the sidebar knows the place it is in (`getOpenPlace`).
            { path: '/:owner(acme)/:name(web)/:section(issues|pulls)', name: 'repository', component: WebList },
            { path: ITEM_PAGE_PATHS[0], meta: { itemPage: 'issue' }, component: ItemPage },
            { path: '/:path(.*)*', component: defineComponent({ render: () => null }) },
        ],
    });
    const host = document.createElement('div');
    document.body.append(host);
    const app = createApp({ setup: () => () => h(Shell, null, { default: () => h(RouterView) }) });
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { pending: container.resolve(PendingUntracks), tracking, router, container };
}
