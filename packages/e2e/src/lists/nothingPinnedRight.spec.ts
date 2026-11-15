import type { Locator } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommitGraphHarness } from '../harnesses/CommitGraph.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { TrackedListScreenHarness } from '../harnesses/TrackedListScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { answerReview } from '../review/answerReview.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT_PATH, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// "Nothing is pinned to a row's far right edge": at a wide window what a row says follows the content it belongs to.

/** The gap a row keeps between its pieces, at most: more means something is held apart from what it belongs to. */
const MAX_GAP = 16;
/** How near the row's right edge a piece may be: a piece that follows the title is nowhere near it at 2560 px. */
const MIN_FROM_RIGHT_EDGE = 800;

test.use({ viewport: { width: 2560, height: 1440 } });

test('in my work a pull request reads title, number, avatars, age; an issue title, avatars, age', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createWorld());

    const requested = myWork.row('Add rate limit headers to the API');
    const title = requested.getByText('Add rate limit headers to the API', { exact: true });
    const number = requested.getByText('#52', { exact: true });
    await expectFollows(number, title, requested);
    await expectFollows(avatar(requested, 'hubot'), number, requested);
    await expectFollows(age(requested), avatar(requested, 'hubot'), requested);

    // Nobody else to name on one's own pull request: the age follows its number.
    const own = myWork.row('Cache search results');
    const ownNumber = own.getByText('#48', { exact: true });
    await expectFollows(ownNumber, own.getByText('Cache search results', { exact: true }), own);
    await expectFollows(age(own), ownNumber, own);

    const issue = myWork.row('Dark mode for the status bar');
    const issueTitle = issue.getByText('Dark mode for the status bar', { exact: true });
    await expectFollows(avatar(issue, 'hubot'), issueTitle, issue);
    await expectFollows(age(issue), avatar(issue, 'hubot'), issue);
});

test("a repository's issues and pull requests keep the avatars and the age right after the title", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, sample.world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const repository = new RepositoryScreenHarness(page);

    const issue = repository.row('Crash on start');
    await expectFollows(
        avatar(issue, SAMPLE_VIEWER.viewer.login),
        issue.getByText('Crash on start', { exact: true }),
        issue,
    );
    await expectFollows(age(issue), avatar(issue, SAMPLE_VIEWER.viewer.login), issue);

    await page.keyboard.press('2');
    await expect(repository.section('Pull requests')).toHaveAttribute('aria-pressed', 'true');
    const pullRequest = repository.row('Fix the crash on start');
    const title = pullRequest.getByText('Fix the crash on start', { exact: true });
    const number = pullRequest.getByText('#4', { exact: true });
    await expectFollows(number, title, pullRequest);
    await expectFollows(age(pullRequest), number, pullRequest);
});

test("a project's list keeps the avatars and the age right after the title", async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    sample.world.issue({
        repository: SAMPLE_REPOSITORY,
        number: 6,
        title: 'Plan the release',
        foundBy: ['assigned'],
        projects: [{ project: sample.project, status: 'Todo' }],
        minutesAgo: 30,
    });
    await openTrackedWork(page, github, sample.world);
    await page.goto(SAMPLE_PROJECT_PATH);
    const project = new ProjectScreenHarness(page);
    await project.showProperties('People', 'Updated');

    const row = project.row('Plan the release');
    const login = SAMPLE_VIEWER.viewer.login;
    await expectFollows(avatar(row, login), row.getByText('Plan the release', { exact: true }), row);
    await expectFollows(age(row), avatar(row, login), row);
});

test("Draft reviews keep the age right after the pull request's number", async ({ page, github }) => {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    const drafted = world.pullRequest({
        repository: 'acme/web',
        number: 3,
        title: 'Retry polls on network errors',
        foundBy: ['authored'],
        minutesAgo: 5,
    });
    world.setPendingReview(drafted, { comments: 2, minutesAgo: 30 });
    await openMyWork(page, github, world);
    await page.goto('/pulls/drafts');

    const row = page.getByRole('region', { name: 'Draft reviews' }).getByRole('listitem');
    await expect(row).toHaveCount(1);
    const number = row.getByText('#3', { exact: true });
    await expectFollows(number, row.getByText('Retry polls on network errors', { exact: true }), row);
    await expectFollows(age(row), number, row);
});

