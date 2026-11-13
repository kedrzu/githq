import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { SavingScreenHarness } from '../harnesses/SavingScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { answerSettingsRepository } from '../settings/answerSettingsRepository.js';

import { answerReview } from './answerReview.js';
import type { AnsweredReview, SampleReviewFile, SampleReviewThread } from './answerReview.js';

const ADDRESS = '/acme/web/pull/3/files';
const ENGINE = 'src/engine.ts';
const LINES = Array.from({ length: 300 }, (_, index) => `const unchanged${index + 1} = ${index + 1};`);
const BEFORE = `${LINES.join('\n')}\n`;
const AFTER = `${LINES.map((line, index) => {
    if (index === 19) {
        return 'const changed20 = 20;';
    }

    return index === 20 ? '    const indented21 = 21;' : line;
}).join('\n')}\n`;
const CHANGED_LINE = 'const changed20 = 20;';
const DRAFT_TAKEN = 'User can only have one pending review per pull request';
const FIRST_KEY = 'ControlOrMeta+Enter';
const SECOND_KEY = 'ControlOrMeta+Shift+Enter';
const NEW_HEAD = 'head0001';
/** After the engine: room to scroll a box out of the list. */
const OTHER: SampleReviewFile = {
    path: 'src/other.ts',
    before: BEFORE,
    after: LINES.map((line, index) => `${line}${index < 100 ? '' : ' // changed'}\n`).join(''),
};

/** A review of one pull request on a GitHub that takes and refuses writes as the real one does. */
async function openWriting(
    page: Page,
    github: GitHubMock,
    options: {
        readonly draft?: number;
        readonly threads?: readonly SampleReviewThread[];
        /** In place of the engine and the file after it; the engine's changed line is still waited for. */
        readonly files?: readonly SampleReviewFile[];
    } = {},
) {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
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

    const threads: SampleReviewThread[] = [...(options.threads ?? [])];
    const answered = answerReview(github, {
        repository: 'acme/web',
        number: 3,
        id,
        files: options.files ?? [{ path: ENGINE, before: BEFORE, after: AFTER }, OTHER],
        threads,
    });

    const writes: { readonly name: string; readonly variables: Readonly<Record<string, unknown>> }[] = [];
    const refused = new Map<string, string>();
    const setDraft = (comments: number | null) => {
        draft = comments;
        world.setPendingReview(id, comments === null ? null : { comments, minutesAgo: 1 });
    };
    const addThread = (body: unknown, line: unknown, pending: boolean) => {
        threads.push({
            id: `T${threads.length}`,
            path: ENGINE,
            line: typeof line === 'number' ? line : 1,
            comments: [`<p>${String(body)}</p>`],
            pending,
        });
    };
    const refusal = (message: string) => ({ data: null, errors: [{ type: 'UNPROCESSABLE', message, path: [] }] });

    github.graphqlDocument('AddPullRequestReview', ({ variables }) => {
        writes.push({ name: 'AddPullRequestReview', variables });
        const message = refused.get('AddPullRequestReview') ?? (draft === null ? null : DRAFT_TAKEN);
        if (message !== null) {
            return refusal(message);
        }

        const { thread, event } = variables as { thread: { body: string; line: number }; event?: string };
        addThread(thread.body, thread.line, event === undefined);
        if (event === undefined) {
            setDraft(1);
        }

        return {
            data: {
                addPullRequestReview: {
                    pullRequestReview: {
                        id: 'DRAFT',
                        createdAt: '2026-01-01T00:00:00Z',
                        comments: { totalCount: 1 },
                    },
                },
            },
        };
    });
    github.graphqlDocument('SendPullRequestReview', ({ variables }) => {
        writes.push({ name: 'SendPullRequestReview', variables });
        const message = refused.get('SendPullRequestReview') ?? (draft === null ? null : DRAFT_TAKEN);
        return message === null
            ? { data: { addPullRequestReview: { pullRequestReview: { id: 'R' } } } }
            : refusal(message);
    });
    github.graphqlDocument('AddPullRequestReviewThread', ({ variables }) => {
        writes.push({ name: 'AddPullRequestReviewThread', variables });
        addThread(variables.body, variables.line, true);
        setDraft((draft ?? 0) + 1);
        return { data: { addPullRequestReviewThread: { thread: { id: 'T' } } } };
    });
    github.graphqlDocument('SubmitPullRequestReview', ({ variables }) => {
        writes.push({ name: 'SubmitPullRequestReview', variables });
        const message = refused.get('SubmitPullRequestReview');
        if (message !== undefined) {
            return refusal(message);
        }

        setDraft(null);
        threads.splice(0, threads.length, ...threads.map(thread => ({ ...thread, pending: false })));
        return { data: { submitPullRequestReview: { pullRequestReview: { id: 'R' } } } };
    });
    github.graphqlDocument('DeletePullRequestReview', ({ variables }) => {
        writes.push({ name: 'DeletePullRequestReview', variables });
        setDraft(null);
        threads.splice(0, threads.length, ...threads.filter(thread => !thread.pending));
        return { data: { deletePullRequestReview: { pullRequestReview: { id: 'R' } } } };
    });

    github.graphqlDocument('AddPullRequestReviewThreadReply', ({ variables }) => {
        writes.push({ name: 'AddPullRequestReviewThreadReply', variables });
        const message = refused.get('AddPullRequestReviewThreadReply');
        if (message !== undefined) {
            return refusal(message);
        }

        const joins = draft !== null;
        const at = threads.findIndex(thread => thread.id === variables.pullRequestReviewThreadId);
        const thread = threads[at];
        if (thread) {
            threads[at] = {
                ...thread,
                comments: [...thread.comments, `<p>${String(variables.body)}</p>`],
                pending: joins || thread.pending,
            };
        }

        if (joins) {
            setDraft((draft ?? 0) + 1);
        }

        return {
            data: {
                addPullRequestReviewThreadReply: {
                    comment: {
                        pullRequestReview: { id: 'DRAFT', state: joins ? 'PENDING' : 'SUBMITTED' },
                    },
                },
            },
        };
    });
    github.graphqlDocument('StartPullRequestReview', ({ variables }) => {
        writes.push({ name: 'StartPullRequestReview', variables });
        setDraft(0);
        return {
            data: {
                addPullRequestReview: {
                    pullRequestReview: { id: 'DRAFT', createdAt: '2026-01-01T00:00:00Z' },
                },
            },
        };
    });
    const answerResolve = (name: string, field: string, isResolved: boolean) =>
        github.graphqlDocument(name, ({ variables }) => {
            writes.push({ name, variables });
            const message = refused.get(name);
            if (message !== undefined) {
                return refusal(message);
            }

            const at = threads.findIndex(thread => thread.id === variables.threadId);
            const thread = threads[at];
            if (thread) {
                threads[at] = { ...thread, isResolved };
            }

            return { data: { [field]: { thread: { id: variables.threadId } } } };
        });
    answerResolve('ResolveReviewThread', 'resolveReviewThread', true);
    answerResolve('UnresolveReviewThread', 'unresolveReviewThread', false);

    await page.goto(ADDRESS);
    const review = new ReviewScreenHarness(page);
    await expect(review.code(CHANGED_LINE)).toBeVisible();
    // Tokens split a line into spans, each rounded on its own, so its width can change by 1/64 px when they arrive.
    await expect(review.codeToken(CHANGED_LINE).first()).toBeVisible();
    return { review, writes, threads, refused, setDraft, world, id, answered };
}

