import { expect, test } from '../fixtures.js';
import type { GitHubWorld } from '../github/GitHubWorld.js';
import { CommitGraphHarness } from '../harnesses/CommitGraph.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
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

test('git-client D17, CH45: the divider dragged with the mouse: as far as two lanes and every lane, the label up meanwhile, kept across a reload, and a double-click resets it', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    // Five branches side by side off one commit, their tips newest.
    sample.world.history(SAMPLE_REPOSITORY, {
        commits: [
            ...['a', 'b', 'c', 'd', 'e'].map((oid, index) => ({
                oid,
                headline: `Commit ${oid}`,
                author: 'monalisa',
                minutesAgo: 10 + index,
                parents: ['root'],
            })),
            { oid: 'root', headline: 'Initial commit', author: 'monalisa', minutesAgo: 100, parents: [] },
        ],
        branches: { main: 'a', 'b/x': 'b', 'c/x': 'c', 'd/x': 'd', 'e/x': 'e' },
    });
    await openTrackedWork(page, github, sample.world);
    await page.goto(`/${SAMPLE_REPOSITORY}/commits`);
    const graph = new CommitGraphHarness(page, SAMPLE_REPOSITORY);
    await expect(graph.rows).toHaveCount(6);
    const every = await graph.divider.getAttribute('aria-valuemax');
    await expect(graph.divider).toHaveAttribute('aria-valuenow', String(every));

    await graph.dragDivider(-400, async () => {
        await expect(graph.divider).toHaveText(`2 of ${every} lanes`);
    });
    await expect(graph.divider).toHaveAttribute('aria-valuenow', '2');
    await expect(graph.divider).not.toContainText('lanes');
    await page.reload();
    await expect(graph.rows).toHaveCount(6);
    await expect(graph.divider).toHaveAttribute('aria-valuenow', '2');

    // Past every lane it goes no further.
    const before = await graph.divider.boundingBox();
    await graph.dragDivider(600);
    await expect(graph.divider).toHaveAttribute('aria-valuenow', String(every));
    const after = await graph.divider.boundingBox();
    expect((after?.x ?? 0) - (before?.x ?? 0)).toBe((Number(every) - 2) * 12);

    await graph.dragDivider(-400);
    await expect(graph.divider).toHaveAttribute('aria-valuenow', '2');
    await graph.divider.dblclick({ position: { x: 4, y: 10 } });
    await expect(graph.divider).toHaveAttribute('aria-valuenow', String(every));
    await page.reload();
    await expect(graph.rows).toHaveCount(6);
    await expect(graph.divider).toHaveAttribute('aria-valuenow', String(every));
});

test('git-client D12, D15, CH25, CH26: B filters the branches and tags, typed letters stay in the field, Enter goes to the commit and Esc back to the graph', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    giveHistory(sample.world, SAMPLE_REPOSITORY);
    await openTrackedWork(page, github, sample.world);
    await page.goto(`/${SAMPLE_REPOSITORY}/commits`);
    const graph = new CommitGraphHarness(page, SAMPLE_REPOSITORY);
    await expect(graph.rows).toHaveCount(6);

    // The default branch first, then branches and tags newest first, each with its tip's pull request and CI.
    await expect(graph.refList.getByRole('option')).toHaveText([
        /main\s*default/,
        /feat\/login\s*#5/,
        /release\/1\.0\s*#4/,
        /v1\.0\.0/,
    ]);
    await expect(graph.mark(graph.refRow('feat/login'), 'Checks failing')).toBeVisible();
    await expect(graph.cursorRow).toContainText("Merge branch 'release/1.0'");

    await page.keyboard.press('b');
    await expect(graph.refFilter).toBeFocused();
    await page.keyboard.type('rel');
    // Letters a graph would take are typed, and the cursor stays.
    await expect(graph.refList.getByRole('option')).toHaveText([/release\/1\.0/]);
    await expect(graph.selectedRef).toContainText('release/1.0');
    await expect(graph.refList).toContainText('No tag matches "rel".');
    await page.keyboard.press('j');
    await expect(graph.refFilter).toHaveValue('relj');
    await expect(graph.cursorRow).toContainText("Merge branch 'release/1.0'");
    await page.keyboard.press('Backspace');

    await page.keyboard.press('Enter');
    // CH26: back in the graph, the filter clear and nothing selected in the list.
    await expect(graph.cursorRow).toContainText('fix: export the CSV header');
    await expect(graph.refFilter).toHaveValue('');
    await expect(graph.root).toBeFocused();
    await expect(graph.root).toHaveCSS('outline-style', 'none');
    await expect(graph.selectedRef).toHaveCount(0);
    await page.keyboard.press('j');
    await expect(graph.cursorRow).toContainText('docs: describe the setup');

    // The header's tool does as B does.
    await graph.refListTool.click();
    await expect(graph.refFilter).toBeFocused();
});

test("git-client D13, D16, CH18, CH27-CH29: Enter opens a commit's details in the list's place; J and P move through the graph with them, Shift+Enter opens its pull request over them, O opens GitHub and Esc closes in order", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    giveHistory(sample.world, SAMPLE_REPOSITORY);
    await openTrackedWork(page, github, sample.world);
    await page.goto(`/${SAMPLE_REPOSITORY}/commits`);
    const graph = new CommitGraphHarness(page, SAMPLE_REPOSITORY);
    await expect(graph.rows).toHaveCount(6);
    await expect(graph.cursorRow).toContainText("Merge branch 'release/1.0'");

    await page.keyboard.press('Enter');
    await expect(graph.detailsHeadline).toHaveText("Merge branch 'release/1.0'");
    await expect(graph.refList).toBeHidden();
    await expect(graph.details.getByRole('heading', { name: 'Parents' })).toBeVisible();
    await expect(graph.details).toContainText('Brings the release back.');

    // The second parent, selected in the graph.
    await page.keyboard.press('Shift+P');
    await expect(graph.cursorRow).toContainText('fix: export the CSV header');
    await expect(graph.detailsHeadline).toHaveText('fix: export the CSV header');
    await expect(graph.details.getByText('Passing')).toBeVisible();

    // O: GitHub in a new tab, on this commit.
    github.web(`/${SAMPLE_REPOSITORY}/commit/r1`, () => ({ status: 200, body: '<title>Commit</title>' }));
    const popup = page.waitForEvent('popup');
    await page.keyboard.press('o');
    const gitHubTab = await popup;
    expect(gitHubTab.url()).toBe(`https://github.com/${SAMPLE_REPOSITORY}/commit/r1`);
    await gitHubTab.close();

    // The pull request in the details' place; Esc is the item's first and comes back to the commit.
    const item = new ItemViewHarness(page);
    await page.keyboard.press('Shift+Enter');
    await expect(item.title).toHaveText('Fix the crash on start');
    await expect(graph.details).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(item.root).toHaveCount(0);
    await expect(graph.detailsHeadline).toHaveText('fix: export the CSV header');

    await page.keyboard.press('j');
    await expect(graph.detailsHeadline).toHaveText('docs: describe the setup');
    await page.keyboard.press('p');
    await expect(graph.detailsHeadline).toHaveText('chore: set up the build');
    await expect(graph.cursorRow).toContainText('chore: set up the build');

    await page.keyboard.press('Escape');
    await expect(graph.details).toHaveCount(0);
    await expect(graph.refList).toBeVisible();
    await expect(graph.root).toBeFocused();
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
                body: 'Brings the release back.',
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
                pullRequest: { number: 4, state: 'MERGED', title: 'Fix the crash on start' },
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
