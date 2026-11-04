import type { RepositoryIssuesQuery } from '@githq/github/generated.gen.js';
import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView, useRoute } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { RepositoryHolds } from '@/repos/RepositoryHolds.js';
import { Browser } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { sampleIssueNode } from '@/testing/sampleRowNodes.js';
import { setIndexedDbPersistence } from '@/testing/setIndexedDbPersistence.js';
import { getRouteNameWithOwner } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import RepositoryPage from './RepositoryPage.vue';

// The page with its real services over a fake GitHub: what it asks of GitHub, and when, is what is proven here.

const WEB = 'acme/web';
const UPDATED_AT = '2026-10-30T13:20:00Z';

test('not tracked, it reads the section shown, its other state when chosen, and nothing on Commits', async () => {
    const { github } = await open({ path: `/${WEB}/issues` });

    await expect.element(rowOf('Issue I_open')).toBeVisible();
    await expect.element(page.getByText('1 of 7', { exact: true })).toBeVisible();
    expect(github.issuePages()).toEqual([{ states: ['OPEN'], after: null }]);

    await userEvent.click(page.getByRole('button', { name: 'Open', exact: true }));
    await userEvent.click(page.getByRole('menuitemradio', { name: 'Closed', exact: true }));
    await expect.element(rowOf('Issue I_closed')).toBeVisible();
    await expect.element(rowOf('Issue I_open')).not.toBeInTheDocument();
    expect(github.issuePages().at(-1)).toEqual({ states: ['CLOSED'], after: null });

    const asked = github.operations().length;
    await userEvent.keyboard('3');
    await expect.element(page.getByRole('heading', { name: WEB, level: 1 })).toBeVisible();
    await settle();
    expect(github.operations().slice(asked).filter(isItemRead)).toEqual([]);
});

test('on Commits from the start, no item is read and no permission asked', async () => {
    const { github } = await open({ path: `/${WEB}/commits` });

    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
    await settle();
    expect(github.operations().filter(isItemRead)).toEqual([]);
});

test('tracked, nothing is read on demand, and untracked from the screen it goes on to be read with its rows kept', async () => {
    const { github, tracking } = await open({ path: `/${WEB}/issues`, tracked: true });

    await expect.element(page.getByRole('button', { name: /^Issues/ })).toBeVisible();
    await settle();
    expect(github.issuePages()).toEqual([]);
    expect(github.operations()).toContain('RepositoryMetadata');
    await expect.element(page.getByText('not tracked', { exact: true })).not.toBeInTheDocument();

    tracking.choose({ repositories: [], projects: [] });
    await expect.element(page.getByText('not tracked', { exact: true })).toBeVisible();
    await expect.element(rowOf('Issue I_open')).toBeVisible();
    expect(github.issuePages()).toEqual([{ states: ['OPEN'], after: null }]);
});

test("GitHub's own name replaces the address, at the same section with its query and hash, and the rows stay", async () => {
    const { router } = await open({ path: '/ACME/Web/issues?panel=1#top', actualName: WEB });

    await expect.poll(() => router.currentRoute.value.fullPath).toBe(`/${WEB}/issues?panel=1#top`);
    await expect.element(rowOf('Issue I_open')).toBeVisible();
});

test('the page holds the repository, tracked or not, and leaving it stops the reading while the hold lasts', async () => {
    const { github, holds, router } = await open({ path: `/${WEB}/issues` });
    expect(holds.isHeld(WEB)).toBe(true);
    await expect.element(rowOf('Issue I_open')).toBeVisible();

    await router.push('/acme/hidden/issues');
    await expect.element(page.getByRole('heading', { name: 'GitHub does not show this repository' })).toBeVisible();
    expect(holds.isHeld(WEB)).toBe(true);
    expect(holds.isHeld('acme/hidden')).toBe(true);
    // One first page each: leaving, the page never asked anything more of the repository it left.
    expect(github.issuePages()).toEqual([
        { states: ['OPEN'], after: null },
        { states: ['OPEN'], after: null },
    ]);
});

test('not tracked, a hidden tab asks GitHub nothing about it, its permission included, until it is shown', async () => {
    const { github, setVisible } = await open({ path: `/${WEB}/issues`, hidden: true });

    await expect.element(page.getByRole('heading', { name: WEB, level: 1 })).toBeInTheDocument();
    await settle();
    expect(github.operations().filter(isAboutRepository)).toEqual([]);

    setVisible(true);
    await expect
        .poll(() => github.operations().filter(isAboutRepository).toSorted())
        .toEqual(['RepositoryIssues', 'RepositoryMetadata']);
});

test('tracked, a hidden tab reads its permission as ever', async () => {
    const { github } = await open({ path: `/${WEB}/issues`, tracked: true, hidden: true });

    await expect.poll(() => github.operations()).toContain('RepositoryMetadata');
});