test('a single comment is one request, shows at once, and what is read keeps its place; keys typed stay in the box', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github);
    const reading = review.code(CHANGED_LINE);
    const before = await reading.boundingBox();

    await review.lineNumber(20).click();
    const field = review.commentField('Comment on line 20');
    await expect(field).toBeFocused();
    expect(await reading.boundingBox()).toEqual(before);

    await field.pressSequentially('jnvC Why this?');
    await expect(field).toHaveValue('jnvC Why this?');
    // Growing with its text, it moves nothing above it.
    await field.pressSequentially('\n\n\n\n');
    expect(await reading.boundingBox()).toEqual(before);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('jnvC Why this?');
    await expect(review.commentBox().getByRole('button', { name: 'Comment' })).toBeVisible();
    await expect(review.commentBox().getByRole('button', { name: 'Start a review' })).toBeVisible();

    await page.keyboard.press(FIRST_KEY);

    await expect(review.thread('jnvC Why this?')).toBeVisible();
    await expect(review.commentBox()).toBeHidden();
    expect(writes.map(write => write.name)).toEqual(['AddPullRequestReview']);
    expect(writes[0]?.variables).toMatchObject({
        commitOID: 'head0000',
        event: 'COMMENT',
        thread: { path: ENGINE, line: 20, side: 'RIGHT', body: 'jnvC Why this?' },
    });
    await expect(review.pendingToolbar).toBeHidden();
    expect(await reading.boundingBox()).toEqual(before);
});

test("C opens the box on the cursor's line, and on a header does nothing; empty, Escape closes it and the keys are the diff again, the cursor on its line (D44)", async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github);
    await review.fileRow('engine.ts').click();
    await expect(review.cursorRow.getByRole('heading', { name: ENGINE, exact: true })).toBeVisible();
    await page.keyboard.press('c');
    await expect(review.commentBox()).toHaveCount(0);

    await review.pointAt(review.code(CHANGED_LINE));
    const line = await review.cursorKey();
    await page.keyboard.press('c');
    const box = review.commentBox('Comment on line 20');
    await expect(box).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
    await expect(review.diff).toBeFocused();
    await expect(review.discardedToast).toBeHidden();
    expect(await review.cursorKey()).toBe(line);
});

test('Escape on a box with text asks in place: typing goes back to writing, Escape keeps writing, Enter discards', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github);
    await review.lineNumber(20).click();
    const field = review.commentField('Comment on line 20');
    await page.keyboard.type('Hold on');
    const question = review.commentBox().getByText('Discard what you wrote?');

    await page.keyboard.press('Escape');
    await expect(question).toBeVisible();
    await expect(field).toBeFocused();
    await page.keyboard.type('!');
    await expect(question).toBeHidden();
    await expect(field).toHaveValue('Hold on!');

    await page.keyboard.press('Escape');
    await expect(question).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(question).toBeHidden();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('Hold on!');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(review.commentBox()).toBeHidden();
    await expect(review.diff).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`${ADDRESS}$`, 'u'));
});

test('a discarded comment comes back from its toast, with Restore or ⌘Z outside a field, under its line with its text', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github, { draft: 2 });
    const reading = review.code(CHANGED_LINE);
    await review.lineNumber(20).click();
    await page.keyboard.type('Not sure yet');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');

    const toast = review.discardedToast;
    await expect(toast).toContainText('Comment on line 20 discarded');
    await expect(toast).toContainText('“Not sure yet”');
    await expect(toast.getByRole('button', { name: 'Dismiss', exact: true }).first()).not.toHaveAttribute(
        'aria-keyshortcuts',
    );
    // Above the pending review's toolbar, never over it.
    const toastBox = await toast.boundingBox();
    const toolbarBox = await review.pendingToolbar.boundingBox();
    expect(toastBox && toolbarBox && toastBox.y + toastBox.height <= toolbarBox.y).toBe(true);

    const before = await reading.boundingBox();
    await toast.getByRole('button', { name: /^Restore/ }).click();
    const field = review.commentField('Comment on line 20');
    await expect(field).toHaveValue('Not sure yet');
    await expect(field).toBeFocused();
    await expect(toast).toBeHidden();
    expect(await reading.boundingBox()).toEqual(before);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(toast).toBeVisible();
    await expect(review.diff).toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(field).toHaveValue('Not sure yet');
    await expect(field).toBeFocused();
    await expect(toast).toBeHidden();
});

