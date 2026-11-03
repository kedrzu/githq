import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { D1_ISSUE_DETAIL, F1_PULL_REQUEST, F3_PULL_REQUEST } from '@/testing/sampleItemDetails.js';
import { SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';

import * as stories from './ItemView.stories.js';

const {
    ContributorView,
    IssueInPanel,
    IssueSplit,
    LoadingComments,
    PullRequestBeingMerged,
    PullRequestBehind,
    PullRequestConflicts,
    PullRequestMergeRefused,
    PullRequestOutcomeUnknown,
    PullRequestContributorView,
    PullRequestDraft,
    PullRequestFailing,
    PullRequestMergeabilityUnknown,
    PullRequestAutoMergeOffered,
    PullRequestAutoMergeOn,
    PullRequestInQueue,
    PullRequestOptionalFailing,
    PullRequestRerunNamesActions,
    PullRequestRerunOutsideActions,
    PullRequestQueueReady,
    PullRequestReady,
    StackOfTenInModal,
    StackOfTenInPanel,
    StackOfTwoOnPage,
} = composeStories(stories);

test("the body and comments show GitHub's rendering only, never the markdown as HTML; their links leave for a new tab; a comment on its way shows as the text typed", async () => {
    await IssueInPanel.run({
        args: {
            ...IssueInPanel.args,
            detail: {
                ...D1_ISSUE_DETAIL,
                // Markdown may hold raw HTML: rendering `body` would put it on the page unsanitized.
                body: '<img src="x" data-from="markdown"><b data-from="markdown">raw</b>',
                bodyHtml:
                    '<p>Rendered by <a href="https://github.com/octocat">GitHub</a> <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="screenshot"></p>',
                comments: {
                    ...D1_ISSUE_DETAIL.comments,
                    nodes: [
                        {
                            ...D1_ISSUE_DETAIL.comments.nodes[0]!,
                            bodyHtml: '<p>See <a href="https://example.com/doc">the doc</a></p>',
                        },
                        {
                            ...D1_ISSUE_DETAIL.comments.nodes[0]!,
                            id: 'pending:1',
                            bodyHtml: '',
                            pendingBody: 'Fixed in <i data-from="pending">#12</i>\nthanks',
                        },
                    ],
                },
            },
        },
    });

    await expect.element(page.getByText('Rendered by')).toBeInTheDocument();
    expect(document.querySelector('[data-from="markdown"]')).toBeNull();
    expect(document.body.textContent).not.toContain('raw');
    await expect.element(page.getByRole('img', { name: 'screenshot' })).toBeInTheDocument();
    await expect.element(page.getByText('Fixed in <i data-from="pending">#12</i>')).toBeInTheDocument();
    expect(document.querySelector('[data-from="pending"]')).toBeNull();

    for (const name of ['GitHub', 'the doc']) {
        const link = page.getByRole('link', { name, exact: true });
        await expect.element(link).toHaveAttribute('target', '_blank');
        await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
});

test('J/K step through the list, Esc closes, R puts the cursor in the comment box and Esc there leaves it without closing', async () => {
    await IssueSplit.run();
    const { onNext, onPrevious, onClose } = IssueSplit.args;

    await userEvent.keyboard('jk');
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('r');
    const box = page.getByRole('textbox', { name: 'Comment' });
    await expect.element(box).toHaveFocus();
    // Typed into the box, the keys are text, not shortcuts.
    await userEvent.keyboard('jk');
    await expect.element(box).toHaveValue('jk');
    expect(onNext).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    await expect.element(box).not.toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
});

test('the arrangement switch asks for another arrangement', async () => {
    await IssueSplit.run();

    await userEvent.click(page.getByRole('group', { name: 'Arrangement' }).getByRole('button', { name: 'Panel' }));
    expect(IssueSplit.args.onArrange).toHaveBeenCalledWith('panel');
});

test('"Show all" reads the comments not read yet, then shows every one', async () => {
    await IssueInPanel.run();

    await userEvent.click(page.getByRole('button', { name: 'Show all 4' }));
    expect(IssueInPanel.args.loadAllComments).toHaveBeenCalledTimes(1);
});

test('opened before its detail arrives: the row shows at once and the comments say they are loading', async () => {
    await LoadingComments.run();

    await expect
        .element(page.getByRole('heading', { name: 'Calendar shows wrong timezone for recurring bookings' }))
        .toBeInTheDocument();
    await expect.element(page.getByText('Loading comments…')).toBeInTheDocument();
    await expect.element(page.getByText('In progress')).toBeInTheDocument();
});

test('L opens the labels picker; what was toggled is asked for when it closes', async () => {
    await IssueInPanel.run();

    await userEvent.keyboard('l');
    await expect.element(page.getByRole('textbox', { name: 'Filter labels…' })).toHaveFocus();
    await userEvent.keyboard('regr{Enter}{Escape}');

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledWith({ kind: 'labels', add: ['regression'], remove: [] });
    // Escape closed the picker, not the item.
    expect(IssueInPanel.args.onClose).not.toHaveBeenCalled();
});

test("M sets the milestone, S the first project's status", async () => {
    await IssueSplit.run();
    const { onEdit } = IssueSplit.args;

    await userEvent.keyboard('m');
    await userEvent.click(page.getByRole('option', { name: /v4.3/ }));
    expect(onEdit).toHaveBeenCalledWith({ kind: 'milestone', title: 'v4.3 — December' });

    await userEvent.keyboard('s');
    await userEvent.click(page.getByRole('option', { name: 'Done' }));
    expect(onEdit).toHaveBeenLastCalledWith({
        kind: 'projectField',
        projectItemId: 'PVTI_Platform Q4',
        fieldId: 'status',
        value: { kind: 'singleSelect', optionId: 'status-done' },
    });
});

test("a project's number field is edited in its field: Enter sets what was typed, an emptied one clears it", async () => {
    await IssueSplit.run();
    const { onEdit } = IssueSplit.args;
    const target = { kind: 'projectField', projectItemId: 'PVTI_Platform Q4', fieldId: 'estimate' };

    await userEvent.click(page.getByRole('button', { name: 'Estimate: 3' }));
    const estimate = page.getByRole('spinbutton', { name: 'Estimate' });
    await expect.element(estimate).toHaveValue(3);
    await userEvent.fill(estimate, '5');
    await userEvent.keyboard('{Enter}');
    expect(onEdit).toHaveBeenLastCalledWith({ ...target, value: { kind: 'number', number: 5 } });

    await userEvent.click(page.getByRole('button', { name: 'Estimate: 3' }));
    await userEvent.clear(page.getByRole('spinbutton', { name: 'Estimate' }));
    await userEvent.keyboard('{Enter}');
    expect(onEdit).toHaveBeenLastCalledWith({ ...target, value: null });
});

test('M1: the reference opens the item menu — the actions grouped, each with its key; a submenu picks a value; Esc closes the menu, not the item', async () => {
    await IssueInPanel.run();
    const { onEdit, onClose } = IssueInPanel.args;

    await userEvent.click(page.getByRole('button', { name: /^Actions of skyline-labs\/portal#/ }));
    const menu = page.getByRole('menu');
    await expect.element(menu).toBeVisible();
    const entries = [...menu.element().querySelectorAll('[role="menuitem"]')].map(entry => entry.textContent);
    expect(entries.findIndex(text => text?.startsWith('Set status'))).toBeLessThan(
        entries.findIndex(text => text?.startsWith('Assign to')),
    );
    expect(entries.findIndex(text => text?.startsWith('Comment'))).toBeLessThan(
        entries.findIndex(text => text?.startsWith('Close issue')),
    );
    await expect.element(page.getByRole('menuitem', { name: /^Assign to/ })).toHaveAttribute('aria-keyshortcuts', 'A');
    // Not from a list: the item is open already.
    await expect.element(page.getByRole('menuitem', { name: 'Open', exact: true })).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('menuitem', { name: /^Add or remove labels/ }));
    await userEvent.click(page.getByRole('menuitemcheckbox', { name: 'perf' }));
    expect(onEdit).toHaveBeenCalledWith({ kind: 'labels', add: ['perf'], remove: [] });

    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    await expect.element(page.getByRole('menu')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
});

test("M2: a pull request's menu asks for reviews — never of its author, those waiting checked — and turns it into a draft", async () => {
    await PullRequestFailing.run();
    const { onEdit } = PullRequestFailing.args;

    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    await userEvent.click(page.getByRole('menuitem', { name: /^Request review/ }));
    await expect.element(page.getByRole('menuitemcheckbox').first()).toBeVisible();
    const author = F1_PULL_REQUEST.author?.login ?? '';
    await expect
        .element(page.getByRole('menuitemcheckbox', { name: new RegExp(`^${author}`) }))
        .not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    await userEvent.click(page.getByRole('menuitem', { name: 'Convert to draft' }));
    expect(onEdit).toHaveBeenCalledWith({ kind: 'draft', draft: true });
});

test('⇧X opens the item menu at closing it: close as not planned', async () => {
    await IssueInPanel.run();

    await userEvent.keyboard('{Shift>}X{/Shift}');
    await userEvent.click(page.getByRole('menuitem', { name: 'Close as not planned' }));

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledWith({ kind: 'close', reason: 'NOT_PLANNED' });
});

test('⌘↵ posts the comment typed and empties the box', async () => {
    await IssueInPanel.run();

    await userEvent.keyboard('r');
    await userEvent.keyboard('Looks good{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledWith({ kind: 'comment', body: 'Looks good' });
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toHaveValue('');
});

test("K1b: edits a contributor can't make are not offered — no keys, no pickers, one line says why", async () => {
    await ContributorView.run();

    await expect.element(page.getByRole('note')).toHaveTextContent("set by skyline-labs/portal's maintainers");
    await expect.element(page.getByRole('button', { name: /^Labels:/ })).not.toBeInTheDocument();
    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    await expect.element(page.getByRole('menuitem', { name: /^Assign to/ })).not.toBeInTheDocument();
    await expect.element(page.getByRole('menuitem', { name: /^Close issue/ })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('l');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    expect(ContributorView.args.onEdit).not.toHaveBeenCalled();
});

test('D17: in a panel the stack map folds to one line once the content scrolls down, and unfolds on a click or at the top', async () => {
    await StackOfTenInPanel.run();
    const rows = page.getByRole('list', { name: 'Pull requests of the stack' });
    await expect.element(rows).toBeVisible();
    const scroll = page.getByRole('heading', { level: 1 }).element().parentElement?.parentElement;
    if (!scroll) {
        throw new Error('The content has no scrolling column.');
    }

    scroll.scrollTop = 200;
    scroll.dispatchEvent(new Event('scroll'));
    const strip = page.getByRole('button', { name: /^Show the stack: 6 of 10/u });
    await expect.element(strip).toBeVisible();
    expect(rows.query()).toBeNull();

    await strip.click();
    await expect.element(rows).toBeVisible();

    scroll.scrollTop = 400;
    scroll.dispatchEvent(new Event('scroll'));
    await expect.element(strip).toBeVisible();
    scroll.scrollTop = 0;
    scroll.dispatchEvent(new Event('scroll'));
    await expect.element(rows).toBeVisible();
});

test('D17: content that fits once the map folds keeps it folded — the browser clamping it to the top does not unfold it, and the end shows', async () => {
    await StackOfTenInPanel.run();
    const rows = page.getByRole('list', { name: 'Pull requests of the stack' });
    await expect.element(rows).toBeVisible();
    const scroll = page.getByRole('heading', { level: 1 }).element().parentElement?.parentElement;
    const frame = scroll?.closest<HTMLElement>('[style*="100vh"]');
    if (!scroll || !frame) {
        throw new Error('The content has no scrolling column in a frame.');
    }

    // The content overflows by 40px, less than the height the fold frees.
    const overflow = scroll.scrollHeight - scroll.clientHeight;
    frame.style.height = `${frame.clientHeight + overflow - 40}px`;
    await expect.poll(() => scroll.scrollHeight - scroll.clientHeight).toBe(40);

    scroll.scrollTop = 40;
    scroll.dispatchEvent(new Event('scroll'));
    const strip = page.getByRole('button', { name: /^Show the stack: 6 of 10/u });
    await expect.element(strip).toBeVisible();
    await expect.poll(() => scroll.scrollTop).toBe(0);
    scroll.dispatchEvent(new Event('scroll'));
    await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await expect.element(strip).toBeVisible();
    expect(rows.query()).toBeNull();
    expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight);
});

test('a row of the stack map opens its pull request in place of this one', async () => {
    await StackOfTenInModal.run();
    const { onOpenInPlace } = StackOfTenInModal.args;

    await page.getByRole('button', { name: /#62/u }).click();
    expect(onOpenInPlace).toHaveBeenCalledExactlyOnceWith(SYNC_ENGINE_STACK[2]!.id);
});

test('the stack map shows only for a pull request in a stack: on a page in its own column', async () => {
    await StackOfTwoOnPage.run();
    await expect.element(page.getByRole('region', { name: 'The stack' })).toBeVisible();

    await PullRequestFailing.run();
    expect(page.getByRole('region', { name: 'The stack' }).query()).toBeNull();
});

test('F3: a ready pull request leads with "Merge…" — ⇧M, its button and the first entry of the item menu ask for the merge panel; M still sets the milestone, Open on GitHub stays beside it', async () => {
    await PullRequestReady.run();
    const { onMerge } = PullRequestReady.args;

    const merge = page.getByRole('button', { name: 'Merge…' });
    await expect.element(merge).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
    // Beside it, by their text: the header has its own GitHub button, an icon alone.
    const gitHub = page.getByRole('link', { name: 'Open on GitHub' }).filter({ hasText: 'Open on GitHub' });
    await expect.element(gitHub).toHaveAttribute('aria-keyshortcuts', 'O');
    await expect.element(page.getByRole('link', { name: 'Review files' })).toHaveAttribute('aria-keyshortcuts', 'D');
    await expect.element(page.getByText("githq doesn't merge")).not.toBeInTheDocument();

    await userEvent.click(merge);
    expect(onMerge).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(onMerge).toHaveBeenCalledTimes(2);

    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    const menu = page.getByRole('menu');
    const entries = [...menu.element().querySelectorAll('[role="menuitem"]')].map(entry => entry.textContent ?? '');
    const mergeAt = entries.findIndex(text => text.startsWith('Merge…'));
    expect(mergeAt).toBeGreaterThanOrEqual(0);
    expect(mergeAt).toBeLessThan(entries.findIndex(text => text.startsWith('Request review')));
    await userEvent.click(page.getByRole('menuitem', { name: /^Merge…/ }));
    expect(onMerge).toHaveBeenCalledTimes(3);

    // `M` is the milestone's, as before.
    await userEvent.keyboard('m');
    await expect.element(page.getByRole('dialog')).toBeVisible();
    expect(onMerge).toHaveBeenCalledTimes(3);
});

test.each([
    ['behind its base', () => PullRequestBehind, 'Update branch'],
    ['conflicts', () => PullRequestConflicts, 'Resolve on GitHub'],
    ['a draft', () => PullRequestDraft, 'Mark ready…'],
])(
    'PM38: %s — ⇧M in the item menu says the way forward its button says, and still opens the panel',
    async (_, story, title) => {
        const shown = story();
        await shown.run();

        await expect.element(page.getByRole('button', { name: title })).toBeVisible();
        await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
        const entry = page.getByRole('menuitem', { name: new RegExp(`^${title}`) });
        await expect.element(entry).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
        await expect.element(page.getByRole('menuitem', { name: /^Merge…/ })).not.toBeInTheDocument();
        await userEvent.click(entry);
        expect(shown.args.onMerge).toHaveBeenCalledOnce();
    },
);

test("PM38: with the merge options read, ⇧M's entry weighs only the required checks, as the button does", async () => {
    // Its row counts a failing check that isn't required: alone, that would hold it with no way forward.
    const checks = { state: 'FAILURE', passing: 7, failing: 1, pending: 1 } as const;
    const item = { ...F3_PULL_REQUEST, mergeStateStatus: 'BEHIND', checks } as const;
    await PullRequestOptionalFailing.run({ args: { ...PullRequestOptionalFailing.args, item } });

    await expect.element(page.getByRole('button', { name: 'Update branch' })).toBeVisible();
    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    await expect.element(page.getByRole('menuitem', { name: /^Update branch/ })).toBeVisible();
});

test('PM39: ⇧E is not offered where no failed check runs on GitHub Actions', async () => {
    await PullRequestRerunOutsideActions.run();

    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    await expect.element(page.getByRole('menu')).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: /^Re-run failed checks/ })).not.toBeInTheDocument();
});

test('PM39: ⇧E names a failed check it re-runs, not one from outside GitHub Actions', async () => {
    await PullRequestRerunNamesActions.run();

    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    await expect.element(page.getByRole('menuitem', { name: /^Re-run failed checks/ })).toHaveTextContent('docs');
});

test('K1b: without write access there is no "Merge…" — no button, no key, no menu entry — and one line says so', async () => {
    await PullRequestContributorView.run();
    const { onMerge } = PullRequestContributorView.args;

    await expect.element(page.getByText("You can't merge in this repository")).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Merge…' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Shift>}M{/Shift}');
    await userEvent.keyboard('{ControlOrMeta>}.{/ControlOrMeta}');
    await expect.element(page.getByRole('menu')).toBeVisible();
    await expect.element(page.getByRole('menuitem', { name: /^Merge…/ })).not.toBeInTheDocument();
    expect(onMerge).not.toHaveBeenCalled();
});

test('PM33: being merged never reads merged — the pill stays Open, the verdict says "Being merged" and "Merge…" waits for GitHub', async () => {
    await PullRequestBeingMerged.run();
    const { onMerge } = PullRequestBeingMerged.args;

    await expect
        .element(page.getByRole('heading', { name: /^Being merged/ }))
        .toHaveTextContent('Being mergedSent to GitHub · not merged yet');
    await expect.element(page.getByText('Open', { exact: true })).toBeVisible();
    await expect.element(page.getByText('Merged', { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText('Waiting for GitHub')).toBeVisible();
    await expect.element(page.getByText("You can't merge in this repository")).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Merge…' })).not.toBeInTheDocument();
    // PM24: ⇧M still opens the panel, which says it is being merged.
    await userEvent.keyboard('{Shift>}M{/Shift}');
    expect(onMerge).toHaveBeenCalledOnce();
});

test('JKPLA: a failing check the base branch requires is tagged "Required"; a running one is not', async () => {
    await PullRequestFailing.run();

    const tagged = (name: string) => page.getByRole('listitem').filter({ hasText: name }).getByText('Required');
    await expect.element(tagged('ci / test (node 20)')).toBeVisible();
    await expect.element(tagged('ci / e2e (chromium)')).toBeVisible();
    await expect.element(tagged('ci / e2e (webkit)')).not.toBeInTheDocument();
});

test("PM38: with the merge options read, a check that isn't required failing or running leaves the standing ready, as the panel says", async () => {
    await PullRequestOptionalFailing.run();

    await expect
        .element(page.getByRole('heading', { name: /^Ready to merge/ }))
        .toHaveTextContent('Ready to mergeApproved · required checks passed');
});

test('PM38: checks still running — the standing draws its Checks line with the icon the merge panel draws them with', async () => {
    const checks = { state: 'PENDING', passing: 6, failing: 0, pending: 3 } as const;
    await PullRequestReady.run({ args: { ...PullRequestReady.args, item: { ...F3_PULL_REQUEST, checks } } });

    await expect.element(page.getByText('3 running', { exact: false })).toBeVisible();
    const label = [...document.querySelectorAll('dt')].find(term => term.textContent.trim() === 'Checks');
    expect(label?.querySelector('svg')?.classList.contains('lucide-loader')).toBe(true);
});

test('PM38: in the queue the standing says what the panel says, and "Queue…" opens it', async () => {
    await PullRequestInQueue.run();
    const { onMerge } = PullRequestInQueue.args;

    await expect
        .element(page.getByRole('heading', { name: /^In the queue/ }))
        .toHaveTextContent('In the queue3rd · waiting for checks · about 12 min');
    await userEvent.click(page.getByRole('button', { name: 'Queue…' }));
    expect(onMerge).toHaveBeenCalledOnce();
});

test('PM38: ready on a queue branch, "Queue…" and the same verdict as the panel', async () => {
    await PullRequestQueueReady.run();

    await expect.element(page.getByRole('heading', { name: /^Ready for the queue/ })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Queue…' })).toBeVisible();
});

test('PM38: auto-merge on, "Auto-merge…" and the same verdict as the panel', async () => {
    await PullRequestAutoMergeOn.run();

    await expect
        .element(page.getByRole('heading', { name: /^Auto-merge is on/ }))
        .toHaveTextContent('Auto-merge is onSquash · enabled by mlaine 12 minutes ago');
    await expect.element(page.getByRole('button', { name: 'Auto-merge…' })).toBeVisible();
});

test('PM38: not met where auto-merge may wait for it, "Auto-merge…" leads to the panel offering it', async () => {
    await PullRequestAutoMergeOffered.run();

    await expect.element(page.getByRole('button', { name: 'Auto-merge…' })).toBeVisible();
});

test('PM38: before the merge options are read, GitHub saying only checks not required fail reads ready', async () => {
    await PullRequestOptionalFailing.run({ args: { ...PullRequestOptionalFailing.args, mergeChecks: null } });

    await expect.element(page.getByRole('heading', { name: /^Ready to merge/ })).toBeVisible();
});

test('PM38: before the merge options are read, a failing check GitHub holds it for holds the standing', async () => {
    const { args } = PullRequestOptionalFailing;
    await PullRequestOptionalFailing.run({
        args: { ...args, mergeChecks: null, item: { ...args.item, mergeStateStatus: 'BLOCKED' } as typeof args.item },
    });

    await expect
        .element(page.getByRole('heading', { name: /^Can't merge yet/ }))
        .toHaveTextContent("Can't merge yet1 check failing");
});

test('PM38: conflicts — the verdict the panel says, and "Merge…" names the way forward it leads to and opens the panel', async () => {
    await PullRequestConflicts.run();
    const { onMerge } = PullRequestConflicts.args;

    await expect
        .element(page.getByRole('heading', { name: /^Can't merge/ }))
        .toHaveTextContent("Can't mergeConflicts with main");
    await expect.element(page.getByText('With main', { exact: true })).toBeVisible();
    const forward = page.getByRole('button', { name: 'Resolve on GitHub' });
    await expect.element(forward).toHaveAttribute('aria-keyshortcuts', 'Shift+M');
    await userEvent.click(forward);
    expect(onMerge).toHaveBeenCalledOnce();
});

test('PM22, PM38: a merge state GitHub has not worked out yet reads as not known in the conflicts line, whatever `mergeable` still says — as the panel reads it', async () => {
    await PullRequestMergeabilityUnknown.run();

    await expect.element(page.getByText('GitHub is still checking', { exact: true })).toBeVisible();
    await expect.element(page.getByText('None with main')).not.toBeInTheDocument();
});

test('PM38: behind its base — "Update branch" in place of "Merge…", the conditions still shown', async () => {
    await PullRequestBehind.run();

    await expect
        .element(page.getByRole('heading', { name: /^Behind main/ }))
        .toHaveTextContent('Behind mainmain requires being up to date');
    await expect.element(page.getByRole('button', { name: 'Update branch' })).toBeVisible();
    await expect.element(page.getByText('Approved by olam and pnowak')).toBeVisible();
});

test('PM38: a draft — the conditions fold, and "Mark ready…" in place of "Merge…"', async () => {
    await PullRequestDraft.run();

    await expect
        .element(page.getByRole('heading', { name: /^Draft/ }))
        .toHaveTextContent('DraftMark it ready for review first');
    await expect.element(page.getByRole('button', { name: 'Mark ready…' })).toBeVisible();
    await expect.element(page.getByText('Approved by olam and pnowak')).not.toBeInTheDocument();
});

test('PM38: a merge refused after the user moved on says so in the standing, and "Back to the merge" opens the panel', async () => {
    await PullRequestMergeRefused.run();
    const { onMerge } = PullRequestMergeRefused.args;

    await expect
        .element(page.getByRole('heading', { name: /^Merge refused/ }))
        .toHaveTextContent('Merge refusedAt least 2 approving reviews are required');
    await expect.element(page.getByText('Open', { exact: true })).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Back to the merge' }));
    expect(onMerge).toHaveBeenCalledOnce();
});

test('PM38: no answer in time is grey, neither merged nor refused, until the next refresh settles it', async () => {
    await PullRequestOutcomeUnknown.run();

    await expect
        .element(page.getByRole('heading', { name: /^Outcome not known yet/ }))
        .toHaveTextContent("Outcome not known yetGitHub hasn't answered · not shown as merged");
    await expect.element(page.getByText('The next refresh settles it')).toBeVisible();
    await expect.element(page.getByText('Merged', { exact: true })).not.toBeInTheDocument();
});
