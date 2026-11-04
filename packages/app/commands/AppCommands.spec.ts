import type { RepositoryBrowseSearchQuery } from '@githq/github/generated.gen.js';
import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import type { VueContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, shallowRef } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { AppUpdateShape } from '@/services/AppUpdate.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import { Browser } from '@/services/Browser.js';
import type { BrowserShape } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';

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

test('Search repositories: asks once typing pauses, nothing under two characters, and Enter goes to the pick', async () => {
    const github = createGitHubSearch();
    const { router } = mountSigned(github.fetch);

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}search repositories');
    await expect
        .element(page.getByRole('option', { name: /^Search repositories… Any repository on GitHub/u }))
        .toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    const field = page.getByRole('textbox', { name: 'Search GitHub for a repository…' });
    await expect.element(field).toHaveFocus();

    await userEvent.keyboard('v');
    await wait(400);
    expect(github.asked).toEqual([]);

    await userEvent.keyboard('ite org:vitejs');
    await expect.poll(() => github.asked).toEqual(['vite org:vitejs']);
    github.answer('vite org:vitejs', ['vitejs/vite']);

    await expect.element(page.getByRole('option', { name: /^vitejs\/vite/u })).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => router.currentRoute.value.path).toMatch(/^\/vitejs\/vite/u);
    expect(github.asked).toEqual(['vite org:vitejs']);
});

test('Search repositories: an answer for older text is dropped', async () => {
    const github = createGitHubSearch();
    mountSigned(github.fetch);
    await openRepositorySearch();

    await userEvent.keyboard('vite');
    await expect.poll(() => github.asked).toEqual(['vite']);
    await userEvent.keyboard('st');
    await expect.poll(() => github.asked).toEqual(['vite', 'vitest']);

    github.answer('vitest', ['vitest-dev/vitest']);
    await expect.element(page.getByRole('option', { name: /^vitest-dev\/vitest/u })).toBeInTheDocument();
    github.answer('vite', ['vitejs/vite']);
    await flushAnswers();

    await expect.element(page.getByRole('option', { name: /^vitest-dev\/vitest/u })).toBeInTheDocument();
    await expect.element(page.getByRole('option', { name: /^vitejs\/vite/u })).not.toBeInTheDocument();
});

test('Search repositories: an answer for an ended session is dropped', async () => {
    const github = createGitHubSearch();
    const { container } = mountSigned(github.fetch);
    await openRepositorySearch();

    await userEvent.keyboard('vite');
    await expect.poll(() => github.asked).toEqual(['vite']);
    container.resolve(AuthStore).signOut();
    github.answer('vite', ['vitejs/vite']);
    await flushAnswers();

    await expect.element(page.getByRole('option', { name: /^vitejs\/vite/u })).not.toBeInTheDocument();
});

test('Search repositories: leaving the submenu inside the pause asks nothing, and coming back starts clean', async () => {
    const github = createGitHubSearch();
    mountSigned(github.fetch);
    await openRepositorySearch();

    await userEvent.keyboard('vite{Escape}');
    await expect.element(page.getByRole('listbox', { name: 'Command menu' })).toBeInTheDocument();
    await wait(400);
    expect(github.asked).toEqual([]);

    await userEvent.keyboard('search repositories{Enter}');
    await expect.element(page.getByText('Type at least two characters')).toBeInTheDocument();
});

test('Search repositories: a failed search says so', async () => {
    mountSigned(() => Promise.resolve(Response.json({ message: 'Bad' }, { status: 502 })));
    await openRepositorySearch();

    await userEvent.keyboard('vite');
    await expect.element(page.getByText(/GitHub did not answer/u)).toBeInTheDocument();
    await expect.element(page.getByText(/Nothing on GitHub matches/u)).not.toBeInTheDocument();
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

/** A GitHub whose search answers only when told to, and what it was asked. */
function createGitHubSearch() {
    const asked: string[] = [];
    const waiting = new Map<string, (answer: Response) => void>();
    const fetch: BrowserShape['fetch'] = (_input, init) => {
        const body = typeof init?.body === 'string' ? init.body : '';
        if (!body.includes('query RepositoryBrowseSearch')) {
            return Promise.resolve(Response.json({ message: 'Server Error' }, { status: 502 }));
        }

        const query = /"variables":\{"query":"(?<query>[^"]*)"/u.exec(body)?.groups?.query ?? '';
        asked.push(query);
        return new Promise(resolve => {
            waiting.set(query, resolve);
        });
    };

    return { asked, fetch, answer };

    function answer(query: string, names: readonly string[]) {
        const data: RepositoryBrowseSearchQuery = {
            search: {
                nodes: names.map(nameWithOwner => ({ nameWithOwner, description: null, isPrivate: false })),
            },
        };
        waiting.get(query)?.(Response.json({ data }));
    }
}

async function openRepositorySearch() {
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}search repositories{Enter}');
    await expect.element(page.getByRole('textbox', { name: 'Search GitHub for a repository…' })).toHaveFocus();
}

/** Long enough for an answer told to arrive to be drawn, were it kept. */
async function flushAnswers() {
    await wait(50);
}

function wait(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

/** The app's commands for a signed-in user whose GitHub answers with `fetch`. */
function mountSigned(fetch: BrowserShape['fetch']) {
    const container = createContainer();
    container.set(Browser, createSignedInBrowser(fetch));
    return { container, router: mountIn(container) };
}

/** The app's commands in an app of their own; `update` stands in for the desktop app's updates. */
function mount(update?: AppUpdateShape) {
    const container = createContainer();
    if (update) {
        container.set(AppUpdate, update);
    }

    return mountIn(container);
}

function mountIn(container: VueContainer) {
    container.set(LanguageContext, () => APP_LANGUAGE);
    setIndexedDbPersistence(container);

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
