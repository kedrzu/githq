import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import { VIEWER_KEY } from '@/auth/AuthStore.js';
import { TOKEN_KEY } from '@/auth/TokenVault.js';
import { Browser } from '@/services/Browser.js';
import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import type { CommitGraphTestOptions } from '@/testing/createCommitGraphTest.js';
import { sampleCommit, sampleCommitRef, sampleHistory, sampleWebappHistory } from '@/testing/sampleCommits.js';

import CommitGraphView from './CommitGraphView.vue';
import type { CommitState } from './CommitTypes.js';

const REPOSITORY = 'acme/web';

test('only the rows near the viewport are drawn: a 5,000-commit graph draws a few dozen, and asks the state of those on screen only', async () => {
    const commits = sampleHistory({ count: 5000, seed: 11 });
    const view = await mount({ commits });
    const rows = page.getByRole('listitem');

    await expect.element(rows.first()).toBeVisible();
    expect(view.github.requests.filter(request => request === 'RepositoryCommitRefs')).toHaveLength(1);
    expect(rows.elements().length).toBeLessThan(60);
    // 600 px of 32 px rows: about 20 on screen, from the newest.
    await expect.poll(() => view.ensureStates.mock.lastCall?.[1].length).toBeGreaterThan(15);
    for (const [, oids] of view.ensureStates.mock.calls) {
        expect(oids.length).toBeLessThanOrEqual(21);
    }
    const newest = view.store.get(REPOSITORY)?.commits;
    expect(view.ensureStates.mock.lastCall?.[1][0]).toBe(newest?.[0]?.oid);
    expect(view.loadMore).not.toHaveBeenCalled();

    // Far down: the rows there, still a few dozen, and only they ask for their state.
    const scroller = view.scroller();
    scroller.scrollTop = 2500 * 32;
    await expect.poll(() => rows.first().element().getAttribute('aria-posinset')).toBe(String(2500 - 8 + 1));
    expect(rows.elements().length).toBeLessThan(60);
    const last = view.ensureStates.mock.lastCall?.[1];
    expect(last?.[0]).toBe(newest?.[2500]?.oid);
    expect(last?.length).toBeLessThanOrEqual(21);
    expect(view.loadMore).not.toHaveBeenCalled();

    // Within a screen of the last loaded row, the next page.
    scroller.scrollTop = scroller.scrollHeight;
    await expect.poll(() => view.loadMore.mock.calls.length).toBe(1);
});

test('D18, CH34: not known yet is an empty bar, never a blank; a commit with no pull request and no checks shows nothing there', async () => {
    const states = new Map<string, CommitState>([
        ['c2', { pullRequest: null, ci: null }],
        [
            'c1',
            {
                pullRequest: {
                    number: 1203,
                    state: 'MERGED',
                    title: 'Fix',
                    url: 'https://github.com/acme/web/pull/1203',
                    isDraft: false,
                },
                ci: 'FAILURE',
            },
        ],
    ]);
    const answered = createPromise();
    await mount({
        commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        states,
        holdIf: operation => (operation === 'CommitStates' ? answered.promise : null),
    });
    const row = (headline: string) => page.getByRole('listitem').filter({ hasText: headline });
    const unknown = { name: 'Pull request and checks not known yet' };

    await expect.element(row('Commit c2').getByRole('img', unknown)).toBeVisible();
    await expect.element(row('Commit c1').getByRole('img', unknown)).toBeVisible();

    answered.resolve();
    await expect.element(row('Commit c2').getByRole('img', unknown)).not.toBeInTheDocument();
    await expect.element(row('Commit c2')).not.toHaveTextContent('#');
    await expect.element(row('Commit c2').getByRole('img', { name: /Checks|pull request/ })).not.toBeInTheDocument();
    await expect.element(row('Commit c1').getByRole('img', unknown)).not.toBeInTheDocument();
    await expect.element(row('Commit c1').getByRole('img', { name: 'Merged pull request' })).toBeVisible();
    await expect.element(row('Commit c1')).toHaveTextContent('#1203');
    await expect.element(row('Commit c1').getByRole('img', { name: 'Checks failing' })).toBeVisible();
});

