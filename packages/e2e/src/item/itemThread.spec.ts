import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { answerReview } from '../review/answerReview.js';
import type { SampleReviewThread } from '../review/answerReview.js';
import { signIn } from '../session.js';

const ISSUE = 'Sign-in loops after the token expires';
const PULL_REQUEST = 'Redirect once after sign-in';
const SECOND_ISSUE = 'Flaky login test';

test("an issue's events show among its comments by time, one person's burst on one line, and an issue named opens in the app", async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    const secondNumber = 21;
    world.event(sample.issue, {
        event: { __typename: 'LabeledEvent', actor: user('monalisa'), label: { name: 'bug', color: 'd73a4a' } },
        minutesAgo: 120,
    });
    world.event(sample.issue, {
        event: { __typename: 'AssignedEvent', actor: user('monalisa'), assignee: user('hubot') },
        minutesAgo: 118,
    });
    world.comment(sample.issue, { author: 'hubot', body: 'Seen it twice today.', minutesAgo: 90 });
    world.event(sample.issue, {
        event: {
            __typename: 'CrossReferencedEvent',
            actor: user('hubot'),
            source: {
                __typename: 'Issue',
                id: sample.secondIssue,
                url: `https://github.com/acme/web/issues/${secondNumber}`,
                number: secondNumber,
                title: SECOND_ISSUE,
                repository: { nameWithOwner: 'acme/web' },
            },
        },
        minutesAgo: 60,
    });
    // Added and taken off again straight after: nothing to tell.
    world.event(sample.issue, {
        event: { __typename: 'PinnedEvent', actor: user('monalisa') },
        minutesAgo: 30,
    });
    world.event(sample.issue, {
        event: { __typename: 'UnpinnedEvent', actor: user('monalisa') },
        minutesAgo: 29,
    });
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();

    const burst = item.entry('added');
    await expect(burst).toHaveText(/^monalisa\s*added\s*bug\s*and assigned hubot\s*1h$/u);
    const mention = item.entry('mentioned this in');
    await expect(mention).toContainText(`#${secondNumber} ${SECOND_ISSUE}`);
    await expect(item.entry('pinned')).toHaveCount(0);
    const order = await item.root
        .getByRole('listitem')
        .evaluateAll(entries => entries.map(entry => entry.textContent ?? ''));
    const positions = ['added', 'Seen it twice today.', 'mentioned this in'].map(text =>
        order.findIndex(entry => entry.includes(text)),
    );
    expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    expect(positions).not.toContain(-1);

    await mention.getByRole('link', { name: `#${secondNumber}` }).click();
    await expect(item.title).toHaveText(SECOND_ISSUE);
});

test("a pull request's commits show as a push and its events after it, by who did them", async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    world.pullRequestEvent(sample.pullRequest, {
        event: {
            __typename: 'ReviewRequestedEvent',
            actor: user('monalisa'),
            requestedReviewer: user('hubot'),
        },
        minutesAgo: 5,
    });
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(PULL_REQUEST).click();

    const push = item.entry('pushed 1 commit');
    await expect(push).toContainText(PULL_REQUEST);
    await expect(item.entry('asked hubot for a review')).toContainText('monalisa');
});

test("a pull request's review shows with its threads, a resolved one folded until opened, and a code comment posted alone on its own", async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    world.review(sample.pullRequest, {
        id: 'R_hubot',
        author: 'hubot',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>One thing before it goes in.</p>',
        minutesAgo: 30,
    });
    const { myWork } = await openMyWork(page, github, world);
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [],
        threads: [
            {
                id: 'T_open',
                path: 'src/auth/redirect.ts',
                line: 2,
                diffHunk: '@@ -1,2 +1,2 @@\n const back = read()\n-go(back)\n+go(back ?? home)',
                comments: ['<p>What if there is no return address?</p>'],
                reviewId: 'R_hubot',
            },
            {
                id: 'T_resolved',
                path: 'src/auth/session.ts',
                line: 4,
                isResolved: true,
                comments: ['<p>A typo in the name.</p>', '<p>Fixed.</p>'],
                reviewId: 'R_hubot',
            },
            { id: 'T_alone', path: 'src/auth/token.ts', line: 7, comments: ['<p>Posted on its own.</p>'] },
        ],
    });
    const item = new ItemViewHarness(page);
    await myWork.row(PULL_REQUEST).click();

    const review = item.entry('One thing before it goes in.');
    await expect(review).toContainText(/hubot\s*requested changes/u);
    await expect(review).toContainText('2 threads · 1 resolved');
    const open = review.getByRole('group', { name: 'Thread by sofiab on src/auth/redirect.ts' });
    await expect(open).toContainText('What if there is no return address?');
    await expect(open).toContainText('go(back ?? home)');

    await expect(review).not.toContainText('A typo in the name.');
    await review.getByRole('button', { name: /^Resolved src\/auth\/session\.ts/u }).click();
    const resolved = review.getByRole('group', { name: 'Thread by sofiab on src/auth/session.ts' });
    await expect(resolved).toContainText('A typo in the name.');
    await expect(resolved).toContainText('mlaine marked this thread as resolved.');
    await resolved.getByRole('button', { name: 'Hide' }).click();
    await expect(review).not.toContainText('A typo in the name.');

    const alone = item.entry('Posted on its own.');
    await expect(alone).toContainText(/^sofiab\s*commented on\s*src\/auth\/token\.ts/u);
    await expect(alone).not.toContainText('One thing before it goes in.');
});

