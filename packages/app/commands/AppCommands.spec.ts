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
import type { AppUpdateShape, UpdateNotice, UpdateState } from '@/services/AppUpdate.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import { Browser } from '@/services/Browser.js';
import type { BrowserShape } from '@/services/Browser.js';
import { CONFIRM_STABLE_PATH } from '@/settings/settingsRoutes.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { PROJECT_PATHS, REPOSITORY_PATH, WORKFLOW_RUN_PATH } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

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
    await expect.element(menu.getByRole('option', { name: /Check for updates/ })).not.toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /Switch to/ })).not.toBeInTheDocument();
});

test('while an update is ready the menu offers "Restart to update" and "Update later"; Later takes only itself away', async () => {
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
    await expect.element(menu.getByRole('option', { name: /^Restart to update\s*githq 1\.4\.0$/ })).toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /^Update later/ })).not.toBeInTheDocument();
});

test('"Restart to update" restarts into the update', async () => {
    const update = createUpdate('1.4.0');
    mount(update);

    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await userEvent.keyboard('restart to update{Enter}');

    expect(update.restart).toHaveBeenCalledOnce();
});

test('"Check for updates" is always there in the desktop app, and is the only update command at rest on Windows', async () => {
    const update = createFakeUpdate({ canChoose: false });
    mount(update);

    await openMenu();
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /Switch to/ })).not.toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /Restart to update/ })).not.toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /Try again/ })).not.toBeInTheDocument();

    await userEvent.keyboard('check for updates{Enter}');
    expect(update.check).toHaveBeenCalledOnce();
});

test('the menu offers only the stream not chosen; a stable version switches at once', async () => {
    const development = createFakeUpdate({ version: '0.2.0', stream: 'development' });
    const router = mount(development);

    await openMenu();
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /Switch to Development/ })).not.toBeInTheDocument();
    await userEvent.keyboard('switch to stable{Enter}');
    expect(development.setStream).toHaveBeenCalledExactlyOnceWith('stable');
    expect(router.currentRoute.value.fullPath).toBe('/');
});

test('from a stable version to Development runs at once', async () => {
    const stable = createFakeUpdate({ version: '0.2.0', stream: 'stable' });
    mount(stable);

    await openMenu();
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /Switch to Stable/ })).not.toBeInTheDocument();
    await userEvent.keyboard('switch to development{Enter}');
    expect(stable.setStream).toHaveBeenCalledExactlyOnceWith('development');
});

test('a Development build never switches to Stable from the menu: it goes to the confirmation in Settings', async () => {
    const update = createFakeUpdate({ version: '0.3.0-dev.214', stream: 'development' });
    const router = mount(update);

    await openMenu();
    await userEvent.keyboard('switch to stable{Enter}');

    await expect.poll(() => router.currentRoute.value.fullPath).toBe(CONFIRM_STABLE_PATH);
    expect(update.setStream).not.toHaveBeenCalled();
});

test('after a failed install the menu offers trying again and Later', async () => {
    const update = createFakeUpdate({ activity: { kind: 'installFailed', version: '1.4.0' } });
    mount(update);

    await openMenu();
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /^Update later/ })).toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /Restart to update/ })).not.toBeInTheDocument();
    await userEvent.keyboard('try again{Enter}');
    expect(update.restart).toHaveBeenCalledOnce();
});

test('a failed install put off by Later can still be tried again from the menu', async () => {
    const update = createFakeUpdate({ activity: { kind: 'installFailed', version: '1.4.0' } });
    mount({ ...update, notice: null });

    await openMenu();
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /^Try again/ })).toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /^Update later/ })).not.toBeInTheDocument();
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

for (const path of ['/', '/settings', '/orgs/acme/projects/1']) {
    test(`at ${path}, with no repository, the menu has no chip and no group of one`, async () => {
        const router = mount();
        await router.push(path);

        await openMenu();
        const menu = page.getByRole('listbox', { name: 'Command menu' });
        await expect.element(menu.getByRole('option', { name: /^Sign out/ })).toBeInTheDocument();
        await expect.element(menu.getByRole('option', { name: /^Open on GitHub/ })).not.toBeInTheDocument();
        await expect.element(menu.getByRole('option', { name: /^Copy link/ })).not.toBeInTheDocument();
        await expect.element(page.getByText('Remove context')).not.toBeInTheDocument();
    });
}

