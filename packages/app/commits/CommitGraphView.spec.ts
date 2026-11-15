import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { assertValue } from '@nzyme/utils/assert.js';
import { createPromise } from '@nzyme/utils/createPromise.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, defineComponent, h, nextTick, ref, unref } from 'vue';
import type { Ref } from 'vue';
import { createMemoryHistory, createRouter, RouterView, useRoute } from 'vue-router';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

import { VIEWER_KEY } from '@/auth/AuthStore.js';
import { TOKEN_KEY } from '@/auth/TokenVault.js';
import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import type { ItemList } from '@/item/ItemNavigation.js';
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
import { storedToken } from '@/testing/storedToken.js';
import { trackTabFocus } from '@/testing/trackTabFocus.js';
import { uniqueLogin } from '@/testing/uniqueLogin.js';
import { getRouteNameWithOwner, WORKFLOW_RUN_PATH } from '@/tracking/trackingRoutes.js';

import CommitGraphView from './CommitGraphView.vue';
import { CommitRoutes } from './commitRoutes.js';
import { COMMIT_REF_LIST_TARGET_ID } from './CommitTypes.js';
import type { CommitRef, CommitState, KeptCommit } from './CommitTypes.js';
import OpenedCommit from './OpenedCommit.vue';

const REPOSITORY = 'acme/web';
const SHARE_KEY = 'githq.panelShare.commitGraph';
const COMMITS = '/acme/web/commits';
const RUN = '/acme/web/actions/runs/1';
/** `$color-accent` and `$color-fg-3`, as computed. */
const ACCENT = 'rgb(123, 135, 247)';
const FG_3 = 'rgb(101, 108, 118)';
/** `$color-graph-line`, `$color-graph-line-main`, `$color-graph-lane-1…8`, `$color-red` and `$color-amber`, as computed. */
const GRAPH_LINE = FG_3;
const GRAPH_LINE_MAIN = 'rgb(139, 146, 155)';
const LANES = [
    'rgb(88, 153, 228)',
    'rgb(145, 181, 74)',
    'rgb(177, 144, 234)',
    'rgb(65, 170, 144)',
    'rgb(199, 132, 205)',
    'rgb(57, 174, 198)',
    'rgb(93, 182, 105)',
    'rgb(134, 174, 203)',
];
const RED = 'rgb(248, 81, 73)';
const AMBER = 'rgb(210, 153, 34)';