test('a Status change a project workflow made names no one, unlike one a person made', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    const project = { title: 'Roadmap', url: 'https://github.com/orgs/acme/projects/1' };
    world.event(sample.issue, {
        event: {
            __typename: 'ProjectV2ItemStatusChangedEvent',
            actor: user('monalisa'),
            wasAutomated: false,
            status: 'In progress',
            project,
        },
        minutesAgo: 60,
    });
    // GitHub names the project's owner for a workflow's change.
    world.event(sample.issue, {
        event: {
            __typename: 'ProjectV2ItemStatusChangedEvent',
            actor: user('acme'),
            wasAutomated: true,
            status: 'Done',
            project,
        },
        minutesAgo: 10,
    });
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();

    await expect(item.entry('changed Status to In progress in Roadmap')).toContainText('monalisa');
    const automated = item.entry('Status set to Done in Roadmap by a project workflow');
    await expect(automated).toHaveText(/^Status\sset\sto\sDone\sin\sRoadmap\sby\sa\sproject\sworkflow\s*10m$/u);
    await expect(automated.locator('img')).toHaveCount(0);
});

test("a pull request's push of more than three commits shows the newest three and the rest on demand, and its head's failed checks show as CI's", async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    // Older than the head, committed when the pull request was opened a day ago (1460 minutes): the head stays the
    // newest, and within an hour of them all, so one push holds the five.
    const author = 'octocat';
    for (const [index, headline] of [
        'Add the redirect',
        'Keep the return address',
        'Test the loop',
        'Drop the retry',
    ].entries()) {
        world.commit(sample.pullRequest, { author, headline, minutesAgo: 1500 - index });
    }
    world.failChecks(sample.pullRequest, ['e2e', 'typecheck']);
    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(PULL_REQUEST).click();

    const push = item.entry('pushed 5 commits');
    await expect(push).toContainText(PULL_REQUEST);
    await expect(push).toContainText('Test the loop');
    await expect(push).not.toContainText('Keep the return address');
    await push.getByRole('button', { name: 'Show 2 more commits' }).click();
    await expect(push).toContainText('Keep the return address');
    await expect(push).toContainText('Add the redirect');
    await expect(push.getByRole('button', { name: /more commits?$/u })).toHaveCount(0);

    const head = world.headOf(sample.pullRequest).slice(0, 7);
    const checks = item.entry('checks failed');
    await expect(checks).toHaveText(
        new RegExp(`^CI\\s*2\\sof\\s5\\schecks\\sfailed\\son\\s${head}:\\se2e,\\stypecheck\\s*1m$`, 'u'),
    );
    await expect(checks.locator('img')).toHaveCount(0);
});

test('a long thread folds its middle to one band; clicking it reads what was not read and shows it all in place, the focus on the first revealed', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    // 60: more than the 2 first and the 50 newest an opened item reads, so the middle is read on demand.
    for (let index = 1; index <= 60; index++) {
        world.comment(sample.issue, { author: 'hubot', body: `Note ${index}.`, minutesAgo: 200 - index });
    }

    const { myWork } = await openMyWork(page, github, world);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();

    const fold = item.root.getByRole('button', { name: /^Show 53 earlier events/ });
    await expect(fold).toContainText('53 comments');
    await expect(item.entry('Note ')).toHaveCount(7);
    await expect(item.entry('Note 56.')).toBeVisible();

    await fold.click();

    await expect(fold).toHaveCount(0);
    await expect(item.entry('Note ')).toHaveCount(60);
    const order = await item.root
        .getByRole('listitem')
        .evaluateAll(entries => entries.map(entry => /Note (\d+)\./u.exec(entry.textContent ?? '')?.[1] ?? ''));
    expect(order.filter(Boolean).map(Number)).toEqual(Array.from({ length: 60 }, (_, index) => index + 1));
    await expect(item.entry('Note 3.')).toBeFocused();
});

