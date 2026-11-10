import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import {
    D1_ISSUE_DETAIL,
    F1_PULL_REQUEST,
    F1_PULL_REQUEST_DETAIL,
    F3_PULL_REQUEST,
} from '@/testing/sampleItemDetails.js';
import { SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';
import { SAMPLE_MAINTAINER_EDITING } from '@/testing/sampleRepositories.js';
import { trackTabFocus } from '@/testing/trackTabFocus.js';

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
        // A link in GitHub's rendering is the brand's indigo.
        expect(getComputedStyle(link.element()).color).toBe('rgb(123, 135, 247)');
    }
});

test('first run and loading D7: a row comes whole, so with its detail and its repository not read yet empty still reads empty', async () => {
    await LoadingComments.run({
        args: {
            ...LoadingComments.args,
            item: { ...D1_ISSUE_DETAIL.item, assignees: [], labels: [], milestone: null },
            editing: { ...SAMPLE_MAINTAINER_EDITING, metadata: null },
        },
    });

    await expect.element(page.getByRole('button', { name: 'Assignees: No one' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Labels: None' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Milestone: None' })).toBeVisible();
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

test("a control Tab reached outside the list holds an opened panel's J/K; one Escape gives them back and does not close it", async () => {
    trackTabFocus();
    await IssueSplit.run();
    const { onNext, onClose } = IssueSplit.args;

    await userEvent.tab();
    expect(document.activeElement?.hasAttribute('data-tab-focus')).toBe(true);
    await userEvent.keyboard('j');
    expect(onNext).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);

    await userEvent.keyboard('j');
    expect(onNext).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
});

test('the arrangement switch asks for another arrangement', async () => {
    await IssueSplit.run();

    await userEvent.click(page.getByRole('group', { name: 'Arrangement' }).getByRole('button', { name: 'Panel' }));
    expect(IssueSplit.args.onArrange).toHaveBeenCalledWith('panel');
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

test("⇧X closes an open issue as completed at once, as the composer's button does: no menu", async () => {
    await IssueInPanel.run();

    await userEvent.keyboard('{Shift>}X{/Shift}');

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledExactlyOnceWith({ kind: 'close', reason: 'COMPLETED' });
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test('the item menu still closes an issue as not planned', async () => {
    await IssueInPanel.run();

    await userEvent.click(page.getByRole('button', { name: /^Actions of / }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Close issue/ }));
    await userEvent.click(page.getByRole('menuitem', { name: 'Close as not planned' }));

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledWith({ kind: 'close', reason: 'NOT_PLANNED' });
});

test('⇧X closes a pull request at once: there is nothing to choose, so no menu', async () => {
    await PullRequestReady.run();

    await userEvent.keyboard('{Shift>}X{/Shift}');

    expect(PullRequestReady.args.onEdit).toHaveBeenCalledWith({ kind: 'close', reason: 'COMPLETED' });
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test("the item menu's Close pull request closes it, with no submenu of itself", async () => {
    await PullRequestReady.run();

    await userEvent.click(page.getByRole('button', { name: /^Actions of / }));
    await userEvent.click(page.getByRole('menuitem', { name: /^Close pull request/ }));

    expect(PullRequestReady.args.onEdit).toHaveBeenCalledWith({ kind: 'close', reason: 'COMPLETED' });
    await expect.element(page.getByRole('menu')).not.toBeInTheDocument();
});

test('⌘↵ posts the comment typed and empties the box', async () => {
    await IssueInPanel.run();

    await userEvent.keyboard('r');
    await userEvent.keyboard('Looks good{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(IssueInPanel.args.onEdit).toHaveBeenCalledWith({ kind: 'comment', body: 'Looks good', keptInThread: true });
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toHaveValue('');
});

test('with text typed the close button reads "Close with comment": the comment goes first, then the close, and the box empties', async () => {
    await IssueInPanel.run();
    const { onEdit } = IssueInPanel.args;

    await userEvent.fill(page.getByRole('textbox', { name: 'Comment' }), '  Fixed in #12  ');
    await userEvent.click(page.getByRole('button', { name: 'Close with comment', exact: true }));

    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(onEdit).toHaveBeenNthCalledWith(1, { kind: 'comment', body: 'Fixed in #12', keptInThread: true });
    expect(onEdit).toHaveBeenNthCalledWith(2, { kind: 'close', reason: 'COMPLETED' });
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toHaveValue('');
    await expect.element(page.getByRole('button', { name: 'Close issue', exact: true })).toBeVisible();
});

test('the composer ends the thread and scrolls with it: nothing is pinned under the content', async () => {
    await IssueInPanel.run();

    const scroll = getContentScroll();
    expect(scroll.contains(page.getByRole('textbox', { name: 'Comment' }).element())).toBe(true);
    expect(document.querySelector('article footer')).toBeNull();
});

test('R brings the composer into view leaving the space the end of the scroll leaves, not flush against the edge', async () => {
    await IssueInPanel.run();
    const scroll = getContentScroll();
    scroll.scrollTop = 0;

    await userEvent.keyboard('r');
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toHaveFocus();
    expect(scroll.scrollHeight - scroll.clientHeight).toBeGreaterThan(0);
    expect(scroll.scrollTop).toBeCloseTo(scroll.scrollHeight - scroll.clientHeight, 0);
});

test('Quote reply of a long comment leaves its HTML comments out and brings the end of the box, where the cursor is, into view', async () => {
    const [first, mine] = D1_ISSUE_DETAIL.comments.nodes;
    const lines = Array.from({ length: 60 }, (_, index) => `Step ${index + 1}.`);
    const long = {
        ...mine!,
        id: 'C_LONG',
        body: `<!-- Fill in the steps -->\n${lines.join('\n')}`,
        bodyHtml: '<p>Steps</p>',
    };
    await IssueInPanel.run({
        args: {
            ...IssueInPanel.args,
            detail: { ...D1_ISSUE_DETAIL, comments: { ...D1_ISSUE_DETAIL.comments, nodes: [first!, long] } },
        },
    });
    const scroll = getContentScroll();
    scroll.scrollTop = 0;

    await userEvent.click(page.getByText('Steps', { exact: true }), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Quote reply' }));

    const box = page.getByRole('textbox', { name: 'Comment' });
    await expect.element(box).toHaveFocus();
    await expect.element(box).toHaveValue(`${lines.map(line => `> ${line}`).join('\n')}\n\n`);
    await expect
        .poll(() => isInView(page.getByRole('button', { name: 'Comment', exact: true }).element(), scroll))
        .toBe(true);
});

test("Edit of a long comment keeps the editor's head in view, not only the caret at its end", async () => {
    const [first, mine] = D1_ISSUE_DETAIL.comments.nodes;
    const body = Array.from({ length: 60 }, (_, index) => `Step ${index + 1}.`).join('\n');
    const long = { ...mine!, id: 'C_LONG', body, bodyHtml: '<p>Steps</p>' };
    await IssueInPanel.run({
        args: {
            ...IssueInPanel.args,
            detail: { ...D1_ISSUE_DETAIL, comments: { ...D1_ISSUE_DETAIL.comments, nodes: [first!, long] } },
        },
    });
    const scroll = getContentScroll();

    await userEvent.click(page.getByText('Steps', { exact: true }), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));

    await expect.element(page.getByRole('textbox', { name: 'Edit comment' })).toHaveFocus();
    const tabs = page.getByRole('tab', { name: 'Write' }).all();
    await expect.poll(() => isInView(tabs[0]!.element(), scroll)).toBe(true);
});

test('K1b: a conversation locked to collaborators, or an archived repository, says so in place of the composer, and R has nothing to focus', async () => {
    const editing = {
        ...SAMPLE_MAINTAINER_EDITING,
        permissions: { ...SAMPLE_MAINTAINER_EDITING.permissions, comment: false },
    };
    await IssueInPanel.run({
        args: { ...IssueInPanel.args, editing, detail: { ...D1_ISSUE_DETAIL, locked: true } },
    });

    await expect
        .element(page.getByText('This conversation is locked to collaborators', { exact: false }))
        .toBeVisible();
    expect(page.getByRole('textbox', { name: 'Comment' }).query()).toBeNull();
    await userEvent.keyboard('r');
    expect(document.activeElement).toBe(document.body);
    // Quote reply would land in a draft no one sees.
    await userEvent.click(page.getByText('Same on mobile.', { exact: false }), { button: 'right' });
    await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();
    expect(page.getByRole('menuitem', { name: 'Quote reply' }).query()).toBeNull();
    await userEvent.keyboard('{Escape}');

    const metadata = SAMPLE_MAINTAINER_EDITING.metadata && { ...SAMPLE_MAINTAINER_EDITING.metadata, isArchived: true };
    await IssueInPanel.run({ args: { ...IssueInPanel.args, editing: { ...editing, metadata } } });
    await expect.element(page.getByText('skyline-labs/portal is archived, so it takes no new comments.')).toBeVisible();
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

/** The panel's scrolling content: the column holding the item's heading. */
/** `element` is wholly inside what `scroll` shows. */
function isInView(element: Element, scroll: HTMLElement) {
    const box = element.getBoundingClientRect();
    const view = scroll.getBoundingClientRect();
    return box.top >= view.top && box.bottom <= view.bottom;
}

function getContentScroll() {
    const scroll = page.getByRole('heading', { level: 1 }).element().parentElement?.parentElement;
    if (!scroll) {
        throw new Error('The content has no scrolling column.');
    }

    return scroll;
}

/** The stack bar's toggle, named by the stack. */
const stackBarToggle = () => page.getByRole('button', { name: /^Pull requests of the stack: /u });

/** Scrolls the panel's content to its end, the stack's rows out of view, and waits for the bar to show its chevron. */
async function scrollRowsAway(scroll: HTMLElement) {
    scroll.scrollTop = scroll.scrollHeight;
    await expect.element(stackBarToggle()).toBeEnabled();
}

test('D25: in a panel the stack bar stays put while the rows scroll away under it; the chevron shows once they are gone', async () => {
    await StackOfTenInPanel.run();
    const toggle = stackBarToggle();
    const scroll = getContentScroll();
    const rows = page.getByRole('list', { name: 'Pull requests of the stack' });
    await expect.element(rows).toBeVisible();
    // Every row, none folded.
    expect(rows.element().querySelectorAll('button')).toHaveLength(SYNC_ENGINE_STACK.length);
    // At the top the rows are in view: nothing to drop, no chevron.
    await expect.element(toggle).toBeDisabled();
    expect(toggle.element().querySelector('svg.lucide-chevron-down')).toBeNull();

    const bar = toggle.element().parentElement;
    if (!bar) {
        throw new Error('The toggle is not in a bar.');
    }

    const [barHeight, contentTop] = [bar.getBoundingClientRect().height, scroll.getBoundingClientRect().top];
    await scrollRowsAway(scroll);
    expect(toggle.element().querySelector('svg.lucide-chevron-down')).not.toBeNull();
    expect(bar.getBoundingClientRect().height).toBe(barHeight);
    expect(scroll.getBoundingClientRect().top).toBe(contentTop);

    scroll.scrollTop = 0;
    await expect.element(toggle).toBeDisabled();
});

test('D27: a click on the bar drops the rows over the content — one map at a time — and Escape takes them away, the item still open', async () => {
    await StackOfTenInPanel.run();
    const { onClose } = StackOfTenInPanel.args;
    const scroll = getContentScroll();
    await scrollRowsAway(scroll);
    const top = scroll.scrollTop;

    await stackBarToggle().click();
    await expect.element(stackBarToggle()).toHaveAttribute('aria-expanded', 'true');
    // The copy over the content; the one in it inert and out of the accessibility tree.
    const maps = () => document.querySelectorAll('section[aria-label="The stack"]');
    await expect.poll(() => maps().length).toBe(2);
    const region = page.getByRole('region', { name: 'The stack' });
    await expect.element(region).toBeVisible();
    expect(region.all()).toHaveLength(1);
    expect(scroll.scrollTop).toBe(top);

    // `J`/`K` still walk the stack while the rows are dropped.
    await userEvent.keyboard('j');
    expect(StackOfTenInPanel.args.onNext).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    await expect.element(stackBarToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(maps()).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
});

test('D27: the dropped rows close on a second click on the bar, a click outside, any scroll of the content and the rows coming back into view', async () => {
    await StackOfTenInPanel.run();
    const scroll = getContentScroll();
    const toggle = stackBarToggle();
    await scrollRowsAway(scroll);

    await toggle.click();
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await userEvent.click(page.getByRole('textbox', { name: 'Comment' }));
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');

    // Scrolling the content, up or down, with the rows still out of view (it starts at the end).
    for (const by of [-40, 20]) {
        await toggle.click();
        await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
        scroll.scrollTop += by;
        await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect.element(toggle).toBeEnabled();
    }

    await toggle.click();
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
    scroll.scrollTop = 0;
    await expect.element(toggle).toBeDisabled();
    await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('D25: another pull request of the stack opens with its rows in view and none dropped', async () => {
    const canvasElement = document.createElement('div');
    document.body.append(canvasElement);
    await StackOfTenInPanel.run({ canvasElement });
    const scroll = getContentScroll();
    const toggle = stackBarToggle();
    await scrollRowsAway(scroll);
    await toggle.click();

    // A row of the dropped copy asks for its pull request; the screen then opens it here.
    const next = SYNC_ENGINE_STACK[6]!;
    await page.getByRole('region', { name: 'The stack' }).getByRole('button', { name: /#66/u }).click();
    expect(StackOfTenInPanel.args.onOpenInPlace).toHaveBeenCalledExactlyOnceWith(next.id);
    await StackOfTenInPanel.run({
        canvasElement,
        args: {
            ...StackOfTenInPanel.args,
            item: next,
            detail: { ...F1_PULL_REQUEST_DETAIL, id: next.id, item: next },
            neighbours: { previous: SYNC_ENGINE_STACK[5]!.id, next: SYNC_ENGINE_STACK[7]!.id },
        },
    });

    await expect.element(page.getByRole('heading', { level: 1 })).toHaveTextContent(next.title);
    // What the router does for another item (`shell/routeScroll.ts`, e2e `navigation/routeScroll.spec.ts`).
    getContentScroll().scrollTop = 0;
    await expect.element(stackBarToggle()).toBeDisabled();
    await expect.element(stackBarToggle()).toHaveAttribute('aria-expanded', 'false');
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

test('PM38: before the merge options are read, GitHub saying it merges with no review decision reads ready', async () => {
    const { args } = PullRequestOptionalFailing;
    await PullRequestOptionalFailing.run({
        args: {
            ...args,
            item: { ...F3_PULL_REQUEST, mergeStateStatus: 'CLEAN', reviewDecision: null },
            mergeChecks: null,
        },
    });

    await expect
        .element(page.getByRole('heading', { name: /^Ready to merge/ }))
        .toHaveTextContent('Ready to mergeNo review required · no conflicts');
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
