import { createPromise } from '@nzyme/utils/createPromise.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page } from 'vitest/browser';
import { createApp, h } from 'vue';

import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import type { CommitGraphTestOptions } from '@/testing/createCommitGraphTest.js';
import { SAMPLE_COMMITS_NOW, sampleCommit, sampleCommitRef, sampleWebappHistory } from '@/testing/sampleCommits.js';

import CommitDetails from './CommitDetails.vue';
import type { CommitRowRef } from './CommitRow.vue';

const REPOSITORY = 'acme/web';

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
    const { panel } = await mount(sampleWebappHistory(), 'a2', [{ name: 'fix/booking-tz', kind: 'branch' }]);

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
    await expect.element(panel).toHaveTextContent('the checks are listed on GitHub');
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

test('passing or running, nothing says where the checks are listed: only a failure sends you to read them', async () => {
    for (const [ci, word] of [
        ['SUCCESS', 'Passing'],
        ['PENDING', 'Running'],
    ] as const) {
        const { panel, unmount } = await mount(
            {
                commits: [sampleCommit('c1', 10)],
                states: new Map([['c1', { pullRequest: null, ci }]]),
            },
            'c1',
        );

        await expect.element(panel.getByText(word)).toBeVisible();
        await expect.element(panel).not.toHaveTextContent('the checks are listed on GitHub');
        unmount();
    }
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

/** The panel on the commit `oid`, its graph opened and its details and state asked for, as the view does. */
async function mount(options: CommitGraphTestOptions, oid: string, refs: readonly CommitRowRef[] = []) {
    const { container, store, ready } = createCommitGraphTest(options);
    await ready;
    await store.open(REPOSITORY);
    store.ensureDetail(REPOSITORY, { oid, id: `C_${oid}` });
    store.ensureStates(REPOSITORY, [{ oid, id: `C_${oid}` }]);

    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.height = '600px';
    document.body.append(host);
    const app = createApp({
        setup: () => () =>
            h(CommitDetails, {
                nameWithOwner: REPOSITORY,
                oid,
                refs,
                chosenRef: null,
                url: `https://github.com/${REPOSITORY}/commit/${oid}`,
                now: SAMPLE_COMMITS_NOW,
            }),
    });
    app.use(IocPlugin, { container });
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
