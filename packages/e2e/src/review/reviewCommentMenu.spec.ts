import type { Locator, Page } from '@playwright/test';

import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { expect, test } from '../fixtures.js';
import { GitHubPartialAnswer } from '../github/GitHubMock.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { answerReview, toReviewCommentNode } from './answerReview.js';
import type { SampleReviewThread } from './answerReview.js';

// The ⋯ menu of a review comment (F15) — Edit in place, Quote reply, Copy link, Delete, each where GitHub allows — in
// code review's diff and in a pull request's code threads.

const ADDRESS = '/acme/web/pull/3/files';
const ENGINE = 'src/engine.ts';
const LINES = Array.from({ length: 40 }, (_, index) => `const unchanged${index + 1} = ${index + 1};`);
const CHANGED_LINE = 'const changed20 = 20;';
const ENGINE_FILE = {
    path: ENGINE,
    before: `${LINES.join('\n')}\n`,
    after: `${LINES.map((line, index) => {
        if (index === 19) {
            return CHANGED_LINE;
        }

        return index === 20 ? 'const changed21 = 21;' : line;
    }).join('\n')}\n`,
};
const VIEWER = SAMPLE_VIEWER.viewer.login;
const QUESTION = 'Why poll twice?';
const OWN = 'Once is enough here.';
const ALONE = 'Only comment of its thread.';

/** Two threads: sofiab's question with the viewer's answer under it, and one holding only a comment of the viewer's. */
const THREADS: readonly SampleReviewThread[] = [
    {
        id: 'T_poll',
        path: ENGINE,
        line: 20,
        comments: [
            { id: 'C_question', bodyHTML: `<p>Why poll <strong>twice</strong>?</p>`, body: 'Why poll **twice**?' },
            { id: 'C_own', bodyHTML: `<p>${OWN}</p>`, body: `_${OWN}_`, author: VIEWER, editable: true },
        ],
    },
    {
        id: 'T_alone',
        path: ENGINE,
        line: 21,
        author: VIEWER,
        comments: [{ id: 'C_alone', bodyHTML: `<p>${ALONE}</p>`, editable: true }],
    },
];

test("in code review, a comment's ⋯ lists Edit, Quote reply, Copy link and Delete on the viewer's own and no Edit or Delete on someone else's; a right click opens the same menu", async ({
    page,
    github,
}) => {
    const { review } = await openReview(page, github, { threads: THREADS });
    const menu = page.getByRole('menu', { name: 'Comment actions' });

    const question = review.comment(QUESTION);
    await question.hover();
    await question.getByRole('button', { name: 'Comment actions' }).click();
    // Hovered, it is the comment under the cursor: its menu shows the keys that act on it.
    await expect(menu.getByRole('menuitem')).toHaveText(['Quote replyQ', 'Copy link']);
    await expect(menu.getByRole('menuitem', { name: 'Quote reply' })).toHaveAttribute('aria-keyshortcuts', 'Q');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // On its meta line: GitHub's rendering keeps the browser's own menu.
    await review.comment(OWN).click({ button: 'right', position: { x: 4, y: 4 } });
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText([
        'EditW',
        'Quote replyQ',
        'Copy link',
        'Delete',
    ]);
});

test("in code review, Edit opens the comment's Markdown in place; Update shows the new text at once and sends it, and GitHub's rendering follows", async ({
    page,
    github,
}) => {
    const { review, writes, holdWrites } = await openReview(page, github, { threads: THREADS });
    await pickAction(page, review.comment(OWN), 'Edit');
    const editor = review.thread(QUESTION).getByRole('textbox', { name: 'Edit comment' });
    await expect(editor).toHaveValue(`_${OWN}_`);
    await expect(editor).toBeFocused();

    const release = holdWrites();
    await editor.fill('Once is **plenty**.');
    await review.thread(QUESTION).getByRole('button', { name: 'Update comment' }).click();

    await expect(editor).toBeHidden();
    await expect(review.thread(QUESTION)).toContainText('Once is **plenty**.');
    await expect(review.thread(QUESTION)).toContainText('Sending…');
    release();
    await expect(review.thread(QUESTION).locator('strong', { hasText: 'plenty' })).toBeVisible();
    await expect(review.thread(QUESTION)).toContainText('· edited');
    expect(writes).toEqual([
        { name: 'UpdatePullRequestReviewComment', variables: { id: 'C_own', body: 'Once is **plenty**.' } },
    ]);
});

