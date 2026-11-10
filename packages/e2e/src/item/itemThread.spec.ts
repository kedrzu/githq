import { expect, test } from '../fixtures.js';
import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
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
            willCloseTarget: false,
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

test('a Status change a project workflow made names no one, unlike one a person made', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { world } = sample;
    const project = { title: 'Roadmap', url: 'https://github.com/orgs/acme/projects/1' };
    world.event(sample.issue, {
        event: {
            __typename: 'ProjectV2ItemStatusChangedEvent',
            actor: user('monalisa'),
            wasAutomated: false,
            previousStatus: 'Todo',
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
            previousStatus: 'In progress',
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
    // Older than the head, committed when the pull request was opened a day ago: the head stays the newest.
    const author = 'octocat';
    for (const [index, headline] of [
        'Add the redirect',
        'Keep the return address',
        'Test the loop',
        'Drop the retry',
    ].entries()) {
        world.commit(sample.pullRequest, { author, headline, minutesAgo: 2000 - index });
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

function user(login: string) {
    return { login, avatarUrl: `https://avatars.githubusercontent.com/${login}` };
}