test('CH23: the cursor starts on the newest commit; J/K and the arrows move it, a click moves it there', async () => {
    await mount(sampleWebappHistory());

    await expect
        .poll(() => cursor()?.textContent)
        .toContain('feat: preview a class while dragging it in the week view');
    await userEvent.keyboard('j');
    await expect.poll(() => cursor()?.textContent).toContain("fix: booking time uses the studio's timezone");
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    await userEvent.keyboard('k');
    await expect.poll(() => cursor()?.textContent).toContain("fix: booking time uses the studio's timezone");
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    await expect
        .poll(() => cursor()?.textContent)
        .toContain('feat: preview a class while dragging it in the week view');

    await userEvent.click(page.getByText('chore: bump vite to 6.2'));
    await expect.poll(() => cursor()?.textContent).toContain('chore: bump vite to 6.2');
});

test('J moves the cursor past the screen and keeps its row in view', async () => {
    const view = await mount({ commits: sampleHistory({ count: 200, seed: 5 }) });
    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');

    for (let i = 0; i < 40; i++) {
        await userEvent.keyboard('j');
    }

    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('41');
    const scroller = view.scroller();
    expect(scroller.scrollTop).toBe(41 * 32 - scroller.clientHeight);
});

test('D19: commits arriving above stay out of the way — the cursor stays on its commit, moved or not, and its row keeps its place', async () => {
    const older = sampleHistory({ count: 100, seed: 2 });
    const view = await mount({ commits: older });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c99');

    // A branch joined later, newer than all, lands above the screen: the untouched cursor stays too.
    const { repository } = view.github;
    const arrive = async (commit: ReturnType<typeof sampleCommit>) => {
        repository.commits.set(commit.oid, commit);
        repository.branch(`newest/${commit.oid}`, commit.oid);
        await view.store.open(REPOSITORY);
    };
    const scroller = view.scroller();
    await arrive(sampleCommit('n1', 5000, ['c99']));
    await expect.poll(() => scroller.scrollTop).toBe(32);
    expect(cursor()?.textContent).toContain('Commit c99');

    // Moved, the same: it stays on its commit, whose row stays where it was on screen.
    await userEvent.keyboard('jjj');
    const before = cursor()?.getBoundingClientRect().top;
    const under = cursor()?.textContent;
    repository.commits.set('n2', sampleCommit('n2', 5001, ['n1']));
    await arrive(sampleCommit('n3', 5002, ['n2']));
    await expect.poll(() => scroller.scrollTop).toBe(3 * 32);
    expect(cursor()?.textContent).toBe(under);
    expect(cursor()?.getBoundingClientRect().top).toBe(before);
});

test("a commit's refs: the default branch first, then branches, then tags, three named and the rest counted", async () => {
    await mount({
        commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        branches: [sampleCommitRef('feat/a', 'c2'), sampleCommitRef('main', 'c2'), sampleCommitRef('fix/b', 'c2')],
        tags: [sampleCommitRef('v1.0.0', 'c2'), sampleCommitRef('v0.9.0', 'c1')],
    });

    await expect
        .element(page.getByRole('listitem').first())
        .toHaveTextContent(/^\s*main\s*feat\/a\s*fix\/b\s*\+1\s*Commit c2/);
    await expect.element(page.getByRole('listitem').nth(1)).toHaveTextContent(/^\s*v0\.9\.0\s*Commit c1/);
});

test('CH35, CH36: under the rows, the next page on its way, then the beginning of the history', async () => {
    const answered = createPromise();
    const commits = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['c0'])];
    await mount({
        commits: [...commits, sampleCommit('c0', 5)],
        branches: [sampleCommitRef('main', 'c2')],
        kept: commits,
        holdIf: operation => (operation === 'CommitHistories' ? answered.promise : null),
    });

    await expect.element(page.getByText('Loading older commits…')).toBeVisible();
    await expect.element(page.getByText("The beginning of acme/web's history")).not.toBeInTheDocument();

    answered.resolve();
    await expect.element(page.getByText("The beginning of acme/web's history")).toBeVisible();
    await expect.element(page.getByText('Loading older commits…')).not.toBeInTheDocument();
    await expect.element(page.getByText('Commit c0')).toBeVisible();
});