test('in code review, an edit GitHub refuses brings the editor back with the text and why', async ({
    page,
    github,
}) => {
    const { review, writes, refused } = await openReview(page, github, { threads: THREADS });
    refused.set('UpdatePullRequestReviewComment', 'Body is too long (maximum is 65536 characters)');
    await pickAction(page, review.comment(OWN), 'Edit');
    const editor = review.thread(QUESTION).getByRole('textbox', { name: 'Edit comment' });
    await editor.fill('Twice, then.');
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(review.thread(QUESTION).getByRole('alert')).toContainText(
        'Body is too long (maximum is 65536 characters)',
    );
    await expect(editor).toHaveValue('Twice, then.');
    await expect(review.thread(QUESTION)).not.toContainText(OWN);
    expect(writes.map(write => write.name)).toEqual(['UpdatePullRequestReviewComment']);
});

test("in code review, Delete asks first; confirmed, the comment goes at once and on GitHub, and a thread's only comment takes the thread with it", async ({
    page,
    github,
}) => {
    const { review, writes } = await openReview(page, github, { threads: THREADS });
    const dialog = page.getByRole('dialog', { name: 'Delete this comment?' });

    await pickAction(page, review.comment(OWN), 'Delete');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(review.thread(OWN)).toBeVisible();
    expect(writes).toEqual([]);

    await pickAction(page, review.comment(OWN), 'Delete');
    await dialog.getByRole('button', { name: 'Delete comment' }).click();
    await expect(review.thread(OWN)).toBeHidden();
    await expect(review.thread(QUESTION)).toBeVisible();

    await pickAction(page, review.comment(ALONE), 'Delete');
    await dialog.getByRole('button', { name: 'Delete comment' }).click();
    await expect(review.thread(ALONE)).toHaveCount(0);
    await expect
        .poll(() => writes)
        .toEqual([
            { name: 'DeletePullRequestReviewComment', variables: { id: 'C_own' } },
            { name: 'DeletePullRequestReviewComment', variables: { id: 'C_alone' } },
        ]);
    // Read again, GitHub has neither: they stay gone.
    await page.reload();
    await expect(review.thread(QUESTION)).toBeVisible();
    await expect(review.thread(OWN)).toHaveCount(0);
    await expect(review.thread(ALONE)).toHaveCount(0);
});

test('in code review, a delete GitHub refuses brings the comment back, its thread saying why', async ({
    page,
    github,
}) => {
    const { review, writes, refused } = await openReview(page, github, { threads: THREADS });
    refused.set('DeletePullRequestReviewComment', 'Resource not accessible by integration');

    await pickAction(page, review.comment(ALONE), 'Delete');
    await page
        .getByRole('dialog', { name: 'Delete this comment?' })
        .getByRole('button', { name: 'Delete comment' })
        .click();

    await expect(review.thread(ALONE)).toContainText(
        "Couldn't delete the comment: Resource not accessible by integration",
    );
    await expect(review.comment(ALONE)).toBeVisible();
    expect(writes.map(write => write.name)).toEqual(['DeletePullRequestReviewComment']);
});

test("in code review, deleting the draft's last pending comment discards the emptied draft with it", async ({
    page,
    github,
}) => {
    const { review, writes } = await openReview(page, github, { threads: [DRAFT_THREAD], draft: 1 });
    await expect(review.pendingToolbar).toContainText('1 pending comment');

    await pickAction(page, review.comment(DRAFTED), 'Delete');
    await page
        .getByRole('dialog', { name: 'Delete this comment?' })
        .getByRole('button', { name: 'Delete comment' })
        .click();

    await expect(review.thread(DRAFTED)).toHaveCount(0);
    await expect(review.pendingToolbar).toBeHidden();
    await expect
        .poll(() => writes.map(write => write.name))
        .toEqual(['DeletePullRequestReviewComment', 'DeletePullRequestReview']);
});

test('in code review, a draft GitHub still holds comments in after the deletion stays: its count is read again first', async ({
    page,
    github,
}) => {
    const { review, writes, setDraft } = await openReview(page, github, { threads: [DRAFT_THREAD], draft: 1 });
    await expect(review.pendingToolbar).toContainText('1 pending comment');
    // Two more written in the draft elsewhere, which this page has not read.
    setDraft(3);

    await pickAction(page, review.comment(DRAFTED), 'Delete');
    await page
        .getByRole('dialog', { name: 'Delete this comment?' })
        .getByRole('button', { name: 'Delete comment' })
        .click();

    await expect(review.pendingToolbar).toContainText('2 pending comments');
    expect(writes.map(write => write.name)).toEqual(['DeletePullRequestReviewComment']);
});

test("in code review, Quote reply opens the thread's reply box with the comment quoted as Markdown, and Copy link puts its address on the clipboard", async ({
    page,
    github,
    context,
}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const { review } = await openReview(page, github, { threads: THREADS });

    await pickAction(page, review.comment(QUESTION), 'Quote reply');
    const field = review.commentField('Reply to sofiab');
    await expect(field).toHaveValue('> Why poll **twice**?\n\n');
    await expect(field).toBeFocused();

    await pickAction(page, review.comment(QUESTION), 'Copy link');
    await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toBe('https://github.com/acme/web/pull/15#discussion_C_question');
});

