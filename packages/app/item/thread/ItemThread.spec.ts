import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { shallowReactive } from 'vue';

import type { FailedTextEdit } from '@/edits/CommentDrafts.js';
import type { ItemComment } from '@/store/ItemDetailTypes.js';
import { D1_ISSUE, D1_ISSUE_DETAIL, F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from '@/testing/sampleItemDetails.js';

import * as stories from './ItemThread.stories.js';

const {
    IssueInPanel,
    PullRequestInPanel,
    NotSent,
    NotSentReadOnly,
    EditRefused,
    SendingAmongEvents,
    LongThread,
    Loading,
    Empty,
    Failed,
} = composeStories(stories);

/** The card of the comment that reads `text`. */
function card(text: string) {
    return page.getByRole('listitem').filter({ hasText: text });
}

/** Opens the ⋯ menu of the comment that reads `text`. */
async function openMenu(text: string) {
    await userEvent.click(card(text).getByRole('button', { name: 'Comment actions' }));
}

const MINE = 'Opened #1205';
const THEIRS = 'Same on mobile.';

test('what GitHub has and the detail does not hold is folded; the band reads it, busy until it is in, and says when it failed', async () => {
    let answer = Promise.withResolvers<void>();
    const loadMiddle = vi.fn(() => answer.promise);
    await IssueInPanel.run({ args: { ...IssueInPanel.args, loadMiddle } });

    const fold = page.getByRole('button', { name: /^Show 2 earlier events/ });
    await expect.element(fold).toHaveTextContent(/2 comments/);
    await userEvent.click(fold);
    expect(loadMiddle).toHaveBeenCalledTimes(1);
    await expect.element(fold).toHaveAttribute('aria-busy', 'true');

    answer.reject(new Error('GitHub cannot be reached'));
    await expect.element(fold).toHaveTextContent(/They couldn.t be loaded from GitHub\. Try again\./);
    await expect.element(fold).not.toHaveAttribute('aria-busy');

    // Read again from the band; still not held, the fold stays, without the failure.
    answer = Promise.withResolvers<void>();
    await userEvent.click(fold);
    expect(loadMiddle).toHaveBeenCalledTimes(2);
    answer.resolve();
    await expect.element(fold).not.toHaveAttribute('aria-busy');
    await expect.element(fold).not.toHaveTextContent(/couldn.t be loaded/);
});

test('the items the fold reveals go in place, the first of them taking the focus, so the keyboard keeps its place', async () => {
    const [newest] = D1_ISSUE_DETAIL.comments.nodes;
    const older: ItemComment[] = [
        { ...newest!, id: 'C_OLDER_1', bodyHtml: '<p>The first comment on the issue.</p>' },
        { ...newest!, id: 'C_OLDER_2', bodyHtml: '<p>The second comment on the issue.</p>' },
    ];
    // GitHub's answer: the detail with every comment, as the store puts it in.
    const loadMiddle = vi.fn(() => {
        const { comments } = D1_ISSUE_DETAIL;
        args.detail = {
            ...D1_ISSUE_DETAIL,
            comments: { ...comments, nodes: [...older, ...comments.nodes], olderCursor: null },
        };
        return Promise.resolve();
    });
    const args = shallowReactive({ ...IssueInPanel.args, detail: D1_ISSUE_DETAIL, loadMiddle });
    await IssueInPanel.run({ args });

    page.getByRole('button', { name: /^Show 2 earlier events/ })
        .element()
        .focus();
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByRole('button', { name: /earlier/ })).not.toBeInTheDocument();
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'The first comment on the issue.' }))
        .toHaveFocus();
});