test('restored where a box was opened since, the comment goes into that box after its text, one box on the line', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github);
    await review.lineNumber(20).click();
    await page.keyboard.type('Not sure yet');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(review.discardedToast).toBeVisible();
    await review.lineNumber(20).click();
    await page.keyboard.type('Second go');

    await review.discardedToast.getByRole('button', { name: /^Restore/ }).click();

    await expect(review.commentBox('Comment on line 20')).toHaveCount(1);
    const field = review.commentField('Comment on line 20');
    await expect(field).toHaveValue('Second go\n\nNot sure yet');
    await expect(field).toBeFocused();
});

test('⌘Z in a text field is the field’s: the discarded comment stays in its toast', async ({ page, github }) => {
    const { review } = await openWriting(page, github);
    await review.lineNumber(20).click();
    await page.keyboard.type('Not sure yet');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(review.discardedToast).toBeVisible();

    await page.keyboard.press('/');
    await page.keyboard.type('eng');
    await page.keyboard.press('ControlOrMeta+z');

    await expect(review.discardedToast).toBeVisible();
    await expect(review.commentBox()).toBeHidden();
});

test('Escape with the toast up leaves the review as it would without it, and the toast goes with the review', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github);
    await review.lineNumber(20).click();
    await page.keyboard.type('Not sure yet');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(review.discardedToast).toBeVisible();
    // The pointer rests on the line number: its tooltip would take the Escape, as any open layer does.
    await page.mouse.move(0, 0);

    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/\/acme\/web\/pull\/3$/u);
    await expect(review.discardedToast).toBeHidden();
});

test('the second key starts a draft: the toolbar comes, and the comment says it is pending', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github);

    await review.lineNumber(20).click();
    await page.keyboard.type('First of many');
    await page.keyboard.press(SECOND_KEY);

    await expect(review.pendingToolbar).toContainText('1 pending comment');
    await expect(review.thread('First of many')).toContainText('Pending · in your draft');
    expect(writes).toHaveLength(1);
    expect(writes[0]?.variables).not.toHaveProperty('event');
});

test('"Add it to a draft review" in Settings swaps the buttons, the first key starts a draft, and it is written to the settings repository', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github);
    const repository = answerSettingsRepository(github, { exists: false, file: null });
    await page.goto('/settings?tab=sync');
    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    await expect(saving.on).toBeVisible();

    await page.goto('/settings?tab=review');
    const settings = new SettingsScreenHarness(page);
    await expect(new AppShellHarness(page).statusBar).toContainText(
        `settings saved in ${SAMPLE_VIEWER.viewer.login}/githq-settings`,
    );
    await settings.reviewComment('Add it to a draft review').click();
    await expect
        .poll((): unknown => repository.file && JSON.parse(repository.file.text))
        .toMatchObject({ reviewCommentChoice: 'draft' });

    await page.goto(ADDRESS);
    await expect(review.code(CHANGED_LINE)).toBeVisible();
    await review.lineNumber(20).click();
    const box = review.commentBox();
    await expect(box.getByRole('button', { name: 'Start a review' })).toBeVisible();
    await expect(box.getByRole('button', { name: 'Comment now' })).toBeVisible();

    await page.keyboard.type('First of many');
    await page.keyboard.press(FIRST_KEY);

    await expect(review.pendingToolbar).toContainText('1 pending comment');
    expect(writes.map(write => write.name)).toEqual(['AddPullRequestReview']);
    expect(writes[0]?.variables).not.toHaveProperty('event');
});

test('with the draft chosen a reply starts a draft on the first key and goes at once on the second', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github, { threads: OPEN_THREADS });
    await page.goto('/settings?tab=review');
    await new SettingsScreenHarness(page).reviewComment('Add it to a draft review').click();
    await page.goto(ADDRESS);
    await expect(review.code(CHANGED_LINE)).toBeVisible();

    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('First thread here');
    await page.keyboard.press('r');
    const box = review.commentBox('Reply to sofiab');
    await expect(box.getByRole('button', { name: 'Start a review' })).toBeVisible();
    await expect(box.getByRole('button', { name: 'Reply now' })).toBeVisible();

    await page.keyboard.type('nrC Agreed');
    await page.keyboard.press(FIRST_KEY);

    await expect(review.pendingToolbar).toContainText('1 pending comment');
    expect(writes.map(write => write.name)).toEqual(['StartPullRequestReview', 'AddPullRequestReviewThreadReply']);
});

test('changed in another tab, an open box says the other thing at once and its key does what it now says, its text staying', async ({
    page,
    context,
    github,
}) => {
    const { review, writes } = await openWriting(page, github);
    await review.lineNumber(20).click();
    const box = review.commentBox();
    await page.keyboard.type('Half written');
    await expect(box.getByRole('button', { name: 'Comment', exact: true })).toBeVisible();

    const other = await context.newPage();
    await other.goto('/settings?tab=review');
    await new SettingsScreenHarness(other).reviewComment('Add it to a draft review').click();

    await expect(box.getByRole('button', { name: 'Comment now' })).toBeVisible();
    await expect(box.getByRole('button', { name: 'Start a review' })).toBeVisible();
    await expect(review.commentField()).toHaveValue('Half written');

    await page.bringToFront();
    await review.commentField().focus();
    await page.keyboard.press(FIRST_KEY);

    await expect(review.pendingToolbar).toContainText('1 pending comment');
    expect(writes.map(write => write.name)).toEqual(['AddPullRequestReview']);
    expect(writes[0]?.variables).not.toHaveProperty('event');
});

