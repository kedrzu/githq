import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, nextTick, ref, unref } from 'vue';
import type { Ref } from 'vue';
import { createMemoryHistory, createRouter, RouterView, useRoute } from 'vue-router';

import { VIEWER_KEY } from '@/auth/AuthStore.js';
import { TOKEN_KEY } from '@/auth/TokenVault.js';
import { Browser } from '@/services/Browser.js';
import { LocalPreferences } from '@/services/LocalPreferences.js';
import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import type { CommitGraphTestOptions } from '@/testing/createCommitGraphTest.js';
import {
    sampleCheckRun,
    sampleCommit,
    sampleCommitRef,
    sampleHistory,
    sampleWebappHistory,
} from '@/testing/sampleCommits.js';
import { trackTabFocus } from '@/testing/trackTabFocus.js';
import { getRouteNameWithOwner, WORKFLOW_RUN_PATH } from '@/tracking/trackingRoutes.js';

import CommitGraphView from './CommitGraphView.vue';
import { COMMIT_REF_LIST_TARGET_ID } from './CommitTypes.js';
import type { CommitState } from './CommitTypes.js';

const REPOSITORY = 'acme/web';
const SHARE_KEY = 'githq.panelShare.commitGraph';
const COMMITS = '/acme/web/commits';
const RUN = '/acme/web/actions/runs/1';

