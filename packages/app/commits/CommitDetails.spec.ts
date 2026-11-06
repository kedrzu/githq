import { createPromise } from '@nzyme/utils/createPromise.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page } from 'vitest/browser';
import { createApp, defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import type { CommitGraphTestOptions } from '@/testing/createCommitGraphTest.js';
import {
    SAMPLE_COMMITS_NOW,
    sampleCheckRun,
    sampleCommit,
    sampleCommitRef,
    sampleWebappHistory,
} from '@/testing/sampleCommits.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import CommitDetails from './CommitDetails.vue';
import type { CommitRowRef } from './CommitRow.vue';

const REPOSITORY = 'acme/web';
const CHECKS_ON_GITHUB = 'The checks are listed on GitHub';

/** How {@link mount} shows the panel. */
interface MountOptions {
    readonly refs?: readonly CommitRowRef[];
    /** `acme/web` is tracked. */
    readonly tracked?: boolean;
    /** The width of the column the panel fills. */
    readonly width?: number;
}

test('a hostile message is text, never markup, its line breaks kept', async () => {
    const hostile = '<img src=x onerror="window.hacked = true">\n<script>window.hacked = true</script>';
    const commit = { ...sampleCommit('c1', 10), headline: '<b onmouseover="window.hacked = true">bold</b>' };
    const { panel } = await mount({ commits: [commit], bodies: new Map([['c1', hostile]]) }, 'c1');

    await expect.element(panel.getByText('<img src=x', { exact: false })).toBeVisible();
    const root = panel.element();
    expect(root.querySelector('img[src="x"], script, b')).toBeNull();
    expect(root.querySelector('h2')?.textContent).toBe(commit.headline);
    const body = [...root.querySelectorAll('p')].find(element => element.textContent.includes('<script>'));
    expect(body?.textContent.trim()).toBe(hostile);
    expect(body && getComputedStyle(body).whiteSpace).toBe('pre-wrap');
    expect('hacked' in window).toBe(false);
});

test('CH18: what it says of a commit: author, when, sha, parent, refs, pull request and CI, with no count of failing checks', async () => {
    const { panel, store } = await mount(sampleWebappHistory(), 'a2', {
        refs: [{ name: 'fix/booking-tz', kind: 'branch' }],
    });

    await expect
        .element(panel.getByRole('heading', { name: "fix: booking time uses the studio's timezone" }))
        .toBeVisible();
    await expect.element(panel).toHaveTextContent('Marta Laine');
    await expect.element(panel).toHaveTextContent('mlaine');
    await expect.element(panel).toHaveTextContent(/ago · \w+ \d+, \d\d:\d\d/);
    await expect.element(panel.getByRole('heading', { name: 'Parent', exact: true })).toBeVisible();
    await expect.element(panel.getByRole('button', { name: /chore: bump vite to 6\.2/ })).toBeVisible();
    await expect.element(panel.getByRole('heading', { name: 'Branches and tags here' })).toBeVisible();
    await expect.element(panel.getByText('fix/booking-tz')).toBeVisible();
    await expect.element(panel.getByRole('button', { name: /Pull request 1228/ })).toBeVisible();
    await expect.element(panel).toHaveTextContent('#1228');
    await expect.element(panel.getByRole('img', { name: 'Open pull request' })).toBeVisible();
    await expect.element(panel.getByRole('img', { name: 'Checks failing' })).toBeVisible();
    await expect.element(panel.getByText('Failing')).toBeVisible();
    // GitHub listed none of them: the rollup stays, and nothing was failed to read.
    await expect.poll(() => store.getChecks(REPOSITORY, 'a2')?.kind).toBe('read');
    await expect.element(panel.getByText('Failing')).toBeVisible();
    await expect.element(panel.getByRole('link', { name: CHECKS_ON_GITHUB })).not.toBeInTheDocument();
    await expect
        .element(panel.getByRole('link', { name: 'Open on GitHub' }))
        .toHaveAttribute('href', 'https://github.com/acme/web/commit/a2');
});

test('a long subject GitHub cuts in the headline reads whole once read, nothing of it repeated in the body', async () => {
    const commit = { ...sampleCommit('c1', 10), headline: 'feat: render the list like vdom (#16…' };
    const answered = createPromise();
    const { panel } = await mount(
        {
            commits: [commit],
            subjects: new Map([['c1', 'feat: render the list like vdom (#16077)']]),
            bodies: new Map([['c1', 'Why it renders like that.']]),
            holdIf: operation => (operation === 'CommitDetail' ? answered.promise : null),
        },
        'c1',
    );

    // The loaded commit's, until then.
    await expect.element(panel.getByRole('heading', { name: commit.headline })).toBeVisible();
    answered.resolve();
    await expect
        .element(panel.getByRole('heading', { name: 'feat: render the list like vdom (#16077)' }))
        .toBeVisible();
    await expect.element(panel).toHaveTextContent('Why it renders like that.');
    expect([...panel.element().querySelectorAll('p')].some(element => element.textContent.includes('077)'))).toBe(
        false,
    );
});

test('CH34: the pull request and CI not known yet: their titles over an empty bar, gone once a commit is known to have neither', async () => {
    const answered = createPromise();
    const { panel } = await mount(
        {
            commits: [sampleCommit('c1', 10)],
            holdIf: operation => (operation === 'CommitStates' ? answered.promise : null),
        },
        'c1',
    );
    const bars = panel.getByRole('img', { name: 'Pull request and checks not known yet' });

    await expect.element(panel.getByRole('heading', { name: 'Pull request' })).toBeVisible();
    await expect.element(panel.getByRole('heading', { name: 'CI on this commit' })).toBeVisible();
    await expect.poll(() => bars.elements().length).toBe(2);

    answered.resolve();
    await expect.element(panel.getByRole('heading', { name: 'Pull request' })).not.toBeInTheDocument();
    await expect.element(panel.getByRole('heading', { name: 'CI on this commit' })).not.toBeInTheDocument();
    await expect.poll(() => bars.elements().length).toBe(0);
});

test('the rollup shows at once, with no note, while the checks are read; the list then takes its place, in order, what passed folded', async () => {
    const answered = createPromise();
    const { panel } = await mount(
        {
            commits: [sampleCommit('c1', 10)],
            states: new Map([['c1', { pullRequest: null, ci: 'FAILURE' }]]),
            checks: new Map([
                [
                    'c1',
                    [
                        sampleCheckRun('lint', 'SUCCESS'),
                        sampleCheckRun('deploy', 'SKIPPED'),
                        sampleCheckRun('e2e', null),
                        sampleCheckRun('build', 'FAILURE'),
                    ],
                ],
            ]),
            holdIf: operation => (operation === 'CommitChecks' ? answered.promise : null),
        },
        'c1',
    );

    await expect.element(panel.getByText('Failing')).toBeVisible();
    await expect.element(panel.getByRole('link', { name: CHECKS_ON_GITHUB })).not.toBeInTheDocument();

    answered.resolve();
    await expect.element(panel.getByText('CI / build')).toBeVisible();
    await expect.element(panel.getByText('Failing')).not.toBeInTheDocument();
    expect(getRowStarts(panel.element())).toEqual(['CI / build', 'CI / e2e', '1 passed · 1 skipped']);

    await panel.getByRole('button', { name: 'Show the checks that passed' }).click();
    expect(getRowStarts(panel.element())).toEqual([
        'CI / build',
        'CI / e2e',
        '1 passed · 1 skipped',
        'CI / lint',
        'CI / deploy',
    ]);
});

test('an Actions job opens in the app in a tracked repository, and on GitHub in a new tab in any other', async () => {
    const options: CommitGraphTestOptions = {
        commits: [sampleCommit('c1', 10)],
        states: new Map([['c1', { pullRequest: null, ci: 'FAILURE' }]]),
        checks: new Map([['c1', [sampleCheckRun('build', 'FAILURE')]]]),
    };
    const log = 'Log · CI / build';

    const tracked = await mount(options, 'c1', { tracked: true });
    const inApp = tracked.panel.getByRole('link', { name: log });
    await expect.element(inApp).toHaveAttribute('href', '/acme/web/actions/runs/123/job/456');
    await expect.element(inApp).not.toHaveAttribute('target');
    expect(inApp.element().querySelector('svg')).toBeNull();
    tracked.unmount();

    const untracked = await mount(options, 'c1');
    const onGitHub = untracked.panel.getByRole('link', { name: log });
    await expect.element(onGitHub).toHaveAttribute('href', 'https://github.com/acme/web/actions/runs/123/job/456');
    await expect.element(onGitHub).toHaveAttribute('target', '_blank');
    expect(onGitHub.element().querySelector('svg')).not.toBeNull();
});

test("in a tracked repository another check's address opens in a new tab, and a check with no address has no link", async () => {
    const { panel } = await mount(
        {
            commits: [sampleCommit('c1', 10)],
            states: new Map([['c1', { pullRequest: null, ci: 'FAILURE' }]]),
            checks: new Map([
                [
                    'c1',
                    [
                        {
                            __typename: 'StatusContext',
                            id: 'S_ci',
                            context: 'ci/external',
                            state: 'FAILURE',
                            targetUrl: 'https://ci.example.com/build/1',
                            createdAt: '2026-10-01T00:00:00Z',
                        },
                        { ...sampleCheckRun('build', 'FAILURE'), detailsUrl: null },
                    ],
                ],
            ]),
        },
        'c1',
        { tracked: true },
    );

    const external = panel.getByRole('link', { name: 'Log · ci/external' });
    await expect.element(external).toHaveAttribute('href', 'https://ci.example.com/build/1');
    await expect.element(external).toHaveAttribute('target', '_blank');
    await expect.element(panel.getByText('CI / build')).toBeVisible();
    await expect.element(panel.getByRole('link', { name: 'Log · CI / build' })).not.toBeInTheDocument();
});

test('a failed read keeps the rollup and links to the checks on GitHub, whatever the rollup; a commit with no checks still has no CI', async () => {
    for (const [ci, word] of [
        ['SUCCESS', 'Passing'],
        ['FAILURE', 'Failing'],
    ] as const) {
        const { panel, unmount } = await mount(
            {
                commits: [sampleCommit('c1', 10)],
                states: new Map([['c1', { pullRequest: null, ci }]]),
                failIf: operation => operation === 'CommitChecks',
            },
            'c1',
        );

        await expect.element(panel.getByText(word)).toBeVisible();
        const link = panel.getByRole('link', { name: CHECKS_ON_GITHUB });
        await expect.element(link).toHaveAttribute('href', 'https://github.com/acme/web/commit/c1/checks');
        await expect.element(link).toHaveAttribute('target', '_blank');
        unmount();
    }

    const none = await mount({ commits: [sampleCommit('c1', 10)], failIf: name => name === 'CommitChecks' }, 'c1');
    await expect.poll(() => none.store.getChecks(REPOSITORY, 'c1')?.kind).toBe('failed');
    await expect.element(none.panel.getByRole('heading', { name: 'CI on this commit' })).not.toBeInTheDocument();
    await expect.element(none.panel.getByRole('link', { name: CHECKS_ON_GITHUB })).not.toBeInTheDocument();
});

test('more checks than a read holds: a link to all of them on GitHub', async () => {
    const { panel } = await mount(
        {
            commits: [sampleCommit('c1', 10)],
            states: new Map([['c1', { pullRequest: null, ci: 'SUCCESS' }]]),
            checks: new Map([['c1', Array.from({ length: 101 }, (_, i) => sampleCheckRun(`job-${i}`, 'SUCCESS'))]]),
        },
        'c1',
    );

    const more = panel.getByRole('link', { name: '1 more on GitHub' });
    await expect.element(more).toHaveAttribute('href', 'https://github.com/acme/web/commit/c1/checks');
    await expect.element(more).toHaveAttribute('target', '_blank');
});

test("in the narrowest panel a check's name gives way and how long it ran stays; the folded row's names cut before its chevron", async () => {
    const long = 'integration-tests-against-the-whole-of-the-staging-environment';
    const { panel } = await mount(
        {
            commits: [sampleCommit('c1', 10)],
            states: new Map([['c1', { pullRequest: null, ci: 'FAILURE' }]]),
            checks: new Map([['c1', [sampleCheckRun(long, 'FAILURE'), sampleCheckRun(`${long}-passing`, 'SUCCESS')]]]),
        },
        'c1',
        { width: 320 },
    );

    const ran = panel.getByText('failed after 2m 14s');
    await expect.element(ran).toBeVisible();
    expect(ran.element().scrollWidth).toBeLessThanOrEqual(ran.element().clientWidth);
    const name = panel.getByText(`CI / ${long}`).element();
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);

    const names = panel.getByText(`${long}-passing`).element();
    expect(names.scrollWidth).toBeGreaterThan(names.clientWidth);
    const chevron = panel.getByRole('button', { name: 'Show the checks that passed' }).element();
    expect(chevron.getBoundingClientRect().right).toBeLessThanOrEqual(panel.element().getBoundingClientRect().right);
});