test('with a draft open the buttons change: the first key joins it, the second adds and submits the whole draft, its label counting this one', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github, { draft: 3 });
    await expect(review.pendingToolbar).toContainText('3 pending comments');

    await review.lineNumber(20).click();
    await expect(review.commentBox().getByRole('button', { name: 'Add to draft' })).toBeVisible();
    await expect(review.commentBox().getByRole('button', { name: 'Submit draft (4 comments)' })).toBeVisible();
    await page.keyboard.type('Joins it');
    await page.keyboard.press(FIRST_KEY);

    await expect(review.pendingToolbar).toContainText('4 pending comments');
    await expect(review.thread('Joins it')).toContainText('Pending');
    expect(writes.map(write => write.name)).toEqual(['AddPullRequestReviewThread']);

    await review.lineNumber(21).click();
    await page.keyboard.type('And go');
    await page.keyboard.press(SECOND_KEY);

    await expect(review.pendingToolbar).toBeHidden();
    await expect(review.thread('And go')).not.toContainText('Pending');
    expect(writes.map(write => write.name)).toEqual([
        'AddPullRequestReviewThread',
        'AddPullRequestReviewThread',
        'SubmitPullRequestReview',
    ]);
    expect(writes.at(-1)?.variables).toMatchObject({ event: 'COMMENT' });
});

test('⇧S opens the dialog, sending takes a press there: submitted as an approval with its comment, the toolbar goes', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github, { draft: 2 });
    await expect(review.pendingToolbar).toBeVisible();

    await page.keyboard.press('Shift+S');
    await expect(review.submitDialog).toBeVisible();
    await expect(review.submitDialog.getByRole('button', { name: 'Submit review' })).toBeVisible();
    expect(writes).toEqual([]);

    await page.keyboard.type('Reads well');
    await page.keyboard.press('Tab');
    await page.keyboard.press('2');
    await expect(review.submitDialog.getByRole('radio', { name: 'Approve' })).toBeChecked();
    await review.submitDialog.getByRole('button', { name: 'Approve' }).last().click();

    await expect(review.submitDialog).toBeHidden();
    await expect(review.pendingToolbar).toBeHidden();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.variables).toMatchObject({ event: 'APPROVE', body: 'Reads well' });
});

test("a refused submission turns the toolbar red with GitHub's words and keeps everything: Edit review… has the choice, Try again sends the same", async ({
    page,
    github,
}) => {
    const { review, writes, refused } = await openWriting(page, github, { draft: 2 });
    refused.set('SubmitPullRequestReview', 'Can not approve your own pull request');
    await review.submitReviewButton.click();
    await page.keyboard.type('Reads well');
    await page.keyboard.press('Tab');
    await page.keyboard.press('2');
    await page.keyboard.press(FIRST_KEY);

    await expect(review.pendingToolbar).toContainText("Couldn't send your review");
    await expect(review.pendingToolbar).toContainText('Can not approve your own pull request');
    await expect(review.pendingToolbar).toContainText('Everything is kept');

    await review.pendingToolbar.getByRole('button', { name: 'Edit review…' }).click();
    await expect(review.submitDialog.getByRole('textbox')).toHaveValue('Reads well');
    await expect(review.submitDialog.getByRole('radio', { name: 'Approve' })).toBeChecked();
    await page.keyboard.press('Escape');

    refused.clear();
    await review.pendingToolbar.getByRole('button', { name: 'Try again' }).click();

    await expect(review.pendingToolbar).toBeHidden();
    expect(writes.map(write => write.variables)).toEqual([
        expect.objectContaining({ event: 'APPROVE', body: 'Reads well' }),
        expect.objectContaining({ event: 'APPROVE', body: 'Reads well' }),
    ]);
});

test('discarding asks: focus on Cancel and Enter deletes nothing; only the red button or ⌘↵ does', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github, { draft: 1 });

    await review.discardReviewButton.click();
    await expect(review.discardDialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(review.discardDialog).toBeHidden();
    expect(writes).toEqual([]);
    await expect(review.pendingToolbar).toBeVisible();

    await review.discardReviewButton.click();
    await page.keyboard.press(FIRST_KEY);

    await expect(review.pendingToolbar).toBeHidden();
    expect(writes.map(write => write.name)).toEqual(['DeletePullRequestReview']);
});

test('the text survives a failure, leaving the screen and a reload, until it is sent', async ({ page, github }) => {
    const { review, writes, refused } = await openWriting(page, github);
    refused.set('AddPullRequestReview', 'Line could not be resolved');

    await review.lineNumber(20).click();
    await page.keyboard.type('Not lost');
    await page.keyboard.press(FIRST_KEY);

    const box = review.commentBox();
    await expect(box).toContainText('Line could not be resolved');
    await expect(review.commentField()).toHaveValue('Not lost');
    await expect(review.commentField()).toBeFocused();
    expect(writes).toHaveLength(1);

    await page.goto('/');
    await page.goto(ADDRESS);
    await expect(review.commentField()).toHaveValue('Not lost');

    await page.reload();
    await expect(review.commentField()).toHaveValue('Not lost');

    refused.clear();
    await review.commentBox().getByRole('button', { name: 'Comment' }).click();
    await expect(review.thread('Not lost')).toBeVisible();

    await page.reload();
    await expect(review.thread('Not lost')).toBeVisible();
    await expect(review.commentBox()).toBeHidden();
});

test('a stale "no draft": the single comment is refused, the text stays, the buttons turn to the draft, and it goes once', async ({
    page,
    github,
}) => {
    const { review, writes, setDraft } = await openWriting(page, github);

    await review.lineNumber(20).click();
    await page.keyboard.type('Meant alone');
    // Begun on github.com: nothing here knows.
    setDraft(2);
    await page.keyboard.press(FIRST_KEY);

    await expect(review.commentBox()).toContainText(DRAFT_TAKEN);
    await expect(review.commentField()).toHaveValue('Meant alone');
    await expect(review.commentBox().getByRole('button', { name: 'Add to draft' })).toBeVisible();
    await expect(review.commentBox().getByRole('button', { name: 'Submit draft (3 comments)' })).toBeVisible();
    await expect(review.pendingToolbar).toContainText('2 pending comments');

    await page.keyboard.press(FIRST_KEY);

    await expect(review.thread('Meant alone')).toBeVisible();
    await expect(review.pendingToolbar).toContainText('3 pending comments');
    expect(writes.map(write => write.name)).toEqual(['AddPullRequestReview', 'AddPullRequestReviewThread']);
});