test('only the rows near the viewport are drawn: a 5,000-commit graph draws a few dozen, and asks the state of those on screen only', async () => {
    // Wide, so the details sit beside the graph and the pane keeps the section's whole height.
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const commits = sampleHistory({ count: 5000, seed: 11 });
    const view = await mount({ commits });
    const rows = page.getByRole('listitem');

    await expect.element(rows.first()).toBeVisible();
    expect(view.github.requests.filter(request => request === 'RepositoryCommitRefs')).toHaveLength(1);
    expect(rows.elements().length).toBeLessThan(60);
    // The opened commit asks for its own state, one at a time: what the rows on screen ask is the longer call.
    const asksOfScreen = () => view.ensureStates.mock.calls.findLast(([, asked]) => asked.length > 1)?.[1];
    // 600 px of 32 px rows: about 20 on screen, from the newest.
    await expect.poll(() => asksOfScreen()?.length).toBeGreaterThan(15);
    for (const [, asked] of view.ensureStates.mock.calls) {
        expect(asked.length).toBeLessThanOrEqual(21);
    }
    const newest = view.store.get(REPOSITORY)?.commits;
    expect(asksOfScreen()?.[0]?.oid).toBe(newest?.[0]?.oid);
    expect(view.loadMore).not.toHaveBeenCalled();

    // Far down: the rows there, still a few dozen, and only they ask for their state.
    const scroller = view.scroller();
    scroller.scrollTop = 2500 * 32;
    await expect.poll(() => rows.first().element().getAttribute('aria-posinset')).toBe(String(2500 - 8 + 1));
    expect(rows.elements().length).toBeLessThan(60);
    await expect.poll(() => asksOfScreen()?.[0]?.oid).toBe(newest?.[2500]?.oid);
    const last = asksOfScreen();
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

test("CH23: the cursor starts on the default branch's tip; J/K and the arrows move it, a click moves it there", async () => {
    await mount(sampleWebappHistory());

    // `main` points at the third commit, not the newest.
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    await userEvent.keyboard('k');
    await expect.poll(() => cursor()?.textContent).toContain("fix: booking time uses the studio's timezone");
    await userEvent.keyboard('{ArrowUp}');
    await expect
        .poll(() => cursor()?.textContent)
        .toContain('feat: preview a class while dragging it in the week view');
    await userEvent.keyboard('j');
    await expect.poll(() => cursor()?.textContent).toContain("fix: booking time uses the studio's timezone");
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');

    await userEvent.click(graphText('chore: bump vite to 6.2'));
    await expect.poll(() => cursor()?.textContent).toContain('chore: bump vite to 6.2');
});

test('the cursor starts on the top row when there is no default branch', async () => {
    const commits = [sampleCommit('c3', 30, ['c1']), sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)];
    const branches = [sampleCommitRef('main', 'c2'), sampleCommitRef('feat/a', 'c3')];
    const view = await mount({ commits, branches });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    view.unmount();

    await mount({ commits, branches, defaultBranch: null });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c3');
    await expect.element(details().getByRole('heading', { name: 'Commit c3' })).toBeVisible();
});

test('the details are open on the selected commit from the start; Esc closes them, and the next move, even onto the same row, shows them again', async () => {
    await mount(sampleWebappHistory());
    await expect.element(details().getByRole('heading', { name: /Merge pull request #1226/ })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    await userEvent.keyboard('j');
    await expect.element(details().getByRole('heading', { name: 'chore: bump vite to 6.2' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    await userEvent.click(graphText('chore: bump vite to 6.2'));
    await expect.element(details().getByRole('heading', { name: 'chore: bump vite to 6.2' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Enter}');
    await expect.element(details().getByRole('heading', { name: 'chore: bump vite to 6.2' })).toBeVisible();
});

test("the opened commit's checks are read and listed in its details, the next commit's when the cursor moves", async () => {
    const view = await mount({
        commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        branches: [sampleCommitRef('main', 'c2')],
        states: new Map([
            ['c2', { pullRequest: null, ci: 'FAILURE' }],
            ['c1', { pullRequest: null, ci: 'SUCCESS' }],
        ]),
        checks: new Map([
            ['c2', [sampleCheckRun('build', 'FAILURE')]],
            ['c1', [sampleCheckRun('lint', 'FAILURE')]],
        ]),
    });

    await expect.element(details().getByText('CI / build')).toBeVisible();
    await userEvent.keyboard('j');
    await expect.element(details().getByText('CI / lint')).toBeVisible();
    expect(view.github.requests.filter(request => request === 'CommitChecks')).toHaveLength(2);
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

    // A new tip of the default branch moves nothing either: the cursor was placed already.
    repository.commits.set('n4', sampleCommit('n4', 5003, ['n3']));
    repository.branch('main', 'n4');
    await view.store.open(REPOSITORY);
    await expect.poll(() => scroller.scrollTop).toBe(4 * 32);
    expect(cursor()?.textContent).toBe(under);
    expect(cursor()?.getBoundingClientRect().top).toBe(before);
});

test("the cursor's commit gone, with commits arriving above in the same read: on to the next in the old order, at the same height", async () => {
    const line = Array.from({ length: 100 }, (_, index) =>
        sampleCommit(`c${index}`, index * 10, index > 0 ? [`c${index - 1}`] : []),
    );
    // Third row, between c98 and c97.
    const gone = sampleCommit('gone', 975, ['c97']);
    // Kept and on no branch yet, so that one read of the refs both drops the gone commit and shows the new one.
    const arriving = sampleCommit('arriving', 5000, ['c99']);
    const commits = [...line, gone, arriving];
    const view = await mount({
        commits,
        kept: commits,
        branches: [sampleCommitRef('main', 'c99'), sampleCommitRef('feat/a', 'gone')],
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c99');

    await userEvent.keyboard('jj');
    await expect.poll(() => cursor()?.textContent).toContain('Commit gone');
    const before = cursor()?.getBoundingClientRect().top;

    const { repository } = view.github;
    repository.deleteBranch('feat/a');
    repository.branch('newest', 'arriving');
    await view.store.open(REPOSITORY);

    // The third row is now c98: the cursor follows the old order, not its place in the list.
    await expect.poll(() => cursor()?.textContent).toContain('Commit c97');
    await expect.poll(() => cursor()?.getBoundingClientRect().top).toBe(before);
    expect(view.scroller().scrollTop).toBe(32);
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

test('CH40: offline, what is kept stays and the last row says older commits wait', async () => {
    const commits = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['c0'])];
    const view = await mount({
        commits,
        branches: [sampleCommitRef('main', 'c2')],
        failIf: () => true,
        online: false,
    });

    await expect.element(page.getByText("Older commits load when you're back online")).toBeVisible();
    await expect.element(graphText('Commit c2')).toBeVisible();
    expect(view.store.getFreshness(REPOSITORY)).toMatchObject({ kind: 'stale', reason: 'offline' });
});

test('CH40: offline a scroll to the end asks nothing; coming back online reads the older commits and takes the note away', async () => {
    const line = Array.from({ length: 60 }, (_, index) =>
        sampleCommit(`c${index}`, index + 10, [index > 0 ? `c${index - 1}` : 'older']),
    );
    let failing = true;
    const view = await mount({
        commits: [...line, sampleCommit('older', 1)],
        branches: [sampleCommitRef('main', 'c59')],
        kept: line,
        failIf: () => failing,
        online: false,
    });
    const note = page.getByText("Older commits load when you're back online");
    await expect.element(note).toBeVisible();

    const scroller = view.scroller();
    scroller.scrollTop = scroller.scrollHeight;
    await expect.element(page.getByText('Commit c0')).toBeInTheDocument();
    await new Promise<void>(resolve => {
        setTimeout(resolve, 100);
    });
    expect(view.loadMore).not.toHaveBeenCalled();

    failing = false;
    view.setOnline(true);

    await expect.element(page.getByText('Commit older')).toBeInTheDocument();
    await expect.element(note).not.toBeInTheDocument();
    expect(view.store.getFreshness(REPOSITORY).kind).toBe('fresh');
});

test('CH38, CH32, first run and loading D17: before anything arrives, the skeleton, read out as one line; an empty repository says so', async () => {
    const answered = createPromise();
    await mount({
        commits: [],
        defaultBranch: null,
        firstOpen: true,
        holdIf: operation => (operation === 'RepositoryCommitRefs' ? answered.promise : null),
    });
    await expect.element(page.getByText('Loading commits…')).toBeInTheDocument();

    answered.resolve();
    await expect.element(page.getByRole('heading', { name: 'No commits yet' })).toBeVisible();
    await expect.element(page.getByText('Loading commits…')).not.toBeInTheDocument();
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
    await expect.element(graphText('Commit a')).toBeVisible();
    await expect.element(graphText('Commit b')).toBeVisible();
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
    const row = graphText('chore: bump vite to 6.2');
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

test('D17, CH10: by default a tenth of the pane: the lanes past those that fit sit on one thicker line, and J still stops on their commits', async () => {
    await mount({ commits: parallelBranches(14) });
    const divider = page.getByRole('separator', { name: 'Resize the commit graph' });

    await expect.element(divider).toHaveAttribute('aria-valuenow', '8');
    await expect.element(divider).toHaveAttribute('aria-valuemin', '2');
    await expect.element(divider).toHaveAttribute('aria-valuemax', '14');
    expect(divider.element().getAttribute('aria-valuetext')).toMatch(/^8 of\s14 lanes$/);
    const cells = graphCells();
    expect(cells[0]?.getBoundingClientRect().width).toBe(120);
    // Eight places for the dots of fourteen tips, the last at the eighth lane.
    expect(new Set(dotsX()).size).toBe(8);
    expect(Math.max(...dotsX())).toBe(8 + 7.5 * 12);
    const widths = (x: number) =>
        [...document.querySelectorAll('li svg path')]
            .filter(path => path.getAttribute('d')?.startsWith(`M${x} 0V32`))
            .map(path => getComputedStyle(path).strokeWidth);
    expect(new Set(widths(8 + 7.5 * 12))).toEqual(new Set(['3px']));
    expect(new Set(widths(8 + 0.5 * 12))).toEqual(new Set(['1.5px']));

    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');
    for (let position = 2; position <= 15; position++) {
        await userEvent.keyboard('j');
        await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe(String(position));
    }
});

test('D17: folded at any width the lanes stay continuous: each row ends where the next one starts', async () => {
    for (const share of [28 / 1200, 52 / 1200, 0.1]) {
        const view = await mount({ commits: sampleHistory({ count: 400, seed: 7 }) }, { keptShare: String(share) });
        const divider = page.getByRole('separator');
        await expect.poll(() => graphCells().length).toBeGreaterThan(15);
        expect(Number(divider.element().getAttribute('aria-valuenow'))).toBeLessThan(
            Number(divider.element().getAttribute('aria-valuemax')),
        );

        const cells = graphCells();
        for (const [index, cell] of cells.slice(0, -1).entries()) {
            expect(getLanesAt('bottom', cell)).toEqual(getLanesAt('top', cells[index + 1]));
        }

        view.unmount();
    }
});

test('D17: an arrow at a limit changes nothing, so nothing is kept for every other repository', async () => {
    // Three lanes on a wide pane: the default share already draws them all.
    const view = await mount({ commits: parallelBranches(3) });
    const divider = page.getByRole('separator', { name: 'Resize the commit graph' });
    const { localStorage } = view.container.resolve(Browser);
    await expect.element(divider).toHaveAttribute('aria-valuenow', '3');
    divider.element().focus();

    await userEvent.keyboard('{ArrowRight}');

    await expect.element(divider).toHaveTextContent('3 of 3 lanes');
    expect(localStorage.getItem(SHARE_KEY)).toBeNull();
});

test('D17: the arrows change the graph by a lane, as far as two lanes and every lane, and the change is kept; Enter resets it', async () => {
    const view = await mount({ commits: parallelBranches(14) });
    const divider = page.getByRole('separator', { name: 'Resize the commit graph' });
    const { localStorage } = view.container.resolve(Browser);
    await expect.element(divider).toHaveAttribute('aria-valuenow', '8');
    divider.element().focus();

    await userEvent.keyboard('{ArrowRight}');
    await expect.element(divider).toHaveAttribute('aria-valuenow', '9');
    await expect.element(divider).toHaveTextContent('9 of 14 lanes');
    await expect.poll(() => graphCells()[0]?.getBoundingClientRect().width).toBe(9 * 12 + 16);
    await expect.poll(() => Number(localStorage.getItem(SHARE_KEY))).toBeCloseTo((9 * 12 + 16) / 1200);

    for (let press = 0; press < 8; press++) {
        await userEvent.keyboard('{ArrowRight}');
    }
    await expect.element(divider).toHaveAttribute('aria-valuenow', '14');
    expect(new Set(dotsX()).size).toBe(14);
    expect(graphCells()[0]?.getBoundingClientRect().width).toBe(14 * 12 + 16);

    for (let press = 0; press < 16; press++) {
        await userEvent.keyboard('{ArrowLeft}');
    }
    await expect.element(divider).toHaveAttribute('aria-valuenow', '2');
    await expect.element(divider).toHaveTextContent('2 of 14 lanes');
    expect(new Set(dotsX()).size).toBe(2);
    expect(graphCells()[0]?.getBoundingClientRect().width).toBe(2 * 12 + 16);

    await userEvent.keyboard('{Enter}');
    await expect.element(divider).toHaveAttribute('aria-valuenow', '8');
    await expect.poll(() => localStorage.getItem(SHARE_KEY)).toBeNull();

    // The label is for while it is being resized.
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(divider).toHaveTextContent('7 of 14 lanes');
    divider.element().blur();
    await expect.element(divider).not.toHaveTextContent('lanes');
});

test('D17: a double-click on the divider forgets the share', async () => {
    const view = await mount({ commits: parallelBranches(14) }, { keptShare: '0.05' });
    const divider = page.getByRole('separator', { name: 'Resize the commit graph' });
    await expect.element(divider).toHaveAttribute('aria-valuenow', '3');

    await userEvent.dblClick(divider);

    await expect.element(divider).toHaveAttribute('aria-valuenow', '8');
    const { localStorage } = view.container.resolve(Browser);
    await expect.poll(() => localStorage.getItem(SHARE_KEY)).toBeNull();
});

test.each([
    ['a share from an earlier visit', String(100 / 1200), '7'],
    ['a share past every lane', '0.9', '14'],
    ['a share below two lanes', '0.001', '2'],
])('D17: %s draws within range', async (_title, kept, lanes) => {
    await mount({ commits: parallelBranches(14) }, { keptShare: kept });
    await expect
        .element(page.getByRole('separator', { name: 'Resize the commit graph' }))
        .toHaveAttribute('aria-valuenow', lanes);
    expect(new Set(dotsX()).size).toBe(Number(lanes));
});

test("D15: below about 1,200 px of window the list is folded away; B opens it over the graph at the pane's left edge without taking the graph's width, Esc closes it and choosing does too, the details below the graph staying meanwhile", async () => {
    await page.viewport(1100, 700);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: parallelBranches(14) });
    const list = page.getByRole('grid', { name: 'Branches and tags' });
    const paneWidth = view.scroller().clientWidth;

    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');
    await expect.element(list).not.toBeInTheDocument();

    await userEvent.keyboard('b');
    await expect.element(list).toBeVisible();
    await expect.element(filter()).toHaveFocus();
    expect(view.scroller().clientWidth).toBe(paneWidth);
    const over = refList().element().getBoundingClientRect();
    expect(over.left).toBe(view.scroller().getBoundingClientRect().left);
    expect(over.width).toBe(280);

    await userEvent.keyboard('{Escape}');
    await expect.element(list).not.toBeInTheDocument();
    expect(document.activeElement).toBe(view.scroller());

    // The details docked below the graph stay while the list is over the graph, and Esc leaves the list first.
    await userEvent.keyboard('b');
    filter().element().blur();
    await expect.element(list).toBeVisible();
    await expect.element(details()).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(list).not.toBeInTheDocument();
    await expect.element(details()).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();

    await userEvent.keyboard('b');
    await userEvent.keyboard('branch-3{Enter}');
    await expect.element(list).not.toBeInTheDocument();
    expect(document.activeElement).toBe(view.scroller());
    await expect.poll(() => cursor()?.textContent).toContain('branch-3');

    // Opened anew, without the filter it was left with.
    await userEvent.keyboard('b');
    await expect.element(filter()).toHaveValue('');
});

test('D15: on a wide window the list is left of the graph from the first draw, in a column of the default width', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: parallelBranches(4) });

    await expect.element(refList()).toBeVisible();
    await expect.element(page.getByRole('separator', { name: 'Resize the left column' })).toBeInTheDocument();
    const list = refList().element().getBoundingClientRect();
    const graph = view.scroller().getBoundingClientRect();
    expect(list.right).toBeLessThanOrEqual(graph.left);
    expect(list.left).toBe(0);
    expect(getComputedStyle(refList().element()).position).toBe('static');
});

test('D15, first run and loading D17: a first open holds the column for the list, which the refs land in without moving the graph', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const answered = createPromise();
    const view = await mount({
        commits: parallelBranches(4),
        firstOpen: true,
        holdIf: operation => (operation === 'RepositoryCommitRefs' ? answered.promise : null),
    });
    await expect.element(page.getByText('Loading commits…')).toBeInTheDocument();
    await expect.element(page.getByRole('separator', { name: 'Resize the left column' })).toBeInTheDocument();
    await expect.element(refList()).not.toBeInTheDocument();
    expect(view.scroller().clientWidth).toBe(1200 - 280);

    answered.resolve();
    await expect.element(refList()).toBeVisible();
    await closeDetails();
    await expect.poll(() => view.scroller().clientWidth).toBe(1200 - 280);
    expect(refList().element().getBoundingClientRect().right).toBeLessThanOrEqual(
        view.scroller().getBoundingClientRect().left,
    );
});

test('D15, D16: crossing 1,200 px moves one list, its filter kept, and leaves the graph as it was', async () => {
    await page.viewport(1100, 700);
    onTestFinished(() => page.viewport(414, 896));
    const commits = Array.from({ length: 300 }, (_, index) =>
        sampleCommit(`c${index}`, index, index > 0 ? [`c${index - 1}`] : []),
    );
    const view = await mount({
        commits,
        branches: [sampleCommitRef('main', 'c299'), sampleCommitRef('feat/a', 'c150')],
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c299');
    const scroller = view.scroller();
    await userEvent.keyboard('jjj');
    scroller.scrollTop = 1000;

    // Over the graph, narrow, with a filter typed: as wide, in the column, the same list with the same filter.
    await userEvent.keyboard('b');
    await userEvent.keyboard('feat');
    await expect.element(filter()).toHaveValue('feat');
    await page.viewport(1400, 800);
    await expect.poll(() => getComputedStyle(refList().element()).position).toBe('static');
    await expect.element(filter()).toHaveValue('feat');
    expect(refList().element().getBoundingClientRect().right).toBeLessThanOrEqual(
        scroller.getBoundingClientRect().left,
    );
    await expect.element(page.getByRole('separator', { name: 'Resize the left column' })).toBeInTheDocument();

    // The graph keeps its scroll and cursor, and the keys on it stay there both ways.
    expect(scroller.scrollTop).toBe(1000);
    scroller.focus();
    await page.viewport(1100, 700);
    await expect.element(refList()).not.toBeInTheDocument();
    await expect.poll(() => scroller.clientWidth).toBe(1200);
    expect(scroller.scrollTop).toBe(1000);
    expect(document.activeElement).toBe(scroller);

    // Back again, the list is there, new.
    await page.viewport(1400, 800);
    await expect.element(refList()).toBeVisible();
    await expect.element(filter()).toHaveValue('');
    expect(refList().element().getBoundingClientRect().right).toBeLessThanOrEqual(
        scroller.getBoundingClientRect().left,
    );
    expect(document.activeElement).toBe(scroller);
    expect(scroller.scrollTop).toBe(1000);

    // The cursor is where it was, its row drawn once in view.
    scroller.scrollTop = 0;
    await expect.poll(() => cursor()?.textContent).toContain('Commit c296');
});

test('D15, D16: on a wide window Enter opens the details right of the graph with the list staying and the graph as it was; B focuses the filter and they stay; Esc leaves the list, the next closes them', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const commits = Array.from({ length: 300 }, (_, index) =>
        sampleCommit(`c${index}`, index, index > 0 ? [`c${index - 1}`] : []),
    );
    const view = await mount({ commits, branches: [sampleCommitRef('main', 'c299')] });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c299');
    const scroller = view.scroller();
    const list = refList().element();
    await userEvent.keyboard('jjj');
    scroller.scrollTop = 1000;
    scroller.focus();

    await userEvent.keyboard('{Enter}');
    await expect.element(details()).toBeVisible();
    await expect.poll(() => scroller.clientWidth).toBe(1200 - 280 - 440);
    const panel = details().element().getBoundingClientRect();
    expect(panel.left).toBeGreaterThanOrEqual(scroller.getBoundingClientRect().right);
    expect(list.getBoundingClientRect().right).toBeLessThanOrEqual(scroller.getBoundingClientRect().left);
    expect(view.scroller()).toBe(scroller);
    expect(refList().element()).toBe(list);
    expect(scroller.scrollTop).toBe(1000);
    expect(document.activeElement).toBe(scroller);
    await expect.element(details()).toHaveTextContent('Commit c296');

    await userEvent.keyboard('b');
    await expect.element(filter()).toHaveFocus();
    await expect.element(details()).toBeVisible();

    await userEvent.keyboard('ma{Escape}');
    await expect.element(filter()).toHaveValue('');
    expect(document.activeElement).toBe(scroller);
    await expect.element(details()).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    await expect.element(refList()).toBeVisible();
    expect(document.activeElement).toBe(scroller);
    expect(scroller.scrollTop).toBe(1000);
});

test("D16: the arrow keys on the details' left edge resize them a tenth of the room at a time, kept under their own key and no other panel's, the graph keeping at least 240 px", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    // 1,000 - 300 leaves the graph and the details 700: 70 px a press, the details 460 at the most.
    const view = await mount({ commits: parallelBranches(4) }, { width: 1000, keptColumnWidth: 300 });
    const preferences = view.container.resolve(LocalPreferences);
    await expect.element(details()).toBeVisible();
    await expect.poll(() => detailsWidth()).toBe(440);

    detailsHandle().element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => detailsWidth()).toBe(460);
    await expect.poll(() => preferences.getPanelWidth('commitDetails').value).toBe(460);
    expect(view.scroller().getBoundingClientRect().width).toBe(240);
    expect(preferences.getPanelWidth('repositoryColumn').value).toBe(300);
    expect(preferences.getPanelWidth('modal').value).toBeNull();

    await userEvent.keyboard('{ArrowLeft}');
    expect(detailsWidth()).toBe(460);
    expect(preferences.getPanelWidth('commitDetails').value).toBe(460);

    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => detailsWidth()).toBe(390);
    await expect.poll(() => preferences.getPanelWidth('commitDetails').value).toBe(390);
});

test('D16: a width squeezed by the window is never kept over the one the user chose: the details narrower, by a key that does nothing at the limit', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    // 1,000 - 300 - 240 leaves the details 460 of the 600 chosen.
    const view = await mount(
        { commits: parallelBranches(4) },
        { width: 1000, keptColumnWidth: 300, keptDetailsWidth: 600 },
    );
    const preferences = view.container.resolve(LocalPreferences);
    await expect.element(details()).toBeVisible();
    await expect.poll(() => detailsWidth()).toBe(460);
    expect(preferences.getPanelWidth('commitDetails').value).toBe(600);

    detailsHandle().element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{Tab}');
    expect(preferences.getPanelWidth('commitDetails').value).toBe(600);

    detailsHandle().element().focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => preferences.getPanelWidth('commitDetails').value).toBe(390);
});

test("D16: with less room than the details' least width and the graph's 240 px the details keep their 320, the graph gives way, and the handle keeps nothing", async () => {
    await page.viewport(1200, 800);
    onTestFinished(() => page.viewport(414, 896));
    // 900 - 480 leaves 420: 100 for the graph.
    const view = await mount({ commits: parallelBranches(4) }, { keptColumnWidth: 480, width: 900 });
    const preferences = view.container.resolve(LocalPreferences);
    await expect.element(details()).toBeVisible();
    await expect.poll(() => detailsWidth()).toBe(320);
    expect(view.scroller().getBoundingClientRect().width).toBe(100);

    detailsHandle().element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{ArrowRight}');
    expect(detailsWidth()).toBe(320);
    expect(preferences.getPanelWidth('commitDetails').value).toBeNull();
});

test("D16: the details' handle is there beside the graph only, and a click on it leaves the focus where it was", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    await mount({ commits: parallelBranches(4) });
    await expect.element(details()).toBeVisible();
    // Pressed as Reka hears it: the handle takes no width to be clicked by a tool.
    const handle = detailsHandle().element();
    const focused = document.activeElement;
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    handle.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(document.activeElement).toBe(focused);

    await page.viewport(1100, 800);
    await expect.element(detailsHandle()).not.toBeInTheDocument();
});

test("D17: the graph's share is of the pane without the list", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: parallelBranches(14) });
    await expect.poll(() => graphCells().length).toBeGreaterThan(0);
    await closeDetails();

    await expect.poll(() => view.scroller().clientWidth).toBe(1200 - 280);
    expect(graphCells()[0]?.getBoundingClientRect().width).toBe(92);
});

