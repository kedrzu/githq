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
import type { CommitRef, CommitState } from './CommitTypes.js';

const REPOSITORY = 'acme/web';
const SHARE_KEY = 'githq.panelShare.commitGraph';

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
        const view = await mount({ commits: sampleHistory({ count: 400, seed: 7 }) }, String(share));
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
    const view = await mount({ commits: parallelBranches(14) }, '0.05');
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
    ['nothing a share could be', 'wide', '8'],
    ['a share of nothing', '0', '8'],
    ['more than the pane', '7', '8'],
])('D17: %s draws within range', async (_title, kept, lanes) => {
    await mount({ commits: parallelBranches(14) }, kept);
    await expect
        .element(page.getByRole('separator', { name: 'Resize the commit graph' }))
        .toHaveAttribute('aria-valuenow', lanes);
    expect(new Set(dotsX()).size).toBe(Number(lanes));
});

test("D15: below about 1,200 px of window the list is folded away; B opens it over the graph without taking the graph's width, Esc closes it and choosing does too", async () => {
    await page.viewport(1100, 700);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: parallelBranches(14) });
    const list = page.getByRole('listbox', { name: 'Branches and tags' });
    const paneWidth = view.scroller().clientWidth;

    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');
    await expect.element(list).not.toBeInTheDocument();

    await userEvent.keyboard('b');
    await expect.element(list).toBeVisible();
    await expect.element(filter()).toHaveFocus();
    expect(view.scroller().clientWidth).toBe(paneWidth);

    await userEvent.keyboard('{Escape}');
    await expect.element(list).not.toBeInTheDocument();
    expect(document.activeElement).toBe(view.scroller());

    await userEvent.keyboard('b');
    await userEvent.keyboard('branch-3{Enter}');
    await expect.element(list).not.toBeInTheDocument();
    expect(document.activeElement).toBe(view.scroller());
    await expect.poll(() => cursor()?.textContent).toContain('branch-3');

    // Opened anew, without the filter it was left with.
    await userEvent.keyboard('b');
    await expect.element(filter()).toHaveValue('');
});

test("D17: the graph's share is of the pane without the list", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: parallelBranches(14) });
    await expect.poll(() => graphCells().length).toBeGreaterThan(0);

    expect(view.scroller().clientWidth).toBe(1200 - 280);
    expect(graphCells()[0]?.getBoundingClientRect().width).toBe(92);
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

    await userEvent.click(page.getByRole('option', { name: /v1/ }));

    await expect.poll(() => cursor()?.textContent).toContain('Commit c200');
    const top = (cursor()?.getBoundingClientRect().top ?? 0) - scroller.getBoundingClientRect().top;
    expect(Math.abs(top - scroller.clientHeight / 3)).toBeLessThan(1);
    // CH26: back to the graph, whose next Enter is on that commit; the list keeps no choice.
    await expect.poll(() => document.activeElement).toBe(scroller);
    await expect.element(page.getByRole('option', { selected: true })).not.toBeInTheDocument();
    expect(view.onOpenCommitDetails).not.toHaveBeenCalled();

    const scrolled = scroller.scrollTop;
    await userEvent.keyboard('b');
    await userEvent.keyboard('main');
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => document.activeElement).toBe(scroller);
    expect(scroller.scrollTop).toBe(scrolled);
    expect(cursor()?.textContent).toContain('Commit c200');
});

test('D12, CH16: a ref whose commit is not loaded asks for its details and leaves the graph where it was', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const old = sampleCommit('old', 1);
    const history = [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10, ['old'])];
    const view = await mount({
        commits: [...history, old],
        branches: [sampleCommitRef('main', 'c2')],
        tags: [sampleCommitRef('v0.1', 'old')],
        kept: history,
        holdIf: operation => (operation === 'CommitHistories' ? new Promise<void>(() => {}) : null),
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    await userEvent.keyboard('b');
    await userEvent.keyboard('v0.1{Enter}');

    await expect.poll(() => view.onOpenCommitDetails.mock.calls.length).toBe(1);
    expect(view.onOpenCommitDetails.mock.lastCall?.[0]).toMatchObject({ name: 'v0.1', oid: 'old' });
    expect(cursor()?.textContent).toContain('Commit c2');
    expect(view.scroller().scrollTop).toBe(0);
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

    await userEvent.click(page.getByRole('option', { name: /feat\/a/ }));
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    view.github.repository.deleteBranch('feat/a');
    await view.store.open(REPOSITORY);

    await expect.element(page.getByRole('option', { name: /feat\/a/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('option', { selected: true })).not.toBeInTheDocument();
    expect(errors).toEqual([]);

    // With a filter, on to the best match that is left.
    await userEvent.keyboard('b');
    await userEvent.keyboard('main');
    await expect.element(page.getByRole('option', { selected: true })).toHaveTextContent('main');
});

/** The field of the list of branches and tags. */
function filter() {
    return page.getByRole('combobox', { name: 'Filter branches and tags' });
}

/** The row under the cursor. */
function cursor() {
    return document.querySelector('li[aria-current="true"]');
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

/**
 * Mounts the section over the real store and a GitHub holding `options`, 600 px tall, at the sample's moment, with
 * `keptShare` kept on this device as the graph's share of the pane.
 */
async function mount(options: CommitGraphTestOptions, keptShare?: string) {
    const { container, store, github, ready } = createCommitGraphTest(options);
    await ready;
    if (keptShare !== undefined) {
        container.resolve(Browser).localStorage.setItem(SHARE_KEY, keptShare);
    }

    const ensureStates = vi.spyOn(store, 'ensureStates');
    const loadMore = vi.spyOn(store, 'loadMore');
    const onOpenCommitDetails = vi.fn<(ref: CommitRef) => void>();
    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.width = '1200px';
    host.style.height = '600px';
    document.body.append(host);

    const app = createApp({
        setup: () => () => h(CommitGraphView, { nameWithOwner: REPOSITORY, onOpenCommitDetails }),
    });
    app.use(IocPlugin, { container });
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
        ensureStates,
        loadMore,
        onOpenCommitDetails,
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