test('F16: an item whose thread GitHub did not give says so on the rail; Try again reads it, Open on GitHub goes there', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    world.comment(sample.issue, { author: 'hubot', body: 'Seen it twice today.', minutesAgo: 3 });
    world.install(github);
    // Neither the prefetch of my work nor the opened item gets its detail.
    github.graphql('ItemDetails', new GitHubHttpError(502, 'Bad gateway'));
    github.graphql('ItemDetail', new GitHubHttpError(502, 'Bad gateway'));
    await signIn(page, github);
    const myWork = new MyWorkScreenHarness(page);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();

    const failed = item.root.getByRole('alert');
    await expect(failed).toContainText("The description, comments and events couldn't be loaded");
    await expect(failed.getByRole('link', { name: 'Open on GitHub' })).toHaveAttribute(
        'href',
        'https://github.com/acme/web/issues/12',
    );
    await expect(item.commentBox).toBeVisible();

    world.install(github);
    await failed.getByRole('button', { name: 'Try again' }).click();

    await expect(item.entry('Seen it twice today.')).toBeVisible();
    await expect(failed).toHaveCount(0);
});

const REPLY_KEY = 'ControlOrMeta+Enter';
const QUESTION = 'What if there is no return address?';

/**
 * The sample pull request with hubot's review holding one open thread on `src/auth/redirect.ts`, opened from my work, on
 * a GitHub that takes replies and resolves as the real one does, or refuses them with `refused`'s words.
 */
async function openReviewThread(page: Page, github: GitHubMock) {
    const sample = createSampleEditableWork();
    const { world } = sample;
    world.review(sample.pullRequest, {
        id: 'R_hubot',
        author: 'hubot',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>One thing before it goes in.</p>',
        minutesAgo: 30,
    });
    const { myWork } = await openMyWork(page, github, world);
    const threads: SampleReviewThread[] = [
        {
            id: 'T_open',
            path: 'src/auth/redirect.ts',
            line: 2,
            diffHunk: '@@ -1,2 +1,2 @@\n const back = read()\n-go(back)\n+go(back ?? home)',
            comments: [`<p>${QUESTION}</p>`],
            reviewId: 'R_hubot',
        },
    ];
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        id: sample.pullRequest,
        files: [
            {
                path: 'src/auth/redirect.ts',
                before: 'const back = read()\ngo(back)\n',
                after: 'const back = read()\ngo(back ?? home)\n',
            },
        ],
        threads,
    });
    const writes: { readonly name: string; readonly variables: Readonly<Record<string, unknown>> }[] = [];
    const refused = new Map<string, string>();
    const refusal = (message: string) => ({ data: null, errors: [{ type: 'UNPROCESSABLE', message, path: [] }] });
    github.graphqlDocument('AddPullRequestReviewThreadReply', ({ variables }) => {
        writes.push({ name: 'AddPullRequestReviewThreadReply', variables });
        const message = refused.get('AddPullRequestReviewThreadReply');
        if (message !== undefined) {
            return refusal(message);
        }

        const at = threads.findIndex(thread => thread.id === variables.pullRequestReviewThreadId);
        const thread = threads[at];
        if (thread) {
            threads[at] = { ...thread, comments: [...thread.comments, `<p>${String(variables.body)}</p>`] };
        }

        return {
            data: {
                addPullRequestReviewThreadReply: { comment: { pullRequestReview: { id: 'R', state: 'SUBMITTED' } } },
            },
        };
    });
    for (const [name, field, isResolved] of [
        ['ResolveReviewThread', 'resolveReviewThread', true],
        ['UnresolveReviewThread', 'unresolveReviewThread', false],
    ] as const) {
        github.graphqlDocument(name, ({ variables }) => {
            writes.push({ name, variables });
            const at = threads.findIndex(thread => thread.id === variables.threadId);
            const thread = threads[at];
            if (thread) {
                threads[at] = { ...thread, isResolved };
            }

            return { data: { [field]: { thread: { id: variables.threadId } } } };
        });
    }

    const item = new ItemViewHarness(page);
    await myWork.row(PULL_REQUEST).click();
    const thread = item.root.getByRole('group', { name: 'Thread by sofiab on src/auth/redirect.ts' });
    await expect(thread).toContainText(QUESTION);
    return { item, thread, writes, refused, sample };
}

