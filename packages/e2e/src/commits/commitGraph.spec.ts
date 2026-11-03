import { expect, test } from '../fixtures.js';
import type { GitHubWorld } from '../github/GitHubWorld.js';
import { CommitGraphHarness } from '../harnesses/CommitGraph.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

/** The commit operations, in the order the graph asks them on a first open. */
const COMMIT_OPERATIONS = new Set(['RepositoryCommitRefs', 'CommitHistories', 'CommitStates']);

test("git-client D9, D18, CH3: Commits on 3 opens GitHub's address of the history, draws the graph with its branches, tag, pull requests and failing CI, and J moves the cursor", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    giveHistory(sample.world, SAMPLE_REPOSITORY);
    const shell = await openTrackedWork(page, github, sample.world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.section('Issues')).toHaveAttribute('aria-pressed', 'true');
    // Nothing of the history is asked before Commits is shown.
    expect(github.graphqlCalls.filter(call => COMMIT_OPERATIONS.has(call.name))).toEqual([]);

    await page.keyboard.press('3');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/commits`);
    const graph = new CommitGraphHarness(page, SAMPLE_REPOSITORY);
    // The default branch first, then the branch `feat/login` joined to it.
    await expect(graph.rows).toHaveText([
        /feat\/login\s*feat: sign in with GitHub/,
        /main\s*Merge branch 'release\/1\.0'/,
        /release\/1\.0\s*v1\.0\.0\s*fix: export the CSV header/,
        /docs: describe the setup/,
        /chore: set up the build/,
        /Initial commit/,
    ]);
    await expect(graph.beginning).toHaveText(`The beginning of ${SAMPLE_REPOSITORY}'s history`);

    // The pull request and CI state of the rows on screen.
    const failing = graph.row('feat: sign in with GitHub');
    await expect(graph.mark(failing, 'Open pull request')).toBeVisible();
    await expect(failing).toContainText('#5');
    await expect(graph.mark(failing, 'Checks failing')).toBeVisible();
    const fix = graph.row('fix: export the CSV header');
    await expect(graph.mark(fix, 'Merged pull request')).toBeVisible();
    await expect(graph.mark(fix, 'Checks passing')).toBeVisible();
    const docs = graph.row('docs: describe the setup');
    await expect(docs).not.toContainText('#');
    await expect(graph.mark(docs, 'Pull request and checks not known yet')).toHaveCount(0);

    // None of the list's tools; GitHub's own history a click away; the status bar tells how fresh the graph is.
    await expect(repository.groupingButton).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('link', { name: 'Open on GitHub' })).toHaveAttribute(
        'href',
        `https://github.com/${SAMPLE_REPOSITORY}/commits`,
    );
    await expect(shell.statusBar).toContainText('Up to date');

    // A first open: the cursor stays on the default branch's newest, the branch that arrived later above it (D19).
    await expect(graph.cursorRow).toContainText("Merge branch 'release/1.0'");
    await page.keyboard.press('k');
    await expect(graph.cursorRow).toContainText('feat: sign in with GitHub');
    await page.keyboard.press('j');
    await expect(graph.cursorRow).toContainText("Merge branch 'release/1.0'");
    await graph.row('chore: set up the build').click();
    await expect(graph.cursorRow).toContainText('chore: set up the build');

    // Asked of GitHub through the graph's store alone: the refs once, the unjoined branch once, the states.
    const asked = github.graphqlCalls.filter(call => COMMIT_OPERATIONS.has(call.name)).map(call => call.name);
    expect(asked.filter(name => name === 'RepositoryCommitRefs')).toHaveLength(1);
    expect(asked.filter(name => name === 'CommitHistories')).toHaveLength(1);
    expect(asked).toContain('CommitStates');

    // The repository's link now opens on Commits.
    await shell.myWorkLink('My work').click();
    await expect(shell.tracked(SAMPLE_REPOSITORY)).toHaveAttribute('href', `/${SAMPLE_REPOSITORY}/commits`);
});

test('git-client D11, D20, CH37: an untracked repository shows Commits in full at its GitHub address, and its Issues say its commits need no tracking', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    giveHistory(sample.world, 'hubot/tools');
    await openTrackedWork(page, github, sample.world);

    await page.goto('/hubot/tools/commits');
    const graph = new CommitGraphHarness(page, 'hubot/tools');
    await expect(graph.rows).toHaveCount(6);
    await expect(graph.mark(graph.row('feat: sign in with GitHub'), 'Checks failing')).toBeVisible();
    await expect(page.getByRole('main').getByText('not tracked', { exact: true })).toBeVisible();
    const repository = new RepositoryScreenHarness(page);
    await expect(repository.notTracked('hubot/tools')).toHaveCount(0);
    // Nothing about its items is asked on Commits.
    expect(github.graphqlCalls.filter(call => call.name === 'RepositoryOpenCounts')).toEqual([]);

    await page.keyboard.press('1');
    await expect(page).toHaveURL('/hubot/tools/issues');
    await expect(repository.notTracked('hubot/tools')).toContainText(
        "Its commits don't need tracking: 3 opens them in full.",
    );
});

test('CH38: an empty repository says it has no commits yet', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    await openTrackedWork(page, github, sample.world);

    await page.goto(`/${SAMPLE_REPOSITORY}/commits`);
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { name: 'No commits yet' })).toBeVisible();
    await expect(main).toContainText(
        `${SAMPLE_REPOSITORY} is empty on GitHub. Commits appear here after the first push.`,
    );
});

/**
 * A small history: `main` with a release branch merged back (tagged `v1.0.0`, from a merged pull request whose CI
 * passed), and `feat/login` a commit ahead of it, from an open pull request whose CI fails.
 */
function giveHistory(world: GitHubWorld, repository: string) {
    world.history(repository, {
        commits: [
            {
                oid: 'f1',
                headline: 'feat: sign in with GitHub',
                author: 'hubot',
                minutesAgo: 60,
                parents: ['m4'],
                pullRequest: { number: 5, state: 'OPEN', title: 'Sign in with GitHub' },
                ci: 'FAILURE',
            },
            {
                oid: 'm4',
                headline: "Merge branch 'release/1.0'",
                author: 'monalisa',
                minutesAgo: 120,
                parents: ['m3', 'r1'],
            },
            {
                oid: 'r1',
                headline: 'fix: export the CSV header',
                author: 'monalisa',
                minutesAgo: 180,
                parents: ['m2'],
                pullRequest: { number: 4, state: 'MERGED', title: 'Export the CSV header' },
                ci: 'SUCCESS',
            },
            { oid: 'm3', headline: 'docs: describe the setup', author: 'monalisa', minutesAgo: 240, parents: ['m2'] },
            { oid: 'm2', headline: 'chore: set up the build', author: 'monalisa', minutesAgo: 300, parents: ['m1'] },
            { oid: 'm1', headline: 'Initial commit', author: 'monalisa', minutesAgo: 360 },
        ],
        branches: { main: 'm4', 'release/1.0': 'r1', 'feat/login': 'f1' },
        tags: { 'v1.0.0': 'r1' },
    });
}