test('a box scrolled out of the window keeps its text, and the keys come back with it', async ({ page, github }) => {
    const { review } = await openWriting(page, github);
    await review.lineNumber(20).click();
    await page.keyboard.type('Half a thou');

    await review.diff.evaluate(diff => diff.scrollBy(0, 4000));
    await expect(review.commentBox()).toBeHidden();
    await review.diff.evaluate(diff => diff.scrollBy(0, -4000));

    await expect(review.commentField()).toHaveValue('Half a thou');
    await expect(review.commentField()).toBeFocused();
    await page.keyboard.type('ght');
    await expect(review.commentField()).toHaveValue('Half a thought');
});

test('a range: a drag on the numbers, on one side, stopping at what hides lines; ⇧click extends a box', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github);

    await review.lineNumber(19).hover();
    await page.mouse.down();
    await review.lineNumber(21).hover();
    await page.mouse.up();

    const box = review.commentBox('Comment on lines 19–21');
    await expect(box).toBeVisible();
    await expect(review.commentField('Comment on lines 19–21')).toBeFocused();

    await review.lineNumber(22).click({ modifiers: ['Shift'] });
    await expect(review.commentBox('Comment on lines 19–22')).toBeVisible();

    await page.keyboard.type('All of these');
    await page.keyboard.press(FIRST_KEY);

    await expect(review.thread('All of these')).toBeVisible();
    expect(writes[0]?.variables).toMatchObject({
        thread: { line: 22, startLine: 19, startSide: 'RIGHT', side: 'RIGHT' },
    });
});

/** Leaves the review with a box on line 20 holding `text`; GitHub's head moves on; back, the list reads it under the box. */
async function pushUnderBox(page: Page, review: ReviewScreenHarness, answered: AnsweredReview, text: string) {
    await review.lineNumber(20).click();
    await page.keyboard.type(text);
    await expect(review.commentBox().getByRole('status')).toBeEmpty();
    // Left with its text: Escape in the box would ask to discard it.
    await review.diff.focus();
    await page.keyboard.press('Escape');
    await expect(review.commentBox()).toBeHidden();

    answered.push(NEW_HEAD);
    await page.keyboard.press('d');
    await expect(review.commentBox().getByRole('status')).toContainText('The code changed since you wrote this');
}

test('a push under a box: the line says so, the text stays, and it goes once, to that line on the new head', async ({
    page,
    github,
}) => {
    const { review, writes, answered } = await openWriting(page, github);

    await pushUnderBox(page, review, answered, 'Still here?');

    await expect(review.commentField('Comment on line 20')).toHaveValue('Still here?');
    await review.commentField().click();
    await page.keyboard.press(FIRST_KEY);

    await expect(review.thread('Still here?')).toBeVisible();
    await expect(review.commentBox()).toBeHidden();
    expect(writes.map(write => write.name)).toEqual(['AddPullRequestReview']);
    expect(writes[0]?.variables).toMatchObject({
        commitOID: NEW_HEAD,
        thread: { path: ENGINE, line: 20, side: 'RIGHT', body: 'Still here?' },
    });
});

test('after a push, changing the range is looking again: the line goes, and a reload does not bring it back', async ({
    page,
    github,
}) => {
    const { review, answered } = await openWriting(page, github);
    await pushUnderBox(page, review, answered, 'These two');

    await review.lineNumber(21).click({ modifiers: ['Shift'] });

    const box = review.commentBox('Comment on lines 20–21');
    await expect(box.getByRole('status')).toBeEmpty();
    await expect(review.commentField('Comment on lines 20–21')).toHaveValue('These two');

    await page.reload();
    await expect(review.commentField('Comment on lines 20–21')).toHaveValue('These two');
    await expect(box.getByRole('status')).toBeEmpty();
});

const OPEN_THREADS: readonly SampleReviewThread[] = [
    { id: 'T1', path: ENGINE, line: 20, comments: ['<p>First thread here</p>'] },
    { id: 'T2', path: ENGINE, line: 21, comments: ['<p>Second thread here</p>'] },
];

test('R on the thread N is at opens its reply box; with no draft the reply goes at once and says Reply', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github, { threads: OPEN_THREADS });

    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('First thread here');
    await page.keyboard.press('r');

    const box = review.commentBox('Reply to sofiab');
    const field = review.commentField('Reply to sofiab');
    await expect(field).toBeFocused();
    await expect(box.getByRole('button', { name: 'Reply' })).toBeVisible();
    await expect(box.getByRole('button', { name: 'Start a review' })).toBeVisible();

    await page.keyboard.type('nrC Agreed');
    await page.keyboard.press(FIRST_KEY);

    await expect(review.thread('First thread here')).toContainText('nrC Agreed');
    await expect(box).toBeHidden();
    expect(writes.map(write => write.name)).toEqual(['AddPullRequestReviewThreadReply']);
    expect(writes[0]?.variables).toEqual({ pullRequestReviewThreadId: 'T1', body: 'nrC Agreed' });
    await expect(review.pendingToolbar).toBeHidden();
});

test('a reply box opens inside its thread and closes again, the thread and what is above it staying put (D7, D39)', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github, { threads: OPEN_THREADS });

    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('First thread here');
    const at = await review.threadOffset('First thread here');
    await page.keyboard.press('r');

    const field = review.commentField('Reply to sofiab');
    await expect(field).toBeFocused();
    await expect(review.thread('First thread here').getByRole('group', { name: 'Reply to sofiab' })).toBeVisible();
    await expect(review.thread('First thread here').getByRole('button', { name: 'Resolve thread' })).toBeVisible();
    expect(await review.threadOffset('First thread here')).toBe(at);

    await page.keyboard.press('Escape');
    await expect(review.commentBox('Reply to sofiab')).toBeHidden();
    await expect(review.thread('First thread here').getByRole('button', { name: 'Reply…' })).toBeVisible();
    expect(await review.threadOffset('First thread here')).toBe(at);
});