test('R on a code thread clicked opens its reply editor; the reply goes as code review sends it, shows at once, and code review shows it', async ({
    page,
    github,
}) => {
    const { item, thread, writes } = await openReviewThread(page, github);

    await thread.getByText(QUESTION).click();
    await page.keyboard.press('r');
    const field = thread.getByRole('textbox', { name: 'Reply' });
    await expect(field).toBeFocused();
    await expect(item.commentBox).not.toBeFocused();

    await page.keyboard.type('Home is the fallback now.');
    await page.keyboard.press(REPLY_KEY);

    await expect(thread).toContainText('Home is the fallback now.');
    await expect(field).toBeHidden();
    expect(writes).toEqual([
        {
            name: 'AddPullRequestReviewThreadReply',
            variables: { pullRequestReviewThreadId: 'T_open', body: 'Home is the fallback now.' },
        },
    ]);

    // The keys are the thread's again: D opens code review, whose thread holds the reply.
    await expect(thread).toBeFocused();
    await page.keyboard.press('d');
    const review = new ReviewScreenHarness(page);
    await expect(review.thread(QUESTION)).toContainText('Home is the fallback now.');
});

test('with the draft chosen, a reply from the thread starts a review on the head GitHub has now, code review never opened', async ({
    page,
    github,
}) => {
    const { item, thread, writes, sample } = await openReviewThread(page, github);
    github.graphqlDocument('StartPullRequestReview', ({ variables }) => {
        writes.push({ name: 'StartPullRequestReview', variables });
        sample.world.setPendingReview(sample.pullRequest, { comments: 1, minutesAgo: 0 });
        return {
            data: { addPullRequestReview: { pullRequestReview: { id: 'DRAFT', createdAt: new Date().toISOString() } } },
        };
    });
    await page.goto('/settings?tab=review');
    await new SettingsScreenHarness(page).reviewComment('Add it to a draft review').click();
    await page.goBack();
    await expect(thread).toContainText(QUESTION);
    // Pushed after the item was read: its row still names the head before.
    const head = sample.world.push(sample.pullRequest, 'sofiab', 'Fall back to home');

    await thread.getByRole('button', { name: 'Reply…' }).click();
    await expect(thread.getByRole('button', { name: 'Start a review' })).toBeVisible();
    await page.keyboard.type('Home is the fallback now.');
    await page.keyboard.press(REPLY_KEY);

    await expect(thread).toContainText('Home is the fallback now.');
    expect(writes).toEqual([
        { name: 'StartPullRequestReview', variables: { pullRequestId: sample.pullRequest, commitOID: head } },
        {
            name: 'AddPullRequestReviewThreadReply',
            variables: {
                pullRequestReviewThreadId: 'T_open',
                body: 'Home is the fallback now.',
                pullRequestReviewId: 'DRAFT',
            },
        },
    ]);
});

test('Resolve thread folds it, saying at once that the viewer resolved it; Unresolve opens it again', async ({
    page,
    github,
}) => {
    const { item, thread, writes } = await openReviewThread(page, github);

    await thread.getByRole('button', { name: 'Resolve thread' }).click();
    const review = item.entry('One thing before it goes in.');
    await expect(review).toContainText('1 thread · 1 resolved');
    // Folded, the thread's row keeps the focus: the keys are still the code threads'.
    const row = review.getByRole('button', { name: /^Resolved src\/auth\/redirect\.ts/u });
    await expect(row).toBeFocused();
    await row.click();
    await expect(thread).toContainText('octocat marked this thread as resolved.');
    expect(writes.map(write => write.name)).toEqual(['ResolveReviewThread']);

    await thread.getByRole('button', { name: 'Unresolve' }).click();
    await expect(thread.getByRole('button', { name: 'Resolve thread' })).toBeVisible();
    await expect(review).not.toContainText('resolved');
    expect(writes.map(write => write.name)).toEqual(['ResolveReviewThread', 'UnresolveReviewThread']);
});

test('a reply GitHub refuses comes back with its text and why; leaving the item asks first, and a reload keeps it', async ({
    page,
    github,
}) => {
    const { item, thread, writes, refused } = await openReviewThread(page, github);
    refused.set('AddPullRequestReviewThreadReply', 'The thread is locked');

    await thread.getByRole('button', { name: 'Reply…' }).click();
    await page.keyboard.type('Keep me');
    await page.keyboard.press(REPLY_KEY);

    const field = thread.getByRole('textbox', { name: 'Reply' });
    await expect(thread.getByRole('alert')).toContainText('The thread is locked');
    await expect(field).toHaveValue('Keep me');
    expect(writes.map(write => write.name)).toEqual(['AddPullRequestReviewThreadReply']);

    await item.nextButton.click();
    await expect(thread.getByRole('status')).toHaveText('Discard your reply?');
    await expect(item.title).toHaveText(PULL_REQUEST);

    await page.reload();
    await expect(thread.getByRole('textbox', { name: 'Reply' })).toHaveValue('Keep me');
});

