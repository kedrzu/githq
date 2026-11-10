import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { shallowReactive } from 'vue';

import type { FailedTextEdit } from '@/edits/CommentDrafts.js';
import type { ItemComment } from '@/store/ItemDetailTypes.js';
import { FakeReviewWriting } from '@/testing/FakeReviewWriting.js';
import { D1_ISSUE, D1_ISSUE_DETAIL, F1_PULL_REQUEST, F1_PULL_REQUEST_DETAIL } from '@/testing/sampleItemDetails.js';
import { DB_THREAD } from '@/testing/sampleReviews.js';

import * as stories from './ItemThread.stories.js';

const {
    CodeThreads,
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

/**
 * Right-clicks the head of the comment that reads `text`, or of the description when not given. Not its text: in
 * GitHub's rendering a right click is the browser's own menu, or a githq link's (`GitHubLinks`).
 */
async function rightClickCard(text?: string) {
    const head = text === undefined ? page.getByText('Author', { exact: true }) : card(text).getByText(/^commented /);
    await userEvent.click(head, { button: 'right' });
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

test('a long thread read whole folds its middle by the counts of each group, and shows it on a click', async () => {
    await LongThread.run();

    const entries = page.getByRole('listitem');
    const fold = page.getByRole('button', { name: /^Show 23 earlier events/ });
    await expect.element(fold).toHaveTextContent(/15 comments\s*8 other events/);
    expect(fold.element().textContent).not.toMatch(/commit/);
    // The first two, the fold, the newest five.
    expect(entries.elements()).toHaveLength(8);
    await expect.element(entries.nth(1)).toHaveTextContent(/added this to parent/);
    await expect.element(entries.nth(3)).toHaveTextContent('Fixed by #15 once it lands');

    await userEvent.click(fold);

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

test('F16: opened the first time, the rail says what is being read, as the row counts it, with no description card', async () => {
    await Loading.run();

    await expect.element(page.getByRole('status')).toHaveTextContent('Loading 4 comments and the events from GitHub');
    await expect.element(page.getByRole('textbox', { name: 'Comment' })).toBeInTheDocument();
    expect(page.getByText('Author', { exact: true }).query()).toBeNull();
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

    await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent("The description, comments and events couldn't be loaded");
    expect(page.getByText('Author', { exact: true }).query()).toBeNull();
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

    await rightClickCard();

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

    await rightClickCard();
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

    await rightClickCard();
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
    await rightClickCard(MINE);
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
    await rightClickCard();
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

    await rightClickCard('An older one of mine.');
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

/** The open thread of sofiab's review, `src/store/db.ts`. */
function dbThread() {
    return page.getByRole('group', { name: 'Thread by sofiab on src/store/db.ts' });
}

/** The pull request with sofiab's review, written through a fresh writing. */
async function openCodeThreads(writing = new FakeReviewWriting()) {
    const args = shallowReactive({ ...CodeThreads.args, reviewWriting: writing });
    await CodeThreads.run({ args });
    return { args, writing };
}

test('Reply… opens the editor in the band, the cursor in it; Cancel on nothing typed closes it, the focus back on the thread', async () => {
    const { writing } = await openCodeThreads();

    await userEvent.click(dbThread().getByRole('button', { name: 'Reply…' }));
    const field = dbThread().getByRole('textbox', { name: 'Reply' });
    await expect.element(field).toHaveFocus();
    expect(writing.targets).toEqual([expect.objectContaining({ threadId: DB_THREAD.id, path: 'src/store/db.ts' })]);

    await userEvent.click(dbThread().getByRole('button', { name: 'Cancel' }));
    await expect.element(field).not.toBeInTheDocument();
    await expect.element(dbThread()).toHaveFocus();
    expect(writing.targets).toEqual([]);
});

test('a reply with text asks before it is let go: Esc asks, Esc keeps writing, Enter discards it', async () => {
    const { writing } = await openCodeThreads();
    await userEvent.click(dbThread().getByRole('button', { name: 'Reply…' }));
    await userEvent.keyboard('Not yet');

    await userEvent.keyboard('{Escape}');
    await expect.element(dbThread().getByRole('status')).toHaveTextContent('Discard your reply?');
    await userEvent.keyboard('{Escape}');
    await expect.element(dbThread().getByRole('status')).not.toBeInTheDocument();
    await expect.element(dbThread().getByRole('textbox', { name: 'Reply' })).toHaveValue('Not yet');

    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Enter}');
    await expect.element(dbThread().getByRole('textbox', { name: 'Reply' })).not.toBeInTheDocument();
    expect(writing.targets).toEqual([]);
    expect(writing.sent).toEqual([]);
});

test('⌘↵ sends the reply as code review would, which shows at once; one GitHub refused comes back with its text and why', async () => {
    const { writing } = await openCodeThreads();
    await userEvent.click(dbThread().getByRole('button', { name: 'Reply…' }));
    await userEvent.keyboard('Migrated, see e81f0a3.');
    await userEvent.keyboard('{ControlOrMeta>}{Enter}{/ControlOrMeta}');

    expect(writing.sent).toEqual([{ body: 'Migrated, see e81f0a3.', way: 'single', threadId: DB_THREAD.id }]);
    await expect.element(dbThread().getByText('Migrated, see e81f0a3.')).toBeVisible();
    await expect.element(dbThread().getByText('Sending…')).toBeVisible();
    await expect.element(dbThread().getByRole('button', { name: 'Reply…' })).toBeVisible();

    const [box] = writing.targets;
    writing.answer(box?.id ?? '', { kind: 'failed', failure: { kind: 'refused', message: 'The thread is locked' } });
    await expect.element(dbThread().getByRole('textbox', { name: 'Reply' })).toHaveValue('Migrated, see e81f0a3.');
    await expect.element(dbThread().getByRole('alert')).toHaveTextContent('The thread is locked');
});

test('with the viewer’s draft open a reply joins it: its button says so', async () => {
    const { writing } = await openCodeThreads(new FakeReviewWriting({ draftOpen: true }));
    await userEvent.click(dbThread().getByRole('button', { name: 'Reply…' }));
    await userEvent.keyboard('In the draft');
    await userEvent.click(dbThread().getByRole('button', { name: 'Add to draft' }));

    expect(writing.sent).toEqual([{ body: 'In the draft', way: 'joinDraft', threadId: DB_THREAD.id }]);
});

test('Resolve thread goes through the writing, and the thread says the viewer resolved it at once', async () => {
    const { args, writing } = await openCodeThreads();
    await userEvent.click(dbThread().getByRole('button', { name: 'Resolve thread' }));
    expect(writing.resolved).toEqual([{ threadId: DB_THREAD.id, resolved: true }]);

    // As the writing draws it: resolved at once, GitHub not yet saying who did.
    args.reviewThreads = (args.reviewThreads ?? []).map(thread =>
        thread.id === DB_THREAD.id ? { ...thread, isResolved: true } : thread,
    );
    await userEvent.click(page.getByRole('button', { name: /^Resolved src\/store\/db\.ts/u }));
    await expect.element(dbThread()).toHaveTextContent('mlaine marked this thread as resolved.');
});

test('on a focused code thread J and K move between the code threads and R opens its reply editor', async () => {
    await openCodeThreads();
    // dkim's code comment, resolved: opened, a code thread too.
    await userEvent.click(page.getByRole('button', { name: /^Resolved/u }));
    const schema = page.getByRole('group', { name: 'Thread by dkim on src/store/schema.ts' });
    await userEvent.click(dbThread().getByText('That’s what the e2e trips on.', { exact: false }));
    await expect.element(dbThread()).toHaveFocus();

    await userEvent.keyboard('j');
    await expect.element(schema).toHaveFocus();
    await userEvent.keyboard('j');
    await expect.element(schema).toHaveFocus();
    await userEvent.keyboard('k');
    await expect.element(dbThread()).toHaveFocus();

    await userEvent.keyboard('r');
    await expect.element(dbThread().getByRole('textbox', { name: 'Reply' })).toHaveFocus();
});
