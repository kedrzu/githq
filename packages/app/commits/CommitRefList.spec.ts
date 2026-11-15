import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h } from 'vue';

import type { ItemReference } from '@/item/itemRoutes.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { createCommitGraphTest } from '@/testing/createCommitGraphTest.js';
import { createFixedPhoneLayout } from '@/testing/createFixedPhoneLayout.js';
import { sampleCommit, sampleCommitRef } from '@/testing/sampleCommits.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { CommitGraphStore } from './CommitGraphStore.js';
import { CommitRefFolders } from './CommitRefFolders.js';
import CommitRefList from './CommitRefList.vue';
import type { CommitRef, CommitState, KeptCommit, KeptCommitRefs } from './CommitTypes.js';

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
        .toHaveTextContent(/^Branches\s*3\s*Newest first/);
    await expect.element(page.getByRole('rowgroup', { name: 'Tags' })).toHaveTextContent(/^Tags\s*3\s*Newest first/);
});

test('hundreds of refs draw a bounded number of rows and a row to show the rest; typing searches all of them', async () => {
    const branches = Array.from({ length: 300 }, (_, index) => ref(`branch-${index}`, index));
    const tags = Array.from({ length: 400 }, (_, index) => ref(`tag-${index}`, index));
    await mount({ branches: [ref('main', 1000), ...branches], tags });

    // The default branch, 20 of each group and a "Show more" row of each.
    expect(rows().length).toBe(43);
    await expect.element(page.getByText('Show 280 more')).toBeVisible();
    await expect.element(page.getByText('Show 380 more')).toBeVisible();

    await filter().fill('branch-7');
    // branch-7 itself is far past the 20 newest, and the best match: it is drawn, selected and in view.
    const selected = page.getByRole('gridcell', { selected: true });
    await expect.element(selected).toHaveAttribute('title', 'branch-7');
    await expect.element(selected).toBeInViewport();
    await filter().fill('tag-12');
    await expect.poll(rowNames).toContain('tag-12');
    await expect.element(page.getByText(/^Show \d+ more$/)).not.toBeInTheDocument();
    // Matching every tag alike: the newest 20, and the rest behind a row.
    await filter().fill('tag');
    expect(rows().length).toBe(21);
    await expect.element(page.getByText('Show 380 more')).toBeVisible();
});

test('CH15, CH17: typing narrows both groups; a group left with none says so; the best match is selected', async () => {
    await mount({
        branches: [ref('main', 100), ref('release/4.2', 50), ref('release/4.1', 40), ref('feat/x', 60)],
        tags: [ref('v4.2.1', 30), ref('v4.1', 20)],
    });
    await filter().fill('rel');

    await expect.poll(rowNames).toEqual(['release/ 2', 'release/4.2', 'release/4.1']);
    await expect.element(page.getByRole('gridcell', { selected: true })).toHaveTextContent('release/4.2');
    await expect.element(page.getByRole('rowgroup', { name: 'Tags' })).toHaveTextContent('No tag matches "rel".');
    // The order stays said, and chosen, while filtering (CH60).
    await expect.element(sortButton('branches')).toHaveAccessibleName('Sort branches: Newest first');

    // The exact name wins over a newer branch holding it.
    await filter().fill('v4.1');
    await expect.element(page.getByRole('gridcell', { selected: true })).toHaveTextContent('v4.1');
    await filter().fill('');
    await expect.poll(rowNames).toEqual(['main', 'release/ 2', 'feat/x', 'v4.2.1', 'v4.1']);
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

    expect(asked(view)).toContain('with-pr');
    expect(asked(view)).toContain('branch-0');
    await expect.element(row('v1')).toBeVisible();
    await expect.element(row('v1').getByRole('img')).not.toBeInTheDocument();
    expect(asked(view)).not.toContain('tagged');
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

test('CH59: the pull request is an 18 px chip with a 1 px border, the CI mark outside it, and the row is no taller for it than one with no marks', async () => {
    await mount({
        branches: [ref('main', 100), ref('feat/a', 50), ref('plain', 40)],
        states: new Map([['feat/a', { pullRequest: pullRequest(1209), ci: 'FAILURE' }]]),
    });
    const row = page.getByRole('row', { name: /feat\/a/ });
    const chip = row.getByRole('link', { name: /1209/ });
    await expect.element(chip).toBeVisible();
    const style = getComputedStyle(chip.element());
    expect(style.borderTopWidth).toBe('1px');
    expect(chip.element().getBoundingClientRect().height).toBe(18);
    expect(chip.element().querySelector('[aria-label="Checks failing"]')).toBeNull();
    await expect.element(row.getByRole('img', { name: 'Checks failing' })).toBeVisible();
    // The age's own line sets the row; the chip must not make it taller than a row with no marks.
    expect(row.element().getBoundingClientRect().height).toBe(
        page.getByRole('row', { name: /plain/ }).element().getBoundingClientRect().height,
    );
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

test('CH53: names nest by `/` into folded folders; unfolding one draws its newest 20 and a row for 20 more there, the other folders as they were; folded branches ask for no state', async () => {
    const view = await mount(folderRefs());

    expect(rowNames()).toEqual(['feature/ 2', 'develop', 'testing/ 45']);
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'false');
    expect(asked(view)).toContain('develop');
    expect(asked(view)).not.toContain('feature/a');

    await userEvent.click(folderCell('testing'));
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'true');
    await expect
        .poll(rowNames)
        .toEqual(['feature/ 2', 'develop', 'testing/ 45', ...testingTags(45, 26), 'Show 25 more']);
    // A ref in a folder shows its name past the folder's.
    await expect
        .element(page.getByRole('gridcell', { name: 'v45', exact: true }))
        .toHaveAttribute('title', 'testing/v45');

    await userEvent.click(page.getByText('Show 25 more'));
    await expect.poll(rowNames).toEqual(['feature/ 2', 'develop', 'testing/ 45', ...testingTags(45, 6), 'Show 5 more']);
    await expect.element(folderCell('feature')).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(folderCell('feature'));
    await expect.poll(() => asked(view)).toContain('feature/a');
});

test("CH53: the unfolded folders are kept per repository: the list mounted again finds them so, another repository's does not", async () => {
    const view = await mount(folderRefs());
    await userEvent.click(folderCell('testing'));
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'true');

    view.remount();
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'true');
    // How many a level shows is not kept.
    await expect.element(page.getByText('Show 25 more')).toBeVisible();

    view.remount('acme/other');
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'false');
});