test("the viewer's draft review shows last, as theirs alone; somebody else's draft comments show nowhere", async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    const { myWork } = await openMyWork(page, github, world);
    const threads: SampleReviewThread[] = [
        {
            id: 'T_theirs',
            path: 'src/auth/redirect.ts',
            line: 2,
            comments: ['<p>Not sent by sofiab yet.</p>'],
            pending: true,
        },
    ];
    answerReview(github, { repository: 'acme/web', number: 15, id: sample.pullRequest, files: [], threads });
    const item = new ItemViewHarness(page);
    await myWork.row(PULL_REQUEST).click();
    await expect(item.title).toHaveText(PULL_REQUEST);
    // The thread is read: the pull request's other cards are on the rail.
    await expect(item.commentBox).toBeVisible();
    await expect(item.root).not.toContainText('Not sent by sofiab yet.');
    await expect(item.root).not.toContainText('Your review');

    // The viewer starts a draft of their own on github.com.
    threads.push({
        id: 'T_mine',
        path: 'src/auth/session.ts',
        line: 4,
        comments: ['<p>Mine, not sent yet.</p>'],
        pending: true,
        author: 'octocat',
    });
    world.setPendingReview(sample.pullRequest, { comments: 1, minutesAgo: 5 });
    await page.reload();

    const draft = item.entry('Mine, not sent yet.');
    await expect(draft).toContainText(/^Your review\s*pending/u);
    await expect(draft.getByRole('button', { name: 'Reply…' })).toHaveCount(0);
    await expect(item.root).not.toContainText('Not sent by sofiab yet.');
    const order = await item.root
        .getByRole('listitem')
        .evaluateAll(entries => entries.map(entry => entry.textContent ?? ''));
    expect(order.at(-1)).toContain('Mine, not sent yet.');
});

test('a long thread folds its middle but never the oldest review with a thread still open, nor what comes after it', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    for (let index = 1; index <= 10; index++) {
        world.comment(sample.pullRequest, { author: 'hubot', body: `Before ${index}.`, minutesAgo: 300 - index });
    }

    world.review(sample.pullRequest, {
        id: 'R_settled',
        author: 'mlaine',
        state: 'COMMENTED',
        bodyHtml: '<p>All settled.</p>',
        minutesAgo: 285,
    });
    world.review(sample.pullRequest, {
        id: 'R_waiting',
        author: 'hubot',
        state: 'CHANGES_REQUESTED',
        bodyHtml: '<p>Still waiting on this.</p>',
        minutesAgo: 280,
    });
    for (let index = 1; index <= 15; index++) {
        world.comment(sample.pullRequest, { author: 'hubot', body: `After ${index}.`, minutesAgo: 200 - index });
    }

    const { myWork } = await openMyWork(page, github, world);
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        id: sample.pullRequest,
        files: [],
        threads: [
            {
                id: 'T_settled',
                path: 'src/auth/session.ts',
                line: 4,
                isResolved: true,
                comments: ['<p>Settled.</p>'],
                reviewId: 'R_settled',
            },
            {
                id: 'T_waiting',
                path: 'src/auth/redirect.ts',
                line: 2,
                comments: ['<p>What if there is no return address?</p>'],
                reviewId: 'R_waiting',
            },
        ],
    });
    const item = new ItemViewHarness(page);
    await myWork.row(PULL_REQUEST).click();

    const waiting = item.entry('Still waiting on this.');
    await expect(waiting.getByRole('group', { name: 'Thread by sofiab on src/auth/redirect.ts' })).toContainText(
        'What if there is no return address?',
    );
    await expect(item.root.getByRole('button', { name: /^Show \d+ earlier events/u })).toBeVisible();
    // Folded: what came before it, the review whose threads are all resolved among them.
    await expect(item.entry('All settled.')).toHaveCount(0);
    await expect(item.entry('Before 10.')).toHaveCount(0);
    // Kept: everything after it, the newest five and more.
    await expect(item.root.getByRole('listitem').filter({ hasText: /After \d+\./u })).toHaveCount(15);
});

function user(login: string) {
    return { login, avatarUrl: `https://avatars.githubusercontent.com/${login}` };
}
