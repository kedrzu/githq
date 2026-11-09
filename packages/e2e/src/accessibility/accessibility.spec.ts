import { expect, test } from '../fixtures.js';
import { BrokenWorkflowsScreenHarness } from '../harnesses/BrokenWorkflowsScreen.harness.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { DocsSiteHarness } from '../harnesses/DocsSite.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { NewIssueHarness } from '../harnesses/NewIssue.harness.js';
import { PickerHarness } from '../harnesses/Picker.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { SettingsScreenHarness } from '../harnesses/SettingsScreen.harness.js';
import { createSampleMergeableWork, FIRST_TITLE } from '../merge/sampleMergeableWork.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';
import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

import { expectAccessible } from './expectAccessible.js';

const ISSUE = 'Sign-in loops after the token expires';

// The screens as a stack of components no story assembles, and the states only a running app reaches. A story checks
// each component's own states; these don't repeat them.

test('the landing page, wide and on a phone', async ({ page }) => {
    await page.goto('/');
    await expect(new LandingHarness(page).root).toBeVisible();
    await expectAccessible(page, 'the landing page');

    await page.setViewportSize({ width: 390, height: 844 });
    await expectAccessible(page, 'the landing page on a phone');
});

test('the docs: the home page, an article and the "not found" page, wide and on a phone', async ({ page }) => {
    const docs = new DocsSiteHarness(page);
    for (const { path, state, shown } of [
        { path: '/docs/', state: 'the docs home', shown: docs.sectionCards.first() },
        { path: '/docs/getting-started/what-is-githq', state: 'a docs article', shown: docs.outline },
        { path: '/docs/no-such-page', state: 'the docs\' "not found" page', shown: docs.notFound },
    ]) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(path);
        await expect(shown).toBeVisible();
        await expectAccessible(page, state);

        await page.setViewportSize({ width: 390, height: 844 });
        await expectAccessible(page, `${state} on a phone`);
    }
});

test('the first sign-in', async ({ page, github }) => {
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: SAMPLE_VIEWER.viewer.login });
    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);
    await expect(new FirstSignInHarness(page).continueButton).toBeVisible();
    await expectAccessible(page, 'the first sign-in');
});

test('my work, with the command menu, the new issue dialog and the account menu over it', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    await expectAccessible(page, 'my work');

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await expect(menu.option(/./u).first()).toBeVisible();
    await expectAccessible(page, 'the command menu');
    await page.keyboard.press('Escape');

    const newIssue = new NewIssueHarness(page);
    await newIssue.open();
    await expectAccessible(page, 'the new issue dialog');
    // The first Escape leaves the open repository field, the next the dialog.
    await expect(async () => {
        await page.keyboard.press('Escape');
        await expect(newIssue.title).toBeHidden({ timeout: 500 });
    }).toPass();

    await shell.account(SAMPLE_VIEWER.viewer.login).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expectAccessible(page, 'the account menu', '[role="menu"]');
    await page.keyboard.press('Escape');

    await myWork.row(ISSUE).click();
    const item = new ItemViewHarness(page);
    await expect(item.projectField('Status')).toBeVisible();
    await expectAccessible(page, 'an item in the panel');

    await page.keyboard.press('s');
    const status = new PickerHarness(page, 'Status');
    await expect(status.option('In Progress')).toBeVisible();
    await expectAccessible(page, 'a picker', '[role="dialog"]');
});

test('a toast', async ({ page, github }) => {
    const sample = createSampleEditableWork();
    sample.world.failEdit(sample.issue, 'AddLabels', {
        kind: 'refuse',
        message: 'Resource not accessible by integration',
    });
    const { myWork, shell } = await openMyWork(page, github, sample.world);
    await myWork.row(ISSUE).click();
    await expect(new ItemViewHarness(page).property('Labels')).toBeVisible();

    await page.keyboard.press('l');
    const labels = new PickerHarness(page, 'Labels');
    await labels.choose('bug');
    await labels.close();

    await expect(shell.toasts.first()).toBeVisible();
    await expectAccessible(page, 'a toast');
});