test('no refs, no pull request, no checks: "None." and nothing more', async () => {
    const { panel } = await mount({ commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)] }, 'c1');

    await expect.element(panel).toHaveTextContent('None.');
    await expect.poll(() => panel.element().querySelectorAll('h3').length).toBe(1);
});

test('D12: a commit not loaded is quiet until it is read, and then drawn from the read', async () => {
    const history = [sampleCommit('c1', 10, ['old'])];
    const options: CommitGraphTestOptions = {
        commits: [...history, sampleCommit('old', 1)],
        branches: [sampleCommitRef('main', 'c1')],
        kept: history,
        holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
    };
    const { panel, store } = await mount(options, 'old');
    await expect.element(panel).toHaveTextContent('Not in the loaded history.');
    await expect.element(panel.getByRole('heading', { name: 'Commit old' })).toBeVisible();
    expect(store.get(REPOSITORY)?.commits.map(commit => commit.oid)).toEqual(['c1']);
});

test('CH40: a read that fails says so quietly: a commit not loaded has the rest of its panel, a loaded one all it knows', async () => {
    const history = [sampleCommit('c1', 10, ['old'])];
    const failing: CommitGraphTestOptions = {
        commits: [...history, sampleCommit('old', 1)],
        branches: [sampleCommitRef('main', 'c1')],
        kept: history,
        holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
        failIf: operation => operation === 'CommitDetail',
    };
    const notLoaded = await mount(failing, 'old');
    await expect.element(notLoaded.panel).toHaveTextContent("GitHub can't be asked for this commit right now.");
    await expect.element(notLoaded.panel.getByRole('link', { name: 'Open on GitHub' })).toBeVisible();
    notLoaded.unmount();

    const loaded = await mount(failing, 'c1');
    await expect
        .element(loaded.panel)
        .toHaveTextContent("GitHub can't be asked for the rest of this message right now.");
    await expect.element(loaded.panel.getByRole('heading', { name: 'Commit c1' })).toBeVisible();
});