test('CH38, CH32: before anything arrives, a quiet line; an empty repository says so', async () => {
    const answered = createPromise();
    await mount({
        commits: [],
        defaultBranch: null,
        firstOpen: true,
        holdIf: operation => (operation === 'RepositoryCommitRefs' ? answered.promise : null),
    });
    await expect.element(page.getByText('Loading commits…')).toBeVisible();

    answered.resolve();
    await expect.element(page.getByRole('heading', { name: 'No commits yet' })).toBeVisible();
    await expect
        .element(page.getByText('acme/web is empty on GitHub. Commits appear here after the first push.'))
        .toBeVisible();
});

test('a page too short to fill the screen is followed by the next, without a scroll', async () => {
    const view = await mount({
        // A merge whose two parents are each a page of one commit.
        commits: [sampleCommit('merge', 30, ['a', 'b']), sampleCommit('a', 20), sampleCommit('b', 10)],
        branches: [sampleCommitRef('main', 'merge')],
        kept: [sampleCommit('merge', 30, ['a', 'b'])],
    });

    await expect.element(page.getByText("The beginning of acme/web's history")).toBeVisible();
    await expect.element(page.getByText('Commit a')).toBeVisible();
    await expect.element(page.getByText('Commit b')).toBeVisible();
    expect(view.github.requests.filter(request => request === 'CommitHistories')).toHaveLength(2);
});

test('a page that fails is not asked for again on its own: the next scroll asks', async () => {
    const view = await mount({
        commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        branches: [sampleCommitRef('main', 'c2')],
        kept: [sampleCommit('c2', 20, ['c1'])],
        failIf: operation => operation === 'CommitHistories',
    });

    await expect.poll(() => view.loadMore.mock.calls.length).toBe(1);
    await expect.poll(() => view.store.get(REPOSITORY)?.loadingMore).toBe(false);
    await new Promise<void>(resolve => {
        setTimeout(resolve, 100);
    });
    expect(view.loadMore).toHaveBeenCalledTimes(1);
});

test('another account signing in opens the graph again for them, the view staying open', async () => {
    const view = await mount(sampleWebappHistory());
    const row = page.getByText('chore: bump vite to 6.2');
    await expect.element(row).toBeVisible();
    const refsRead = () => view.github.requests.filter(request => request === 'RepositoryCommitRefs').length;
    expect(refsRead()).toBe(1);

    // As another tab signs in: the token and the user change under this one, which hears of the token.
    const { localStorage } = view.container.resolve(Browser);
    const login = `user-${crypto.randomUUID()}`;
    localStorage.setItem(VIEWER_KEY, JSON.stringify({ login, name: null, avatarUrl: 'https://avatars.test/user' }));
    localStorage.setItem(TOKEN_KEY, `gho_${login}`);
    window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY, storageArea: window.localStorage }));

    await expect.poll(refsRead).toBe(2);
    await expect.element(row).toBeVisible();
    await expect.element(page.getByText('Loading commits…')).not.toBeInTheDocument();
});

/** The row under the cursor. */
function cursor() {
    return document.querySelector('li[aria-current="true"]');
}

/** Mounts the section over the real store and a GitHub holding `options`, 600 px tall, at the sample's moment. */
async function mount(options: CommitGraphTestOptions) {
    const { container, store, github, ready } = createCommitGraphTest(options);
    await ready;
    const ensureStates = vi.spyOn(store, 'ensureStates');
    const loadMore = vi.spyOn(store, 'loadMore');
    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.width = '1200px';
    host.style.height = '600px';
    document.body.append(host);

    const app = createApp({ setup: () => () => h(CommitGraphView, { nameWithOwner: REPOSITORY }) });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return {
        container,
        store,
        github,
        ensureStates,
        loadMore,
        scroller: () => {
            const element = host.querySelector<HTMLElement>('[role="region"]');
            if (!element) {
                throw new Error('No scroller');
            }
            return element;
        },
    };
}