test('the merge panel', async ({ page, github }) => {
    const sample = createSampleMergeableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    await selectRow(myWork, FIRST_TITLE);
    await page.keyboard.press('Shift+M');
    await expect(new MergePanelHarness(page).line('Commit')).toBeVisible();
    await expectAccessible(page, 'the merge panel');
});

test('a repository, a project as a list and a board, and the sidebar’s context menu', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, sample.world);

    await shell.tracked(SAMPLE_REPOSITORY).click();
    await expect(new RepositoryScreenHarness(page).section('Issues')).toHaveAttribute('aria-pressed', 'true');
    await expectAccessible(page, 'a repository');

    await shell.openTrackedMenu(SAMPLE_REPOSITORY);
    await expectAccessible(page, 'the sidebar’s context menu', '[role="menu"]');
    await page.keyboard.press('Escape');

    await shell.tracked(SAMPLE_PROJECT).click();
    const project = new ProjectScreenHarness(page);
    await expect(project.tabs.first()).toBeVisible();
    await expectAccessible(page, 'a project');

    await project.tab('Board').click();
    await expect(project.group('Todo')).toBeVisible();
    await expectAccessible(page, 'a project’s board');
});

test('a repository browsed, as a list and a board, the search of repositories, and one GitHub does not show', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.repository('hubot/tools', { description: 'Tools for the release' });
    for (const number of Array.from({ length: 101 }, (_, index) => index + 1)) {
        sample.world.issue({ repository: 'hubot/tools', number, title: `Issue ${number}`, minutesAgo: number + 10 });
    }

    await openTrackedWork(page, github, sample.world);

    const repository = new RepositoryScreenHarness(page);
    await page.goto('/hubot/tools');
    await expect(repository.readCount).toHaveText('100 of 101');
    await expectAccessible(page, 'a repository browsed');

    await repository.layout('Board').click();
    await expect(repository.readMore).toBeVisible();
    await expectAccessible(page, 'a repository browsed, as a board');

    const menu = new CommandMenuHarness(page);
    await menu.openRepositorySearch();
    await menu.field.pressSequentially('tools');
    await expect(menu.option(/^hubot\/tools/u)).toBeVisible();
    await expectAccessible(page, 'the search of repositories');

    await page.goto('/hubot/hidden');
    await expect(repository.notShown).toBeVisible();
    await expectAccessible(page, 'a repository GitHub does not show');
});

test('the commit graph', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    sample.world.history(SAMPLE_REPOSITORY, {
        commits: [
            { oid: 'f1', headline: 'feat: sign in', author: 'hubot', minutesAgo: 60, parents: ['m1'], ci: 'FAILURE' },
            { oid: 'm1', headline: 'chore: start', author: 'monalisa', minutesAgo: 120, parents: [] },
        ],
        branches: { main: 'm1', feature: 'f1' },
    });
    const shell = await openTrackedWork(page, github, sample.world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const repository = new RepositoryScreenHarness(page);
    await repository.section('Commits').click();
    await expect(page.getByText('feat: sign in').first()).toBeVisible();
    await expectAccessible(page, 'the commit graph');
});

test('every screen of Settings', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    await openTrackedWork(page, github, sample.world);
    await page.goto('/settings');
    const settings = new SettingsScreenHarness(page);
    await expect(settings.heading).toBeVisible();

    for (const section of ['Account', 'Repositories', 'Projects', 'Display', 'Code review', 'Sync settings'] as const) {
        await settings.section(section).click();
        await expect(settings.section(section)).toHaveAttribute('aria-pressed', 'true');
        await expectAccessible(page, `Settings: ${section}`);
    }
});

test('the broken workflows', async ({ page, github }) => {
    const { world } = createSampleTrackedWork();
    world.workflow({
        repository: SAMPLE_REPOSITORY,
        name: 'Deploy',
        runs: [
            { conclusion: 'success', minutesAgo: 600 },
            { conclusion: 'failure', minutesAgo: 30 },
        ],
    });
    const shell = await openTrackedWork(page, github, world);
    await shell.brokenWorkflows.click();
    await expect(new BrokenWorkflowsScreenHarness(page).group('New')).toContainText('Deploy');
    await expectAccessible(page, 'the broken workflows');
});