test('D14, D15, CH6, CH42: with the list in the column it renders there at any window width, leaving the graph the pane; B, typing and Enter behave as in tabs; the details open beside the graph with the list staying, and Esc closes them', async () => {
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const target = columnTarget();
    const view = await mount({ commits: parallelBranches(14) }, { refListInColumn: true });
    const list = target.querySelector.bind(target);
    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');

    await expect.poll(() => list('[role="grid"]')).not.toBeNull();
    await closeDetails();
    await expect.poll(() => view.scroller().clientWidth).toBe(1200);
    // D17: the share is of the pane, the list taking none of it.
    expect(graphCells()[0]?.getBoundingClientRect().width).toBe(120);

    await userEvent.keyboard('b');
    await expect.element(filter()).toHaveFocus();
    await userEvent.keyboard('branch-3{Enter}');
    await expect.poll(() => cursor()?.textContent).toContain('branch-3');
    expect(document.activeElement).toBe(view.scroller());

    await userEvent.keyboard('{Enter}');
    await expect.element(details()).toBeVisible();
    expect(list('[role="grid"]')).not.toBeNull();
    expect(view.scroller().clientWidth).toBe(1200 - 440);
    // Beside the graph, not over it.
    expect(details().element().getBoundingClientRect().left).toBeGreaterThanOrEqual(
        view.scroller().getBoundingClientRect().right,
    );

    // B with the details open: the filter, and they stay.
    await userEvent.keyboard('b');
    await expect.element(filter()).toHaveFocus();
    await expect.element(details()).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(view.scroller());
    await expect.element(details()).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    expect(list('[role="grid"]')).not.toBeNull();
});

