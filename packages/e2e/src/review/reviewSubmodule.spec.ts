import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { ReviewScreenHarness } from '../harnesses/ReviewScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

import { answerReview } from './answerReview.js';
import type { SampleReviewFile, SampleReviewSubmodule } from './answerReview.js';

const REVIEW_ADDRESS = '/acme/web/pull/15/files';
const ENGINE = 'vendor/engine';
const ENGINE_REPOSITORY = 'acme/engine';
const BEFORE = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const AFTER = 'f9e8d7c6b5a40312a1b2c3d4e5f6071829304152';
const CLIENT: SampleReviewFile = {
    path: 'src/api/client.ts',
    before: `export const client = 1;\n`,
    after: `export const client = 2;\n`,
};
const ENGINE_PULL_REQUEST = 'Batch the flushes of the sync engine';

test('a submodule moved forward shows its commits, the files they change and the open pull request with the new commit, which opens in githq', async ({
    page,
    github,
}) => {
    const review = await openReview(page, github, {
        before: BEFORE,
        after: AFTER,
        repository: ENGINE_REPOSITORY,
        commits: [
            { oid: '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', subject: 'Batch the flushes', author: 'monalisa' },
            { oid: '2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', subject: 'Raise the batch size', author: 'hubot' },
            { oid: '3333333ccccccccccccccccccccccccccccccccc', subject: 'Log a slow flush', author: 'monalisa' },
        ],
        files: [
            { path: 'src/flush.ts', additions: 12, deletions: 3 },
            { path: 'src/batch.ts', additions: 4, deletions: 0 },
        ],
        pullRequests: [{ number: 7, title: ENGINE_PULL_REQUEST }],
    });

    await expect(review.fileRow('engine')).toContainText('submodule');
    await expect(review.fileRow('engine')).not.toContainText('binary');
    await expect(review.diff.getByText('a1b2c3d → f9e8d7c', { exact: true })).toBeVisible();
    await expect(review.diff.getByText('3 commits ahead', { exact: true })).toBeVisible();
    await expect(review.diff.getByText(/Binary file/)).toHaveCount(0);

    const commits = review.diff.getByRole('list', { name: 'Commits' });
    await expect(commits.getByRole('link')).toHaveText([
        'Batch the flushes',
        'Raise the batch size',
        'Log a slow flush',
    ]);
    const files = review.diff.getByRole('list', { name: 'Files' }).getByRole('listitem');
    await expect(files.filter({ hasText: 'src/flush.ts' })).toContainText(/\+12\s*−3/);
    await expect(files.filter({ hasText: 'src/batch.ts' })).toContainText(/\+4\s*−0/);

    await review.diff
        .getByRole('list', { name: 'Pull requests with the new commit' })
        .getByRole('link', { name: ENGINE_PULL_REQUEST })
        .click();
    await expect(new ItemViewHarness(page).title).toHaveText(ENGINE_PULL_REQUEST);
});

test("a submodule whose repository GitHub can't compare says so with its path and both commits, the other files still diffed", async ({
    page,
    github,
}) => {
    const review = await openReview(page, github, {
        before: BEFORE,
        after: AFTER,
        repository: ENGINE_REPOSITORY,
        commits: null,
    });

    await expect(review.diff.getByText("This submodule's history can't be read", { exact: true })).toBeVisible();
    await expect(review.diff.getByText(ENGINE, { exact: true }).last()).toBeVisible();
    await expect(review.diff.getByText('a1b2c3d → f9e8d7c', { exact: true })).toBeVisible();
    await expect(review.diff.getByText(/Binary file/)).toHaveCount(0);
    await expect(review.code('export const client = 2;')).toBeVisible();
});

/** Signs in and opens a review of a client change and a submodule pointer moved forward, its repository's pull request in the world. */
async function openReview(
    page: Parameters<typeof openMyWork>[0],
    github: GitHubMock,
    submodule: SampleReviewSubmodule,
) {
    const { world } = createSampleMyWork();
    world.pullRequest({ repository: ENGINE_REPOSITORY, number: 7, title: ENGINE_PULL_REQUEST, minutesAgo: 30 });
    await openMyWork(page, github, world);
    answerReview(github, {
        repository: 'acme/web',
        number: 15,
        files: [CLIENT, { path: ENGINE, before: null, after: null, submodule }],
    });
    const review = new ReviewScreenHarness(page);
    await page.goto(REVIEW_ADDRESS);
    await expect(review.fileRow('client.ts')).toBeVisible();
    return review;
}