test('restored where its thread was replied to again, the reply goes into that box, the thread staying put (D7)', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github, { threads: OPEN_THREADS });
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('First thread here');
    const at = await review.threadOffset('First thread here');
    await page.keyboard.press('r');
    await page.keyboard.type('Agreed');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(review.discardedToast).toBeVisible();
    await expect(review.commentBox('Reply to sofiab')).toBeHidden();
    await page.keyboard.press('r');
    await expect(review.commentField('Reply to sofiab')).toBeFocused();

    await review.discardedToast.getByRole('button', { name: /^Restore/ }).click();

    await expect(review.commentBox('Reply to sofiab')).toHaveCount(1);
    const field = review.commentField('Reply to sofiab');
    await expect(field).toHaveValue('Agreed');
    await expect(field).toBeFocused();
    expect(await review.threadOffset('First thread here')).toBe(at);
});

test('a reply with a draft open joins it, and its button, its comment and the toolbar all say so', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github, { draft: 2, threads: OPEN_THREADS });

    await review.thread('First thread here').getByRole('button', { name: 'Reply…' }).click();
    const box = review.commentBox('Reply to sofiab');
    await expect(box.getByRole('button', { name: 'Add to draft' })).toBeVisible();
    await expect(box.getByRole('button', { name: 'Submit draft (3 comments)' })).toBeVisible();
    await expect(box.getByRole('button', { name: 'Reply', exact: true })).toBeHidden();

    await page.keyboard.type('In the draft');
    await page.keyboard.press(FIRST_KEY);

    await expect(review.thread('First thread here')).toContainText('In the draft');
    await expect(review.thread('First thread here')).toContainText('Pending');
    expect(writes[0]?.variables).toMatchObject({ pullRequestReviewId: expect.any(String) });
    await expect(review.pendingToolbar).toContainText('3');
});

test('a reply labelled to go now, meeting a draft begun elsewhere, is not sent: the box says so and now joins', async ({
    page,
    github,
}) => {
    const { review, writes, setDraft } = await openWriting(page, github, { threads: OPEN_THREADS });

    await review.thread('First thread here').getByRole('button', { name: 'Reply…' }).click();
    await page.keyboard.type('Keep me');
    setDraft(4);
    await page.keyboard.press(FIRST_KEY);

    const box = review.commentBox('Reply to sofiab');
    await expect(box.getByRole('alert')).toContainText('nothing was sent');
    await expect(review.commentField('Reply to sofiab')).toHaveValue('Keep me');
    await expect(box.getByRole('button', { name: 'Add to draft' })).toBeVisible();
    expect(writes).toEqual([]);
});

test('a reply GitHub refuses comes back in its box, and after a reload it is still there on its thread', async ({
    page,
    github,
}) => {
    const { review, refused, writes } = await openWriting(page, github, { threads: OPEN_THREADS });
    refused.set('AddPullRequestReviewThreadReply', 'The thread is locked');

    await review.thread('First thread here').getByRole('button', { name: 'Reply…' }).click();
    await page.keyboard.type('Keep me too');
    await page.keyboard.press(FIRST_KEY);

    const box = review.commentBox('Reply to sofiab');
    await expect(box.getByRole('alert')).toContainText('The thread is locked');
    await expect(review.commentField('Reply to sofiab')).toHaveValue('Keep me too');

    refused.clear();
    await page.reload();
    await expect(review.commentField('Reply to sofiab')).toHaveValue('Keep me too');
    await review.commentField('Reply to sofiab').click();
    await page.keyboard.press(FIRST_KEY);
    await expect(review.thread('First thread here')).toContainText('Keep me too');
    await expect.poll(() => writes.filter(write => write.name === 'AddPullRequestReviewThreadReply')).toHaveLength(2);
});

test('Resolve folds the thread where it is, moving nothing above it, and N goes on to the open one', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github, { draft: 1, threads: OPEN_THREADS });
    const reading = review.code(CHANGED_LINE);
    await page.keyboard.press('n');
    const before = await reading.boundingBox();

    await review.thread('First thread here').getByRole('button', { name: 'Resolve' }).click();

    const folded = review.thread('First thread here').getByRole('button', { name: /Resolved/ });
    await expect(folded).toBeVisible();
    expect(await reading.boundingBox()).toEqual(before);
    expect(writes.map(write => write.name)).toEqual(['ResolveReviewThread']);
    await expect(review.pendingToolbar).toContainText('1');

    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('Second thread here');
});