test('D15, CH42: with the list in the column, below 1,200 px of window the details dock under the graph, and the list stays', async () => {
    await page.viewport(1100, 800);
    onTestFinished(() => page.viewport(414, 896));
    const target = columnTarget();
    const view = await mount({ commits: parallelBranches(14) }, { refListInColumn: true });
    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');
    const paneWidth = view.scroller().clientWidth;

    await expect.poll(() => target.querySelector('[role="grid"]')).not.toBeNull();
    await expect.element(details()).toBeVisible();
    expect(view.scroller().clientWidth).toBe(paneWidth);
    expect(details().element().getBoundingClientRect().top).toBe(view.scroller().getBoundingClientRect().bottom);
    expect(target.querySelector('[role="grid"]')).not.toBeNull();
});

test('D14: the layout changed while the graph is open, by another tab or device: the list moves to the column and back', async () => {
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const target = columnTarget();
    const inColumn = ref(false);
    const view = await mount({ commits: parallelBranches(14) }, { refListInColumn: inColumn });

    await expect.element(page.getByRole('grid', { name: 'Branches and tags' })).toBeVisible();
    expect(target.querySelector('[role="grid"]')).toBeNull();
    const list = refList().element();
    await closeDetails();

    inColumn.value = true;
    await expect.poll(() => target.querySelector('[role="grid"]')).not.toBeNull();
    expect(refList().element()).toBe(list);
    await expect.poll(() => view.scroller().clientWidth).toBe(1200);

    inColumn.value = false;
    await expect.poll(() => target.querySelector('[role="grid"]')).toBeNull();
    await expect.element(page.getByRole('grid', { name: 'Branches and tags' })).toBeVisible();
    expect(refList().element()).toBe(list);
    await expect.poll(() => view.scroller().clientWidth).toBe(1200 - 280);
    expect(list.getBoundingClientRect().right).toBeLessThanOrEqual(view.scroller().getBoundingClientRect().left);

    // The column's panel is remounted between two visits: the list goes to the element there now.
    target.remove();
    const remounted = columnTarget();
    inColumn.value = true;
    await expect.poll(() => remounted.querySelector('[role="grid"]')).not.toBeNull();
});

test('D14, D15: the layout changed with the list open over the graph: it moves to the column, the same list with its filter', async () => {
    await page.viewport(1100, 800);
    onTestFinished(() => page.viewport(414, 896));
    const target = columnTarget();
    const inColumn = ref(false);
    await mount({ commits: parallelBranches(4) }, { refListInColumn: inColumn });
    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');

    await userEvent.keyboard('b');
    await userEvent.keyboard('branch');
    const list = refList().element();

    inColumn.value = true;
    await expect.poll(() => target.querySelector('[role="grid"]')).not.toBeNull();
    expect(refList().element()).toBe(list);
    expect(getComputedStyle(list).position).toBe('static');
    await expect.element(filter()).toHaveValue('branch');
});

test('D12: a chosen ref on a loaded commit scrolls the graph, row not drawn yet, a third of the way down; Esc leaves cursor and scroll where they were', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const commits = Array.from({ length: 1000 }, (_, index) =>
        sampleCommit(`c${index}`, index, index > 0 ? [`c${index - 1}`] : []),
    );
    const view = await mount({
        commits,
        branches: [sampleCommitRef('main', 'c999')],
        tags: [sampleCommitRef('v1', 'c200')],
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c999');
    const scroller = view.scroller();
    // Far past what is drawn.
    await expect.element(page.getByText('Commit c200')).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('row', { name: /v1/ }));

    await expect.poll(() => cursor()?.textContent).toContain('Commit c200');
    const top = (cursor()?.getBoundingClientRect().top ?? 0) - scroller.getBoundingClientRect().top;
    expect(Math.abs(top - scroller.clientHeight / 3)).toBeLessThan(1);
    // CH26: back to the graph, on that commit with its details; the list keeps no choice.
    await expect.poll(() => document.activeElement).toBe(scroller);
    await expect.element(page.getByRole('gridcell', { selected: true })).not.toBeInTheDocument();
    await expect.element(details().getByRole('heading', { name: 'Commit c200' })).toBeVisible();

    const scrolled = scroller.scrollTop;
    await userEvent.keyboard('b');
    await userEvent.keyboard('main');
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => document.activeElement).toBe(scroller);
    expect(scroller.scrollTop).toBe(scrolled);
    expect(cursor()?.textContent).toContain('Commit c200');
});

test('D12, CH16: a ref whose commit is not loaded opens its details, the graph staying and never taking the commit, with its pull request and CI, and the list staying, cleared; Esc lands on the graph', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const old = sampleCommit('old', 1);
    const history = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['old'])];
    const view = await mount({
        commits: [...history, old],
        branches: [sampleCommitRef('main', 'c2')],
        tags: [sampleCommitRef('v0.1', 'old')],
        bodies: new Map([['old', 'Why it was released.']]),
        states: new Map([['old', { pullRequest: null, ci: 'SUCCESS' }]]),
        kept: history,
        holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    await userEvent.keyboard('b');
    await userEvent.keyboard('v0.1{Enter}');

    await expect.element(details()).toHaveTextContent('Not in the loaded history. v0.1 is from');
    await expect.element(details()).toHaveTextContent('so it stayed where it was');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('Why it was released.');
    await expect.element(details().getByText('Passing')).toBeVisible();
    await expect.element(page.getByRole('grid', { name: 'Branches and tags' })).toBeVisible();
    await expect.element(filter()).toHaveValue('');
    expect(cursor()?.textContent).toContain('Commit c2');
    expect(view.scroller().scrollTop).toBe(0);
    expect(document.activeElement).toBe(view.scroller());
    expect(view.store.get(REPOSITORY)?.commits.map(commit => commit.oid)).not.toContain('old');

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(view.scroller());
    expect(cursor()?.textContent).toContain('Commit c2');
});

test("D12, CH42: in the column, with an unloaded tag's details open, choosing the ref on the cursor's commit brings the details to it and draws the cursor", async () => {
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const history = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['old'])];
    columnTarget();
    await mount(
        {
            commits: [...history, sampleCommit('old', 1)],
            branches: [sampleCommitRef('main', 'c2')],
            tags: [sampleCommitRef('v0.1', 'old')],
            kept: history,
            holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
        },
        { refListInColumn: true },
    );
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    await userEvent.keyboard('b');
    await userEvent.keyboard('v0.1{Enter}');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    expect(cursorDrawn()).toBe(false);

    await userEvent.keyboard('b');
    await userEvent.keyboard('main{Enter}');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    expect(cursorDrawn()).toBe(true);
    expect(cursor()?.textContent).toContain('Commit c2');
});