test('another account signed in where the page stands holds the repository for itself and reads under that hold', async () => {
    const { auth, github, holds } = await open({ path: `/${WEB}/issues` });
    await expect.element(rowOf('Issue I_open')).toBeVisible();
    const asked = github.issuePages().length;

    const another = `user-${crypto.randomUUID()}`;
    github.signsIn = another;
    await auth.signInWithToken('gho_another');

    await expect.poll(() => auth.viewer?.login).toBe(another);
    await expect.poll(() => holds.isHeld(WEB)).toBe(true);
    await expect.poll(() => github.issuePages().length).toBe(asked + 1);
    expect(holds.isHeld(WEB)).toBe(true);
});

interface OpenOptions {
    readonly path: string;
    /** The tab is hidden when the page opens. */
    readonly hidden?: boolean;
    readonly tracked?: boolean;
    /** GitHub's name of `acme/web`, when asked by another. */
    readonly actualName?: string;
}

/** The page at an address as the app's router has it: remounted by repository, signed in, with GitHub faked. */
async function open({ path, tracked = false, actualName = WEB, hidden = false }: OpenOptions) {
    const github = createFakeGitHub(actualName);
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    let visible = !hidden;
    const visibilityListeners: (() => void)[] = [];
    container.set(Browser, {
        ...createSignedInBrowser(github.fetch),
        isVisible: () => visible,
        onVisibilityChange: listener => {
            visibilityListeners.push(listener);
        },
    });
    setIndexedDbPersistence(container);
    const tracking = container.resolve(TrackingStore);
    await tracking.ready();
    if (tracked) {
        tracking.choose({ repositories: [{ nameWithOwner: WEB, id: 'R_web' }], projects: [] });
    }

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:owner/:name/:section?', component: RepositoryPage }],
    });
    await router.push(path);
    const host = document.createElement('div');
    host.style.height = '100vh';
    host.style.display = 'flex';
    host.style.width = '1400px';
    document.body.append(host);
    const app = createApp(
        defineComponent({
            setup() {
                const route = useRoute();
                return () => h(RouterView, { key: getRouteNameWithOwner(route) });
            },
        }),
    );
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return {
        github,
        tracking,
        router,
        holds: container.resolve(RepositoryHolds),
        auth: container.resolve(AuthStore),
        setVisible: (value: boolean) => {
            visible = value;
            for (const listener of visibilityListeners) {
                listener();
            }
        },
    };
}

/** GitHub with `acme/web` of one open and one closed issue listed and more behind them; any other repository hidden. */
function createFakeGitHub(actualName: string) {
    const requests: { readonly operation: string; readonly variables: Record<string, unknown> }[] = [];

    const github = {
        /** Whom GitHub says a token belongs to; until set, it does not answer that. */
        signsIn: null as string | null,
        operations: () => requests.map(request => request.operation),
        issuePages: () =>
            requests
                .filter(request => request.operation === 'RepositoryIssues')
                .map(({ variables }) => ({ states: variables.states, after: variables.after ?? null })),
        fetch: (_input: RequestInfo | URL, init?: RequestInit) => {
            const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
            if (!isGraphQLBody(body)) {
                return Promise.resolve(Response.json([], { status: 200 }));
            }

            const operation = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1] ?? '';
            requests.push({ operation, variables: body.variables });
            return Promise.resolve(Response.json({ data: answer(operation, body.variables) }));
        },
    };

    return github;

    function answer(operation: string, variables: Record<string, unknown>) {
        const known = String(variables.name).toLowerCase() === 'web';
        switch (operation) {
            case 'RepositoryIssues':
                return issuesPage(known, variables);
            case 'RepositoryMetadata':
                return { repository: null };
            case 'Viewer':
                return github.signsIn === null
                    ? null
                    : { viewer: { login: github.signsIn, name: null, avatarUrl: 'https://avatars.test/another' } };
            default:
                return null;
        }
    }

    function issuesPage(known: boolean, variables: Record<string, unknown>): RepositoryIssuesQuery {
        if (!known) {
            return { repository: null };
        }

        const closed = Array.isArray(variables.states) && variables.states.includes('CLOSED');
        const node = closed
            ? sampleIssueNode('I_closed', { repository: actualName, number: 2, updatedAt: UPDATED_AT, open: false })
            : sampleIssueNode('I_open', { repository: actualName, number: 1, updatedAt: UPDATED_AT });
        return {
            repository: {
                nameWithOwner: actualName,
                issues: {
                    totalCount: 7,
                    pageInfo: { hasNextPage: false, endCursor: null },
                    nodes: [node],
                },
            },
        };
    }
}

function isGraphQLBody(body: unknown): body is { query: string; variables: Record<string, unknown> } {
    return typeof body === 'object' && body !== null && 'query' in body && typeof body.query === 'string';
}

function isItemRead(operation: string) {
    return operation === 'RepositoryIssues' || operation === 'RepositoryPullRequests';
}

/** What the screen itself may ask about the repository it shows. */
function isAboutRepository(operation: string) {
    return isItemRead(operation) || operation === 'RepositoryMetadata';
}

function rowOf(title: string) {
    return page.getByRole('listitem').filter({ hasText: title });
}

/** Long enough for a read that was going to be asked to have been. */
async function settle() {
    await new Promise(resolve => {
        setTimeout(resolve, 150);
    });
}
