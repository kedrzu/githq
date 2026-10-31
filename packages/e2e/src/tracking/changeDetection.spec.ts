import type { GitHubGraphQLCall, GitHubMock } from '../github/GitHubMock.js';
import { expect, test } from '../fixtures.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';

import { openTrackedWork } from './openTrackedWork.js';
import {
    createSampleTrackedWork,
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_PATH,
    SAMPLE_REPOSITORY,
} from './sampleTrackedWork.js';

/** Where the app polls the sample's repository and project for changes. */
const REPOSITORY_POLL = `/repos/${SAMPLE_REPOSITORY}/issues`;
const PROJECT_POLL = '/users/octocat/projectsV2/1';

test('while nothing changes, the tracked repository and project are polled for free and GitHub is asked nothing else; a change shows up after the next poll, and only what changed is read again', async ({
    page,
    github,
}) => {
    // Time runs as usual, and the minute to the next poll can be skipped.
    await page.clock.install();
    const sample = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, sample.world);
    // Right after the download, both are polled once: what changed while it ran is read.
    await expect.poll(() => findPoll(github, PROJECT_POLL, 200)).toBe(true);
    await expect.poll(() => github.graphqlCalls.some(call => isNarrowedRead(call))).toBe(true);
    await expect(shell.statusBar).toContainText('Up to date');

    const sent = github.graphqlCalls.length;
    const polled = github.restCalls.length;
    await page.clock.fastForward('01:01');
    await expect.poll(() => findPoll(github, REPOSITORY_POLL, 304, polled)).toBe(true);
    await expect.poll(() => findPoll(github, PROJECT_POLL, 304, polled)).toBe(true);
    expect(github.graphqlCalls.slice(sent)).toEqual([]);

    // An issue of the repository is renamed on GitHub: the next poll reads it alone again.
    const repository = new RepositoryScreenHarness(page);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    await expect(repository.row('Add a dark theme')).toBeVisible();
    // Opened, the view reads what may be set in the repository.
    await expect.poll(() => github.graphqlCalls.some(call => call.name === 'RepositoryMetadata')).toBe(true);
    const beforeRename = github.graphqlCalls.length;
    sample.world.retitle(sample.themeIssue, 'Add a dark and a light theme');
    await page.clock.fastForward('01:01');
    await expect(repository.row('Add a dark and a light theme')).toBeVisible();
    expect(github.graphqlCalls.slice(beforeRename)).toEqual([
        { name: 'ItemsByIds', variables: { ids: [sample.themeIssue] } },
    ]);

    // An item of the project moves on GitHub: the next poll reads the project's fields and views and the items
    // changed since the day before — not all of them.
    const project = new ProjectScreenHarness(page);
    await shell.tracked(SAMPLE_PROJECT).click();
    await expect(page).toHaveURL(SAMPLE_PROJECT_PATH);
    await expect(project.row('Collapse the sidebar on narrow screens')).toBeVisible();
    const beforeMove = github.graphqlCalls.length;
    sample.world.setStatus(sample.collapseIssue, sample.project, 'Done');
    await page.clock.fastForward('01:01');
    // "Backlog" leaves out what is done.
    await expect(project.row('Collapse the sidebar on narrow screens')).toBeHidden();
    const reads = github.graphqlCalls.slice(beforeMove);
    expect(reads.map(call => call.name)).toEqual(['ProjectSchema', 'ProjectItems']);
    expect(reads.every(call => call.name !== 'ProjectItems' || isNarrowedRead(call))).toBe(true);
});

/** Whether the mock answered a poll of `path` with `status`, after its first `after` REST calls. */
function findPoll(github: GitHubMock, path: string, status: number, after = 0) {
    return github.restCalls.slice(after).some(call => call.url.pathname === path && call.status === status);
}

/** A project's re-read of only the items updated since a day: `ProjectItems` with `updated:>=YYYY-MM-DD`. */
function isNarrowedRead(call: GitHubGraphQLCall) {
    return call.name === 'ProjectItems' && /^updated:>=\d{4}-\d{2}-\d{2}$/.test(String(call.variables.query));
}