test('a viewed file whose thread was resolved stays while it is at the top of the screen, the cursor gone on past it, and goes when it leaves the top, nothing moving (D7, D44)', async ({
    page,
    github,
}) => {
    // Tall, for the next file to come a third down the screen well after the hold of N has ended.
    const tall = `${LINES.map((line, index) => {
        if (index === 19) {
            return CHANGED_LINE;
        }

        return index < 150 ? `${line} // tall` : line;
    }).join('\n')}\n`;
    const { review } = await openWriting(page, github, {
        threads: [OPEN_THREADS[0]!],
        files: [{ path: ENGINE, before: BEFORE, after: tall }, OTHER],
    });
    await review.hideViewedButton.click();
    // Viewed, it stays for its open thread (D15); opened again to be read.
    await review.viewedButton(ENGINE).click();
    await expect(review.viewedButton(ENGINE)).toHaveAttribute('aria-pressed', 'true');
    await review.topHeader(ENGINE).click();
    await expect(review.code(CHANGED_LINE)).toBeVisible();
    await page.keyboard.press('n');
    await expect(review.focusedThread).toContainText('First thread here');
    await review.thread('First thread here').getByRole('button', { name: 'Resolve' }).click();
    await expect(review.thread('First thread here').getByRole('button', { name: /Resolved/ })).toBeVisible();

    // Down through the engine, the next file's header a third down the screen; the pointer on it, it is current, the
    // engine still on top.
    await expect(async () => {
        if ((await review.fileHeader(OTHER.path).count()) === 0) {
            await review.diff.evaluate(element => element.scrollBy(0, 400));
            throw new Error('The next file is not drawn yet');
        }

        const [header, diff] = await Promise.all([
            review.fileHeader(OTHER.path).boundingBox(),
            review.diff.boundingBox(),
        ]);
        if (!header || !diff) {
            throw new Error('The next file is not on screen');
        }

        const third = 38 + (diff.height - 38) / 3;
        const by = header.y + 40 - diff.y - third;
        await review.diff.evaluate((element, distance) => element.scrollBy(0, distance), by);
        expect(Math.abs(by)).toBeLessThan(2);
    }).toPass();
    await review.pointAt(review.fileHeader(OTHER.path));
    await expect(review.currentFileRow).toContainText('other.ts');
    const next = review.fileHeader(OTHER.path);
    const before = await next.boundingBox();
    await expect(review.fileRow('engine.ts')).toBeVisible();
    await expect(review.code('const unchanged150 = 150; // tall')).toBeInViewport();
    await page.evaluate(
        () =>
            new Promise(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            }),
    );
    expect(await next.boundingBox()).toEqual(before);

    // The engine off the top, it goes, and what is read stays where it is.
    const reading = review.code('const unchanged110 = 110; // changed');
    const read = await reading.boundingBox();
    await review.diff.evaluate(element => element.scrollBy(0, 300));
    await expect(review.fileRow('engine.ts')).toHaveCount(0);
    expect(await reading.boundingBox()).toEqual({ ...read!, y: read!.y - 300 });
});

test('a refused Resolve puts the thread back and says so on it, what is read staying put', async ({ page, github }) => {
    const { review, refused } = await openWriting(page, github, { threads: OPEN_THREADS });
    refused.set('ResolveReviewThread', 'Must have write access');
    await page.keyboard.press('n');
    const reading = review.code(CHANGED_LINE);
    const before = await reading.boundingBox();

    await review.thread('First thread here').getByRole('button', { name: 'Resolve' }).click();

    const thread = review.thread('First thread here');
    await expect(thread.getByRole('alert')).toContainText('Must have write access');
    await expect(thread.getByRole('button', { name: 'Resolve' })).toBeVisible();
    expect(await reading.boundingBox()).toEqual(before);
});

test('a suggestion from a range keeps its indentation; the older side offers none', async ({ page, github }) => {
    const { review, writes } = await openWriting(page, github);

    await review.lineNumber(20).click();
    const single = review.commentBox('Comment on line 20');
    await expect(single.getByRole('button', { name: /Suggest a change/ })).toBeVisible();

    // ⇧↓ in the empty box takes in the next line, the keys staying in it.
    await page.keyboard.press('Shift+ArrowDown');
    const field = review.commentField('Comment on lines 20–21');
    await expect(field).toBeFocused();

    await page.keyboard.press('ControlOrMeta+g');
    await expect(field).toHaveValue('```suggestion\nconst changed20 = 20;\n    const indented21 = 21;\n```');

    await page.keyboard.press(FIRST_KEY);
    await expect(review.commentBox()).toBeHidden();
    expect(writes[0]?.variables).toMatchObject({
        thread: {
            startLine: 20,
            line: 21,
            body: '```suggestion\nconst changed20 = 20;\n    const indented21 = 21;\n```',
        },
    });
});

test('⇧↓ out of a box left with text takes the next line into it, and in a box it selects text', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github);

    await review.lineNumber(20).click();
    await page.keyboard.type('Half');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(review.commentBox('Comment on line 20')).toBeVisible();

    await review.diff.focus();
    await page.keyboard.press('Shift+ArrowDown');
    await expect(review.commentBox('Comment on lines 20–21')).toBeVisible();
    await expect(review.commentField('Comment on lines 20–21')).toHaveValue('Half');
});

test('a comment on the pull request with a draft open goes at once and joins nothing, and keys there stay there', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github, { draft: 2 });

    await page.keyboard.press('Alt+ControlOrMeta+b');
    const conversation = page.getByRole('region', { name: 'Conversation' });
    const field = conversation.getByRole('textbox', { name: 'Comment', exact: true });
    await expect(field).toHaveAttribute('placeholder', /go\sout\snow,\snot\sin\syour\sdraft/u);
    await field.click();
    await page.keyboard.type('Note for all rCS');
    await expect(review.commentBox()).toBeHidden();
    await expect(field).toHaveValue('Note for all rCS');
    await page.keyboard.press(FIRST_KEY);

    await expect(conversation).toContainText('Note for all rCS');
    await expect(field).toHaveValue('');
    expect(writes).toEqual([]);
    await expect(review.pendingToolbar).toContainText('2');
});

test('the keys sheet has every row whatever can run now, and no key of the app it would not run', async ({
    page,
    github,
}) => {
    await openWriting(page, github, { threads: OPEN_THREADS });

    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog', { name: 'Keys in a review' });
    const writing = sheet.getByRole('region', { name: 'Writing' });
    await expect(writing.getByText('Comment on the line')).toBeVisible();
    await expect(writing.getByText('Suggest a change')).toBeVisible();
    // With no thread focused and no draft, R and ⇧S are listed all the same.
    await expect(writing.getByText('Reply to the thread')).toBeVisible();
    await expect(writing.getByText('Submit review…')).toBeVisible();
    await expect(sheet.getByText('New issue')).toBeHidden();
    const moving = sheet.getByRole('region', { name: 'Moving' });
    await expect(moving.getByText('Next and previous file')).toBeVisible();
    await expect(moving.getByText('Move the cursor', { exact: true })).toBeVisible();
    await expect(moving.getByText('Back to the pull request')).toBeVisible();
    await expect(sheet.getByRole('region', { name: 'Files' }).getByText('Filter by path')).toBeVisible();
    await expect(sheet.getByRole('region', { name: 'Files' }).getByText('Show 20 more hidden lines')).toBeVisible();
    await expect(sheet.getByText('Review, from an opened pull request')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
});

test('⇧S with no draft: an approval goes with no line comment, naming the head read, and no toolbar stays', async ({
    page,
    github,
}) => {
    const { review, writes } = await openWriting(page, github);
    await expect(review.pendingToolbar).toBeHidden();

    await page.keyboard.press('Shift+S');
    await expect(review.submitDialog).toBeVisible();
    await expect(review.submitDialog.getByText(/pending comment/u)).toBeHidden();
    await expect(review.submitDialog.getByRole('button', { name: 'Write a comment first' })).toBeDisabled();

    await page.keyboard.press('Tab');
    await page.keyboard.press('2');
    await review.submitDialog.getByRole('button', { name: 'Approve' }).last().click();

    await expect(review.submitDialog).toBeHidden();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.name).toBe('SendPullRequestReview');
    expect(writes[0]?.variables).toMatchObject({ event: 'APPROVE' });
    expect(writes[0]?.variables).toHaveProperty('commitOID');
    expect(writes[0]?.variables).not.toHaveProperty('thread');
    await expect(review.pendingToolbar).toBeHidden();
});

test("an approval refused with no draft shows GitHub's words though no draft is open; Edit review… has the choice", async ({
    page,
    github,
}) => {
    const { review, refused } = await openWriting(page, github);
    refused.set('SendPullRequestReview', 'Review Can not approve your own pull request');

    await page.keyboard.press('Shift+S');
    await page.keyboard.press('Tab');
    await page.keyboard.press('2');
    github.holdAnswers();
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(review.pendingToolbar.getByRole('status')).toHaveText('Sending your review…');
    await expect(review.pendingToolbar.getByRole('button')).toHaveCount(0);
    github.releaseAnswers();

    await expect(review.pendingToolbar).toContainText('Review Can not approve your own pull request');
    await review.pendingToolbar.getByRole('button', { name: 'Edit review…' }).click();
    await expect(review.submitDialog.getByRole('radio', { name: 'Approve' })).toBeChecked();
    await page.keyboard.press('Escape');

    await review.pendingToolbar.getByRole('button', { name: 'Try again' }).click();
    await expect(review.pendingToolbar).toContainText('Review Can not approve your own pull request');
    await expect(review.diff).toBeFocused();

    await review.pendingToolbar.getByRole('button', { name: 'Dismiss' }).click();
    await expect(review.pendingToolbar).toBeHidden();
    await expect(review.diff).toBeFocused();
    await page.keyboard.press('Shift+S');
    await expect(review.submitDialog.getByRole('radio', { name: 'Approve' })).toBeChecked();
});

test('Esc goes back to the pull request, last of what it does: the box, the selection and the filter first', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github);

    await review.lineNumber(20).click();
    await expect(review.commentField('Comment on line 20')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(review.commentBox('Comment on line 20')).toBeHidden();

    await page.keyboard.press('x');
    await expect(page.getByText('1 file selected')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('1 file selected')).toBeHidden();

    // The pointer rests on the line number: its tooltip would take the next Escape, as any open layer does.
    await page.mouse.move(0, 0);
    await page.keyboard.press('/');
    await page.keyboard.type('engine');
    await review.diff.focus();
    await page.keyboard.press('Escape');
    await expect(review.filterField).toHaveValue('');
    await expect(page).toHaveURL(new RegExp(`${ADDRESS}$`, 'u'));

    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/acme\/web\/pull\/3$/u);
});

test('O opens the files on GitHub', async ({ page, github }) => {
    await openWriting(page, github);
    github.web('/acme/web/pull/3/files', () => ({ status: 200, body: '<title>Files</title>' }));

    const popup = page.waitForEvent('popup');
    await page.keyboard.press('o');

    expect((await popup).url()).toBe('https://github.com/acme/web/pull/3/files');
});

test('the palette offers what a review has keys for: back, GitHub and the cursor', async ({ page, github }) => {
    await openWriting(page, github);
    const menu = new CommandMenuHarness(page);

    await menu.open();
    for (const title of ['Back to the pull request', 'Open on GitHub', 'Move the cursor down', 'Move the cursor up']) {
        await menu.field.fill(title);
        await expect(menu.option(new RegExp(title, 'u')).first()).toBeVisible();
    }
});

test('every file viewed with threads left: the block says so over them, and its Submit review… opens the dialog', async ({
    page,
    github,
}) => {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const id = world.pullRequest({
        repository: 'acme/web',
        number: 3,
        title: 'Retry polls',
        foundBy: ['authored'],
        minutesAgo: 5,
    });
    await openMyWork(page, github, world);
    answerReview(github, {
        repository: 'acme/web',
        number: 3,
        id,
        files: [
            { path: ENGINE, before: BEFORE, after: AFTER, viewed: 'VIEWED' },
            { path: 'src/other.ts', before: 'one\n', after: 'two\n', viewed: 'VIEWED' },
        ],
        threads: [{ id: 'T1', path: ENGINE, line: 20, comments: ['<p>Why here?</p>'] }],
    });
    await page.goto(ADDRESS);
    const review = new ReviewScreenHarness(page);
    await review.hideViewedButton.click();

    await expect(review.diff.getByText('All 2 files viewed')).toBeInViewport();
    await expect(review.diff.getByText(/thread.is.still.open.on.1.file,.shown.below/u)).toBeVisible();
    await expect(review.thread('Why here?')).toBeVisible();
    await review.diff.getByRole('button', { name: 'Submit review…' }).click();
    await expect(review.submitDialog).toBeVisible();
});
