import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { FakeReviewWriting } from '@/testing/FakeReviewWriting.js';
import {
    D1_ISSUE_DETAIL,
    F1_PULL_REQUEST,
    F1_PULL_REQUEST_DETAIL,
    F3_PULL_REQUEST,
} from '@/testing/sampleItemDetails.js';
import { CHANGES_REQUESTED_REVIEW, DB_THREAD, SCHEMA_THREAD } from '@/testing/sampleReviews.js';
import { SYNC_ENGINE_STACK } from '@/testing/sampleStacks.js';
import { SAMPLE_MAINTAINER_EDITING } from '@/testing/sampleRepositories.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';
import { trackTabFocus } from '@/testing/trackTabFocus.js';
import type { TrackingStore } from '@/tracking/TrackingStore.js';

import * as stories from './ItemView.stories.js';

const {
    ContributorView,
    IssueInPanel,
    IssueLongThreadOnPage,
    IssueOnNarrowPage,
    IssueOnPage,
    IssueOnPageNoRoomForPanel,
    LoadingComments,
    PullRequestBeingMerged,
    PullRequestBehind,
    PullRequestConflicts,
    PullRequestMergeRefused,
    PullRequestOutcomeUnknown,
    PullRequestContributorView,
    PullRequestDraft,
    PullRequestFailing,
    PullRequestFailingPage,
    PullRequestFailingWidePanel,
    PullRequestFailingWiderPanel,
    PullRequestMergeabilityUnknown,
    PullRequestAutoMergeOffered,
    PullRequestAutoMergeOn,
    PullRequestInQueue,
    PullRequestLongThreadOnShortPage,
    PullRequestOptionalFailing,
    PullRequestRerunNamesActions,
    PullRequestRerunOutsideActions,
    PullRequestQueueReady,
    PullRequestReady,
    StackOfTenInPanel,
    StackOfTenOnPage,
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
    await IssueOnPage.run();
    const { onNext, onPrevious, onClose } = IssueOnPage.args;

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
    await IssueOnPage.run();
    const { onNext, onClose } = IssueOnPage.args;

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

test('"Back to the panel" on a page and Shift+Enter ask for the panel', async () => {
    await IssueOnPage.run();

    await userEvent.click(page.getByRole('button', { name: 'Back to the panel' }));
    expect(IssueOnPage.args.onArrange).toHaveBeenLastCalledWith('panel');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(IssueOnPage.args.onArrange).toHaveBeenCalledTimes(2);
});

test('on a page in a window with no room for the panel, neither its button nor Shift+Enter is offered', async () => {
    await IssueOnPageNoRoomForPanel.run();

    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Back to the panel' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(IssueOnPageNoRoomForPanel.args.onArrange).not.toHaveBeenCalled();
});

test('"Open full screen" in the panel and Shift+Enter ask for the page; Shift+Enter in the comment box stays a new line', async () => {
    await IssueInPanel.run();

    await userEvent.click(page.getByRole('button', { name: 'Open full screen' }));
    expect(IssueInPanel.args.onArrange).toHaveBeenLastCalledWith('page');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(IssueInPanel.args.onArrange).toHaveBeenCalledTimes(2);

    await userEvent.keyboard('r');
    await userEvent.keyboard('one{Shift>}{Enter}{/Shift}two');
    expect(IssueInPanel.args.onArrange).toHaveBeenCalledTimes(2);
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toHaveValue('one\ntwo');
});

test('opened before its detail arrives: the row shows at once and the thread says it is loading', async () => {
    await LoadingComments.run();

    await expect
        .element(page.getByRole('heading', { name: 'Calendar shows wrong timezone for recurring bookings' }))
        .toBeInTheDocument();
    await expect.element(page.getByText('Loading 4 comments and the events from GitHub')).toBeInTheDocument();
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
    await IssueOnPage.run();
    const { onEdit } = IssueOnPage.args;

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
    await IssueOnPage.run();
    const { onEdit } = IssueOnPage.args;
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

test.each([
    ['F18: a page', () => PullRequestFailingPage, 32],
    ['F20: a panel dragged to 1400px', () => PullRequestFailingWidePanel, 24],
])(
    '%s, 1000px wide or more on a page, 1300px in the panel: the summary and the timeline stand side by side on one surface and scroll as one, wherever the pointer is',
    async (_, story, inset) => {
        await useShortWideWindow();
        await story().run();
        const columns = getColumnsScroll();
        const summary = getColumn('summary');
        const timeline = getColumn('timeline');
        const [left, right] = [getSummaryColumn().getBoundingClientRect(), timeline.getBoundingClientRect()];
        expect(left.width).toBe(440);
        expect(right.left).toBe(left.right);
        expect(right.top).toBe(left.top);
        // One surface, no line between the columns, the edge midway between their content, as far as from every edge.
        expect(getComputedStyle(getSummaryColumn()).borderRightWidth).toBe('0px');
        expect(getComputedStyle(getSummaryColumn()).backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(summary.getBoundingClientRect().right).toBe(left.right);
        for (const column of [summary, timeline]) {
            const style = getComputedStyle(column);
            expect([style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]).toEqual(
                Array.from({ length: 4 }, () => `${inset}px`),
            );
        }
        // The heading and the merge block in the summary, the thread in the timeline.
        const title = page.getByRole('heading', { level: 1 }).element();
        const box = page.getByRole('textbox', { name: 'Comment' }).element();
        expect(summary.contains(title)).toBe(true);
        expect(timeline.contains(box)).toBe(true);

        // One scroll: under the pointer, over the summary or the thread, nothing else scrolls first.
        expect(document.querySelectorAll('[data-route-scroll]')).toHaveLength(1);
        expect(getScrollingAncestor(elementAtCentre(title))).toBe(columns);
        expect(getScrollingAncestor(elementAtCentre(timeline.querySelector('p') ?? timeline))).toBe(columns);
        const threadTop = box.getBoundingClientRect().top;
        columns.scrollTop = 100;
        expect(columns.scrollTop).toBe(100);
        expect(box.getBoundingClientRect().top).toBe(threadTop - 100);
    },
);

test('a summary shorter than the view stays at the top while the thread scrolls', async () => {
    await IssueLongThreadOnPage.run();
    const columns = getColumnsScroll();
    const summary = getColumn('summary');
    expect(summary.getBoundingClientRect().height).toBeLessThan(columns.clientHeight);
    const summaryTop = summary.getBoundingClientRect().top;

    columns.scrollTop = columns.scrollHeight;
    expect(columns.scrollTop).toBeGreaterThan(0);
    expect(summary.getBoundingClientRect().top).toBe(summaryTop);
});

test('a summary taller than the view scrolls with the thread until its bottom meets the bottom of the view, then stays there', async () => {
    await PullRequestLongThreadOnShortPage.run();
    const columns = getColumnsScroll();
    const summary = getColumn('summary');
    const view = columns.getBoundingClientRect();
    const height = summary.getBoundingClientRect().height;
    expect(height).toBeGreaterThan(columns.clientHeight);
    const summaryTop = summary.getBoundingClientRect().top;

    columns.scrollTop = 50;
    await expect.poll(() => summary.getBoundingClientRect().top).toBe(summaryTop - 50);

    // Past where its bottom shows: it stays there however far the thread goes.
    const stuckAt = height - columns.clientHeight;
    expect(columns.scrollHeight - columns.clientHeight).toBeGreaterThan(stuckAt + 100);
    columns.scrollTop = stuckAt + 50;
    await expect.poll(() => summary.getBoundingClientRect().bottom).toBeCloseTo(view.top + columns.clientHeight, 0);
    columns.scrollTop = columns.scrollHeight;
    await expect.poll(() => summary.getBoundingClientRect().bottom).toBeCloseTo(view.top + columns.clientHeight, 0);
});

test('F19: in two columns on a page the thread fills the timeline, at the reading width in the default box, 32px from the summary', async () => {
    await StackOfTenOnPage.run();
    const thread = getColumn('timeline').firstElementChild;
    if (!thread) {
        throw new Error('The timeline holds no thread.');
    }

    expect(thread.getBoundingClientRect().width).toBe(920);
    expect(thread.getBoundingClientRect().left - getSummaryColumn().getBoundingClientRect().right).toBe(32);
});

test("on a page the columns stand in a box centred in the width: its edge widens it on both sides, the width kept in the user's settings; the summary's edge moves neither side", async () => {
    const { tracking, browser } = await runPageWithSettings();
    tracking.setMaxWidth('itemPageWidth', 1200);
    const columns = getColumnsScroll();
    const box = getPageBox();
    const space = () => {
        const outer = columns.getBoundingClientRect();
        const inner = box.getBoundingClientRect();
        return { left: inner.left - outer.left, right: outer.left + columns.clientWidth - inner.right };
    };
    await expect.poll(() => box.getBoundingClientRect().width).toBe(1200);
    expect(space().left).toBeGreaterThan(0);
    expect(Math.abs(space().left - space().right)).toBeLessThanOrEqual(1);

    const drag = pressEdge(page.getByRole('separator', { name: 'Resize the item' }).last().element());
    drag.moveBy(50);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(1300);
    drag.release();
    expect(Math.abs(space().left - space().right)).toBeLessThanOrEqual(1);
    expect(tracking.itemPageWidth).toBe(1300);

    // The summary's edge moves only the edge between the columns. Once the split has laid its panels out in the wider
    // box (a frame for its observer, a tick for the width put back).
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const { left, right } = box.getBoundingClientRect();
    const split = press(page.getByRole('separator', { name: 'Resize the summary' }).element());
    split.moveBy(60);
    await expect.poll(() => getSummaryColumn().getBoundingClientRect().width).toBe(500);
    split.release();
    expect(box.getBoundingClientRect().left).toBe(left);
    expect(box.getBoundingClientRect().right).toBe(right);
    expect(tracking.itemPageWidth).toBe(1300);

    // Changed elsewhere (another device), the box follows.
    tracking.setMaxWidth('itemPageWidth', 1100);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(1100);

    // Opened again, the item has the box's width kept.
    await runPageWithSettings(browser);
    await expect.poll(() => getPageBox().getBoundingClientRect().width).toBe(1100);
});

test('the box is at most as wide as the width there is, never narrower than the two columns; dragged to the edge it keeps "full"', async () => {
    const { tracking } = await runPageWithSettings();
    const columns = getColumnsScroll();
    const box = getPageBox();
    tracking.setMaxWidth('itemPageWidth', 4000);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(columns.clientWidth);

    // Not below the narrowest the two columns take (360 + 560px), however narrow a width is kept.
    tracking.setMaxWidth('itemPageWidth', 400);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(920);

    tracking.setMaxWidth('itemPageWidth', 1200);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(1200);
    const drag = pressEdge(page.getByRole('separator', { name: 'Resize the item' }).last().element());
    drag.moveBy(columns.clientWidth);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(columns.clientWidth);
    drag.release();
    expect(tracking.itemPageWidth).toBe('full');
});

test("a click on the box's edge, or Tab through it, keeps nothing; an arrow key keeps the width it moved to", async () => {
    const { tracking } = await runPageWithSettings();
    const box = getPageBox();
    const edges = page.getByRole('separator', { name: 'Resize the item' });
    // The summary's 440px beside a timeline at the reading width, each 32px from its edges, in a window that wide.
    const width = Math.min(440 + 920 + 2 * 32, getColumnsScroll().clientWidth);
    await expect.poll(() => box.getBoundingClientRect().width).toBe(width);

    const click = pressEdge(edges.last().element());
    click.moveBy(0);
    click.release();
    // Tab from the left edge to the right one: the key is let go of on the right edge.
    edges.first().element().focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(edges.last().element());
    expect(tracking.itemPageWidth).toBeNull();
    expect(box.getBoundingClientRect().width).toBe(width);

    // On the right edge, the left arrow narrows the box on both sides.
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(() => box.getBoundingClientRect().width).toBe(width - 40);
    expect(tracking.itemPageWidth).toBe(width - 40);
});

test("the summary's column is resized by dragging its edge or by the arrow keys on it, from 360 to 560 px, the width kept on this device and the timeline following it", async () => {
    const { browser } = await runPageWithSettings();
    const edge = page.getByRole('separator', { name: 'Resize the summary' });
    const threadLeft = () => getColumn('timeline').firstElementChild?.getBoundingClientRect().left;
    const boxLeft = getPageBox().getBoundingClientRect().left;
    await expect.poll(() => getSummaryColumn().getBoundingClientRect().width).toBe(440);

    const drag = press(edge.element());
    drag.moveBy(60);
    await expect.poll(() => getSummaryColumn().getBoundingClientRect().width).toBe(500);
    drag.release();
    await expect.poll(() => browser.localStorage.getItem(SUMMARY_WIDTH_KEY)).toBe('500');
    expect(threadLeft()).toBe(boxLeft + 500 + 32);

    // A tenth of the box a press, within the range.
    edge.element().focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(() => getSummaryColumn().getBoundingClientRect().width).toBe(560);
    await expect.poll(() => browser.localStorage.getItem(SUMMARY_WIDTH_KEY)).toBe('560');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect.poll(() => getSummaryColumn().getBoundingClientRect().width).toBe(360);
    await expect.poll(() => browser.localStorage.getItem(SUMMARY_WIDTH_KEY)).toBe('360');

    // Opened again, the item has the width kept.
    await runPageWithSettings(browser);
    await expect.poll(() => getSummaryColumn().getBoundingClientRect().width).toBe(360);
});

test.each([
    ['F21: the panel', () => PullRequestFailing],
    ['the panel dragged to 1100px', () => PullRequestFailingWiderPanel],
    ['F22: a page of a 900px window', () => IssueOnNarrowPage],
])(
    '%s, narrower than 1000px on a page or 1300px in the panel: the summary comes first and the timeline under it, scrolling as one',
    async (_, story) => {
        await story().run();
        const summary = getColumn('summary');
        const timeline = getColumn('timeline');
        expect(timeline.getBoundingClientRect().top).toBeGreaterThan(summary.getBoundingClientRect().bottom);
        expect(timeline.getBoundingClientRect().left).toBe(summary.getBoundingClientRect().left);
        const scroll = getContentScroll();
        expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
        expect(getComputedStyle(timeline).overflowY).toBe('visible');
        expect(document.querySelectorAll('[data-route-scroll]')).toHaveLength(1);
    },
);

test('in two columns R brings the composer into view in the one scroll, leaving the space the end of the scroll leaves', async () => {
    await useShortWideWindow();
    await IssueOnPage.run();
    const columns = getColumnsScroll();
    columns.scrollTop = 0;

    await userEvent.keyboard('r');
    const box = page.getByRole('textbox', { name: 'Comment' });
    await expect.element(box).toHaveFocus();
    expect(columns.scrollTop).toBeGreaterThan(0);
    expect(isInView(box.element(), columns)).toBe(true);
    expect(columns.scrollTop).toBeCloseTo(columns.scrollHeight - columns.clientHeight, 0);
});

test('in two columns J on a code thread brings the next one into view in the one scroll', async () => {
    await PullRequestLongThreadOnShortPage.run({
        args: {
            ...PullRequestLongThreadOnShortPage.args,
            detail: {
                ...F1_PULL_REQUEST_DETAIL,
                reviewSummaries: [...F1_PULL_REQUEST_DETAIL.reviewSummaries, CHANGES_REQUESTED_REVIEW.review],
            },
            reviewThreads: [DB_THREAD, SCHEMA_THREAD],
            reviewWriting: new FakeReviewWriting(),
        },
    });
    // dkim's code comment, resolved: opened, a code thread too.
    await userEvent.click(page.getByRole('button', { name: /^Resolved/u }));
    const columns = getColumnsScroll();
    const first = page.getByRole('group', { name: 'Thread by sofiab on src/store/db.ts' }).element();
    const next = page.getByRole('group', { name: 'Thread by dkim on src/store/schema.ts' }).element();
    if (!(first instanceof HTMLElement)) {
        throw new TypeError('The code thread is no element to focus.');
    }
    // The first in view at the bottom of the scroll, the next under it out of view.
    columns.scrollTop += first.getBoundingClientRect().bottom - columns.getBoundingClientRect().bottom;
    first.focus({ preventScroll: true });
    expect(isInView(next, columns)).toBe(false);

    await userEvent.keyboard('j');
    await expect.element(next).toHaveFocus();
    expect(isInView(next, columns)).toBe(true);
});

test('the summary moves between one column and two as it is: a picker open in it stays open', async () => {
    await IssueOnNarrowPage.run();
    await userEvent.keyboard('l');
    const picker = page.getByRole('dialog');
    await expect.element(picker).toBeVisible();
    const summary = getColumn('summary');

    const frame = document.querySelector('article')?.parentElement;
    if (!frame) {
        throw new Error('The item is in no frame.');
    }
    frame.style.width = '1440px';
    await expect.poll(() => document.querySelector('[data-route-scroll^="item-columns:"]')).not.toBeNull();
    expect(getSummaryColumn().contains(summary)).toBe(true);
    await expect.element(picker).toBeVisible();
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

    await rightClickComment('Steps');
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

    await rightClickComment('Steps');
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
    await rightClickComment('Same on mobile.');
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

/**
 * Right-clicks the head of the comment that reads `text`. Not its text: in GitHub's rendering a right click is the
 * browser's own menu, or a githq link's (`GitHubLinks`).
 */
async function rightClickComment(text: string) {
    await userEvent.click(
        page
            .getByRole('listitem')
            .filter({ hasText: text })
            .getByText(/^commented /),
        {
            button: 'right',
        },
    );
}

/** `element` is wholly inside what `scroll` shows. */
function isInView(element: Element, scroll: HTMLElement) {
    const box = element.getBoundingClientRect();
    const view = scroll.getBoundingClientRect();
    return box.top >= view.top && box.bottom <= view.bottom;
}

/** A window as wide as the widest story and short enough for its timeline to scroll, until the test ends. */
async function useShortWideWindow() {
    await page.viewport(1920, 500);
    onTestFinished(() => page.viewport(414, 896));
}

/** Where `LocalPreferences` keeps the summary's width. */
const SUMMARY_WIDTH_KEY = 'githq.panelWidth.itemSummary';

/**
 * Runs `PullRequestFailingPage` in `browser` (a user of their own when not given, a reopened item when given again)
 * and gives the user's settings once read: where the width of a page's box is kept.
 */
async function runPageWithSettings(browser = createSignedInBrowser()) {
    const settings = Promise.withResolvers<TrackingStore>();
    await PullRequestFailingPage.run({
        parameters: { ...PullRequestFailingPage.parameters, browser, onTracking: settings.resolve },
    });
    return { tracking: await settings.promise, browser };
}

/** In two columns, the summary's column: the panel of the split holding the summary (its place, sticky in it). */
function getSummaryColumn() {
    const column = getColumn('summary').parentElement?.parentElement?.parentElement;
    if (!column) {
        throw new Error('The summary is in no column.');
    }

    return column;
}

/** On a page in two columns, the box the columns stand in: what its edges are drawn in. */
function getPageBox() {
    const box = page.getByRole('separator', { name: 'Resize the item' }).first().element().parentElement;
    if (!box) {
        throw new Error('The page has no box.');
    }

    return box;
}

/** The element the pointer is over at the centre of `element`, as the wheel finds it. */
function elementAtCentre(element: Element) {
    const { left, top, width, height } = element.getBoundingClientRect();
    const found = document.elementFromPoint(left + width / 2, top + height / 2);
    if (!found) {
        throw new Error('Nothing is under the pointer.');
    }

    return found;
}

/** The nearest element around `element`, itself included, that scrolls vertically: what the wheel over it scrolls. */
function getScrollingAncestor(element: Element) {
    for (let current: Element | null = element; current; current = current.parentElement) {
        const { overflowY } = getComputedStyle(current);
        if (overflowY === 'auto' || overflowY === 'scroll') {
            return current;
        }
    }

    return null;
}

/** Presses the primary button on a box's edge (`WidthHandle`), as the mouse does (pointer 1). */
function pressEdge(handle: Element) {
    const { left: x, top, height } = handle.getBoundingClientRect();
    const init = { pointerId: 1, button: 0, bubbles: true, clientY: top + height / 2 };
    handle.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x }));

    return {
        /** Moves the pointer `by` pixels from where it was pressed. */
        moveBy(by: number) {
            handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x + by }));
        },
        release() {
            handle.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: x }));
        },
    };
}