test('a long thread read whole folds its middle by the counts of each group, and shows it without asking GitHub', async () => {
    const loadMiddle = vi.fn(() => Promise.resolve());
    await LongThread.run({ args: { ...LongThread.args, loadMiddle } });

    const entries = page.getByRole('listitem');
    const fold = page.getByRole('button', { name: /^Show 23 earlier events/ });
    await expect.element(fold).toHaveTextContent(/15 comments\s*8 other events/);
    expect(fold.element().textContent).not.toMatch(/commit/);
    // The first two, the fold, the newest five.
    expect(entries.elements()).toHaveLength(8);
    await expect.element(entries.nth(1)).toHaveTextContent(/added this to parent/);
    await expect.element(entries.nth(3)).toHaveTextContent('Fixed by #15 once it lands');

    await userEvent.click(fold);

    expect(loadMiddle).not.toHaveBeenCalled();
    await expect.element(fold).not.toBeInTheDocument();
    expect(entries.elements()).toHaveLength(30);
    await expect.element(entries.nth(2)).toHaveFocus();
});

test('a comment with an edit GitHub did not take is never folded away: its editor stays in view', async () => {
    const failedEdits: FailedTextEdit[] = [
        {
            itemId: LongThread.args.item!.id,
            commentId: 'C_LONG_3',
            body: 'Follow-up 3, edited.',
            reason: { kind: 'offline' },
        },
    ];
    await LongThread.run({ args: { ...LongThread.args, failedEdits } });

    await expect.element(page.getByRole('textbox', { name: 'Edit comment' })).toHaveValue('Follow-up 3, edited.');
    await expect.element(page.getByRole('button', { name: /^Show \d+ earlier events/ })).toBeInTheDocument();
});

test('F16: opened the first time, the description stands and the rail says what is being read, as the row counts it', async () => {
    await Loading.run();

    await expect.element(page.getByRole('status')).toHaveTextContent('Loading 4 comments and the events from GitHub');
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toBeInTheDocument();
    expect(page.getByRole('alert').query()).toBeNull();
});

test('F16: with nothing between them, the description goes straight to the composer', async () => {
    await Empty.run();

    await expect.element(page.getByText('Recurring visits created before the DST change')).toBeInTheDocument();
    expect(page.getByRole('listitem').query()).toBeNull();
    expect(page.getByRole('status').query()).toBeNull();
});

test('F16: not given by GitHub, the rail says so with Try again, which reads it again, and Open on GitHub', async () => {
    const readAgain = vi.fn(() => Promise.resolve());
    await Failed.run({ args: { ...Failed.args, readAgain } });

    await expect.element(page.getByRole('alert')).toHaveTextContent("The comments and events couldn't be loaded");
    await expect
        .element(page.getByRole('link', { name: 'Open on GitHub' }))
        .toHaveAttribute('href', Failed.args.item!.url);
    await userEvent.click(page.getByRole('button', { name: 'Try again' }));
    expect(readAgain).toHaveBeenCalledTimes(1);
    expect(page.getByRole('status').query()).toBeNull();
});

test('with every comment read there is nothing to fold', async () => {
    await PullRequestInPanel.run();

    await expect.element(page.getByText('Good catch, adding a cross-repo fixture')).toBeInTheDocument();
    expect(page.getByRole('button', { name: /earlier/ }).query()).toBeNull();
});

test('a comment GitHub did not take says why, after those read, and offers Discard and Retry', async () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();
    await NotSent.run({ args: { ...NotSent.args, onRetry, onDiscard } });

    const alerts = page.getByRole('alert');
    await expect.element(alerts.first()).toHaveTextContent("Not sent: GitHub can't be reached.");
    await expect.element(alerts.last()).toHaveTextContent('Not sent: GitHub refused it: Commenting is disabled.');
    await expect.element(page.getByText('Not sent', { exact: true }).first()).toBeVisible();

    await userEvent.click(page.getByRole('button', { name: 'Retry' }).first());
    expect(onRetry).toHaveBeenCalledWith(1);
    await userEvent.click(page.getByRole('button', { name: 'Discard' }).last());
    expect(onDiscard).toHaveBeenCalledWith(2);
});