test('CH53: unfolding a folder forgets the kept folders no longer among the refs, a complete read of them', async () => {
    const view = await mount(folderRefs());
    const kept = view.container.resolve(CommitRefFolders);
    kept.toggle(REPOSITORY, 'tags:gone', null);

    await userEvent.click(folderCell('testing'));
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'true');
    expect(kept.isUnfolded(REPOSITORY, 'tags:gone')).toBe(false);
    expect(kept.isUnfolded(REPOSITORY, 'tags:testing')).toBe(true);
});

test('CH53: refs not read in full forget no kept folder', async () => {
    const view = await mount(folderRefs(), { refsComplete: false });
    const kept = view.container.resolve(CommitRefFolders);
    kept.toggle(REPOSITORY, 'tags:gone', null);

    await userEvent.click(folderCell('testing'));
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'true');
    expect(kept.isUnfolded(REPOSITORY, 'tags:gone')).toBe(true);
});

test('CH53: a filter unfolds every folder holding a match, counting its matches, the matches under their full names and the best selected, keeping nothing', async () => {
    const view = await mount(folderRefs());
    const kept = view.container.resolve(CommitRefFolders);

    await filter().fill('testing/v12');
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(rowNames).toContain('testing/v12');
    expect(rowNames()).not.toContain('develop');
    const selected = page.getByRole('gridcell', { selected: true });
    await expect.element(selected).toHaveTextContent('testing/v12');
    expect(kept.isUnfolded(REPOSITORY, 'tags:testing')).toBe(false);

    // A click on a folder the filter unfolded keeps nothing either.
    await userEvent.click(folderCell('testing'));
    expect(kept.isUnfolded(REPOSITORY, 'tags:testing')).toBe(false);

    await filter().fill('');
    await expect.poll(rowNames).toEqual(['feature/ 2', 'develop', 'testing/ 45']);
});