test("on a pull request's thread, a code thread's comment opens the same menu by . under the reading cursor, by hover and by right click; Quote reply, Edit and Delete do there what they do in code review", async ({
    page,
    github,
}) => {
    const { item, thread, writes } = await openItemThread(page, github);
    const menu = page.getByRole('menu', { name: 'Comment actions' });

    // Someone else's, under the reading cursor: no Edit or Delete.
    await thread.getByText(QUESTION).click();
    await expect(item.readingCursor).toHaveAttribute('data-reading-stop', 'C_question');
    await page.keyboard.press('.');
    // Its entries show the keys acting on the comment under the cursor.
    await expect(menu.getByRole('menuitem')).toHaveText([/^Quote reply/u, /^Copy link/u]);
    await menu.getByRole('menuitem', { name: 'Quote reply' }).click();
    const reply = thread.getByRole('textbox', { name: 'Reply' });
    await expect(reply).toHaveValue('> Why poll **twice**?\n\n');
    await expect(reply).toBeFocused();

    // The viewer's own, from its ⋯ on hover.
    const own = item.codeComment(OWN);
    await own.hover();
    await own.getByRole('button', { name: 'Comment actions' }).click();
    await expect(menu.getByRole('menuitem')).toHaveText([/^Edit/u, /^Quote reply/u, /^Copy link/u, /^Delete/u]);
    await menu.getByRole('menuitem', { name: 'Edit' }).click();
    const editor = thread.getByRole('textbox', { name: 'Edit comment' });
    await expect(editor).toHaveValue(`_${OWN}_`);
    await editor.fill('Once is **plenty**.');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(thread.locator('strong', { hasText: 'plenty' })).toBeVisible();

    // By right click on its meta line.
    await item.codeComment('Once is plenty.').click({ button: 'right', position: { x: 4, y: 4 } });
    await page.getByRole('menu').getByRole('menuitem', { name: 'Delete' }).click();
    await page
        .getByRole('dialog', { name: 'Delete this comment?' })
        .getByRole('button', { name: 'Delete comment' })
        .click();
    await expect(thread).not.toContainText('Once is plenty.');
    await expect(thread).toContainText(QUESTION);
    await expect
        .poll(() => writes)
        .toEqual([
            { name: 'UpdatePullRequestReviewComment', variables: { id: 'C_own', body: 'Once is **plenty**.' } },
            { name: 'DeletePullRequestReviewComment', variables: { id: 'C_own' } },
        ]);
});

const DRAFTED = 'Not sent yet.';
/** A thread of the viewer's draft review, holding its one comment. */
const DRAFT_THREAD: SampleReviewThread = {
    id: 'T_draft',
    path: ENGINE,
    line: 20,
    author: VIEWER,
    pending: true,
    comments: [{ id: 'C_drafted', bodyHTML: `<p>${DRAFTED}</p>`, editable: true }],
};

/** What {@link openReview} opens code review on. */
interface OpenReviewOptions {
    readonly threads: readonly SampleReviewThread[];
    /** How many comments the viewer's draft review holds; none by default. */
    readonly draft?: number;
}

/** Code review of acme/web#3, the viewer's, on a GitHub that edits and deletes its review comments as the real one does. */
async function openReview(page: Page, github: GitHubMock, options: OpenReviewOptions) {
    const world = new GitHubWorld(VIEWER);
    const id = world.pullRequest({
        repository: 'acme/web',
        number: 3,
        title: 'Retry polls',
        foundBy: ['authored'],
        minutesAgo: 5,
    });
    let draft = options.draft ?? null;
    world.setPendingReview(id, draft === null ? null : { comments: draft, minutesAgo: 60 });
    await openMyWork(page, github, world);
    const threads = [...options.threads];
    answerReview(github, { repository: 'acme/web', number: 3, id, files: [ENGINE_FILE], threads });
    /** The draft as GitHub holds it now, which the page reads only when it reads again. */
    const setDraft = (comments: number | null) => {
        draft = comments;
        world.setPendingReview(id, comments === null ? null : { comments, minutesAgo: 1 });
    };
    const answered = answerCommentWrites(github, threads, () => setDraft(Math.max(0, (draft ?? 0) - 1)));
    github.graphqlDocument('DeletePullRequestReview', ({ variables }) => {
        answered.writes.push({ name: 'DeletePullRequestReview', variables });
        setDraft(null);
        return { data: { deletePullRequestReview: { pullRequestReview: { id: 'R' } } } };
    });

    await page.goto(ADDRESS);
    const review = new ReviewScreenHarness(page);
    await expect(review.code(CHANGED_LINE)).toBeVisible();
    return { review, setDraft, ...answered };
}

