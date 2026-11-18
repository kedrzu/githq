import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { signIn } from '../session.js';
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

test('the empty ⌘K lists the projects, repositories and items opened lately under "Recent", newest first, not the screen shown, and after a reload; a phone too', async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const menu = new CommandMenuHarness(page);
    const item = new ItemViewHarness(page);
    const recent = menu.group('Recent').getByRole('option');

    await menu.run(SAMPLE_PROJECT);
    await expect(page).toHaveURL(SAMPLE_PROJECT_PATH);
    await menu.run('remember the side');
    await expect(item.title).toHaveText('Remember the sidebar width');
    await page.keyboard.press('Escape');
    await expect(item.title).toBeHidden();
    await menu.run(SAMPLE_REPOSITORY);
    await expect(page).toHaveURL(new RegExp(`^[^?]*/${SAMPLE_REPOSITORY}`, 'u'));

    // On the repository's view, it is not where to go.
    await menu.open();
    await expect(recent).toHaveText([/^Remember the sidebar width/u, new RegExp(`^${SAMPLE_PROJECT}`, 'u')]);
    await page.keyboard.press('Escape');

    await menu.run('My work');
    await expect(page).toHaveURL(/\/$/u);
    const expected = [
        new RegExp(`^${SAMPLE_REPOSITORY}`, 'u'),
        /^Remember the sidebar width/u,
        new RegExp(`^${SAMPLE_PROJECT}`, 'u'),
    ];
    await menu.open();
    await expect(recent).toHaveText(expected);
    await page.keyboard.press('Escape');

    await page.reload();
    await menu.open();
    await expect(recent).toHaveText(expected);
    await page.keyboard.press('Escape');
    await expect(menu.root).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Do or find…/u }).click();
    await expect(recent).toHaveText(expected);
});

test('E13, E14: the empty ⌘K lists no tracked repository but "Repositories…", whose level lists them alphabetically, narrows as typed, steps back on ← and goes to one on Enter', async ({
    page,
    github,
}) => {
    const { world } = createSampleTrackedWork();
    const { login } = SAMPLE_VIEWER.viewer;
    world.repository(`${login}/web`);
    world.repository(`${login}/api`);
    await openTrackedWork(page, github, world);
    const menu = new CommandMenuHarness(page);
    const top = menu.root.getByRole('listbox', { name: 'Command menu' });
    const level = menu.root.getByRole('listbox', { name: 'Repositories…' });

    await menu.open();
    await expect(menu.option(/^Repositories…\s*3$/u)).toBeVisible();
    await expect(menu.option(/^Projects…/u)).toBeVisible();
    await expect(menu.option(new RegExp(`^${SAMPLE_REPOSITORY}`, 'u'))).toHaveCount(0);
    await expect(menu.option(new RegExp(`^${SAMPLE_PROJECT}`, 'u'))).toHaveCount(0);

    // The last two lines: ↑ from the first wraps to "Projects…", then "Repositories…".
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Tab');
    await expect(level.getByRole('option')).toHaveText([
        new RegExp(`^${login}/api`, 'u'),
        new RegExp(`^${login}/app`, 'u'),
        new RegExp(`^${login}/web`, 'u'),
    ]);
    await expect(menu.field).toHaveAttribute('placeholder', 'Filter repositories…');

    await page.keyboard.press('ArrowLeft');
    await expect(top).toBeVisible();
    await expect(menu.option(/^Repositories…/u)).toBeVisible();

    await menu.field.pressSequentially('repositories');
    await page.keyboard.press('Enter');
    await expect(level).toBeVisible();
    await menu.field.pressSequentially('web');
    await expect(level.getByRole('option')).toHaveText([new RegExp(`^${login}/web`, 'u')]);
    await page.keyboard.press('Enter');
    await expect(menu.root).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`^[^?]*/${login}/web`, 'u'));
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