test('where the user may no longer comment, a comment not sent stays readable with Discard, without Retry', async () => {
    await NotSentReadOnly.run();

    await expect.element(page.getByText('The cross-repository case is fixed in 3f2a9b1')).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Discard' })).toBeVisible();
    expect(page.getByRole('button', { name: 'Retry' }).query()).toBeNull();
});

test("K1b: the user's own comment offers Edit and Delete…; one GitHub does not let them change, only Quote reply and Copy link", async () => {
    await IssueInPanel.run();

    await openMenu(MINE);
    const items = page.getByRole('menuitem');
    await expect.element(items.nth(0)).toHaveTextContent('Edit');
    expect(items.elements().map(item => item.textContent.trim())).toEqual([
        'Edit',
        'Quote reply',
        'Copy link',
        'Delete…',
    ]);
    await userEvent.keyboard('{Escape}');

    await openMenu(THEIRS);
    await expect.element(items.nth(0)).toHaveTextContent('Quote reply');
    expect(items.elements().map(item => item.textContent.trim())).toEqual(['Quote reply', 'Copy link']);
});

test('where the user may not comment, the menu offers no Quote reply: the quote would land in a draft no one sees', async () => {
    await IssueInPanel.run({ args: { ...IssueInPanel.args, canQuote: false } });

    await openMenu(MINE);
    const items = page.getByRole('menuitem');
    await expect.element(items.nth(0)).toHaveTextContent('Edit');
    expect(items.elements().map(item => item.textContent.trim())).toEqual(['Edit', 'Copy link', 'Delete…']);
});

test('the description has the same menu without Delete, from a right click too', async () => {
    await IssueInPanel.run();

    await userEvent.click(page.getByText('Recurring visits created before the DST change'), { button: 'right' });

    const items = page.getByRole('menuitem');
    await expect.element(items.nth(0)).toHaveTextContent('Edit');
    expect(items.elements().map(item => item.textContent.trim())).toEqual(['Edit', 'Quote reply', 'Copy link']);
});

test("Edit opens the comment's Markdown in place; Esc on it unchanged puts the card back at once, nothing sent", async () => {
    const onEdit = vi.fn();
    await IssueInPanel.run({ args: { ...IssueInPanel.args, onEdit } });

    await openMenu(MINE);
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const editor = page.getByRole('textbox', { name: 'Edit comment' });
    await expect.element(editor).toHaveFocus();
    await expect.element(editor).toHaveValue('Opened #1205 — converting at creation and migrating existing series.');

    await userEvent.keyboard('{Escape}');

    await expect.element(editor).not.toBeInTheDocument();
    await expect.element(card(MINE)).toHaveTextContent(/migrating existing series\.$/u);
    expect(onEdit).not.toHaveBeenCalled();
    // The keyboard goes on from the card, not from the page's start.
    await expect.element(card(MINE).getByRole('button', { name: 'Comment actions' })).toHaveFocus();
});

test('a changed edit asks before it is let go: Esc asks, Esc again keeps editing, Enter discards', async () => {
    const onEdit = vi.fn();
    await IssueInPanel.run({ args: { ...IssueInPanel.args, onEdit } });

    await openMenu(MINE);
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const editor = page.getByRole('textbox', { name: 'Edit comment' });
    await userEvent.type(editor, ' Typed away.');
    await userEvent.keyboard('{Escape}');

    const question = page.getByRole('status');
    await expect.element(question).toHaveTextContent('Discard your changes to this comment?');
    await expect.element(editor).toHaveFocus();
    expect(page.getByRole('button', { name: 'Update comment' }).query()).toBeNull();

    await userEvent.keyboard('{Escape}');
    await expect.element(question).not.toBeInTheDocument();
    await expect.element(editor).toHaveFocus();
    await expect
        .element(editor)
        .toHaveValue('Opened #1205 — converting at creation and migrating existing series. Typed away.');

    await userEvent.keyboard('{Escape}');
    await expect.element(question).toBeVisible();
    await userEvent.keyboard('{Enter}');

    await expect.element(editor).not.toBeInTheDocument();
    await expect.element(card(MINE)).toHaveTextContent(/migrating existing series\.$/u);
    await expect.element(card(MINE).getByRole('button', { name: 'Comment actions' })).toHaveFocus();
    expect(onEdit).not.toHaveBeenCalled();
});