test('only the rows near the viewport are drawn: a 5,000-commit graph draws a few dozen, and asks the state of those on screen only', async () => {
    // Wide, so the pane keeps the section's whole height.
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const commits = sampleHistory({ count: 5000, seed: 11 });
    const view = await mount({ commits });
    const rows = page.getByRole('listitem');

    await expect.element(rows.first()).toBeVisible();
    expect(view.github.requests.filter(request => request === 'RepositoryCommitRefs')).toHaveLength(1);
    expect(rows.elements().length).toBeLessThan(60);
    // What the rows on screen ask is the longer call.
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

test('CH59: a commit with a pull request keeps its 32 px row, the pull request a chip with the CI mark outside it', async () => {
    const states = new Map<string, CommitState>([
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
    await mount({ commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)], states });
    const row = (headline: string) => page.getByRole('listitem').filter({ hasText: headline });
    const chip = row('Commit c1').getByRole('link', { name: /1203/ });
    await expect.element(chip).toBeVisible();
    expect(getComputedStyle(chip.element()).borderTopWidth).toBe('1px');
    expect(chip.element().querySelector('[aria-label="Checks failing"]')).toBeNull();
    await expect.element(row('Commit c1').getByRole('img', { name: 'Checks failing' })).toBeVisible();
    expect(row('Commit c1').element().getBoundingClientRect().height).toBe(32);
    expect(row('Commit c2').element().getBoundingClientRect().height).toBe(32);
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

test("CH54: the row's surface spans the graph; its dot is ringed softly under the mouse and in the accent on the cursor's row, a click on the dot moving the cursor there", async () => {
    // Wide, so the rows are all on screen for the mouse.
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    await mount(sampleWebappHistory());
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    const row = (text: string) => page.getByRole('listitem').filter({ hasText: text }).element();
    const chore = row('chore: bump vite to 6.2');

    // Both from the row's left edge, the graph column included.
    expect(getComputedStyle(chore, '::after').left).toBe('4px');
    expect(getComputedStyle(cursor()!, '::after').left).toBe('4px');
    expect(getComputedStyle(chore).cursor).toBe('pointer');
    // The mouse on the cursor's row, which keeps its accent.
    await userEvent.hover(cursor()!);
    expect(getRing(cursor()!)).toEqual({ stroke: ACCENT, opacity: '1' });
    expect(getRing(chore).opacity).toBe('0');

    await userEvent.hover(chore);
    await expect.poll(() => getRing(chore)).toEqual({ stroke: FG_3, opacity: '0.5' });
    expect(getRing(cursor()!).opacity).toBe('1');

    // The dot's own circle, drawn last, at the ring's centre.
    const dot = [...chore.querySelector('svg')!.querySelectorAll('circle')].at(-1)!;
    await userEvent.click(dot);
    await expect.poll(() => cursor()?.textContent).toContain('chore: bump vite to 6.2');
    await expect.element(details().getByRole('heading', { name: 'chore: bump vite to 6.2' })).toBeVisible();
    expect(getRing(chore)).toEqual({ stroke: ACCENT, opacity: '1' });
});

test('the cursor starts on the top row when there is no default branch', async () => {
    const commits = [sampleCommit('c3', 30, ['c1']), sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)];
    const branches = [sampleCommitRef('main', 'c2'), sampleCommitRef('feat/a', 'c3')];
    const view = await mount({ commits, branches });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    view.unmount();

    await mount({ commits, branches, defaultBranch: null });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c3');
    await expect.element(details()).not.toBeInTheDocument();
});

test('D16: entering opens nothing; Enter or a click opens the commit in the panel, added to the history; J/K move the cursor and the panel follows, in place of the address; with the commit closed J/K move the cursor alone', async () => {
    const view = await mount(sampleWebappHistory());
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    expect(view.router.currentRoute.value.fullPath).toBe(COMMITS);
    await expect.element(details()).not.toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    await expect.element(details().getByRole('heading', { name: /Merge pull request #1226/ })).toBeVisible();
    expect(view.router.currentRoute.value.fullPath).toBe(panelPath('a3'));

    await userEvent.keyboard('j');
    await expect.element(details().getByRole('heading', { name: 'chore: bump vite to 6.2' })).toBeVisible();
    expect(view.router.currentRoute.value.fullPath).toBe(panelPath('a4'));
    // Followed in place of the address: Back goes back past the commit, as before it opened.
    view.router.back();
    await expect.element(details()).not.toBeInTheDocument();
    expect(view.router.currentRoute.value.fullPath).toBe(COMMITS);
    expect(cursor()?.textContent).toContain('chore: bump vite to 6.2');

    await userEvent.keyboard('k');
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    await wait(200);
    expect(view.router.currentRoute.value.fullPath).toBe(COMMITS);

    await userEvent.click(graphText("fix: booking time uses the studio's timezone"));
    await expect
        .element(details().getByRole('heading', { name: "fix: booking time uses the studio's timezone" }))
        .toBeVisible();
    expect(view.router.currentRoute.value.fullPath).toBe(panelPath('a2'));
    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
    expect(cursor()?.textContent).toContain("fix: booking time uses the studio's timezone");
    expect(document.activeElement).toBe(view.scroller());
});

test('with nothing open J and K move the cursor alone: no address, no read', async () => {
    const view = await mount({ commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)] });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    await userEvent.keyboard('j');
    await expect.poll(() => cursor()?.textContent).toContain('Commit c1');
    await wait(300);
    expect(view.router.currentRoute.value.fullPath).toBe(COMMITS);
    expect(view.github.requests).not.toContain('CommitDetail');
    await expect.element(details()).not.toBeInTheDocument();
});

test('with a workflow open in the panel the keys are its own, and a click on a commit row opens the commit in its place', async () => {
    const view = await mount({ commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)] });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    await view.router.push(`${COMMITS}?pane=workflow&workflow=acme|web|ci.yml`);

    await userEvent.keyboard('j');
    await wait(100);
    expect(cursor()?.textContent).toContain('Commit c2');

    await userEvent.click(graphText('Commit c1'));
    await expect.element(details().getByRole('heading', { name: 'Commit c1' })).toBeVisible();
    expect(view.router.currentRoute.value.fullPath).toBe(panelPath('c1'));
    expect(cursor()?.textContent).toContain('Commit c1');
});

test('with no room for the panel J and K never leave the graph; Enter and a click open the commit on its page', async () => {
    const view = await mount({
        commits: [sampleCommit('c3', 30, ['c2']), sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
    });
    view.container.resolve(ItemNavigation).setPanelFits(false);
    await expect.poll(() => cursor()?.textContent).toContain('Commit c3');

    await userEvent.keyboard('j');
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    await wait(100);
    expect(view.router.currentRoute.value.fullPath).toBe(COMMITS);

    await userEvent.keyboard('{Enter}');
    await expect.poll(() => view.router.currentRoute.value.path).toBe(`/acme/web/commit/${sha('c2')}`);
    await view.router.push(COMMITS);
    await userEvent.click(graphText('Commit c1'));
    await expect.poll(() => view.router.currentRoute.value.path).toBe(`/acme/web/commit/${sha('c1')}`);
});

test("the section is the list an opened commit steps through: its rows' keys, the cursor's neighbours, its address without the commit", async () => {
    const view = await mount({
        commits: [sampleCommit('c3', 30, ['c2']), sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)],
    });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c3');

    await userEvent.keyboard('j{Enter}');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    const expected: ItemList = {
        kind: 'commit',
        path: COMMITS,
        title: 'Commits',
        steps: [key('c3'), key('c2'), key('c1')],
        stepOf: new Map(),
        around: { previous: key('c3'), next: key('c1') },
    };
    expect(view.container.resolve(ItemNavigation).list).toEqual(expected);
});

test("the cursor starts on the commit opened last when it is this repository's row — closed from its page, back on its row —, opening nothing", async () => {
    const commits = [sampleCommit('c3', 30, ['c2']), sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)];
    const view = await mount({ commits }, { lastOpened: key('c1') });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c1');
    await expect.element(details()).not.toBeInTheDocument();
    view.unmount();

    await mount({ commits }, { lastOpened: CommitRoutes.formatKey({ owner: 'acme', name: 'other', oid: sha('c1') }) });
    await expect.poll(() => cursor()?.textContent).toContain('Commit c3');
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

    await userEvent.keyboard('{Enter}');
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
    const arrive = async (commit: KeptCommit) => {
        repository.commits.set(commit.oid, commit);
        repository.branch(`newest/${commit.oid}`, commit.oid);
        await view.store.open(REPOSITORY);
    };
    const scroller = view.scroller();
    await arrive(hexCommit(sampleCommit('n1', 5000, ['c99'])));
    await expect.poll(() => scroller.scrollTop).toBe(32);
    expect(cursor()?.textContent).toContain('Commit c99');

    // Moved, the same: it stays on its commit, whose row stays where it was on screen.
    await userEvent.keyboard('jjj');
    const before = cursor()?.getBoundingClientRect().top;
    const under = cursor()?.textContent;
    const n2 = hexCommit(sampleCommit('n2', 5001, ['n1']));
    repository.commits.set(n2.oid, n2);
    await arrive(hexCommit(sampleCommit('n3', 5002, ['n2'])));
    await expect.poll(() => scroller.scrollTop).toBe(3 * 32);
    expect(cursor()?.textContent).toBe(under);
    expect(cursor()?.getBoundingClientRect().top).toBe(before);

    // A new tip of the default branch moves nothing either: the cursor was placed already.
    const n4 = hexCommit(sampleCommit('n4', 5003, ['n3']));
    repository.commits.set(n4.oid, n4);
    repository.branch('main', n4.oid);
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
    repository.branch('newest', sha('arriving'));
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

test('ES22: GitHub failing with nothing to draw says so, stays up while asked again, and R draws the graph', async () => {
    let failing = true;
    let held = Promise.resolve();
    await mount({
        commits: [sampleCommit('c1', 10)],
        branches: [sampleCommitRef('main', 'c1')],
        firstOpen: true,
        failIf: () => failing,
        holdIf: () => held,
    });
    const heading = page.getByRole('heading', { name: "GitHub isn't answering" });
    await expect.element(heading).toBeVisible();

    failing = false;
    const answer = createPromise();
    held = answer.promise;
    await userEvent.keyboard('r');
    // Asked again, the note stays and no skeleton comes between.
    await expect.element(page.getByRole('button', { name: /Try again/u })).toHaveAttribute('aria-busy', 'true');
    await expect.element(heading).toBeVisible();

    answer.resolve();
    await expect.element(graphText('Commit c1')).toBeVisible();
    await expect.element(heading).not.toBeInTheDocument();
});

test('ES22: GitHub failing leaves a graph already on screen on screen: the status bar alone tells it', async () => {
    const commits = [sampleCommit('c1', 10)];
    const view = await mount({
        commits,
        branches: [sampleCommitRef('main', 'c1')],
        kept: commits,
        failIf: () => true,
    });

    await expect.poll(() => view.store.getFreshness(REPOSITORY)).toMatchObject({ kind: 'stale', reason: 'failing' });
    await expect.element(graphText('Commit c1')).toBeVisible();
    await expect.element(page.getByRole('heading', { name: "GitHub isn't answering" })).not.toBeInTheDocument();
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
    await expect.element(page.getByRole('heading', { name: 'A blank slate' })).toBeVisible();
    await expect.element(page.getByText('Loading commits…')).not.toBeInTheDocument();
    await expect
        .element(page.getByText('acme/web is empty on GitHub. Commits show up after the first push.'))
        .toBeVisible();
    await expect.element(page.getByText('git log → no commits yet')).toBeVisible();
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
    const login = uniqueLogin();
    localStorage.setItem(VIEWER_KEY, JSON.stringify({ login, name: null, avatarUrl: 'https://avatars.test/user' }));
    localStorage.setItem(TOKEN_KEY, storedToken(`gho_${login}`));
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

test("CH61: each lane in its palette colour, the first lane taking the first without a default branch's; the fold the darker grey, its dots the light one", async () => {
    await mount({ commits: parallelBranches(14), defaultBranch: null });
    await expect.poll(() => graphCells().length).toBe(15);
    const strokesAt = (lane: number) =>
        new Set(
            [...document.querySelectorAll('li svg path')]
                .filter(path => path.getAttribute('d')?.startsWith(`M${8 + (lane + 0.5) * 12} 0V32`))
                .map(path => getComputedStyle(path).stroke),
        );

    expect(strokesAt(0)).toEqual(new Set([LANES[0]]));
    expect(strokesAt(1)).toEqual(new Set([LANES[1]]));
    expect(strokesAt(6)).toEqual(new Set([LANES[6]]));
    // The eighth lane holds the seven past it.
    expect(strokesAt(7)).toEqual(new Set([GRAPH_LINE]));
    const cells = graphCells();
    expect(getDot(cells[0]).fill).toBe(LANES[0]);
    expect(getDot(cells[1]).fill).toBe(LANES[1]);
    expect(getDot(cells[7]).fill).toBe(GRAPH_LINE_MAIN);
    expect(getDot(cells[13]).fill).toBe(GRAPH_LINE_MAIN);
});

test("CH61: the default branch's lane in its grey, the next lanes in the palette from its first colour; a merge hollow; a failing dot a red disc inside its lane's ring, the lines cut inside it, a running one amber", async () => {
    await mount(sampleWebappHistory());
    const cell = (text: string) =>
        page.getByRole('listitem').filter({ hasText: text }).element().querySelector('svg') ?? undefined;
    await expect.poll(() => cell('Initial commit')).toBeDefined();
    const strokes = (svg: SVGSVGElement | undefined) =>
        new Set([...(svg?.querySelectorAll('path') ?? [])].map(path => getComputedStyle(path).stroke));

    // The merge on the default branch, hollow in its grey; the lane beside it the palette's first.
    const merge = cell('Merge pull request #1226');
    expect(getDot(merge)).toEqual({ fill: 'none', stroke: GRAPH_LINE_MAIN });
    expect(strokes(merge)).toContain(GRAPH_LINE_MAIN);
    expect(strokes(merge)).toContain(LANES[0]);
    expect(merge?.querySelector('g')?.getAttribute('mask')).toMatch(/^url\(#.+\)$/);
    // A plain dot is filled, and nothing is cut under it.
    const chore = cell('chore: bump vite to 6.2');
    expect(getDot(chore)).toEqual({ fill: GRAPH_LINE_MAIN, stroke: 'none' });
    expect(chore?.querySelector('g')?.hasAttribute('mask')).toBe(false);

    // Running, on the first lane past the default branch's; failing, on the next.
    await expect.poll(() => getDot(cell('feat: preview a class while dragging it')).fill).toBe(AMBER);
    expect(getMarker(cell('feat: preview a class while dragging it'))).toEqual({
        ring: { fill: 'none', stroke: LANES[0], outer: 5 },
        disc: { fill: AMBER, r: 2.5 },
        cut: 3.5,
    });
    expect(getMarker(cell("fix: booking time uses the studio's timezone"))).toEqual({
        ring: { fill: 'none', stroke: LANES[1], outer: 5 },
        disc: { fill: RED, r: 2.5 },
        cut: 3.5,
    });
    // Failing on the default branch's lane: its grey ring.
    expect(getMarker(cell('chore: prepare the 4.2.1 release')).ring.stroke).toBe(GRAPH_LINE_MAIN);
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

test("D15: below about 1,200 px of window the list is folded away; B opens it over the graph at the pane's left edge without taking the graph's width, Esc closes it and choosing does too; with a commit open, Esc leaves the list before the commit", async () => {
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

    // With a commit open in the panel, Esc leaves the list over the graph first, and closes the commit after.
    await userEvent.keyboard('{Enter}');
    await expect.element(details()).toBeVisible();
    await userEvent.keyboard('b');
    filter().element().blur();
    await expect.element(list).toBeVisible();
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

test('D15, D16: on a wide window Enter opens the commit in the panel beside the section, the list staying and the graph as it was; B focuses the filter and the commit stays; Esc leaves the list, the next closes the commit', async () => {
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

test("D17: the graph's share is of the pane without the list", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: parallelBranches(14) });
    await expect.poll(() => graphCells().length).toBeGreaterThan(0);

    await expect.poll(() => view.scroller().clientWidth).toBe(1200 - 280);
    expect(graphCells()[0]?.getBoundingClientRect().width).toBe(92);
});

test('D14, D15, CH6, CH42: with the list in the column it renders there at any window width, leaving the graph the pane; B, typing and Enter behave as in tabs; the commit opens in the panel with the list staying, and Esc closes it', async () => {
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const target = columnTarget();
    const view = await mount({ commits: parallelBranches(14) }, { refListInColumn: true });
    const list = target.querySelector.bind(target);
    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('1');

    await expect.poll(() => list('[role="grid"]')).not.toBeNull();
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

test('D14: the layout changed while the graph is open, by another tab or device: the list moves to the column and back', async () => {
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const target = columnTarget();
    const inColumn = ref(false);
    const view = await mount({ commits: parallelBranches(14) }, { refListInColumn: inColumn });

    await expect.element(page.getByRole('grid', { name: 'Branches and tags' })).toBeVisible();
    expect(target.querySelector('[role="grid"]')).toBeNull();
    const list = refList().element();

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

test('D12, CH16: a ref whose commit is not loaded opens it in the panel, the graph staying and never taking the commit, with its pull request and CI, and the list staying, cleared; Esc lands on the graph', async () => {
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

    await expect
        .element(details())
        .toHaveTextContent(
            "Not in the graph's loaded history, which reaches older commits as you scroll. v0.1 is from",
        );
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('Why it was released.');
    await expect.element(details().getByText('Passing')).toBeVisible();
    await expect.element(page.getByRole('grid', { name: 'Branches and tags' })).toBeVisible();
    await expect.element(filter()).toHaveValue('');
    expect(cursor()?.textContent).toContain('Commit c2');
    expect(view.scroller().scrollTop).toBe(0);
    expect(document.activeElement).toBe(view.scroller());
    expect(view.store.get(REPOSITORY)?.commits.map(commit => commit.oid)).not.toContain(sha('old'));

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

test('D16, CH18: Enter opens the commit in the panel beside the list and the graph, at once from what the graph knows, the body arriving after; J and K follow, a click too; Esc closes it, the cursor where it was', async () => {
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
    await userEvent.keyboard('{Enter}');
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
    await userEvent.keyboard('{Enter}');
    await expect.element(details()).toBeVisible();
    for (let i = 0; i < 10; i++) {
        pressJ();
    }

    await expect.poll(() => cursor()?.getAttribute('aria-posinset')).toBe('11');
    const stoppedOn = view.store.get(REPOSITORY)?.commits[10]?.oid ?? '';
    await expect.poll(() => view.store.getDetail(REPOSITORY, stoppedOn)?.kind).toBe('read');
    // The one opened, and the one it stopped on: none read on the way.
    expect(view.github.requests.filter(request => request === 'CommitDetail')).toHaveLength(2);
    expect(view.store.getDetail(REPOSITORY, view.store.get(REPOSITORY)?.commits[5]?.oid ?? '')).toBeUndefined();

    function pressJ() {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', cancelable: true }));
    }
});

test('D16, CH20, CH27, CH28: P and Shift+P open the parents in the panel, the cursor going with them, in view; a key with nothing to go to does nothing', async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    await mount(sampleWebappHistory());
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    await userEvent.keyboard('{Enter}');
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
    await userEvent.keyboard('{Enter}');
    await expect.element(details()).toBeVisible();
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

    await userEvent.keyboard('b');
    await expect.element(filter()).toHaveFocus();
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('p');
    await expect.poll(() => cursor()?.textContent).not.toContain('Merge pull request #1226');
});

test('CH16: P to a parent not loaded opens it the same way, the graph not moving and not taking it; J goes on from the graph', async () => {
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

    await expect.element(details()).toHaveTextContent("Not in the graph's loaded history");
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    expect(cursor()?.textContent).toContain('Commit c1');
    // The cursor stays where the keys go from, drawn on no row: it is not what the details show.
    await expect.poll(cursorDrawn).toBe(false);
    expect(view.store.get(REPOSITORY)?.commits.map(commit => commit.oid)).toEqual([sha('c2'), sha('c1')]);

    await userEvent.keyboard('k');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    await expect.element(details()).not.toHaveTextContent("Not in the graph's loaded history");
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

test("Enter with a ref's commit open moves on to the cursor's commit", async () => {
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
});

test("D16, CH29: Shift+Enter opens the pull request in the commit's place, the keys are the item's meanwhile, and Back comes back to the commit", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount(sampleWebappHistory());
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    await userEvent.keyboard('kk{Enter}');
    await expect.element(details().getByRole('button', { name: /Pull request 1231/ })).toBeVisible();

    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect
        .poll(() => view.router.currentRoute.value.query)
        .toMatchObject({ pane: 'issue', issue: 'acme|web|1231' });
    await expect.element(details()).not.toBeInTheDocument();

    // J is the item's: under it the cursor stays as it was.
    await userEvent.keyboard('j');
    await wait(100);
    expect(cursor()?.textContent).toContain('feat: preview a class');
    view.router.back();

    await expect.element(details().getByRole('heading', { name: /feat: preview a class/ })).toBeVisible();
    expect(cursor()?.textContent).toContain('feat: preview a class');
});

test("with the commit's pull request open, Shift+Enter is the item's (it expands the item to full screen), never the details' again", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount(sampleWebappHistory());
    await expect.poll(() => cursor()?.textContent).toContain('Merge pull request #1226');
    await userEvent.keyboard('kk{Enter}');
    await expect.element(details().getByRole('button', { name: /Pull request 1231/ })).toBeVisible();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect
        .poll(() => view.router.currentRoute.value.query)
        .toMatchObject({ pane: 'issue', issue: 'acme|web|1231' });

    // The opened item's arrangement command (`ItemView`), as the panel registers it.
    const expand = vi.fn();
    const unregister = view.container.resolve(CommandRegistry).register({
        commands: [
            { id: 'item.arrange.page', title: 'Open full screen', section: 'item', key: 'Shift+Enter', run: expand },
        ],
        subject: null,
    });
    onTestFinished(unregister);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(expand).toHaveBeenCalledTimes(1);
    expect(view.router.currentRoute.value.query).toMatchObject({ pane: 'issue', issue: 'acme|web|1231' });
    await expect.element(details()).not.toBeInTheDocument();
});

test("a fork's commit opens its upstream's pull request, by its address", async () => {
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
    await userEvent.keyboard('{Enter}');
    await expect.element(details().getByRole('button', { name: /From the fork/ })).toBeVisible();

    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect
        .poll(() => view.router.currentRoute.value.query)
        .toMatchObject({ pane: 'issue', issue: 'upstream|web|1203' });
});

test("D16: O opens the commit on GitHub; Esc with a layer open is the layer's", async () => {
    await page.viewport(1400, 800);
    onTestFinished(() => page.viewport(414, 896));
    const view = await mount({ commits: [sampleCommit('c2', 20, ['c1']), sampleCommit('c1', 10)] });
    const openInNewTab = vi.spyOn(view.container.resolve(Browser), 'openInNewTab').mockImplementation(() => {});
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');

    // Not while it is closed.
    await userEvent.keyboard('o');
    expect(openInNewTab).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('o');
    expect(openInNewTab).toHaveBeenCalledWith(`https://github.com/acme/web/commit/${sha('c2')}`);

    const layer = document.createElement('div');
    layer.dataset.layer = '';
    document.body.append(layer);
    onTestFinished(() => layer.remove());
    await userEvent.keyboard('{Escape}');
    // The graph's keys are the layer's too: the cursor stays, and the commit with it.
    await userEvent.keyboard('j');
    await wait(100);
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    expect(cursor()?.textContent).toContain('Commit c2');
    layer.remove();

    await userEvent.keyboard('{Escape}');
    await expect.element(details()).not.toBeInTheDocument();
});

test("D16: a tooltip up takes none of the commit's keys", async () => {
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
    expect(openInNewTab).toHaveBeenCalledWith(`https://github.com/acme/web/commit/${sha('c3')}`);
    await userEvent.keyboard('p');
    await expect.element(details().getByRole('heading', { name: 'Commit c2' })).toBeVisible();
    await userEvent.keyboard('k');
    await expect.element(details().getByRole('heading', { name: 'Commit c3' })).toBeVisible();
    await userEvent.keyboard('{Shift>}p{/Shift}');
    await expect.element(details().getByRole('heading', { name: 'Commit c1' })).toBeVisible();
    await expect.poll(() => view.store.getState(REPOSITORY, sha('c1'))?.pullRequest?.number).toBe(7);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect.poll(() => view.router.currentRoute.value.query).toMatchObject({ pane: 'issue', issue: 'acme|web|7' });
});

test('CH41: the commit gone from the graph while open in the panel stays there, readable and saying so, the cursor on a neighbour drawn on no row, until J moves on', async () => {
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
    await userEvent.keyboard('{Enter}k');
    await expect.poll(() => cursor()?.textContent).toContain('Commit old');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();

    const { repository } = view.github;
    repository.branch('fix/a', sha('new'));
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

test('CH41: the commit gone under the cursor with nothing open opens nothing', async () => {
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

    view.github.repository.branch('fix/a', sha('new'));
    await view.store.open(REPOSITORY);

    await expect.element(page.getByRole('listitem').filter({ hasText: 'Commit old' })).not.toBeInTheDocument();
    await expect.poll(() => cursor()?.textContent).not.toContain('Commit old');
    await expect.element(details()).not.toBeInTheDocument();
});

test("a section entered with the graph already in memory starts on the default branch's tip in view, opening nothing", async () => {
    const commits = Array.from({ length: 300 }, (_, index) =>
        sampleCommit(`c${index}`, index, index > 0 ? [`c${index - 1}`] : []),
    );
    const view = await mount(
        {
            commits,
            branches: [sampleCommitRef('main', 'c50'), sampleCommitRef('feat/a', 'c299')],
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
    await expect.element(details()).not.toBeInTheDocument();
    await expect
        .poll(() => view.github.requests.filter(request => request === 'CommitStates').length)
        .toBeGreaterThan(0);
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

test("a row's author and age follow its headline and marks 8px apart; a long headline gives way first, the age staying whole", async () => {
    await page.viewport(1500, 800);
    onTestFinished(() => page.viewport(414, 896));
    const states = new Map<string, CommitState>([['c1', { pullRequest: samplePullRequest(1203), ci: 'FAILURE' }]]);
    const longHeadline = `fix: ${'a headline that goes on and on '.repeat(12)}`;
    await mount({
        commits: [{ ...sampleCommit('c2', 20, ['c1']), headline: longHeadline }, sampleCommit('c1', 10)],
        states,
    });
    const row = (headline: string) => page.getByRole('listitem').filter({ hasText: headline });
    await expect.element(row('Commit c1').getByRole('img', { name: 'Checks failing' })).toBeVisible();

    const short = row('Commit c1').element();
    const message = assertValue(short.querySelector('time')?.previousElementSibling?.previousElementSibling);
    const author = assertValue(short.querySelector('time')?.previousElementSibling);
    const age = assertValue(short.querySelector('time'));
    expect(message.textContent).toContain('#1203');
    expect(author.getBoundingClientRect().left - message.getBoundingClientRect().right).toBeCloseTo(8, 0);
    expect(age.getBoundingClientRect().left - author.getBoundingClientRect().right).toBeCloseTo(8, 0);
    expect(age.getBoundingClientRect().right).toBeLessThan(short.getBoundingClientRect().right - 100);

    const long = row('a headline that goes').element();
    const clipped = page.getByRole('listitem').getByText(longHeadline, { exact: true }).element();
    expect(clipped.scrollWidth).toBeGreaterThan(clipped.clientWidth);
    const longAge = assertValue(long.querySelector('time'));
    expect(longAge.scrollWidth).toBeLessThanOrEqual(longAge.clientWidth);
    expect(longAge.getBoundingClientRect().right).toBeLessThanOrEqual(long.getBoundingClientRect().right);
});

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

test("D24: back from a run's page the address brings the commit back, in the panel and under the cursor in view, kept through what the open reads", async () => {
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
    view.router.back();
    await expect.poll(() => cursor()?.textContent).toContain('Commit c100');
    await expect.element(details().getByRole('heading', { name: 'Commit c100' })).toBeVisible();
    expect(view.router.currentRoute.value.fullPath).toBe(panelPath('c100'));
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
});

test("back from a run's page, the commit open though it isn't a row: in the panel again with its ref, no row drawn as the cursor, which J moves from the start", async () => {
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
    await userEvent.keyboard('b');
    await userEvent.keyboard('v0.1{Enter}');
    await expect.element(details()).toHaveTextContent('v0.1 is from');

    await view.router.push(RUN);
    view.router.back();

    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('v0.1 is from');
    await expect.poll(() => cursor()?.textContent).toContain('Commit c2');
    await expect.poll(cursorDrawn).toBe(false);

    await view.store.open(REPOSITORY);
    await nextTick();
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();

    await userEvent.keyboard('j');
    await expect.element(details().getByRole('heading', { name: 'Commit c1' })).toBeVisible();
    await expect.poll(cursorDrawn).toBe(true);
});

test("back from a run's page with the open commit gone from the graph meanwhile: the cursor at the start with no error, the commit in the panel saying so", async () => {
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
    await userEvent.keyboard('{Enter}k');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();

    await view.router.push(RUN);
    view.github.repository.branch('fix/a', sha('new'));
    await view.store.open(REPOSITORY);
    view.router.back();

    await expect.poll(() => cursor()?.textContent).toContain('Commit other');
    await expect.element(details().getByRole('heading', { name: 'Commit old' })).toBeVisible();
    await expect.element(details()).toHaveTextContent('It is no longer in the graph.');
    expect(errors).toEqual([]);
});

/** The panel of a commit's details. */
function details() {
    return page.getByRole('region', { name: 'Commit details' });
}

/** The width of the panel the commit is open in. */
function detailsWidth() {
    return details().element().parentElement?.getBoundingClientRect().width;
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

/** Whether the row under the cursor looks it: its surface outlined in the accent, as a list's selected row, and its dot ringed. */
function cursorDrawn() {
    const row = cursor();
    if (row === null) {
        return false;
    }

    const surface = getComputedStyle(row, '::after').boxShadow !== 'none';
    // Both or neither.
    expect(getRing(row).opacity).toBe(surface ? '1' : '0');
    return surface;
}

/** How a row's dot is ringed (CH54): the first circle of its slice of the graph, under the lines. */
function getRing(row: Element) {
    const ring = row.querySelector('svg')?.querySelector('circle');
    if (!ring) {
        throw new Error('No ring');
    }

    const style = getComputedStyle(ring);
    return { stroke: style.stroke, opacity: style.opacity };
}

/** The rows' slices of the graph, each the first drawing of its row. */
function graphCells() {
    return [...document.querySelectorAll('li')].flatMap(row => row.querySelector('svg') ?? []);
}

function dotsX() {
    return graphCells().map(cell => Number(cell.querySelector('circle')?.getAttribute('cx')));
}

/** A row's dot as drawn: the last circle of its slice of the graph. */
function getDot(cell: SVGSVGElement | undefined) {
    const dot = [...(cell?.querySelectorAll('circle') ?? [])].at(-1);
    if (!dot) {
        throw new Error('No dot');
    }

    const style = getComputedStyle(dot);
    return { fill: style.fill, stroke: style.stroke };
}

/** A failing or running dot: its ring (its outer edge), the disc inside, and how far round it the lines are cut. */
function getMarker(cell: SVGSVGElement | undefined) {
    const circles = [...(cell?.querySelectorAll('circle') ?? [])];
    const [ring, disc] = circles.slice(-2);
    const maskId = /^url\(#(.+)\)$/.exec(cell?.querySelector('g')?.getAttribute('mask') ?? '')?.[1];
    const cut = maskId === undefined ? undefined : cell?.querySelector(`[id="${maskId}"] circle`);
    if (!ring || !disc || !cut) {
        throw new Error('No marker');
    }

    const ringStyle = getComputedStyle(ring);
    return {
        ring: {
            fill: ringStyle.fill,
            stroke: ringStyle.stroke,
            outer: Number(ring.getAttribute('r')) + Number.parseFloat(ringStyle.strokeWidth) / 2,
        },
        disc: { fill: getComputedStyle(disc).fill, r: Number(disc.getAttribute('r')) },
        cut: Number(cut.getAttribute('r')),
    };
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
    const { container, store, github, ready } = createCommitGraphTest(toShas(options));
    await ready;
    const section = defineComponent({
        setup() {
            const route = useRoute();
            return () => renderSection(route, getRouteNameWithOwner(route), false);
        },
    });
    const elsewhere = defineComponent({ render: () => null });
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            // The repository's route, a list an item opens over in the panel, as `app/router.options.ts` has it.
            { path: '/:owner/:name/commits', name: 'repository', component: section, meta: { itemPanel: true } },
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
    /** A ref to change it while mounted. */
    readonly refListInColumn?: boolean | Ref<boolean>;
    /** What the section has of the window: 1,200 px when not given. */
    readonly width?: number;
    /** The graph was opened before: the section is entered with it in memory. */
    readonly graphInMemory?: boolean;
    /** The key of the item opened last (`ItemNavigation.lastOpenedId`). */
    readonly lastOpened?: string;
}

/**
 * Mounts the section over the real store and a GitHub holding `options`, 600 px tall, at the sample's moment, at its
 * address; a commit the address opens over it shows in a 440 px panel beside it, as the shell's.
 */
async function mount(
    options: CommitGraphTestOptions,
    { keptShare, keptColumnWidth, refListInColumn, width = 1200, graphInMemory, lastOpened }: MountPlace = {},
) {
    const { container, store, github, setOnline, ready } = createCommitGraphTest(toShas(options));
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

    if (lastOpened !== undefined) {
        container.resolve(ItemNavigation).setLastOpened(lastOpened);
    }

    const ensureStates = vi.spyOn(store, 'ensureStates');
    const loadMore = vi.spyOn(store, 'loadMore');
    const router = createRouter({
        history: createMemoryHistory(),
        // The repository's commits, a list an item opens over in the panel, as `app/router.options.ts` has it.
        routes: [
            { path: '/:path(.*)*', component: defineComponent({ render: () => null }), meta: { itemPanel: true } },
        ],
    });
    await router.push(COMMITS);
    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.width = `${width}px`;
    host.style.height = '600px';
    document.body.append(host);

    const app = createApp({
        setup() {
            const route = useRoute();
            return () => renderSection(route, REPOSITORY, unref(refListInColumn));
        },
    });
    app.use(IocPlugin, { container });
    app.use(router);
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

/** The section, and beside it in a 440 px panel the commit `route` opens over it, as the shell shows it. */
function renderSection(
    route: RouteLocationNormalizedLoaded,
    nameWithOwner: string,
    refListInColumn: boolean | undefined,
) {
    const opened = CommitRoutes.getOpened(route);
    return [
        h(CommitGraphView, { nameWithOwner, refListInColumn }),
        opened && !opened.onPage
            ? h('div', { style: 'display: flex; flex: none; width: 440px' }, [
                  h(OpenedCommit, { reference: opened.reference, arrangement: 'panel' }),
              ])
            : null,
    ];
}

/**
 * A sample commit's name (`c2`) as a sha an address can carry: its bytes in hex, 40 digits long. The names stay
 * in the headlines (`Commit c2`).
 */
function sha(name: string) {
    const hex = Array.from(new TextEncoder().encode(name), byte => byte.toString(16).padStart(2, '0'));
    return hex.join('').padStart(40, '0');
}

/** The sample commit with its oid and its parents' as {@link sha} writes them, its ids `C_<oid>` as the samples' are. */
function hexCommit(commit: KeptCommit): KeptCommit {
    return {
        ...commit,
        oid: sha(commit.oid),
        id: `C_${sha(commit.oid)}`,
        parents: commit.parents.map(parent => ({ id: `C_${sha(parent.oid)}`, oid: sha(parent.oid) })),
    };
}

/** The sample branch or tag pointing at its commit by {@link sha}. */
function hexRef(commitRef: CommitRef): CommitRef {
    return { ...commitRef, oid: sha(commitRef.oid), commitId: `C_${sha(commitRef.oid)}` };
}

/** What GitHub holds, every oid as {@link sha} writes it. */
function toShas(options: CommitGraphTestOptions): CommitGraphTestOptions {
    return {
        ...options,
        commits: options.commits.map(hexCommit),
        kept: options.kept?.map(hexCommit),
        branches: options.branches?.map(hexRef),
        tags: options.tags?.map(hexRef),
        states: options.states && keyByShas(options.states),
        checks: options.checks && keyByShas(options.checks),
        bodies: options.bodies && keyByShas(options.bodies),
        subjects: options.subjects && keyByShas(options.subjects),
    };
}

function keyByShas<T>(byName: ReadonlyMap<string, T>) {
    return new Map([...byName].map(([name, value]) => [sha(name), value]));
}

/** The address of the section with the sample commit `name` open in the panel. */
function panelPath(name: string) {
    return `${COMMITS}?pane=commit&commit=acme|web|${sha(name)}`;
}

/** The sample commit `name` as a list of commits steps through it. */
function key(name: string) {
    return CommitRoutes.formatKey({ owner: 'acme', name: 'web', oid: sha(name) });
}

/** Longer than a key's effect or a read's pause takes, for a test that nothing came of it. */
function wait(ms: number) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}