test("the commit that's open isn't read again by opening it again; a read that failed is, after a close or a move", async () => {
    const reads = () => view.github.requests.filter(request => request === 'CommitDetail').length;
    const view = await mount({
        commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        failIf: operation => operation === 'CommitDetail',
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    await userEvent.keyboard('{Enter}');
    await expect.element(details()).toHaveTextContent("GitHub can't be asked for the rest of this message right now.");
    expect(reads()).toBe(1);

    await userEvent.click(page.getByRole('listitem').filter({ hasText: 'Commit c2' }));
    await userEvent.keyboard('{Enter}');
    await nextTick();
    expect(reads()).toBe(1);

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await expect.poll(reads).toBe(2);

    await userEvent.keyboard('j');
    await expect.poll(reads).toBe(3);
    await userEvent.keyboard('k');
    await expect.poll(reads).toBe(4);
});

test('D16, CH18: the details are open from the start beside the list and the graph at 440 px, the body arriving after; J and K follow, a click too; Esc closes them and focus goes to the graph', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const answered = createPromise();
    const view = await mount({
        commits: [sampleCommit('c3', 30, ['c2']), sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        bodies: new Map([
            ['c3', 'The third, in detail.'],
            ['c2', 'The second, in detail.'],
        ]),
        holdIf: operation => (operation === 'CommitDetail' ? answered.promise : null),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c3');
    const list = page.getByRole('grid', { name: 'Branches and tags' });
    await expect.element(list).toBeVisible();

    // At once, from what the graph knows.
    await expect.element(details().getByRole('heading', { name: 'Commit c3' })).toBeVisible();
    await expect.element(details()).not.toHaveTextContent('The third, in detail.');
    await expect.element(list).toBeVisible();
    await expect.poll(() => view.scroller().clientWidth).toBe(1200 - 280 - 440);
    expect(detailsWidth()).toBe(440);
    answered.resolve();
    await expect.element(details()).toHaveTextContent('The third, in detail.');

    await userEvent.keyboard('j');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('The second, in detail.');
    expect(cursor()?.textContent).toContain('Commit c2');
    await userEvent.keyboard('k');
    await expect.element(details().getByRole('heading', { name: 'Commit c3' })).toBeVisible();
    await userEvent.click(page.getByRole('listitem').filter({ hasText: 'Commit c1' }));
    await expect.element(details().getByRole('heading', { name: 'Commit c1' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    await expect.element(list).toBeVisible();
    expect(document.activeElement).toBe(view.scroller());
    expect(cursor()?.textContent).toContain('Commit c1');
});

test('a burst of J reads only the commit it stops on', async () => {
    const view = await mount({ commits: sampleHistory({ count: 40, seed: 3 }) });
    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');
    for (let i = 0; i < 10; i++) {
        pressJ();
    }

    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('11');
    const stoppedOn = view.store.get(REPOSITORY)?.commits[10]?.oid ?? '';
    await expect.poll(() => view.store.getDetail(REPOSITORY, stoppedOn)?.kind).toBe('read');
    // The one the details opened on, and the one it stopped on.
    expect(view.github.requests.filter(request => request === 'CommitDetail')).toHaveLength(2);
    expect(view.store.getDetail(REPOSITORY, view.store.get(REPOSITORY)?.commits[5]?.oid ?? '')).toBeUndefined();

    function pressJ() {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', cancelable: true }));
    }
});

test('details closed and shown again by a move read the commit at once, with no pause to rest on it', async () => {
    const view = await mount({ commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)] });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    await closeDetails();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', cancelable: true }));
    await nextTick();

    expect(view.store.getDetail(REPOSITORY, 'c1')).toBeDefined();
});

test('D16, CH20, CH27, CH28: P and Shift+P go to the parents, selected in the graph and in view, with the details; a key with nothing to go to does nothing', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    await mount(sampleWebappHistory());
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    await expect.element(details().getByRole('heading', { name: 'Parents' })).toBeVisible();

    await userEvent.keyboard('{Shift>}p{/Shift}');
    await expect.poll(() => cursor()?.textContent).toContain('feat: search members by email');
    await expect.element(details().getByRole('heading', { name: 'feat: search members by email' })).toBeVisible();
    await expect.element(details().getByRole('heading', { name: 'Parent', exact: true })).toBeVisible();

    // No second parent here.
    await userEvent.keyboard('{Shift>}p{/Shift}');
    expect(cursor()?.textContent).toContain('feat: search members by email');

    await userEvent.keyboard('p');
    await expect.poll(() => cursor()?.textContent).toContain("Merge branch 'release/4.2'");
    await expect.element(details().getByRole('heading', { name: "Merge branch 'release/4.2'" })).toBeVisible();

    // A row clicked does the same.
    await userEvent.click(details().getByRole('button', { name: /chore: prepare the 4\.2\.1 release/ }));
    await expect.poll(() => cursor()?.textContent).toContain('chore: prepare the 4.2.1 release');
});

test('a control Tab reached in the details holds J and P, the commit staying; B, about the view, still opens the list; the graph itself holds nothing', async () => {
    trackTabFocus();
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    await mount(sampleWebappHistory());
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    const pane = document.querySelector('[data-screen-keys]');
    const control = details().getByRole('button').first().element();

    for (const target of [pane, control]) {
        for (let tabs = 0; tabs < 40 && document.activeElement !== target; tabs++) {
            await userEvent.tab();
        }

        expect(document.activeElement).toBe(target);
    }

    expect(pane?.hasAttribute('data-tab-focus')).toBe(false);
    expect(control.hasAttribute('data-tab-focus')).toBe(true);
    await userEvent.keyboard('jp{Shift>}p{/Shift}');
    expect(cursor()?.textContent).toContain('Merge pull request #1226');

    await userEvent.keyboard('{Escape}b');
    await expect.element(filter()).toHaveFocus();
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('p');
    await expect.poll(() => cursor()?.textContent).not.toContain('Merge pull request #1226');
});

test('CH16: P to a parent not loaded opens its details the same way, the graph not moving and not taking it; J goes on from the graph', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const history = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['old'])];
    const view = await mount({
        commits: [...history, sampleCommit('old', 1)],
        branches: [sampleCommitRef('main', 'c2')],
        kept: history,
        holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    await userEvent.keyboard('j{Enter}');
    await expect.element(details().getByRole('heading', { name: 'Commit c1' })).toBeVisible();

    await userEvent.keyboard('p');

    await expect.element(details()).toHaveTextContent('Not in the loaded history.');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    expect(cursor()?.textContent).toContain('Commit c1');
    // The cursor stays where the keys go from, drawn on no row: it is not what the details show.
    await expect.poll(cursorDrawn).toBe(false);
    expect(view.store.get(REPOSITORY)?.commits.map(commit => commit.oid)).toEqual(['c2', 'c1']);

    await userEvent.keyboard('k');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    await expect.element(details()).not.toHaveTextContent('Not in the loaded history.');
    await expect.poll(cursorDrawn).toBe(true);
});

test("the details' K and J buttons do what the keys do: on the first row with a commit not loaded open, K stays", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const kept = [sampleCommit('c2', 20, ['old']), sampleCommit('c1', 10)];
    await mount({
        commits: [...kept, sampleCommit('old', 1)],
        branches: [sampleCommitRef('main', 'c2'), sampleCommitRef('feat/a', 'c1')],
        kept,
        holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('p');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();

    await userEvent.click(details().getByRole('button', { name: 'Previous commit' }));
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    expect(cursor()?.textContent).toContain('Commit c2');

    await userEvent.click(details().getByRole('button', { name: 'Next commit' }));
    await expect.element(details().getByRole('heading', { name: 'Commit c1' })).toBeVisible();
    expect(cursor()?.textContent).toContain('Commit c1');
});

test("Enter from a ref's details moves on to the cursor's commit; another account signing in opens them again on the new graph's commit", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const history = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['old'])];
    const view = await mount({
        commits: [...history, sampleCommit('old', 1)],
        branches: [sampleCommitRef('main', 'c2')],
        tags: [sampleCommitRef('v0.1', 'old')],
        kept: history,
        holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    await userEvent.keyboard('b');
    await userEvent.keyboard('v0.1{Enter}');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(view.scroller());

    await userEvent.keyboard('b');
    await userEvent.keyboard('v0.1{Enter}');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();

    const { localStorage } = view.container.resolve(Browser);
    const login = `user-${crypto.randomUUID()}`;
    localStorage.setItem(VIEWER_KEY, JSON.stringify({ login, name: null, avatarUrl: 'https://avatars.test/user' }));
    localStorage.setItem(TOKEN_KEY, `gho_${login}`);
    window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY, storageArea: window.localStorage }));
    // Opened again, on the commit the new account's graph starts on: nothing of the previous account's is left.
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).not.toBeInTheDocument();
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
});

test("D16, CH29: Shift+Enter opens the pull request in place of the details, the keys are the item's meanwhile, and closing it comes back to the commit", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount(sampleWebappHistory());
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    await userEvent.keyboard('kk');
    await expect.element(details().getByRole('button', { name: /Pull request 1231/ })).toBeVisible();

    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect
        .poll(() => view.router.currentRoute.value.query)
        .toMatchObject({ pane: 'issue', issue: 'acme|web|1231' });
    await expect.element(details()).not.toBeInTheDocument();

    // Esc is the item's, J too: under it the commit stays as it was.
    await userEvent.keyboard('j');
    expect(cursor()?.textContent).toContain('feat: preview a class');
    await userEvent.keyboard('{Escape}');
    await view.router.push({ query: {} });

    await expect.element(details().getByRole('heading', { name: /feat: preview a class/ })).toBeVisible();
    expect(cursor()?.textContent).toContain('feat: preview a class');
});

test("a fork's commit opens its upstream's pull request, by its address, in the arrangement items open in", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const pullRequest = {
        number: 1203,
        state: 'OPEN',
        title: 'From the fork',
        url: 'https://github.com/upstream/web/pull/1203',
        isDraft: false,
    } as const;
    const view = await mount({
        commits: [sampleCommit('c1', 10)],
        states: new Map([['c1', { pullRequest, ci: null }]]),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c1');
    await expect.element(details().getByRole('button', { name: /From the fork/ })).toBeVisible();

    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect
        .poll(() => view.router.currentRoute.value.query)
        .toMatchObject({ pane: 'issue', issue: 'upstream|web|1203' });

    await view.router.push({ query: {} });
    await expect.element(details()).toBeVisible();
    view.container.resolve(LocalPreferences).itemArrangement.value = 'page';
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect.poll(() => view.router.currentRoute.value.path).toBe('/upstream/web/pull/1203');
});

test("D16: O opens the commit on GitHub; Esc with a layer open is the layer's", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)] });
    const openInNewTab = vi.spyOn(view.container.resolve(Browser), 'openInNewTab').mockImplementation(() => {});
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    // Not while they are closed.
    await closeDetails();
    await userEvent.keyboard('o');
    expect(openInNewTab).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('o');
    expect(openInNewTab).toHaveBeenCalledWith('https://github.com/acme/web/commit/c2');

    const layer = document.createElement('div');
    layer.dataset.layer = '';
    document.body.append(layer);
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('j');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    // The details' keys are the layer's too.
    await userEvent.keyboard('op');
    expect(openInNewTab).toHaveBeenCalledTimes(1);
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    layer.remove();

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
});

