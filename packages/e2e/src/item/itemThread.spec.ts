import { expect, test } from '../fixtures.js';
import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

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

function user(login: string) {
    return { login, avatarUrl: `https://avatars.githubusercontent.com/${login}` };
}