test('E1: the view’s options are actions — "Show as board" shows it as a board, "Order by…" sets the order; `>` finds actions only', async ({
    page,
    github,
}) => {
    const { myWork } = await openMyWork(page, github, createSampleMyWork().world);
    const menu = new CommandMenuHarness(page);

    await menu.open();
    await expect(menu.option(/^Group by…/)).toBeVisible();
    await menu.option(/^Show as board/).click();
    await expect(menu.root).toBeHidden();
    await expect(myWork.layout('Board')).toHaveAttribute('aria-pressed', 'true');

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

test('D14: a list\'s "This view" opens on what acts on the list and its row, its view options after them', async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await shell.tracked(SAMPLE_PROJECT).click();
    const project = new ProjectScreenHarness(page);
    await project.tab('Board').click();
    await expect(project.rows('Todo')).toHaveCount(3);
    // Away from the tabs, so the keys are the board's: a card selected, which "Open full screen" opens.
    await project.group('Todo').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('j');

    const menu = new CommandMenuHarness(page);
    await menu.open();
    // By what each line starts with, its key's hint aside (⇧ on a Mac, "Shift" elsewhere); a space may be a no-break one.
    await expect(menu.group('This view').getByRole('option')).toHaveText(
        [
            `New issue in ${SAMPLE_PROJECT}`,
            `Add existing issues to ${SAMPLE_PROJECT}…`,
            'Open on GitHub',
            'Open full screen',
            'Show as list',
            'Group by…',
            'Order by…',
            'Row field…',
            'Show properties…',
        ].map(title => new RegExp(`^${title.replaceAll(' ', '\\s')}`, 'u')),
    );
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

test("⌘K on one repository's screen walks into another's level without going there, and its Pull requests go there", async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.goto('/acme/web');
    await expect(new RepositoryScreenHarness(page).notTrackedChip).toBeVisible();
    const screen = page.url();
    const menu = new CommandMenuHarness(page);

    await menu.open();
    await expect(menu.chip('acme/web')).toBeVisible();
    await menu.field.pressSequentially(SAMPLE_REPOSITORY);
    await expect(menu.option(new RegExp(`^${SAMPLE_REPOSITORY}`, 'u'))).toBeVisible();
    await page.keyboard.press('ArrowRight');

    await expect(menu.chip(SAMPLE_REPOSITORY)).toBeVisible();
    await expect(menu.chip('acme/web')).toHaveCount(0);
    await expect(menu.option(/^Workflows/u)).toBeVisible();
    expect(page.url()).toBe(screen);

    await menu.field.pressSequentially('pull requests');
    await page.keyboard.press('Enter');
    await expect(menu.root).toBeHidden();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);
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

test('"Documentation" in the command menu and in the account menu opens the docs in a new tab, and the app stays where it is', async ({
    page,
    github,
}) => {
    const shell = await signIn(page, github);
    const appUrl = page.url();
    const menu = new CommandMenuHarness(page);

    const fromCommandMenu = page.context().waitForEvent('page');
    await menu.open();
    await menu.field.pressSequentially('docs');
    await menu.option(/^Documentation/u).click();
    await expectDocsStart(await fromCommandMenu);
    expect(page.url()).toBe(appUrl);

    const fromAccountMenu = page.context().waitForEvent('page');
    await shell.account(SAMPLE_VIEWER.viewer.login).click();
    await page.getByRole('menu').getByRole('menuitem', { name: 'Documentation' }).click();
    await expectDocsStart(await fromAccountMenu);
    expect(page.url()).toBe(appUrl);
});

/** A tab opened on the docs (`/docs/`), which is their first page: they have no home page. */
async function expectDocsStart(tab: Page) {
    await expect(tab).toHaveURL('/docs/');
    await expect(tab.getByRole('heading', { level: 1 })).toHaveText('What is githq');
    await tab.close();
}

test('the command menu is at most 600px tall on a desktop, less on a short window, its rows scrolling; a phone’s sheet is not held to it', async ({
    page,
    github,
}) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const menu = new CommandMenuHarness(page);
    const listbox = menu.root.getByRole('listbox');

    await menu.open();
    await expect.poll(async () => (await menu.root.boundingBox())?.height).toBeLessThanOrEqual(600);
    // The rows scroll inside it, the field above them still in view.
    expect(await listbox.evaluate(list => list.scrollHeight > list.clientHeight)).toBe(true);
    await expect(menu.field).toBeInViewport();

    // A short window caps it lower: 78% of its height.
    await page.setViewportSize({ width: 1440, height: 500 });
    await expect.poll(async () => (await menu.root.boundingBox())?.height).toBeLessThanOrEqual(0.78 * 500 + 1);

    // A phone's sheet rises from below as tall as its rows, up to the window, not 600.
    await page.keyboard.press('Escape');
    await expect(menu.root).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Do or find…/u }).click();
    await expect.poll(async () => (await menu.root.boundingBox())?.height).toBeGreaterThan(600);
});

test('the command menu’s rows stop short of its scrollbar, the last one wrapped to keeps the list’s padding, and rows that don’t scroll sit evenly inset', async ({
    page,
    github,
}) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    const menu = new CommandMenuHarness(page);
    const listbox = menu.root.getByRole('listbox');
    const highlighted = listbox.locator('[role="option"][data-highlighted]');

    await menu.open();
    await expect.poll(async () => (await menu.root.boundingBox())?.height).toBeLessThanOrEqual(600);
    expect(await listbox.evaluate(list => list.scrollHeight > list.clientHeight)).toBe(true);

    // Whether the scrollbar takes its own width (classic) or is drawn over the list (overlay, the thin one about 8px),
    // the highlighted row ends before it.
    await expect(highlighted).toBeVisible();
    await expect
        .poll(async () => {
            const room = await measureRow(highlighted);
            return room.right - Math.max(room.scrollbar, 8);
        })
        .toBeGreaterThanOrEqual(0);

    // ↑ on the first row wraps to the last, scrolled into view above the list's bottom padding, not touching the footer.
    await page.keyboard.press('ArrowUp');
    await expect(listbox.getByRole('option').last()).toHaveAttribute('data-highlighted', '');
    await expect.poll(async () => (await measureRow(highlighted)).bottom).toBeGreaterThanOrEqual(4);

    // A list that doesn't scroll keeps no room for a scrollbar: its rows sit inset alike on both sides.
    await menu.field.pressSequentially('remember the side');
    await expect(menu.option(/Remember the sidebar width/)).toBeVisible();
    expect(await listbox.evaluate(list => list.scrollHeight > list.clientHeight)).toBe(false);
    const room = await measureRow(highlighted);
    expect(Math.abs(room.left - room.right)).toBeLessThanOrEqual(1);
});

/** The room between a row and its list's edges, and the width the list's scrollbar takes beside the rows (0 overlay). */
async function measureRow(row: Locator) {
    return await row.evaluate(element => {
        const list = element.closest<HTMLElement>('[role="listbox"]');
        if (!list) {
            throw new Error('The row is not in a listbox');
        }

        const outer = list.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return {
            left: box.left - outer.left,
            right: outer.right - box.right,
            bottom: outer.bottom - box.bottom,
            scrollbar: list.offsetWidth - list.clientWidth,
        };
    });
}