test('CH53: ↑/↓ reach folder and "Show more" rows; Enter folds or unfolds a folder, the selection staying on it, and shows more', async () => {
    await mount(folderRefs());
    const selected = page.getByRole('gridcell', { selected: true });
    await userEvent.click(filter());

    await userEvent.keyboard('{ArrowDown}');
    await expect.element(selected).toHaveAttribute('aria-expanded', 'false');
    await expect.element(selected).toHaveTextContent(/^feature/);
    await userEvent.keyboard('{Enter}');
    await expect.element(selected).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(selected).toHaveAttribute('title', 'feature/b');
    await userEvent.keyboard('{ArrowUp}{Enter}');
    await expect.element(selected).toHaveAttribute('aria-expanded', 'false');
    await expect.element(selected).toHaveTextContent(/^feature/);
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(selected).toHaveAttribute('title', 'develop');

    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect.element(folderCell('testing')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{ArrowDown}'.repeat(21));
    await expect.element(selected).toHaveTextContent('Show 25 more');
    await userEvent.keyboard('{Enter}');
    await expect.element(selected).toHaveTextContent('Show 5 more');
    await userEvent.keyboard('{Enter}');
    // All shown: the selection on the first of the last ones.
    await expect.element(selected).toHaveAttribute('title', 'testing/v5');
});

test('CH60: By name for branches orders them naturally, folders first, leaves tags and the default branch as they were, and is the synced setting every repository reads', async () => {
    const view = await mount({
        branches: [
            ref('main', 1),
            ref('fix/hld-100-ical', 60),
            ref('fix/hld-9-retry', 10),
            ref('fix/hld-98-week', 40),
            ref('develop', 50),
            ref('billing', 20),
        ],
        tags: [ref('v1', 5), ref('v3', 25), ref('v2', 15)],
    });
    view.container.resolve(CommitRefFolders).toggle(REPOSITORY, 'branches:fix', null);
    await expect
        .poll(rowNames)
        .toEqual([
            'main',
            'fix/ 3',
            'fix/hld-100-ical',
            'fix/hld-98-week',
            'fix/hld-9-retry',
            'develop',
            'billing',
            'v3',
            'v2',
            'v1',
        ]);

    await userEvent.click(sortButton('branches'));
    await userEvent.click(page.getByRole('menuitemradio', { name: /^By\sname$/ }));

    await expect
        .poll(rowNames)
        .toEqual([
            'main',
            'fix/ 3',
            'fix/hld-9-retry',
            'fix/hld-98-week',
            'fix/hld-100-ical',
            'billing',
            'develop',
            'v3',
            'v2',
            'v1',
        ]);
    await expect.element(sortButton('branches')).toHaveTextContent(/^By\sname$/);
    await expect.element(sortButton('tags')).toHaveAccessibleName('Sort tags: Newest first');
    const tracking = view.container.resolve(TrackingStore);
    expect(tracking.document.refSort).toEqual({ branches: 'name' });

    // Filtering keeps the order.
    await filter().fill('hld');
    await expect.poll(rowNames).toEqual(['fix/ 3', 'fix/hld-9-retry', 'fix/hld-98-week', 'fix/hld-100-ical']);

    view.remount('acme/other');
    await expect.element(sortButton('branches')).toHaveAccessibleName(/^Sort branches: By\sname$/);
});

test("CH60: the sort menu is the keyboard's: Enter opens it, ↓ and Enter pick, Esc closes it alone, the focus back on the button and the filter kept", async () => {
    const view = await mount({ branches: [ref('main', 1), ref('b', 20), ref('a', 10)] });
    await filter().fill('a');
    await expect.poll(rowNames).toEqual(['a', 'main']);
    const button = sortButton('branches');
    button.element().focus();

    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('menu')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    await expect.element(button).toHaveFocus();
    await expect.element(filter()).toHaveValue('a');
    expect(view.leave).not.toHaveBeenCalled();
    expect(view.choose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Enter}');
    await expect
        .element(page.getByRole('menuitemradio', { name: 'Newest first' }))
        .toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowDown}');
    await expect.element(page.getByRole('menuitemradio', { name: /^By\sname$/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    await expect.element(button).toHaveAccessibleName(/^Sort branches: By\sname$/);
    await expect.element(button).toHaveFocus();
    // The pick chose no ref and left the list where it was.
    expect(view.choose).not.toHaveBeenCalled();
    expect(view.leave).not.toHaveBeenCalled();
});

test('CH60: an order the settings do not know reads as Newest first and stays in them until the user picks one', async () => {
    const view = await mount({
        branches: [ref('main', 1), ref('b', 10), ref('a', 20)],
        tags: [ref('v2', 2), ref('v10', 3)],
    });
    const tracking = view.container.resolve(TrackingStore);
    await tracking.ready();
    tracking.replaceDocument({ ...tracking.document, refSort: { branches: 'by-semver', tags: 'name' } });

    await expect.element(sortButton('branches')).toHaveAccessibleName('Sort branches: Newest first');
    await expect.element(sortButton('tags')).toHaveAccessibleName(/^Sort tags: By\sname$/);
    expect(rowNames()).toEqual(['main', 'a', 'b', 'v2', 'v10']);
    expect(tracking.document.refSort).toEqual({ branches: 'by-semver', tags: 'name' });
});

test('CH60: the sort button leaves the heading row as tall as its text', async () => {
    await mount({ branches: [ref('main', 1), ref('a', 10)] });
    const button = sortButton('branches');
    await expect.element(button).toBeVisible();
    const header = page.getByRole('columnheader', { name: /^Branches/ }).element();
    const height = header.getBoundingClientRect().height;
    expect(getComputedStyle(button.element()).borderTopWidth).toBe('1px');

    // The same heading without the button: the title and the count alone set its height.
    if (!(button.element() instanceof HTMLElement)) {
        throw new TypeError('No button');
    }

    button.element().style.display = 'none';
    expect(header.getBoundingClientRect().height).toBe(height);
});

function sortButton(group: 'branches' | 'tags') {
    return page.getByRole('button', { name: new RegExp(`^Sort ${group}:`) });
}

function filter() {
    return page.getByRole('combobox', { name: 'Filter branches and tags' });
}

function rows() {
    return page
        .getByRole('row')
        .filter({ has: page.getByRole('gridcell') })
        .elements();
}

/** Each row's name: a ref's full name, `name/ count` for a folder, a "Show more" row's text. */
function rowNames() {
    return rows().map(row => {
        const cell = row.querySelector('[aria-selected]');
        if (cell?.hasAttribute('aria-expanded')) {
            return `${cell.children[0]?.textContent}/ ${cell.children[1]?.textContent}`;
        }

        return cell?.getAttribute('title') ?? cell?.textContent;
    });
}

function folderCell(name: string) {
    return page.getByRole('gridcell', { name: new RegExp(`^${name} \\d+ (refs?|match(es)?)$`) });
}

/** The oids the list asked the state of. */
function asked(view: MountedList) {
    return view.ensureStates.mock.calls.flatMap(([, commits]) => commits.map(commit => commit.oid));
}

/** `testing/v<from>` down to `testing/v<to>`. */
function testingTags(from: number, to: number) {
    return Array.from({ length: from - to + 1 }, (_, index) => `testing/v${from - index}`);
}

/** Branches `feature/a`, `feature/b`, `develop`, no default branch among them, and tags `testing/v1…v45`. */
function folderRefs(): MountRefs {
    return {
        branches: [ref('develop', 10), ref('feature/a', 20), ref('feature/b', 30)],
        tags: Array.from({ length: 45 }, (_, index) => ref(`testing/v${index + 1}`, index + 1)),
    };
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

type MountedList = Awaited<ReturnType<typeof mount>>;

/** How `mount` draws the list. */
interface MountOptions {
    readonly height?: number;
    /** Overrides whether the refs are a complete read, the store's word otherwise. */
    readonly refsComplete?: boolean;
}

/** The list alone over the real store and a GitHub holding `refs`, 280 px wide. */
async function mount(refs: MountRefs, { height = 600, refsComplete }: MountOptions = {}) {
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
    // The test frame is narrower than a phone's width: the computer's menus.
    container.set(PhoneLayout, createFixedPhoneLayout(false));
    await ready;
    const store = container.resolve(CommitGraphStore);
    await store.open(REPOSITORY);
    const ensureStates = vi.spyOn(store, 'ensureStates');
    const choose = vi.fn<(chosen: CommitRef) => void>();
    const leave = vi.fn<() => void>();
    const openPullRequest = vi.fn<(reference: ItemReference) => void>();

    const read = store.get(REPOSITORY)?.refs;
    if (!read) {
        throw new Error('No refs');
    }

    const known: KeptCommitRefs = read;

    let unmount = render(REPOSITORY);
    onTestFinished(() => unmount());

    /** The list again, unmounted and mounted afresh over the same store, for `nameWithOwner`. */
    function remount(nameWithOwner = REPOSITORY) {
        unmount();
        unmount = render(nameWithOwner);
    }

    function render(nameWithOwner: string) {
        const host = document.createElement('div');
        host.style.display = 'flex';
        host.style.width = '280px';
        host.style.height = `${height}px`;
        document.body.append(host);
        const app = createApp({
            setup: () => () =>
                h(CommitRefList, {
                    nameWithOwner,
                    refs: store.get(REPOSITORY)?.refs ?? known,
                    refsComplete: refsComplete ?? store.get(REPOSITORY)?.refsComplete ?? false,
                    now: Date.parse('2026-10-02T00:00:00Z'),
                    onChoose: choose,
                    onLeave: leave,
                    onOpenPullRequest: openPullRequest,
                }),
        });
        app.use(IocPlugin, { container });
        app.mount(host);
        return () => {
            app.unmount();
            host.remove();
        };
    }

    return { container, store, ensureStates, choose, leave, openPullRequest, remount };
}
