import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import type { ItemReference } from '@/item/itemRoutes.js';
import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import { sampleCommit, sampleCommitRef } from '@/testing/sampleCommits.js';

import { CommitGraphStore } from './CommitGraphStore.js';
import CommitRefList from './CommitRefList.vue';
import type { CommitRef, CommitState, KeptCommit } from './CommitTypes.js';

const REPOSITORY = 'acme/web';

test('D15: the default branch first, then branches and tags, each newest first by date, with the counts', async () => {
    await mount({
        branches: [ref('old', 10), ref('main', 20), ref('newest', 30)],
        tags: [ref('v1', 5), ref('v3', 25), ref('v2', 15)],
    });

    expect(rowNames()).toEqual(['main', 'newest', 'old', 'v3', 'v2', 'v1']);
    await expect.element(page.getByRole('row', { name: /main/ })).toHaveTextContent('default');
    await expect
        .element(page.getByRole('rowgroup', { name: 'Branches' }))
        .toHaveTextContent(/^Branches\s*3\s*newest first/);
    await expect.element(page.getByRole('rowgroup', { name: 'Tags' })).toHaveTextContent(/^Tags\s*3\s*newest first/);
});

test('hundreds of refs draw a bounded number of rows and count the rest; typing searches all of them', async () => {
    const branches = Array.from({ length: 300 }, (_, index) => ref(`branch-${index}`, index));
    const tags = Array.from({ length: 400 }, (_, index) => ref(`tag-${index}`, index));
    await mount({ branches: [ref('main', 1000), ...branches], tags });

    expect(rows().length).toBe(41);
    await expect.element(page.getByText('280 more branches · type to find one')).toBeVisible();
    await expect.element(page.getByText('380 more tags · type to find one')).toBeVisible();

    await filter().fill('branch-7');
    // branch-7 itself is far past the 20 newest, and the best match.
    await expect.element(page.getByRole('gridcell', { selected: true })).toHaveAttribute('title', 'branch-7');
    await filter().fill('tag-12');
    await expect.poll(rowNames).toContain('tag-12');
    await expect.element(page.getByText(/more · keep typing/)).not.toBeInTheDocument();
    await filter().fill('tag-1');
    expect(rows().length).toBeLessThanOrEqual(21);
    await expect.element(page.getByText(/\d+ more · keep typing/)).toBeVisible();
});

test('CH15, CH17: typing narrows both groups; a group left with none says so; the best match is selected', async () => {
    await mount({
        branches: [ref('main', 100), ref('release/4.2', 50), ref('release/4.1', 40), ref('feat/x', 60)],
        tags: [ref('v4.2.1', 30), ref('v4.1', 20)],
    });
    await filter().fill('rel');

    await expect.poll(rowNames).toEqual(['release/4.2', 'release/4.1']);
    await expect.element(page.getByRole('gridcell', { selected: true })).toHaveTextContent('release/4.2');
    await expect.element(page.getByRole('rowgroup', { name: 'Tags' })).toHaveTextContent('No tag matches "rel".');
    await expect.element(page.getByRole('rowgroup', { name: 'Branches' })).not.toHaveTextContent('newest first');

    // The exact name wins over a newer branch holding it.
    await filter().fill('v4.1');
    await expect.element(page.getByRole('gridcell', { selected: true })).toHaveTextContent('v4.1');
    await filter().fill('');
    await expect.poll(rowNames).toEqual(['main', 'feat/x', 'release/4.2', 'release/4.1', 'v4.2.1', 'v4.1']);
    await expect.element(page.getByRole('gridcell', { selected: true })).not.toBeInTheDocument();
});

test('↑/↓ move through the matches and letters are typed, J and K too; Enter chooses', async () => {
    const view = await mount({
        branches: [ref('main', 100), ref('jan/a', 50), ref('kim/b', 40)],
    });
    const windowKeys = vi.fn<(event: KeyboardEvent) => void>();
    window.addEventListener('keydown', windowKeys);
    onTestFinished(() => window.removeEventListener('keydown', windowKeys));
    const selected = page.getByRole('gridcell', { selected: true });

    await userEvent.click(filter());
    await userEvent.keyboard('j');
    await expect.element(filter()).toHaveValue('j');
    await expect.poll(rowNames).toEqual(['jan/a']);
    await userEvent.keyboard('{Backspace}');
    await expect.poll(rowNames).toEqual(['main', 'jan/a', 'kim/b']);

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(selected).toHaveTextContent('main');
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(selected).toHaveTextContent('jan/a');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    await expect.element(selected).toHaveTextContent('main');

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(selected).toHaveTextContent('jan/a');
    // Handled by the list: nothing listening on the window may take it again.
    expect(windowKeys.mock.lastCall?.[0].defaultPrevented).toBe(true);

    await userEvent.keyboard('{Enter}');
    expect(view.choose.mock.lastCall?.[0]).toMatchObject({ name: 'jan/a' });
});