test("D16: a tooltip up takes none of the details' keys", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const states = new Map<string, CommitState>([
        [
            'c1',
            {
                pullRequest: {
                    number: 7,
                    state: 'OPEN',
                    title: 'The change',
                    url: 'https://github.com/acme/web/pull/7',
                    isDraft: false,
                },
                ci: null,
            },
        ],
    ]);
    const merge = sampleCommit('c3', 30, ['c2', 'c1']);
    const view = await mount({ commits: [merge, sampleCommit('c2', 20), sampleCommit('c1', 10)], states });
    const openInNewTab = vi.spyOn(view.container.resolve(Browser), 'openInNewTab').mockImplementation(() => {});
    await expect.poll(() => cursor()?.textContent).toContain('Commit c3');
    await userEvent.keyboard('{Enter}');
    await expect.element(details().getByRole('heading', { name: 'Commit c3' })).toBeVisible();

    const tooltip = document.createElement('div');
    tooltip.setAttribute('data-reka-popper-content-wrapper', '');
    document.body.append(tooltip);
    onTestFinished(() => tooltip.remove());

    await userEvent.keyboard('o');
    expect(openInNewTab).toHaveBeenCalledWith('https://github.com/acme/web/commit/c3');
    await userEvent.keyboard('p');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    await userEvent.keyboard('k');
    await expect.element(details().getByRole('heading', { name: 'Commit c3' })).toBeVisible();
    await userEvent.keyboard('{Shift>}p{/Shift}');
    await expect.element(details().getByRole('heading', { name: 'Commit c1' })).toBeVisible();
    await expect.poll(() => view.store.getState(REPOSITORY, 'c1')?.pullRequest?.number).toBe(7);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect.poll(() => view.router.currentRoute.value.query).toMatchObject({ pane: 'issue', issue: 'acme|web|7' });
});

test('CH41: the commit gone from the graph under open details stays readable and says so, until J moves on', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({
        commits: [
            sampleCommit('old', 30, ['base']),
            sampleCommit('other', 25, ['base']),
            sampleCommit('base', 10),
            sampleCommit('new', 40, ['base']),
        ],
        kept: [sampleCommit('old', 30, ['base']), sampleCommit('other', 25, ['base']), sampleCommit('base', 10)],
        branches: [sampleCommitRef('main', 'other'), sampleCommitRef('fix/a', 'old')],
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit other');
    await userEvent.keyboard('k');
    await expect.poll(() => cursor()?.textContent).toContain('Commit old');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();

    const { repository } = view.github;
    repository.branch('fix/a', 'new');
    await view.store.open(REPOSITORY);

    await expect.element(details()).toHaveTextContent('It is no longer in the graph.');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('None any more.');
    await expect.element(page.getByRole('listitem').filter({ hasText: 'Commit old' })).not.toBeInTheDocument();
    const under = cursor()?.textContent;
    expect(under).not.toContain('Commit old');
    await expect.poll(cursorDrawn).toBe(false);

    await userEvent.keyboard('j');
    await expect.poll(() => cursor()?.textContent).not.toBe(under);
    await expect.poll(cursorDrawn).toBe(true);
    await expect.element(details()).not.toHaveTextContent('It is no longer in the graph.');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).not.toBeInTheDocument();
});

test('CH41: the commit gone under details closed by Esc does not open them again', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({
        commits: [
            sampleCommit('old', 30, ['base']),
            sampleCommit('other', 25, ['base']),
            sampleCommit('base', 10),
            sampleCommit('new', 40, ['base']),
        ],
        kept: [sampleCommit('old', 30, ['base']), sampleCommit('other', 25, ['base']), sampleCommit('base', 10)],
        branches: [sampleCommitRef('main', 'other'), sampleCommitRef('fix/a', 'old')],
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit other');
    await userEvent.keyboard('k');
    await expect.poll(() => cursor()?.textContent).toContain('Commit old');
    await closeDetails();

    view.github.repository.branch('fix/a', 'new');
    await view.store.open(REPOSITORY);

    await expect.element(page.getByRole('listitem').filter({ hasText: 'Commit old' })).not.toBeInTheDocument();
    await expect.poll(() => cursor()?.textContent).not.toContain('Commit old');
    await expect.element(details()).not.toBeInTheDocument();
});

test("a section entered with the graph already in memory starts on the default branch's tip in view, reading its details", async () => {
    const commits = Array.from({ length: 300 }, (_, index) =>
        sampleCommit(`c${index}`, index, index > 0 ? [`c${index - 1}`] : []),
    );
    const view = await mount(
        {
            commits,
            branches: [sampleCommitRef('main', 'c50'), sampleCommitRef('feat/a', 'c299')],
            bodies: new Map([['c50', 'Read at mount.']]),
        },
        { graphInMemory: true },
    );

    await expect.poll(() => cursor()?.textContent).toContain('Commit c50');
    const scroller = view.scroller();
    // Far down the list: brought into view once the pane was there.
    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0);
    const row = (cursor()?.getBoundingClientRect().top ?? 0) - scroller.getBoundingClientRect().top;
    expect(row).toBeGreaterThanOrEqual(0);
    expect(row + 32).toBeLessThanOrEqual(scroller.clientHeight);
    await expect.element(details().getByRole('heading', { name: 'Commit c50' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('Read at mount.');
    expect(view.github.requests.filter(request => request === 'CommitStates').length).toBeGreaterThan(0);
});

test('D15, D16: below about 1,200 px the details dock under the graph, the full width at 45% of the height, the list over the graph only, and Esc leaves the list first', async () => {
    await page.viewport(1100, 700);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: parallelBranches(4) });
    const paneWidth = view.scroller().clientWidth;
    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');

    // Open from the start, under the graph: the whole width, 45% of the section, the graph above it.
    await expect.element(details()).toBeVisible();
    const docked = details().element().getBoundingClientRect();
    const pane = view.scroller().getBoundingClientRect();
    expect(view.scroller().clientWidth).toBe(paneWidth);
    expect(docked.width).toBe(paneWidth);
    expect(docked.top).toBe(pane.bottom);
    expect(docked.height).toBeCloseTo(600 * 0.45, 0);

    // B puts the list over the graph, and the details stay under it, not covered.
    await userEvent.keyboard('b');
    await expect.element(filter()).toHaveFocus();
    await expect.element(details()).toBeVisible();
    expect(refList().element().getBoundingClientRect().bottom).toBeLessThanOrEqual(docked.top);
    expect(details().element().getBoundingClientRect().top).toBe(docked.top);

    // With the keys off its filter, Esc leaves the list first and the details after it.
    filter().element().blur();
    await userEvent.keyboard('{Escape}');
    await expect.element(filter()).not.toBeInTheDocument();
    await expect.element(details()).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(view.scroller());
});

test("the cursor's row stays in view when the details dock under the graph and shorten it: at the start, after a click on a lower row, and after J", async () => {
    await page.viewport(1100, 700);
    onTestFinished(() => page.viewport(414, 896));
    const commits = Array.from({ length: 100 }, (_, index) =>
        sampleCommit(`c${index}`, index, index > 0 ? [`c${index - 1}`] : []),
    );
    // The default branch's tip is the 16th row: in the tall pane, below the short one.
    const view = await mount({ commits, branches: [sampleCommitRef('main', 'c84'), sampleCommitRef('feat/a', 'c99')] });
    const scroller = view.scroller();
    await expect.poll(() => cursor()?.textContent).toContain('Commit c84');
    const inView = () => {
        const row = cursor()?.getBoundingClientRect();
        const pane = scroller.getBoundingClientRect();
        return row !== undefined && row.top >= pane.top && row.bottom <= pane.bottom;
    };
    // The pane is the shorter one from the start, and the viewport the rows are measured from with it.
    await expect.element(details()).toBeVisible();
    expect(scroller.clientHeight).toBeLessThan(400);
    expect(inView()).toBe(true);

    // Closed, the pane is tall; a click on a row near its bottom, then the details open again by J: still in view.
    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    const tall = scroller.clientHeight;
    const rows = Array.from(document.querySelectorAll<HTMLElement>('li[aria-posinset]'));
    const lower = rows.findLast(row => row.getBoundingClientRect().bottom <= scroller.getBoundingClientRect().bottom);
    expect(lower).toBeDefined();
    lower?.click();
    expect(inView()).toBe(true);

    await userEvent.keyboard('j');
    await expect.element(details()).toBeVisible();
    expect(scroller.clientHeight).toBeLessThan(tall);
    await expect.poll(inView).toBe(true);
});

test("the cursor's row stays in view when the window narrows below 1,200 px and the details dock under the graph", async () => {
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const commits = Array.from({ length: 100 }, (_, index) =>
        sampleCommit(`c${index}`, index, index > 0 ? [`c${index - 1}`] : []),
    );
    // The tip is the 16th row: in view beside the details, below the pane that is left under them.
    const view = await mount({ commits, branches: [sampleCommitRef('main', 'c84'), sampleCommitRef('feat/a', 'c99')] });
    const scroller = view.scroller();
    await expect.poll(() => cursor()?.textContent).toContain('Commit c84');
    await expect.element(details()).toBeVisible();
    const tall = scroller.clientHeight;

    await page.viewport(1100, 700);
    await expect.poll(() => scroller.clientHeight).toBeLessThan(tall);
    await expect
        .poll(() => {
            const row = cursor()?.getBoundingClientRect();
            const pane = scroller.getBoundingClientRect();
            return row !== undefined && row.top >= pane.top && row.bottom <= pane.bottom;
        })
        .toBe(true);
});

test('a deleted ref disappears when the refs are read again: the selection falls back without an error', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({
        commits: [sampleCommit('c3', 30, ['c1']), sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        branches: [sampleCommitRef('main', 'c3'), sampleCommitRef('feat/a', 'c2')],
    });
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener('error', onError);
    onTestFinished(() => window.removeEventListener('error', onError));

    await userEvent.click(page.getByRole('row', { name: /feat\/a/ }));
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    view.github.repository.deleteBranch('feat/a');
    await view.store.open(REPOSITORY);

    await expect.element(page.getByRole('row', { name: /feat\/a/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('gridcell', { selected: true })).not.toBeInTheDocument();
    expect(errors).toEqual([]);

    // With a filter, on to the best match that is left.
    await userEvent.keyboard('b');
    await userEvent.keyboard('main');
    await expect.element(page.getByRole('gridcell', { selected: true })).toHaveTextContent('main');
});

/** Esc: the details close, and the pane is the graph's again. */
async function closeDetails() {
    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
}

/** An open pull request of `acme/web`. */
function samplePullRequest(number: number) {
    return {
        number,
        state: 'OPEN',
        title: 'A change',
        url: `https://github.com/acme/web/pull/${number}`,
        isDraft: false,
    } as const;
}

/** A commit's text in the graph, not in the details beside or over it. */
function graphText(text: string) {
    return page.getByRole('region', { name: 'Commits of acme/web' }).getByText(text);
}

test('a click on a row and then a key draw no ring around the pane: the cursor row shows where the keys go', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)] });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    await userEvent.click(page.getByRole('listitem').filter({ hasText: 'Commit c1' }));
    await userEvent.keyboard('{Enter}');

    const scroller = view.scroller();
    expect(document.activeElement).toBe(scroller);
    expect(scroller.matches(':focus-visible')).toBe(true);
    expect(getComputedStyle(scroller).outlineStyle).toBe('none');
});

