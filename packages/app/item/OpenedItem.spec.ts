import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';
import type { RouterHistory } from 'vue-router';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { ItemStore } from '@/store/ItemStore.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { sampleIssue, samplePullRequest } from '@/testing/sampleItems.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

import { ItemNavigation } from './ItemNavigation.js';
import { ITEM_PAGE_PATHS } from './itemRoutes.js';
import ItemPage from './ItemPage.vue';

const LIST = '/acme/web/issues?q=bug';

test('mobile D20: back on a phone, the list right behind, is the history’s Back — the list comes back as it was left', async () => {
    const { router, history, navigation } = await mountItemPage({ phone: true, visits: [LIST, '/acme/web/issues/1'] });
    navigation.setList({ path: LIST, title: 'Issues', steps: ['i1', 'i2'], stepOf: new Map(), around: null });

    // `J` replaces the address: the list is still the entry behind.
    await userEvent.click(page.getByRole('button', { name: 'Next item' }));
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/acme/web/issues/2'));
    await userEvent.click(page.getByRole('button', { name: 'Back to Issues' }));

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(LIST));
    expect(history.entries()).toEqual([LIST, '/acme/web/issues/2']);
    expect(history.position()).toBe(0);
});

test('mobile D20: back on a phone, another item behind (a link followed), goes to the list’s address', async () => {
    const { router, history, navigation } = await mountItemPage({
        phone: true,
        visits: [LIST, '/acme/web/issues/2', '/acme/web/issues/1'],
    });
    navigation.setList({ path: LIST, title: 'Issues', steps: ['i2'], stepOf: new Map(), around: null });

    await userEvent.click(page.getByRole('button', { name: 'Back to Issues' }));

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(LIST));
    expect(history.entries()).toEqual([LIST, '/acme/web/issues/2', '/acme/web/issues/1', LIST]);
    expect(history.position()).toBe(3);
});

test('mobile D20: back on a phone with no list (opened from a link) goes up to the repository, by the item’s kind, and says so', async () => {
    const { router } = await mountItemPage({ phone: true, visits: ['/acme/web/pull/3'] });

    await expect.element(page.getByRole('button', { name: 'Next item' })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Back to acme/web' }));

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/acme/web/pulls'));
});

test('D20: on the computer, closing an item’s page with no list goes to its repository, not My work', async () => {
    const { router } = await mountItemPage({ phone: false, visits: ['/acme/web/issues/1'] });

    await userEvent.click(page.getByRole('button', { name: 'Close', exact: true }));

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/acme/web/issues'));
});

test('on the computer, closing an item’s page goes to the list it was opened from, as before', async () => {
    const { router, navigation } = await mountItemPage({ phone: false, visits: [LIST, '/acme/web/issues/1'] });
    navigation.setList({ path: LIST, title: 'Issues', steps: ['i1'], stepOf: new Map(), around: null });

    await userEvent.click(page.getByRole('button', { name: 'Close', exact: true }));

    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(LIST));
});

/** Options of {@link mountItemPage}. */
interface MountItemPageOptions {
    readonly phone: boolean;
    /** The addresses visited, in order, the last an item's page on screen. */
    readonly visits: readonly string[];
}

/** An item's page (`ItemPage`) with issues 1 and 2 and pull request 3 of acme/web in the local copy. */
async function mountItemPage({ phone, visits }: MountItemPageOptions) {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    container.set(Browser, createSignedInBrowser());
    container.set(PhoneLayout, createFixedPhoneLayout(phone));
    setIndexedDbPersistence(container);
    const store = container.resolve(ItemStore);
    await store.ready();
    store.upsertMany([
        sampleIssue('i1'),
        { ...sampleIssue('i2'), number: 2 },
        { ...samplePullRequest('p3'), number: 3 },
    ]);

    const history = createBrowserLikeHistory();
    const router = createRouter({
        history,
        routes: [
            ...ITEM_PAGE_PATHS.map((path, index) => ({
                path,
                name: index === 0 ? 'item-issue' : 'item-pull',
                component: ItemPage,
                meta: { itemPage: true },
            })),
            { path: '/:path(.*)*', component: { render: () => null } },
        ],
    });
    for (const visit of visits) {
        await router.push(visit);
    }

    const app = createApp({ render: () => h(RouterView) });
    app.use(IocPlugin, { container });
    app.use(router);
    const root = document.createElement('div');
    root.style.height = '800px';
    document.body.append(root);
    app.mount(root);
    onTestFinished(() => {
        app.unmount();
        root.remove();
    });

    return { router, history, navigation: container.resolve(ItemNavigation) };
}

/**
 * A memory history that keeps the entry behind in each entry's state (`back`), as the browser's history does: what back
 * on a phone reads. Its entries, and which is on screen, for a test to tell Back from a new entry.
 */
function createBrowserLikeHistory() {
    const memory = createMemoryHistory();
    const visited: string[] = [];
    let position = -1;
    const history: RouterHistory = {
        get location() {
            return memory.location;
        },
        get state() {
            return memory.state;
        },
        base: memory.base,
        createHref: href => memory.createHref(href),
        push(to, data) {
            memory.push(to, { ...data, back: memory.location || null });
            position++;
            visited.splice(position, Infinity, to);
        },
        replace(to, data) {
            memory.replace(to, { ...data, back: memory.state.back ?? null });
            visited[Math.max(position, 0)] = to;
            position = Math.max(position, 0);
        },
        go(delta, triggerListeners) {
            position = Math.max(0, Math.min(position + delta, visited.length - 1));
            memory.go(delta, triggerListeners);
        },
        listen: callback => memory.listen(callback),
        destroy: () => memory.destroy(),
    };

    return Object.assign(history, {
        entries: () => [...visited],
        position: () => position,
    });
}