test('Enter with nothing selected chooses nothing; Esc clears the filter and leaves, nothing selected', async () => {
    const view = await mount({ branches: [ref('main', 100), ref('feat/a', 50)] });
    await userEvent.click(filter());

    await userEvent.keyboard('{Enter}');
    expect(view.choose).not.toHaveBeenCalled();

    await userEvent.keyboard('feat{Enter}');
    expect(view.choose.mock.lastCall?.[0]).toMatchObject({ name: 'feat/a' });

    await userEvent.keyboard('{Escape}');
    await expect.element(filter()).toHaveValue('');
    expect(view.leave).toHaveBeenCalledTimes(1);
    await expect.element(page.getByRole('gridcell', { selected: true })).not.toBeInTheDocument();
});

test('D18: the branch rows drawn ask for their state, tags never; not known yet is a bar; a branch without a pull request shows none; tags show their age alone', async () => {
    const states = new Map<string, CommitState>([
        ['with-pr', { pullRequest: pullRequest(1209), ci: 'SUCCESS' }],
        ['main-tip', { pullRequest: pullRequest(1300), ci: 'FAILURE' }],
        ['plain', { pullRequest: null, ci: null }],
    ]);
    const branches = Array.from({ length: 18 }, (_, index) => ref(`branch-${index}`, index));
    const view = await mount({
        branches: [
            ref('main', 1000, 'main-tip'),
            ref('with-pr', 500, 'with-pr'),
            ref('plain', 400, 'plain'),
            ...branches,
        ],
        tags: [ref('v1', 300, 'tagged')],
        states,
    });

    const row = (name: string) => page.getByRole('row', { name: new RegExp(`^${name}`) });
    await expect.element(row('with-pr').getByRole('img', { name: 'Merged pull request' })).toBeVisible();
    await expect.element(row('with-pr')).toHaveTextContent('#1209');
    await expect.element(row('with-pr').getByRole('img', { name: 'Checks passing' })).toBeVisible();
    // The default branch's row: its CI, no pull request (CH3).
    await expect.element(row('main').getByRole('img', { name: 'Checks failing' })).toBeVisible();
    await expect.element(row('main')).not.toHaveTextContent('#');
    await expect.element(row('plain')).not.toHaveTextContent('#');
    await expect.element(row('plain').getByRole('img')).not.toBeInTheDocument();

    const asked = () => view.ensureStates.mock.calls.flatMap(([, commits]) => commits.map(commit => commit.oid));
    expect(asked()).toContain('with-pr');
    expect(asked()).toContain('branch-0');
    await expect.element(row('v1')).toBeVisible();
    await expect.element(row('v1').getByRole('img')).not.toBeInTheDocument();
    expect(asked()).not.toContain('tagged');
});

test("a branch's pull request is a link: a click on it opens it, choosing nothing and leaving the selection and the focus where they were; a modified click is the browser's", async () => {
    const view = await mount({
        branches: [ref('main', 100), ref('feat/a', 50), ref('feat/b', 40)],
        states: new Map([['feat/b', { pullRequest: pullRequest(1209), ci: 'FAILURE' }]]),
    });
    await userEvent.click(filter());
    await userEvent.keyboard('feat{ArrowDown}');
    const selected = page.getByRole('gridcell', { selected: true });
    await expect.element(selected).toHaveTextContent('feat/b');
    await userEvent.keyboard('{ArrowUp}');
    await expect.element(selected).toHaveTextContent('feat/a');
    const link = page.getByRole('row', { name: /feat\/b/ }).getByRole('link', { name: /1209/ });
    await expect.element(link).toHaveAttribute('href', '/acme/web/pull/1209');

    await userEvent.click(link);
    expect(view.openPullRequest.mock.lastCall?.[0]).toMatchObject({ owner: 'acme', name: 'web', number: 1209 });
    expect(view.choose).not.toHaveBeenCalled();
    await expect.element(selected).toHaveTextContent('feat/a');
    await expect.element(filter()).toHaveFocus();

    // A listener of the link's own runs after the component's, and stops the new tab a test has no use for.
    let handedToBrowser = false;
    link.element().addEventListener('click', event => {
        handedToBrowser = !event.defaultPrevented;
        event.preventDefault();
    });
    link.element().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }));
    expect(handedToBrowser).toBe(true);
    expect(view.openPullRequest).toHaveBeenCalledTimes(1);
    expect(view.choose).not.toHaveBeenCalled();
});