test("Cancel on the description's changed edit asks too: Keep editing goes back to the text, Discard puts the card back", async () => {
    await IssueInPanel.run();

    await userEvent.click(page.getByText('Recurring visits created before the DST change'), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const editor = page.getByRole('textbox', { name: 'Edit description' });
    await userEvent.type(editor, ' More.');
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));

    await expect.element(page.getByRole('status')).toHaveTextContent('Discard your changes to the description?');
    await expect.element(editor).toHaveFocus();
    await userEvent.click(page.getByRole('button', { name: 'Keep editing' }));
    await expect.element(page.getByRole('status')).not.toBeInTheDocument();
    await expect.element(editor).toHaveFocus();

    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(page.getByRole('button', { name: 'Discard' }));
    await expect.element(editor).not.toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Description actions' })).toHaveFocus();
});

test("the description's Cancel gives the focus back to its ⋯ too", async () => {
    await IssueInPanel.run();

    await userEvent.click(page.getByText('Recurring visits created before the DST change'), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));

    await expect.element(page.getByRole('button', { name: 'Description actions' })).toHaveFocus();
});

test('⌘↵ saves the edit through the edit path and closes the editor', async () => {
    const onEdit = vi.fn();
    await IssueInPanel.run({ args: { ...IssueInPanel.args, onEdit } });

    await openMenu(MINE);
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const editor = page.getByRole('textbox', { name: 'Edit comment' });
    await userEvent.clear(editor);
    await userEvent.type(editor, 'Opened a pull request.');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(onEdit).toHaveBeenCalledWith({ kind: 'editComment', commentId: 'C_2', body: 'Opened a pull request.' });
    await expect.element(editor).not.toBeInTheDocument();
});

test("Cancel in the delete confirmation gives the focus back to the comment's ⋯, the comment kept", async () => {
    const onEdit = vi.fn();
    await IssueInPanel.run({ args: { ...IssueInPanel.args, onEdit } });

    // From a right click too, where the menu has no ⋯ of its own to give the focus back to.
    await userEvent.click(card(MINE).getByText('Opened #1205'), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Delete…' }));
    const dialog = page.getByRole('dialog', { name: 'Delete this comment?' });
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(card(MINE).getByRole('button', { name: 'Comment actions' })).toHaveFocus();
    expect(onEdit).not.toHaveBeenCalled();
});

test('Delete… asks once; only the confirmation deletes', async () => {
    const onEdit = vi.fn();
    await IssueInPanel.run({ args: { ...IssueInPanel.args, onEdit } });

    await openMenu(MINE);
    await userEvent.click(page.getByRole('menuitem', { name: 'Delete…' }));
    const dialog = page.getByRole('dialog', { name: 'Delete this comment?' });
    await expect.element(dialog).toBeVisible();
    expect(onEdit).not.toHaveBeenCalled();

    await userEvent.click(dialog.getByRole('button', { name: 'Delete comment' }));
    expect(onEdit).toHaveBeenCalledWith({ kind: 'deleteComment', commentId: 'C_2' });
    await expect.element(dialog).not.toBeInTheDocument();
});

test('an edit GitHub did not take is open again with the text and why; Cancel asks, Discard drops it', async () => {
    const onDiscardEdit = vi.fn();
    await EditRefused.run({ args: { ...EditRefused.args, onDiscardEdit } });

    const editor = page.getByRole('textbox', { name: 'Edit comment' });
    await expect
        .element(editor)
        .toHaveValue('Opened #1205 — converting at creation. Migrating existing series in a follow-up.');
    await expect.element(page.getByRole('alert')).toHaveTextContent('Not sent: GitHub refused it: Body is too long.');

    // Not taken, it counts as changed: Cancel asks first.
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));
    expect(onDiscardEdit).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole('button', { name: 'Discard' }));
    expect(onDiscardEdit).toHaveBeenCalledWith('C_2');
});