/** Presses the mouse on `handle`, as Reka hears it: it listens on the body and takes no width to be clicked by a tool. */
function press(handle: Element) {
    const { left: x, top, bottom } = handle.getBoundingClientRect();
    // Within the window: an edge running the whole scroll goes on below it.
    const y = (top + Math.min(bottom, window.innerHeight)) / 2;
    document.body.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));

    return {
        /** Moves the mouse `by` pixels from where it was pressed. */
        moveBy(by: number) {
            document.body.dispatchEvent(new MouseEvent('mousemove', { clientX: x + by, clientY: y, bubbles: true }));
        },
        release() {
            handle.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
        },
    };
}

/** The content in one column, scrolling as one: summary, then timeline. */
function getContentScroll() {
    return getScrollContainer('item-main');
}

/** In two columns, the one scroll of both columns. */
function getColumnsScroll() {
    return getScrollContainer('item-columns');
}

/** The summary or the timeline, wherever the layout has them. */
function getColumn(kind: 'summary' | 'timeline') {
    const column = document.querySelector<HTMLElement>(`[data-item-column="${kind}"]`);
    if (!column) {
        throw new Error(`The item has no ${kind}.`);
    }

    return column;
}

/** The content's scrolling container `kind` (`item-main` in one column, `item-columns` in two), by what it shows. */
function getScrollContainer(kind: string) {
    const container = document.querySelector<HTMLElement>(`[data-route-scroll^="${kind}:"]`);
    if (!container) {
        throw new Error(`The item has no ${kind} container.`);
    }

    return container;
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
    // The summary's own map, for two columns, is not drawn in one.
    const maps = () =>
        [...document.querySelectorAll('section[aria-label="The stack"]')].filter(map => map.checkVisibility());
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
    await StackOfTenOnPage.run();
    const { onOpenInPlace } = StackOfTenOnPage.args;

    await page.getByRole('button', { name: /#62/u }).click();
    expect(onOpenInPlace).toHaveBeenCalledExactlyOnceWith(SYNC_ENGINE_STACK[2]!.id);
});

test('the stack map shows only for a pull request in a stack: in two columns at the top of the summary, with no bar', async () => {
    await StackOfTwoOnPage.run();
    const map = page.getByRole('region', { name: 'The stack' });
    await expect.element(map).toBeVisible();
    expect(map.all()).toHaveLength(1);
    expect(getColumn('summary').contains(map.element())).toBe(true);
    expect(stackBarToggle().query()).toBeNull();

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