test("D18: the row's pull request number links to it, in the tab order: a click opens it, the cursor staying, a modified click is the browser's", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const pullRequest = {
        number: 1203,
        state: 'OPEN',
        title: 'From the fork',
        url: 'https://github.com/upstream/web/pull/1203',
        isDraft: false,
    } as const;
    const view = await mount({
        commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        branches: [sampleCommitRef('main', 'c2'), sampleCommitRef('feat/a', 'c1')],
        states: new Map([['c1', { pullRequest, ci: null }]]),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    const link = page.getByRole('listitem').filter({ hasText: 'Commit c1' }).getByRole('link', { name: /1203/ });
    await expect.element(link).toHaveAttribute('href', '/upstream/web/pull/1203');
    expect(link.element().tabIndex).toBe(0);

    // A listener of the link's own runs after the component's, and stops the new tab a test has no use for.
    let handedToBrowser = false;
    link.element().addEventListener('click', event => {
        handedToBrowser = !event.defaultPrevented;
        event.preventDefault();
    });
    link.element().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    expect(handedToBrowser).toBe(true);
    expect(view.router.currentRoute.value.query).toEqual({});
    expect(cursor()?.textContent).toContain('Commit c2');

    await userEvent.click(link);
    await expect
        .poll(() => view.router.currentRoute.value.query)
        .toMatchObject({ pane: 'issue', issue: 'upstream|web|1203' });
    expect(handedToBrowser).toBe(false);
    expect(cursor()?.textContent).toContain('Commit c2');
});

test("D18: a branch's pull request in the list opens it, the list done with: its filter cleared, closed over the graph, the keys on the graph and the cursor where it was", async () => {
    await page.viewport(1100, 700);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({
        commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        branches: [sampleCommitRef('main', 'c2'), sampleCommitRef('feat/a', 'c1')],
        states: new Map([['c1', { pullRequest: samplePullRequest(1203), ci: null }]]),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    await userEvent.keyboard('b');
    await userEvent.keyboard('feat');
    await expect.element(filter()).toHaveValue('feat');

    await userEvent.click(refList().getByRole('link', { name: /1203/ }));

    await expect
        .poll(() => view.router.currentRoute.value.query)
        .toMatchObject({ pane: 'issue', issue: 'acme|web|1203' });
    await expect.element(refList()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(view.scroller());
    expect(cursor()?.textContent).toContain('Commit c2');

    await view.router.push({ query: {} });
    await userEvent.keyboard('b');
    await expect.element(filter()).toHaveValue('');
});

test('a click on a CI mark is a click on what it sits in: the commit of a graph row, the branch of a list row, with its details', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    await mount({
        commits: [sampleCommit('c3', 30, ['c2']), sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
        branches: [sampleCommitRef('main', 'c3'), sampleCommitRef('feat/a', 'c1')],
        states: new Map([
            ['c2', { pullRequest: null, ci: 'FAILURE' }],
            ['c1', { pullRequest: null, ci: 'SUCCESS' }],
        ]),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c3');
    const graphRow = page.getByRole('region', { name: 'Commits of acme/web' }).getByRole('listitem').nth(1);

    await userEvent.click(graphRow.getByRole('img', { name: 'Checks failing' }));
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    expect(cursor()?.textContent).toContain('Commit c2');

    await userEvent.click(page.getByRole('row', { name: /feat\/a/ }).getByRole('img', { name: 'Checks passing' }));
    await expect.element(details().getByRole('heading', { name: 'Commit c1' })).toBeVisible();
    expect(cursor()?.textContent).toContain('Commit c1');
});

test("back from a run's page: the cursor on its commit in view, its details, kept through what the open reads; used once, and another page or closed details leave none", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const commits = Array.from({ length: 300 }, (_, index) =>
        sampleCommit(`c${index}`, index, index > 0 ? [`c${index - 1}`] : []),
    );
    const view = await mountRouted({
        commits,
        branches: [sampleCommitRef('main', 'c299')],
        tags: [sampleCommitRef('v1', 'c100')],
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c299');

    await userEvent.click(page.getByRole('row', { name: /v1/ }));
    await expect.element(details().getByRole('heading', { name: 'Commit c100' })).toBeVisible();

    await view.router.push(RUN);
    await expect.element(page.getByRole('region', { name: 'Commits of acme/web' })).not.toBeInTheDocument();
    await view.router.push(COMMITS);
    await expect.poll(() => cursor()?.textContent).toContain('Commit c100');
    await expect.element(details().getByRole('heading', { name: 'Commit c100' })).toBeVisible();
    const scroller = view.scroller();
    const inView = () => {
        const row = cursor()?.getBoundingClientRect();
        const pane = scroller.getBoundingClientRect();
        return row !== undefined && row.top >= pane.top && row.bottom <= pane.bottom;
    };
    await expect.poll(inView).toBe(true);

    await view.store.open(REPOSITORY);
    await nextTick();
    expect(cursor()?.textContent).toContain('Commit c100');
    await expect.element(details().getByRole('heading', { name: 'Commit c100' })).toBeVisible();
    await userEvent.keyboard('j');
    await expect.element(details().getByRole('heading', { name: 'Commit c99' })).toBeVisible();

    // Somewhere else after the run's page, and the place is gone: only coming straight back finds it.
    await view.router.push(RUN);
    await view.router.push('/acme/web/pull/1');
    await view.router.push(COMMITS);
    await expect.poll(() => cursor()?.textContent).toContain('Commit c299');
    await userEvent.click(page.getByRole('row', { name: /v1/ }));
    await expect.element(details().getByRole('heading', { name: 'Commit c100' })).toBeVisible();
    await view.router.push(RUN);
    await view.router.push(COMMITS);
    await expect.poll(() => cursor()?.textContent).toContain('Commit c100');
    await userEvent.keyboard('j');
    await expect.element(details().getByRole('heading', { name: 'Commit c99' })).toBeVisible();

    // Used once: another page next, and it starts at its start. Leaving for it keeps nothing, details open or not.
    await view.router.push('/acme/web/pull/1');
    await view.router.push(COMMITS);
    await expect.poll(() => cursor()?.textContent).toContain('Commit c299');
    await expect.element(details().getByRole('heading', { name: 'Commit c299' })).toBeVisible();

    await userEvent.keyboard('j');
    await closeDetails();
    await view.router.push(RUN);
    await view.router.push(COMMITS);
    await expect.poll(() => cursor()?.textContent).toContain('Commit c299');
});

test("back from a run's page, the commit that was open though it isn't a row or the cursor's: its ref with it, and it stays through what the open reads", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const history = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['old'])];
    const view = await mountRouted({
        commits: [...history, sampleCommit('old', 1)],
        branches: [sampleCommitRef('main', 'c2')],
        tags: [sampleCommitRef('v0.1', 'old')],
        kept: history,
        holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    await userEvent.keyboard('j');
    await expect.poll(() => cursor()?.textContent).toContain('Commit c1');
    await userEvent.keyboard('b');
    await userEvent.keyboard('v0.1{Enter}');
    await expect.element(details()).toHaveTextContent('Not in the loaded history. v0.1 is from');

    await view.router.push(RUN);
    await view.router.push(COMMITS);

    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('Not in the loaded history. v0.1 is from');
    await expect.poll(() => cursor()?.textContent).toContain('Commit c1');
    await expect.poll(cursorDrawn).toBe(false);

    await view.store.open(REPOSITORY);
    await nextTick();
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();

    await userEvent.keyboard('k');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    await expect.poll(cursorDrawn).toBe(true);
});

test("back from a run's page with the cursor's commit gone from the graph meanwhile: the cursor at the start with no error, the commit that was open saying so", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mountRouted({
        commits: [
            sampleCommit('old', 30, ['base']),
            sampleCommit('other', 25, ['base']),
            sampleCommit('base', 10),
            sampleCommit('new', 40, ['base']),
        ],
        kept: [sampleCommit('old', 30, ['base']), sampleCommit('other', 25, ['base']), sampleCommit('base', 10)],
        branches: [sampleCommitRef('main', 'other'), sampleCommitRef('fix/a', 'old')],
    });
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener('error', onError);
    onTestFinished(() => window.removeEventListener('error', onError));
    await expect.poll(() => cursor()?.textContent).toContain('Commit other');
    await userEvent.keyboard('k');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();

    await view.router.push(RUN);
    view.github.repository.branch('fix/a', 'new');
    await view.store.open(REPOSITORY);
    await view.router.push(COMMITS);

    await expect.poll(() => cursor()?.textContent).toContain('Commit other');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('It is no longer in the graph.');
    expect(errors).toEqual([]);
});

test("a run in another repository: the place is this repository's; with the prop already on the other, none is kept, nothing of the other's under this one", async () => {
    const commits = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)];
    const view = await mountRouted({ commits, branches: [sampleCommitRef('main', 'c2')] });
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();

    await view.router.push('/acme/other/actions/runs/1');
    await expect.element(details()).not.toBeInTheDocument();
    expect(view.store.takePlace('acme/other')).toBeUndefined();
    expect(view.store.takePlace(REPOSITORY)).toMatchObject({ cursorOid: 'c2', opened: { oid: 'c2' } });

    const other = view.github.otherRepository('acme/other');
    other.add('o1', 30, []);
    other.branch('main', 'o1');
    await view.router.push(COMMITS);
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();

    // The same page's prop moves to the other repository first, and shows its commit, before the page goes.
    await view.router.push('/acme/other/commits');
    await expect.element(details().getByRole('heading', { name: 'Commit o1' })).toBeVisible();
    await view.router.push('/acme/other/actions/runs/1');
    await expect.element(details()).not.toBeInTheDocument();
    expect(view.store.takePlace(REPOSITORY)).toBeUndefined();
    expect(view.store.takePlace('acme/other')).toBeUndefined();
});

/** The panel of a commit's details. */
function details() {
    return page.getByRole('region', { name: 'Commit details' });
}

/** The width of the details beside the graph: of their column, its line included. */
function detailsWidth() {
    return details().element().parentElement?.getBoundingClientRect().width;
}

/** The handle on the details' left edge. */
function detailsHandle() {
    return page.getByRole('separator', { name: 'Resize the commit details' });
}

/** The field of the list of branches and tags. */
function filter() {
    return page.getByRole('combobox', { name: 'Filter branches and tags' });
}

/** The list of branches and tags, wherever it renders. */
function refList() {
    return page.getByRole('region', { name: 'Branches and tags' });
}

/** The row under the cursor. */
function cursor() {
    return document.querySelector('li[aria-current="true"]');
}

/** Whether the row under the cursor looks it: its accent edge, as a list's selected row. */
function cursorDrawn() {
    const row = cursor();
    return row !== null && getComputedStyle(row).boxShadow !== 'none';
}

/** The rows' slices of the graph, each the first drawing of its row. */
function graphCells() {
    return [...document.querySelectorAll('li')].flatMap(row => row.querySelector('svg') ?? []);
}

function dotsX() {
    return graphCells().map(cell => Number(cell.querySelector('circle')?.getAttribute('cx')));
}

/** Where the lines reach a row's top or bottom edge. */
function getLanesAt(edge: 'bottom' | 'top', cell: SVGSVGElement | undefined) {
    const lanes = new Set<number>();
    for (const path of cell?.querySelectorAll('path') ?? []) {
        // `M x y V y`, or a curve `M x y Q x y x y`.
        const numbers = (path.getAttribute('d')?.match(/[\d.]+/g) ?? []).map(Number);
        if (edge === 'top' && numbers[1] === 0) {
            lanes.add(numbers[0] ?? -1);
        } else if (edge === 'bottom' && numbers.at(-1) === 32) {
            lanes.add(numbers.length === 3 ? (numbers[0] ?? -1) : (numbers.at(-2) ?? -1));
        }
    }

    return [...lanes].toSorted((a, b) => a - b);
}

/** `lanes` branches side by side from one commit, so the graph needs exactly that many lanes. */
function parallelBranches(lanes: number) {
    const tips = Array.from({ length: lanes }, (_, index) => sampleCommit(`t${index}`, 1000 - index, ['root']));
    return [...tips, sampleCommit('root', 1)];
}

/** The element a repository's column gives the list, 280 px wide as the column is by default. */
function columnTarget() {
    const target = document.createElement('div');
    target.id = COMMIT_REF_LIST_TARGET_ID;
    target.style.display = 'flex';
    target.style.flexDirection = 'column';
    target.style.width = '280px';
    target.style.height = '600px';
    document.body.append(target);
    onTestFinished(() => target.remove());
    return target;
}

/** The section as the app has it, under a router view: leaving for another route unmounts it. */
async function mountRouted(options: CommitGraphTestOptions) {
    const { container, store, github, ready } = createCommitGraphTest(options);
    await ready;
    const section = defineComponent({
        setup() {
            const route = useRoute();
            return () => h(CommitGraphView, { nameWithOwner: getRouteNameWithOwner(route) });
        },
    });
    const elsewhere = defineComponent({ render: () => null });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/:owner/:name/commits', name: 'repository', component: section },
            { path: WORKFLOW_RUN_PATH, name: 'workflow-run', component: elsewhere },
            { path: '/:path(.*)*', component: elsewhere },
        ],
    });
    await router.push(COMMITS);
    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.width = '1200px';
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

    return {
        store,
        github,
        router,
        scroller: () => {
            const element = host.querySelector<HTMLElement>('[role="region"]');
            if (!element) {
                throw new Error('No scroller');
            }
            return element;
        },
    };
}