/** The first text of each row of the list of checks: a check's name, or the folded row's counts. */
function getRowStarts(panel: Element) {
    return [...panel.querySelectorAll('li')].map(row => row.querySelector('span')?.textContent);
}

/** The panel on the commit `oid`, its graph opened and its details, state and checks asked for, as the view does. */
async function mount(options: CommitGraphTestOptions, oid: string, panel: MountOptions = {}) {
    const { container, store, ready } = createCommitGraphTest(options);
    await ready;
    if (panel.tracked) {
        const tracking = container.resolve(TrackingStore);
        await tracking.ready();
        tracking.choose({ repositories: [{ nameWithOwner: REPOSITORY, id: 'R_web' }], projects: [] });
    }

    await store.open(REPOSITORY);
    const commit = { oid, id: `C_${oid}` };
    store.ensureDetail(REPOSITORY, commit);
    store.ensureStates(REPOSITORY, [commit]);
    store.ensureChecks(REPOSITORY, commit);

    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
    });
    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.height = '600px';
    if (panel.width !== undefined) {
        host.style.width = `${panel.width}px`;
    }
    document.body.append(host);
    const app = createApp({
        setup: () => () =>
            h(CommitDetails, {
                nameWithOwner: REPOSITORY,
                oid,
                refs: panel.refs ?? [],
                chosenRef: null,
                url: `https://github.com/${REPOSITORY}/commit/${oid}`,
                now: SAMPLE_COMMITS_NOW,
                docked: 'side',
            }),
    });
    app.use(IocPlugin, { container });
    app.use(router);
    await router.isReady();
    app.mount(host);
    let mounted = true;
    onTestFinished(unmount);

    return { store, unmount, panel: page.getByRole('region', { name: 'Commit details' }) };

    function unmount() {
        if (mounted) {
            mounted = false;
            app.unmount();
            host.remove();
        }
    }
}