test('the links are no tab stops: Tab leaves the filter past them, and Enter in the filter still chooses the selected row', async () => {
    const view = await mount({
        branches: [ref('main', 100), ref('feat/a', 50)],
        states: new Map([['feat/a', { pullRequest: pullRequest(1209), ci: null }]]),
    });
    const link = page.getByRole('link', { name: /1209/ });
    await expect.element(link).toBeVisible();
    expect(link.element().tabIndex).toBe(-1);

    await userEvent.click(filter());
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    expect(view.choose.mock.lastCall?.[0]).toMatchObject({ name: 'feat/a' });
    expect(view.openPullRequest).not.toHaveBeenCalled();

    await userEvent.click(filter());
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).not.toBe(link.element());
});

test('CH34: while a branch is not known yet, the bar stands in for its marks', async () => {
    await mount({
        branches: [ref('main', 100), ref('feat/a', 50)],
        holdIf: operation => (operation === 'CommitStates' ? new Promise<void>(() => {}) : null),
    });

    await expect
        .element(
            page
                .getByRole('row', { name: /feat\/a/ })
                .getByRole('img', { name: 'Pull request and checks not known yet' }),
        )
        .toBeVisible();
});

function filter() {
    return page.getByRole('combobox', { name: 'Filter branches and tags' });
}

function rows() {
    return page
        .getByRole('row')
        .filter({ has: page.getByRole('gridcell') })
        .elements();
}

function rowNames() {
    return rows().map(row => row.querySelector('[title]')?.textContent);
}

function pullRequest(number: number) {
    return {
        number,
        state: 'MERGED' as const,
        title: 'A change',
        url: `https://github.com/acme/web/pull/${number}`,
        isDraft: false,
    };
}

/** A ref named `name`, at the sample minute `minutes`, on a commit of its own (`oid`, its name when not given). */
function ref(name: string, minutes: number, oid = name): CommitRef {
    return { ...sampleCommitRef(name, oid), committedDate: sampleCommit(oid, minutes).committedDate };
}

/** What `mount` gives GitHub. */
interface MountRefs {
    readonly branches: readonly CommitRef[];
    readonly tags?: readonly CommitRef[];
    readonly states?: ReadonlyMap<string, CommitState>;
    readonly holdIf?: (operation: string) => Promise<void> | null;
}

/** The list alone over the real store and a GitHub holding `refs`, 280 px wide. */
async function mount(refs: MountRefs, { height = 600 } = {}) {
    const commits: KeptCommit[] = [...refs.branches, ...(refs.tags ?? [])].map(item => ({
        ...sampleCommit(item.oid, 0),
        committedDate: item.committedDate,
    }));
    const { container, ready } = createCommitGraphTest({
        commits,
        branches: refs.branches,
        tags: refs.tags,
        states: refs.states,
        holdIf: refs.holdIf,
    });
    await ready;
    const store = container.resolve(CommitGraphStore);
    await store.open(REPOSITORY);
    const ensureStates = vi.spyOn(store, 'ensureStates');
    const choose = vi.fn<(chosen: CommitRef) => void>();
    const leave = vi.fn<() => void>();
    const openPullRequest = vi.fn<(reference: ItemReference) => void>();

    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.width = '280px';
    host.style.height = `${height}px`;
    document.body.append(host);
    const known = store.get(REPOSITORY)?.refs;
    if (!known) {
        throw new Error('No refs');
    }

    const app = createApp({
        setup: () => () =>
            h(CommitRefList, {
                nameWithOwner: REPOSITORY,
                refs: store.get(REPOSITORY)?.refs ?? known,
                now: Date.parse('2026-10-02T00:00:00Z'),
                onChoose: choose,
                onLeave: leave,
                onOpenPullRequest: openPullRequest,
            }),
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(() => {
        app.unmount();
        host.remove();
    });

    return { store, ensureStates, choose, leave, openPullRequest };
}