/** How `mount` places the section. */
interface MountPlace {
    /** Kept on this device as the graph's share of the pane. */
    readonly keptShare?: string;
    /** Kept on this device as the left column's width. */
    readonly keptColumnWidth?: number;
    /** Kept on this device as the commit details' width. */
    readonly keptDetailsWidth?: number;
    /** A ref to change it while mounted. */
    readonly refListInColumn?: boolean | Ref<boolean>;
    /** What the section has of the window: 1,200 px when not given. */
    readonly width?: number;
    /** The graph was opened before: the section is entered with it in memory. */
    readonly graphInMemory?: boolean;
}

/** Mounts the section over the real store and a GitHub holding `options`, 600 px tall, at the sample's moment. */
async function mount(
    options: CommitGraphTestOptions,
    { keptShare, keptColumnWidth, keptDetailsWidth, refListInColumn, width = 1200, graphInMemory }: MountPlace = {},
) {
    const { container, store, github, setOnline, ready } = createCommitGraphTest(options);
    await ready;
    if (graphInMemory) {
        await store.open(REPOSITORY);
    }

    if (keptShare !== undefined) {
        container.resolve(Browser).localStorage.setItem(SHARE_KEY, keptShare);
    }

    if (keptColumnWidth !== undefined) {
        container.resolve(LocalPreferences).getPanelWidth('repositoryColumn').value = keptColumnWidth;
    }

    if (keptDetailsWidth !== undefined) {
        container.resolve(LocalPreferences).getPanelWidth('commitDetails').value = keptDetailsWidth;
    }

    const ensureStates = vi.spyOn(store, 'ensureStates');
    const loadMore = vi.spyOn(store, 'loadMore');
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
    });
    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.width = `${width}px`;
    host.style.height = '600px';
    document.body.append(host);

    const app = createApp({
        setup: () => () => h(CommitGraphView, { nameWithOwner: REPOSITORY, refListInColumn: unref(refListInColumn) }),
    });
    app.use(IocPlugin, { container });
    app.use(router);
    await router.isReady();
    app.mount(host);
    const unmount = () => {
        app.unmount();
        host.remove();
    };
    let unmounted = false;
    onTestFinished(() => {
        if (!unmounted) {
            unmount();
        }
    });

    return {
        container,
        store,
        github,
        setOnline,
        ensureStates,
        loadMore,
        router,
        unmount: () => {
            unmounted = true;
            unmount();
        },
        scroller: () => {
            const element = host.querySelector<HTMLElement>('[role="region"]');
            if (!element) {
                throw new Error('No scroller');
            }
            return element;
        },
    };
}
