import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import {
    createSampleTrackedWork,
    SAMPLE_PROJECT,
    SAMPLE_PROJECT_PATH,
    SAMPLE_REPOSITORY,
} from '../tracking/sampleTrackedWork.js';

test('⌘K jumps to an item found by its title in the local copy, and to a project', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    await openTrackedWork(page, github, sample.world);
    const menu = new CommandMenuHarness(page);

    await menu.open();
    await menu.field.pressSequentially('remember the side');
    await expect(menu.option(/Remember the sidebar width/)).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(menu.root).toBeHidden();
    await expect(new ItemViewHarness(page).title).toHaveText('Remember the sidebar width');

    await page.keyboard.press('Escape');
    await menu.run(SAMPLE_PROJECT);
    await expect(page).toHaveURL(SAMPLE_PROJECT_PATH);
});

test('⌘K sets the Status of two selected items at once, by typing the value', async ({ page, github }) => {
    const sample = createSampleTrackedWork();
    const shell = await openTrackedWork(page, github, sample.world);
    await shell.tracked(SAMPLE_PROJECT).click();
    const project = new ProjectScreenHarness(page);
    await project.tab('Board').click();
    await expect(project.rows('Todo')).toHaveCount(3);

    // Away from the tabs, so the keys are the board's: the first two cards of Todo selected together.
    await project.group('Todo').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('j');
    await page.keyboard.press('x');
    await page.keyboard.press('Shift+ArrowDown');

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await expect(menu.root.getByText('2 items', { exact: true }).first()).toBeVisible();
    await menu.field.pressSequentially('in prog');
    await expect(menu.option(/Set status → In Progress/)).toBeVisible();
    await page.keyboard.press('Enter');

    await expect
        .poll(() => [
            sample.world.stateOf(sample.setupIssue).projects,
            sample.world.stateOf(sample.collapseIssue).projects,
        ])
        .toEqual([{ [SAMPLE_PROJECT]: 'In Progress' }, { [SAMPLE_PROJECT]: 'In Progress' }]);
    await expect(project.rows('In Progress')).toHaveCount(3);
    expect(sample.world.edits.map(edit => edit.mutation)).toEqual(['SetProjectFieldValue', 'SetProjectFieldValue']);
});

test('E1: the view’s options are actions — ⇧V shows it as a board, "Order by…" sets the order; `>` finds actions only', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const menu = new CommandMenuHarness(page);

    await menu.open();
    await expect(menu.option(/^Show as board/)).toBeVisible();
    await expect(menu.option(/^Group by…/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu.root).toBeHidden();

    await expect(async () => {
        await page.keyboard.press('Shift+V');
        await expect(myWork.layout('Board')).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    }).toPass();

    await menu.open();
    await menu.field.pressSequentially('> order');
    await expect(menu.option(/^Order by…/)).toBeVisible();
    await expect(menu.root.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await menu.field.pressSequentially('title');
    await page.keyboard.press('Enter');
    await expect(menu.root).toBeHidden();

    await menu.open();
    await menu.field.pressSequentially('> order');
    await expect(menu.option(/^Order by…\s*Title/)).toBeVisible();
});

test("⌘K on a tracked repository's view groups its sections, Open on GitHub, Copy link and Settings under its name, and a section runs as its tab", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const menu = new CommandMenuHarness(page);

    await menu.open();
    await expect(menu.chip(SAMPLE_REPOSITORY)).toBeVisible();
    await expect(menu.group(SAMPLE_REPOSITORY).getByRole('option')).toHaveText([
        'Issues1',
        'Pull requests2',
        'Commits3',
        'Workflows4',
        `Open on GitHub${SAMPLE_REPOSITORY}`,
        'Copy link',
        'Repository settings',
    ]);

    await menu.option(/^Pull requests/u).click();
    await expect(menu.root).toBeHidden();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);
    await expect(new RepositoryScreenHarness(page).section('Pull requests')).toHaveAttribute('aria-pressed', 'true');
});