/**
 * The sample pull request acme/web#15 opened full screen, hubot's review on it holding {@link THREADS}' first thread, on a
 * GitHub that edits and deletes its review comments as the real one does.
 */
async function openItemThread(page: Page, github: GitHubMock) {
    const sample = createSampleEditableWork();
    sample.world.review(sample.pullRequest, {
        id: 'R_hubot',
        author: 'hubot',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>One thing before it goes in.</p>',
        minutesAgo: 30,
    });
    const { myWork } = await openMyWork(page, github, sample.world);
    const [first] = THREADS;
    const threads = first ? [{ ...first, reviewId: 'R_hubot' }] : [];
    answerReview(github, { repository: 'acme/web', number: 15, id: sample.pullRequest, files: [], threads });
    const { writes } = answerCommentWrites(github, threads, () => {});

    const item = new ItemViewHarness(page);
    await myWork.row('Redirect once after sign-in').click();
    await page.keyboard.press('Shift+Enter');
    await expect(item.backToPanelButton).toBeVisible();
    const thread = item.root.getByRole('group', { name: `Thread by sofiab on ${ENGINE}` });
    await expect(thread).toContainText(OWN);
    return { item, thread, writes };
}

/** A write the app sent, as GitHub got it. */
interface Write {
    readonly name: string;
    readonly variables: Readonly<Record<string, unknown>>;
}

/**
 * Answers `UpdatePullRequestReviewComment` and `DeletePullRequestReviewComment` on `threads` as GitHub does, a thread
 * going with its last comment; `onPendingDeleted` runs when a draft's comment is deleted. `refused` names the mutations
 * GitHub refuses, with its words; `holdWrites` keeps their answers back until the function it returns is called.
 */
function answerCommentWrites(github: GitHubMock, threads: SampleReviewThread[], onPendingDeleted: () => void) {
    const writes: Write[] = [];
    const refused = new Map<string, string>();
    let held: Promise<void> | null = null;

    github.graphql('UpdatePullRequestReviewComment', async ({ variables }) => {
        writes.push({ name: 'UpdatePullRequestReviewComment', variables });
        await held;
        const message = refused.get('UpdatePullRequestReviewComment');
        if (message !== undefined) {
            return new GitHubPartialAnswer<'UpdatePullRequestReviewComment'>({ updatePullRequestReviewComment: null }, [
                { type: 'UNPROCESSABLE', message, path: ['updatePullRequestReviewComment'] },
            ]);
        }

        const { thread, index } = findComment(variables.id);
        const body = String(variables.body);
        const comments = [...thread.comments];
        const comment = comments[index];
        comments[index] = {
            ...(typeof comment === 'object' ? comment : { bodyHTML: '' }),
            body,
            bodyHTML: `<p>${body.replace(/\*\*(.+?)\*\*/gu, '<strong>$1</strong>')}</p>`,
            edited: true,
        };
        const edited = { ...thread, comments };
        threads.splice(threads.indexOf(thread), 1, edited);
        return {
            updatePullRequestReviewComment: { pullRequestReviewComment: toReviewCommentNode(edited, index) },
        };
    });
    github.graphql('DeletePullRequestReviewComment', async ({ variables }) => {
        writes.push({ name: 'DeletePullRequestReviewComment', variables });
        await held;
        const message = refused.get('DeletePullRequestReviewComment');
        if (message !== undefined) {
            return new GitHubPartialAnswer<'DeletePullRequestReviewComment'>({ deletePullRequestReviewComment: null }, [
                { type: 'FORBIDDEN', message, path: ['deletePullRequestReviewComment'] },
            ]);
        }

        const { thread, index } = findComment(variables.id);
        const comments = thread.comments.filter((_, at) => at !== index);
        threads.splice(threads.indexOf(thread), 1, ...(comments.length > 0 ? [{ ...thread, comments }] : []));
        if (thread.pending) {
            onPendingDeleted();
        }

        return { deletePullRequestReviewComment: { clientMutationId: null } };
    });

    return {
        writes,
        refused,
        holdWrites: () => {
            const { promise, resolve } = Promise.withResolvers<void>();
            held = promise;
            return () => {
                held = null;
                resolve();
            };
        },
    };

    function findComment(id: unknown) {
        for (const thread of threads) {
            const index = thread.comments.findIndex(comment => typeof comment === 'object' && comment.id === id);
            if (index !== -1) {
                return { thread, index };
            }
        }

        throw new Error(`No review comment ${String(id)}`);
    }
}

/** Picks `action` from the comment's ⋯, shown by hovering it as a user would. */
async function pickAction(page: Page, comment: Locator, action: string) {
    await comment.hover();
    await comment.getByRole('button', { name: 'Comment actions' }).click();
    await page.getByRole('menu', { name: 'Comment actions' }).getByRole('menuitem', { name: action }).click();
}