test("an item opened over a list elsewhere names the item's repository, over a repository's screen that screen's", async () => {
    const router = mount();
    const pane = '?pane=issue&issue=acme%7Capi%7C1';

    await router.push(`/orgs/acme/projects/1${pane}`);
    await openMenu();
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('group', { name: 'acme/api' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    for (const screen of ['/acme/web/issues', '/acme/web/actions/runs/7']) {
        await router.push(`${screen}${pane}`);
        await openMenu();
        await expect.element(menu.getByRole('group', { name: 'acme/web' })).toBeInTheDocument();
        await expect.element(menu.getByRole('group', { name: 'acme/api' })).not.toBeInTheDocument();
        await userEvent.keyboard('{Escape}');
    }
});

test("off its view the repository's group has its sections, page, link and settings, none of them on a key", async () => {
    const router = await mount({ tracked: ['acme/web'] });
    await router.push('/acme/web/actions/runs/7');

    await openMenu();
    const group = page.getByRole('listbox', { name: 'Command menu' }).getByRole('group', { name: 'acme/web' });
    for (const title of ['Issues', 'Pull requests', 'Commits', 'Workflows', 'Repository settings', 'Copy link']) {
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
    await expect.element(group.getByRole('option', { name: 'Repository settings', exact: true })).toBeInTheDocument();
    for (const title of ['Issues', 'Pull requests', 'Commits', 'Workflows']) {
        await expect.element(group.getByRole('option', { name: title })).not.toBeInTheDocument();
    }
});

test('a repository that is not tracked is offered Commits but neither Workflows nor its settings', async () => {
    const router = await mount({});
    await router.push('/acme/web/actions/runs/7');

    await openMenu();
    const group = page.getByRole('listbox', { name: 'Command menu' }).getByRole('group', { name: 'acme/web' });
    await expect.element(group.getByRole('option', { name: 'Commits', exact: true })).toBeInTheDocument();
    await expect.element(group.getByRole('option', { name: 'Workflows' })).not.toBeInTheDocument();
    await expect
        .element(group.getByRole('option', { name: 'Repository settings', exact: true }))
        .not.toBeInTheDocument();
});

test('a repository that is not tracked ends its group with "Track repository", which never comes with "Stop tracking"', async () => {
    const router = await mount({});
    await router.push('/acme/web/issues');

    await openMenu();
    const group = page.getByRole('listbox', { name: 'Command menu' }).getByRole('group', { name: 'acme/web' });
    await expect.element(group.getByRole('option', { name: /^Track repository/ })).toBeInTheDocument();
    expect(group.getByRole('option').elements().at(-1)?.textContent).toMatch(/^Track repository/);
    await expect.element(group.getByRole('option', { name: /^Stop tracking/ })).not.toBeInTheDocument();
});

test('a tracked repository is offered neither "Track repository" nor "Stop tracking"', async () => {
    const router = await mount({ tracked: ['acme/web'] });
    await router.push('/acme/web/issues');

    await openMenu();
    const menu = page.getByRole('listbox', { name: 'Command menu' });
    await expect.element(menu.getByRole('option', { name: /^Copy link/ })).toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /^Track repository/ })).not.toBeInTheDocument();
    await expect.element(menu.getByRole('option', { name: /^Stop tracking/ })).not.toBeInTheDocument();
});

async function openMenu() {
    await userEvent.keyboard('{ControlOrMeta>}k{/ControlOrMeta}');
    await expect.element(page.getByRole('listbox', { name: 'Command menu' })).toBeInTheDocument();
}

/** An update ready to run, whose segment `later` hides as the desktop app's does. */
function createUpdate(version: string) {
    const hidden = shallowRef(false);
    const update = createFakeUpdate({ activity: { kind: 'ready', version } });
    return {
        ...update,
        get notice(): UpdateNotice | null {
            return hidden.value ? null : { kind: 'ready', version };
        },
        later: vi.fn(() => {
            hidden.value = true;
        }),
    } satisfies AppUpdateShape;
}

/** The desktop app's updates, in the state given. */
function createFakeUpdate(state: Partial<UpdateState>) {
    const activity = state.activity ?? { kind: 'idle' };
    return {
        state: {
            version: '1.3.0',
            commit: null,
            stream: 'stable',
            canChoose: true,
            manual: false,
            checkedAt: null,
            activity,
            ...state,
        },
        notice: activity.kind === 'installFailed' || activity.kind === 'ready' ? activity : null,
        check: vi.fn(),
        setStream: vi.fn(),
        restart: vi.fn(),
        later: vi.fn(),
        dismiss: vi.fn(),
        previousVersion: null,
        untoldChange: null,
        markUpdateTold: vi.fn(),
    } satisfies AppUpdateShape;
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
    const container = createAppContainer();
    container.set(Browser, createSignedInBrowser(fetch));
    return { container, router: render(container) };
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
    const container = createAppContainer();
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

function createAppContainer() {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    setIndexedDbPersistence(container);
    return container;
}

function render(container: VueContainer) {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: REPOSITORY_PATH, name: 'repository', component: defineComponent({ render: () => null }) },
            { path: WORKFLOW_RUN_PATH, component: defineComponent({ render: () => null }) },
            ...PROJECT_PATHS.map(path => ({ path, component: defineComponent({ render: () => null }) })),
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