test("⌘K filters a repository's pull requests by state, in the submenu or by typing the state, and its issues keep their own", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const repository = new RepositoryScreenHarness(page);
    const menu = new CommandMenuHarness(page);
    await repository.section('Pull requests').click();
    await expect(repository.row('Fix the crash on start')).toBeVisible();

    await menu.run('filter by state');
    await expect(menu.option(/^Open and closed/)).toBeVisible();
    await menu.field.pressSequentially('closed');
    await menu.option(/^Closed/).click();
    await expect(menu.root).toBeHidden();
    await expect(repository.row('Fix the crash on start')).toBeHidden();

    await menu.run('open and closed');
    await expect(menu.root).toBeHidden();
    await expect(repository.row('Fix the crash on start')).toBeVisible();

    await repository.section('Issues').click();
    await expect(repository.row('Crash on start')).toBeVisible();
    await expect(repository.row('Old crash')).toBeHidden();
});

test('⌘K in a repository: "settings" and Enter opens the app\'s Settings, the repository\'s is its own line', async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    const menu = new CommandMenuHarness(page);

    await menu.run('settings');
    await expect(page).toHaveURL('/settings');

    await page.goBack();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    await menu.run('repository settings');
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings`);
});

test("⌘K on an untracked repository's view has neither Workflows nor Settings in its group", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/acme/web');
    await expect(new RepositoryScreenHarness(page).notTrackedChip).toBeVisible();
    const menu = new CommandMenuHarness(page);

    await menu.open();
    const group = menu.group('acme/web');
    await expect(group.getByRole('option', { name: /^Issues/u })).toBeVisible();
    await expect(group.getByRole('option', { name: /^Open on GitHub/u })).toBeVisible();
    await expect(group.getByRole('option', { name: /^Workflows/u })).toHaveCount(0);
    await expect(group.getByRole('option', { name: /^Repository settings/u })).toHaveCount(0);
});

test('⌘K with an item opened over a repository’s list runs a section without closing the item', async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await shell.tracked(SAMPLE_REPOSITORY).click();
    const repository = new RepositoryScreenHarness(page);
    // My work lists the same issue: the click must land on the repository's list.
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/issues`);
    await expect(repository.section('Issues')).toHaveAttribute('aria-pressed', 'true');
    await repository.row('Crash on start').click();
    const item = new ItemViewHarness(page);
    await expect(item.title).toHaveText('Crash on start');
    const pane = new URL(page.url()).search;
    expect(pane).toContain('pane=issue');

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('pull requests');
    await expect(menu.group(SAMPLE_REPOSITORY).getByRole('option').first()).toHaveText(/^Pull requests/u);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls${pane}`);
    await expect(repository.section('Pull requests')).toHaveAttribute('aria-pressed', 'true');
    await expect(item.title).toHaveText('Crash on start');
});

test("⌘K on an item's page has its chip and its repository's group, Commits goes to the repository's history, and ⌫ steps out to the repository and then to none", async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.history(SAMPLE_REPOSITORY, {
        commits: [{ oid: 'a', headline: 'feat: start', author: 'octocat', minutesAgo: 60 }],
        branches: { main: 'a' },
    });
    await openTrackedWork(page, github, sample.world);
    await page.goto(`/${SAMPLE_REPOSITORY}/issues/1`);
    await expect(new ItemViewHarness(page).title).toHaveText('Crash on start');
    const menu = new CommandMenuHarness(page);

    await menu.open();
    await expect(menu.chip(/#1\b/u)).toBeVisible();
    await expect(menu.group(SAMPLE_REPOSITORY)).toBeVisible();

    await page.keyboard.press('Backspace');
    await expect(menu.chip(SAMPLE_REPOSITORY)).toBeVisible();
    await expect(menu.group(SAMPLE_REPOSITORY)).toBeVisible();

    await page.keyboard.press('Backspace');
    await expect(menu.chip(SAMPLE_REPOSITORY)).toHaveCount(0);
    await expect(menu.group(SAMPLE_REPOSITORY)).toHaveCount(0);

    await page.keyboard.press('Escape');
    await menu.open();
    await menu
        .group(SAMPLE_REPOSITORY)
        .getByRole('option', { name: /^Commits/u })
        .click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/commits`);
});
