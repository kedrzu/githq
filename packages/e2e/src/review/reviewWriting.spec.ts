import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { answerReview } from './answerReview.js';
import type { SampleReviewThread } from './answerReview.js';

const ADDRESS = '/acme/web/pull/3/files';
const ENGINE = 'src/engine.ts';
const LINES = Array.from({ length: 300 }, (_, index) => `const unchanged${index + 1} = ${index + 1};`);
const BEFORE = `${LINES.join('\n')}\n`;
const AFTER = `${LINES.map((line, index) => (index === 19 ? 'const changed20 = 20;' : line)).join('\n')}\n`;
const CHANGED_LINE = 'const changed20 = 20;';
const DRAFT_TAKEN = 'User can only have one pending review per pull request';
const FIRST_KEY = 'ControlOrMeta+Enter';
const SECOND_KEY = 'ControlOrMeta+Shift+Enter';

/** A review of one pull request on a GitHub that takes and refuses writes as the real one does. */
async function openWriting(page: Page, github: GitHubMock, options: { readonly draft?: number } = {}) {
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

    const threads: SampleReviewThread[] = [];
    answerReview(github, {
        repository: 'acme/web',
        number: 3,
        id,
        files: [
            { path: ENGINE, before: BEFORE, after: AFTER },
            // Room to scroll a box out of the list.
            {
                path: 'src/other.ts',
                before: BEFORE,
                after: LINES.map((line, index) => `${line}${index < 100 ? '' : ' // changed'}\n`).join(''),
            },
        ],
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

    await page.goto(ADDRESS);
    const review = new ReviewScreenHarness(page);
    await expect(review.code(CHANGED_LINE)).toBeVisible();
    return { review, writes, threads, refused, setDraft, world, id };
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

test('C opens the box on the first line in view; empty, Escape closes it; with text it stays, and the keys are the diff again', async ({
    page,
    github,
}) => {
    const { review } = await openWriting(page, github);

    await page.keyboard.press('c');
    const box = review.commentBox();
    await expect(box).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();

    await page.keyboard.press('c');
    await page.keyboard.type('Hold on');
    await page.keyboard.press('Escape');
    await expect(review.commentField()).toHaveValue('Hold on');
    await expect(review.diff).toBeFocused();
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