test("a commit row's second line starts under its headline, and its author, age and short sha each follow the one before", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.history(SAMPLE_REPOSITORY, {
        commits: [
            { oid: 'm2', headline: 'docs: describe the setup', author: 'monalisa', minutesAgo: 240, parents: ['m1'] },
            { oid: 'm1', headline: 'Initial commit', author: 'monalisa', minutesAgo: 360 },
        ],
        branches: { main: 'm2' },
        tags: {},
    });
    const shell = await openTrackedWork(page, github, sample.world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.section('Issues')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('3');
    const graph = new CommitGraphHarness(page, SAMPLE_REPOSITORY);

    const row = graph.row('docs: describe the setup');
    // Until its pull request and checks are known the row holds a placeholder after the headline; this commit has
    // neither, so nothing follows the headline on its line.
    await expect(graph.mark(row, 'Pull request and checks not known yet')).toHaveCount(0);
    const headline = row.getByText('docs: describe the setup', { exact: true });
    // The second line: the branch, then the author's segment (avatar and name), the age and the short sha.
    const branch = row.getByText('main', { exact: true });
    const author = row.getByText('monalisa', { exact: true }).locator('..');
    await expect.poll(() => leftEdgeOffset(branch, headline)).toBeLessThanOrEqual(1);
    await expectFollows(author, branch, row);
    await expectFollows(age(row), author, row);
    await expectFollows(row.getByText('m2', { exact: true }), age(row), row);
});

test("a diff file header's thread count and size follow the file's name", async ({ page, github }) => {
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
        files: [{ path: 'src/poll.ts', before: 'const retries = 1;\n', after: 'const retries = 3;\n' }],
        threads: [{ id: 'T1', path: 'src/poll.ts', line: 1, comments: ['<p>Why three?</p>'] }],
    });
    const review = new ReviewScreenHarness(page);
    await page.goto('/acme/web/pull/3/files');
    await expect(review.code('const retries = 3;')).toBeVisible();

    const path = review.fileHeader('src/poll.ts');
    const header = path.locator('..');
    const threads = header.getByText('1 open', { exact: true });
    await expectFollows(threads, path, header);
    await expectFollows(header.getByText('+1', { exact: false }), threads, header);
});

test("a tracked repository's row in Settings keeps its counts right after its name", async ({ page, github }) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/settings');
    const list = new TrackedListScreenHarness(page);
    const name = SAMPLE_REPOSITORY.split('/')[1] ?? '';
    const row = list.row(SAMPLE_VIEWER.viewer.login, name);

    // The name, the badge saying who may see it, then the counts.
    const badge = row.getByText('public', { exact: true });
    await expectFollows(badge, row.getByText(name, { exact: true }), row);
    await expectFollows(row.getByText(/\d+ open/u), badge, row);
});

/**
 * `info` sits right after `before` (within the row's gap, not before it) and nowhere near the row's right edge.
 * Polled: a row settles after its marks and pictures arrive.
 */
async function expectFollows(info: Locator, before: Locator, row: Locator) {
    await expect.poll(() => measure(info, before, row)).toEqual({ follows: true, farFromEdge: true });
}

async function measure(info: Locator, before: Locator, row: Locator) {
    const [infoBox, beforeBox, rowBox] = await Promise.all([
        info.boundingBox(),
        before.boundingBox(),
        row.boundingBox(),
    ]);
    if (!infoBox || !beforeBox || !rowBox) {
        return null;
    }

    const gap = infoBox.x - (beforeBox.x + beforeBox.width);
    return {
        follows: gap >= -1 && gap <= MAX_GAP,
        farFromEdge: rowBox.x + rowBox.width - (infoBox.x + infoBox.width) > MIN_FROM_RIGHT_EDGE,
    };
}

/** How far apart the left edges of two pieces are: 0 when one starts right under the other. */
async function leftEdgeOffset(piece: Locator, other: Locator) {
    const [pieceBox, otherBox] = await Promise.all([piece.boundingBox(), other.boundingBox()]);
    if (!pieceBox || !otherBox) {
        return null;
    }

    return Math.abs(pieceBox.x - otherBox.x);
}

function avatar(row: Locator, login: string) {
    return row.getByRole('img', { name: login, exact: true }).last();
}

/** The age of a row: its first `time`. */
function age(row: Locator) {
    return row.locator('time').first();
}

function createWorld() {
    const world = new GitHubWorld(SAMPLE_VIEWER.viewer.login);
    world.pullRequest({
        repository: 'acme/api',
        number: 52,
        title: 'Add rate limit headers to the API',
        author: 'hubot',
        foundBy: ['reviewRequested'],
        minutesAgo: 5,
    });
    world.pullRequest({
        repository: 'acme/api',
        number: 48,
        title: 'Cache search results',
        foundBy: ['authored'],
        minutesAgo: 10,
    });
    world.issue({
        repository: 'octocat/hello-world',
        number: 3,
        title: 'Dark mode for the status bar',
        author: 'hubot',
        foundBy: ['mentioned'],
        minutesAgo: 120,
    });
    return world;
}