test("an editor open on one item is not on the next: Update could otherwise save one item's text into another", async () => {
    const onEdit = vi.fn();
    const failedEdits = EditRefused.args.failedEdits ?? [];
    const args = shallowReactive({ ...IssueInPanel.args, failedEdits, onEdit });
    await IssueInPanel.run({ args });
    await userEvent.click(page.getByText('Recurring visits created before the DST change'), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    await expect.element(page.getByRole('textbox', { name: 'Edit description' })).toBeVisible();

    Object.assign(args, { item: F1_PULL_REQUEST, detail: F1_PULL_REQUEST_DETAIL, failedEdits: [] });
    await expect.element(page.getByText('Good catch, adding a cross-repo fixture')).toBeInTheDocument();
    expect(page.getByRole('textbox', { name: /^Edit / }).query()).toBeNull();

    // Back on the first item, only the edit GitHub did not take opens again; the description's editor was let go.
    Object.assign(args, { item: D1_ISSUE, detail: D1_ISSUE_DETAIL, failedEdits });
    await expect.element(page.getByRole('textbox', { name: 'Edit comment' })).toBeVisible();
    expect(page.getByRole('textbox', { name: 'Edit description' }).query()).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
});

test('Edit from a right click leaves the focus in the editor it opened, not where it was: what is typed lands there', async () => {
    const mine = D1_ISSUE_DETAIL.comments.nodes[1]!;
    const older: ItemComment = {
        ...mine,
        id: 'C_OLDER',
        body: 'An older one of mine.',
        bodyHtml: '<p>An older one of mine.</p>',
        createdAt: new Date(Date.parse(D1_ISSUE_DETAIL.comments.nodes[0]!.createdAt) - 60 * 60_000).toISOString(),
    };
    const loadMiddle = vi.fn(() => {
        const { comments } = D1_ISSUE_DETAIL;
        args.detail = {
            ...D1_ISSUE_DETAIL,
            comments: { totalCount: 3, first: [], nodes: [older, ...comments.nodes], olderCursor: null },
        };
        return Promise.resolve();
    });
    const args = shallowReactive({ ...IssueInPanel.args, detail: D1_ISSUE_DETAIL, loadMiddle });
    await IssueInPanel.run({ args });
    // The comment the fold revealed has the focus, which the closing menu would give back.
    await userEvent.click(page.getByRole('button', { name: /^Show 2 earlier events/ }));
    await expect.element(card('An older one of mine.')).toHaveFocus();

    await userEvent.click(card('An older one of mine.').getByText('An older one'), { button: 'right' });
    await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
    const editor = page.getByRole('textbox', { name: 'Edit comment' });
    await expect.element(editor).toHaveFocus();
    // The menu gives the focus back a tick after it closed.
    await new Promise(resolve => {
        setTimeout(resolve, 50);
    });
    await userEvent.keyboard(' Typed away.');

    await expect.element(editor).toHaveValue('An older one of mine. Typed away.');
});

test("events and comments read show in one time order; the user's comment on its way and one not sent come after them", async () => {
    await SendingAmongEvents.run();

    const entries = page.getByRole('list').first().getByRole('listitem').elements();
    const texts = entries
        .filter(entry => entry.parentElement === entries[0]?.parentElement)
        .map(entry => entry.textContent.replace(/\s+/gu, ' '));
    const order = [
        'added bug and set the type to Bug',
        'Same here: the link to #9 is gone',
        'linked a pull request #15',
        'Fixed by #15 once it lands',
        'Status set to Done in',
        'pinned this issue',
        'Pinned it until #15 lands.',
        'Thanks both.',
    ].map(text => texts.findIndex(entry => entry.includes(text)));
    expect(order).toEqual(order.toSorted((a, b) => a - b));
    expect(order).not.toContain(-1);
});
