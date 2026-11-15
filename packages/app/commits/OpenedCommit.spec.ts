import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView, useRoute } from 'vue-router';

import ItemPage from '@/item/ItemPage.vue';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import { sampleCommit } from '@/testing/sampleCommits.js';

import { COMMIT_PAGE_PATH, CommitRoutes } from './commitRoutes.js';
import OpenedCommit from './OpenedCommit.vue';

const COMMITS = '/acme/web/commits';
const OID = 'abcdef1234567890abcdef1234567890abcdef12';
const FIRST_PARENT = '1111111111111111111111111111111111111111';
const SECOND_PARENT = '2222222222222222222222222222222222222222';
const GRANDPARENT = '3333333333333333333333333333333333333333';
const PULL_REQUEST_URL = 'https://github.com/acme/web/pull/1228';

test('a short sha in the address settles on the full lowercase oid, in place of the address', async () => {
    const { router } = await mountOpened(['/elsewhere', `/acme/web/commit/${OID.slice(0, 7).toUpperCase()}`]);

    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(`/acme/web/commit/${OID}`));
    await expect.element(page.getByRole('heading', { name: `Commit ${OID}` })).toBeVisible();

    router.back();
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/elsewhere'));
});

test('P and ⇧P open a parent in place of the commit, replacing the address; Esc closes it back to the Commits section', async () => {
    const { router } = await mountOpened([COMMITS, panelPath(OID)]);
    await expect.element(page.getByRole('heading', { name: `Commit ${OID}` })).toBeVisible();

    await userEvent.keyboard('p');
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(panelPath(FIRST_PARENT)));
    router.back();
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(COMMITS));

    await router.push(panelPath(OID));
    await expect.element(page.getByRole('heading', { name: `Commit ${OID}` })).toBeVisible();
    await userEvent.keyboard('{Shift>}p{/Shift}');
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(panelPath(SECOND_PARENT)));

    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(COMMITS));
});

test("⇧↵ opens its pull request as any item opens: in the panel's place, Back returning to the commit; from its page, the pull request's page", async () => {
    const { router } = await mountOpened([COMMITS, panelPath(OID)]);
    await expect.element(page.getByRole('button', { name: /#1228/ })).toBeVisible();

    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await vi.waitFor(() =>
        expect(router.currentRoute.value.fullPath).toBe(`${COMMITS}?pane=issue&issue=acme|web|1228`),
    );
    router.back();
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(panelPath(OID)));

    await router.push(`/acme/web/commit/${OID}`);
    await expect.element(page.getByRole('button', { name: /#1228/ })).toBeVisible();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/acme/web/pull/1228'));
});

test("the graph's list lying over the graph takes Escape before the commit closes", async () => {
    const { router, store } = await mountOpened([COMMITS, panelPath(OID)]);
    await expect.element(page.getByRole('heading', { name: `Commit ${OID}` })).toBeVisible();
    let listOpen = true;
    const removeTaker = store.addEscapeTaker(() => {
        const took = listOpen;
        listOpen = false;
        return took;
    });
    onTestFinished(removeTaker);

    await userEvent.keyboard('{Escape}');
    expect(listOpen).toBe(false);
    expect(router.currentRoute.value.fullPath).toBe(panelPath(OID));

    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(COMMITS));
});

test("J/K: on its page they step through the list of commits it was opened from; in the panel they are the graph's", async () => {
    const { router, navigation } = await mountOpened([COMMITS, `/acme/web/commit/${OID}`]);
    navigation.setList({
        kind: 'commit',
        path: COMMITS,
        title: 'Commits',
        steps: [key(OID), key(FIRST_PARENT)],
        stepOf: new Map(),
        around: null,
    });
    await expect.element(page.getByRole('heading', { name: `Commit ${OID}` })).toBeVisible();

    await userEvent.keyboard('j');
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe(`/acme/web/commit/${FIRST_PARENT}`));

    await router.push(panelPath(OID));
    await expect.element(page.getByRole('heading', { name: `Commit ${OID}` })).toBeVisible();
    await userEvent.keyboard('j');
    await wait(100);
    expect(router.currentRoute.value.fullPath).toBe(panelPath(OID));
});

test('what it shows is read once it rests on a commit: two moves in a row read only where they stop', async () => {
    const { router, github } = await mountOpened([COMMITS, panelPath(OID)]);
    await expect.element(page.getByRole('heading', { name: `Commit ${OID}` })).toBeVisible();
    await vi.waitFor(() => expect(github.requests).toContain('CommitDetail'));
    const before = github.requests.length;

    await userEvent.keyboard('pp');
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(panelPath(GRANDPARENT)));
    await vi.waitFor(() =>
        expect(github.requests.slice(before).filter(request => request === 'CommitDetail')).toHaveLength(1),
    );
    await wait(300);
    expect(github.requests.slice(before).filter(request => request === 'CommitDetail')).toHaveLength(1);
});

/** Longer than a key's effect or the read's pause takes, for a test that nothing came of it. */
function wait(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function panelPath(oid: string) {
    return `${COMMITS}?pane=commit&commit=acme|web|${oid}`;
}

function key(oid: string) {
    return CommitRoutes.formatKey({ owner: 'acme', name: 'web', oid });
}

/**
 * The commit opened over the real store and a GitHub holding a merge (two parents, the first with a parent of its own)
 * whose pull request is #1228: in the panel over the Commits section, or on its page, as the shell and `ItemPage` show
 * it. `visits` are pushed in order.
 */
async function mountOpened(visits: readonly string[]) {
    const { container, store, github, ready } = createCommitGraphTest({
        commits: [
            sampleCommit(OID, 30, [FIRST_PARENT, SECOND_PARENT]),
            sampleCommit(FIRST_PARENT, 20, [GRANDPARENT]),
            sampleCommit(SECOND_PARENT, 15, [GRANDPARENT]),
            sampleCommit(GRANDPARENT, 10),
        ],
        states: new Map([
            [
                OID,
                {
                    pullRequest: {
                        number: 1228,
                        state: 'OPEN',
                        title: 'Booking time',
                        url: PULL_REQUEST_URL,
                        isDraft: false,
                    },
                    ci: null,
                },
            ],
        ]),
    });
    await ready;

    const section = defineComponent({
        setup() {
            const route = useRoute();
            return () => {
                const opened = CommitRoutes.getOpened(route);
                return opened && !opened.onPage
                    ? h(OpenedCommit, { reference: opened.reference, arrangement: 'panel' })
                    : null;
            };
        },
    });
    const elsewhere = defineComponent({ render: () => null });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            // As `app/router.options.ts` has them: the Commits section a list an item opens over, the commit's page.
            { path: '/:owner/:name/commits', name: 'repository', component: section, meta: { itemPanel: true } },
            { path: COMMIT_PAGE_PATH, name: 'commit-page', component: ItemPage, meta: { itemPage: 'commit' } },
            { path: '/:path(.*)*', component: elsewhere },
        ],
    });
    for (const visit of visits) {
        await router.push(visit);
    }

    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.width = '800px';
    host.style.height = '600px';
    document.body.append(host);
    const app = createApp({ setup: () => () => h(RouterView) });
    app.use(IocPlugin, { container });
    app.use(router);
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { router, store, github, navigation: container.resolve(ItemNavigation) };
}
