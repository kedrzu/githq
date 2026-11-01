import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import type { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import type { SampleTrackedWork } from '../tracking/sampleTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_PROJECT_PATH } from '../tracking/sampleTrackedWork.js';

test('a project shows its saved views as tabs, each with the items its filter keeps; one githq can’t evaluate is answered by GitHub; archived items never show', async ({
    page,
    github,
}) => {
    const { project } = await openProject(page, github, createSampleTrackedWork());

    await expect(project.tabs).toHaveText(['Backlog', 'Board', 'Sidebar work', 'Shipped bugs']);
    await expect(project.currentTab).toHaveText('Backlog');
    await expect(project.root).toContainText('octocat · 5 items');
    await expect(project.filter('Backlog')).toContainText('-status:Done');
    await expect(project.root.getByRole('listitem')).toHaveText([
        /Document the setup/,
        /Collapse the sidebar on narrow screens/,
        /Remember the sidebar width/,
        /Sketch the settings page/,
    ]);

    await project.tab('Board').click();
    await expect(project.currentTab).toHaveText('Board');
    await expect(project.layout('Board')).toHaveAttribute('aria-pressed', 'true');
    await expect(project.rows('Todo')).toHaveText([
        /Document the setup/,
        /Collapse the sidebar on narrow screens/,
        /Sketch the settings page/,
    ]);
    await expect(project.rows('In Progress')).toHaveText([/Remember the sidebar width/]);
    await expect(project.rows('Done')).toHaveText([/Ship the onboarding tour/]);

    // Free text is GitHub's to match: the view is asked of GitHub with its filter, and says so.
    await expect(project.tab('Sidebar work').getByRole('img', { name: 'answered by GitHub' })).toBeVisible();
    await project.tab('Sidebar work').click();
    await expect(project.filter('Sidebar work').getByRole('img', { name: 'answered by GitHub' })).toBeVisible();
    // GitHub's answer holds the archived item too; it is not shown.
    await expect(project.root.getByRole('listitem')).toHaveText([
        /Collapse the sidebar on narrow screens/,
        /Remember the sidebar width/,
    ]);
    expect(
        github.graphqlCalls.filter(call => call.name === 'ProjectItems' && call.variables.query === 'sidebar'),
    ).toHaveLength(1);
    await expect(project.row('Old sidebar experiment')).toHaveCount(0);
});

test('a view grouped otherwise is marked modified locally, on this device, until Reset brings back the saved view', async ({
    page,
    github,
}) => {
    const { project } = await openProject(page, github, createSampleTrackedWork());
    const backlog = project.tab('Backlog');
    await expect(project.groupingButton).toHaveText('Group: None');
    await expect(backlog.getByRole('img', { name: 'modified locally' })).toHaveCount(0);

    await project.groupingButton.click();
    await page.getByRole('menuitemradio', { name: 'Status' }).click();
    await expect(project.groupingButton).toHaveText('Group: Status');
    // Every option is a group, an empty one too: "Done" items are left out by the view's filter.
    await expect(project.groups).toHaveText([/^\s*Todo\s*3/, /^\s*In Progress\s*1/, /^\s*Done\s*0/]);
    await expect(project.rows('Todo')).toHaveText([
        /Document the setup/,
        /Collapse the sidebar on narrow screens/,
        /Sketch the settings page/,
    ]);
    await expect(backlog.getByRole('img', { name: 'modified locally' })).toBeVisible();
    await expect(project.root).toContainText('Changed here');

    // Kept on this device.
    await page.reload();
    await expect(project.groupingButton).toHaveText('Group: Status');
    await expect(backlog.getByRole('img', { name: 'modified locally' })).toBeVisible();

    await project.resetButton.click();
    await expect(project.groupingButton).toHaveText('Group: None');
    await expect(backlog.getByRole('img', { name: 'modified locally' })).toHaveCount(0);
    await expect(project.root).not.toContainText('Changed here');
});

test('a view nothing matches shows all the project’s items, or its filter cleared here until Reset (K9)', async ({
    page,
    github,
}) => {
    const { project } = await openProject(page, github, createSampleTrackedWork());
    const allItems = [
        /Document the setup/,
        /Collapse the sidebar on narrow screens/,
        /Remember the sidebar width/,
        /Ship the onboarding tour/,
        /Sketch the settings page/,
    ];
    await project.tab('Shipped bugs').click();
    await expect(project.root.getByRole('heading', { name: 'Nothing matches “Shipped bugs”' })).toBeVisible();

    await project.root.getByRole('button', { name: 'Clear filters here' }).click();
    await expect(project.root.getByRole('listitem')).toHaveText(allItems);
    await expect(project.tab('Shipped bugs').getByRole('img', { name: 'modified locally' })).toBeVisible();
    await expect(project.filter('Shipped bugs')).toHaveCount(0);

    await project.resetButton.click();
    await expect(project.root.getByRole('heading', { name: 'Nothing matches “Shipped bugs”' })).toBeVisible();

    await project.root.getByRole('link', { name: 'Show all items' }).click();
    await expect(page).toHaveURL(/\?all$/);
    await expect(project.currentTab).toHaveText('All items');
    await expect(project.root.getByRole('listitem')).toHaveText(allItems);
    // The saved view itself is untouched.
    await expect(project.tab('Shipped bugs').getByRole('img', { name: 'modified locally' })).toHaveCount(0);
});

test('on the board, ⇧→ and a drag set the Status on GitHub; one GitHub refuses goes back to its column, with its toast', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    sample.world.failEdit(sample.tourIssue, 'SetProjectFieldValue', {
        kind: 'refuse',
        message: 'Resource not accessible by integration',
    });
    const { project, shell } = await openProject(page, github, sample);
    await project.tab('Board').click();
    await expect(project.rows('Todo')).toHaveCount(3);

    // Away from the tabs, so the keys are the board's.
    await project.group('Todo').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('j');
    await expect(project.selectedRow).toContainText('Document the setup');
    await page.keyboard.press('Shift+ArrowRight');
    // In GitHub's order of the project.
    await expect(project.rows('In Progress')).toHaveText([/Document the setup/, /Remember the sidebar width/]);
    await expect
        .poll(() => sample.world.stateOf(sample.setupIssue).projects)
        .toEqual({ [SAMPLE_PROJECT]: 'In Progress' });

    await project.row('Remember the sidebar width').dragTo(project.group('Done'));
    await expect(project.rows('Done')).toHaveText([/Remember the sidebar width/, /Ship the onboarding tour/]);
    await expect.poll(() => sample.world.stateOf(sample.widthIssue).projects).toEqual({ [SAMPLE_PROJECT]: 'Done' });

    await project.row('Ship the onboarding tour').dragTo(project.group('In Progress'));
    const toast = shell.toasts.filter({ hasText: "Status of acme/web#13 wasn't set" });
    await expect(toast).toContainText('GitHub refused it: Resource not accessible by integration. It was undone.');
    await expect(project.rows('Done')).toHaveText([/Remember the sidebar width/, /Ship the onboarding tour/]);
    expect(sample.world.stateOf(sample.tourIssue).projects).toEqual({ [SAMPLE_PROJECT]: 'Done' });
    expect(sample.world.edits.map(edit => [edit.mutation, edit.itemId])).toEqual([
        ['SetProjectFieldValue', sample.setupIssue],
        ['SetProjectFieldValue', sample.widthIssue],
        ['SetProjectFieldValue', sample.tourIssue],
    ]);
});

test('on the board, a stack spread over columns has a card in each ("2 of 5") and one alone in a column is its own card marked "5 of 5"; dragging a share moves all its pull requests', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    const project = sample.project;
    const stack = sample.world.stack({
        repository: 'acme/web',
        number: 1,
        pullRequests: [
            { number: 31, title: 'Read stacks', projects: [{ project, status: 'Todo' }], minutesAgo: 50 },
            { number: 32, title: 'Fold stacks', projects: [{ project, status: 'Todo' }], minutesAgo: 40 },
            { number: 33, title: 'Draw the pips', projects: [{ project, status: 'In Progress' }], minutesAgo: 30 },
            { number: 34, title: 'Map the stack', projects: [{ project, status: 'In Progress' }], minutesAgo: 20 },
            { number: 35, title: 'Merge a stack', projects: [{ project, status: 'Done' }], minutesAgo: 10 },
        ],
    });
    const { project: screen } = await openProject(page, github, sample);
    await screen.tab('Board').click();

    // A card for each share, named after the stack's first pull request; the one alone is a plain card, marked.
    const todoShare = screen.rows('Todo').filter({ hasText: '2 of 5' });
    await expect(todoShare).toHaveCount(1);
    await expect(todoShare).toContainText('Read stacks');
    await expect(screen.rows('Todo')).toHaveCount(4);
    await expect(screen.rows('In Progress').filter({ hasText: '2 of 5' })).toContainText('Read stacks');
    await expect(screen.rows('In Progress')).toHaveCount(2);
    const lone = screen.rows('Done').filter({ hasText: 'Merge a stack' });
    await expect(lone).toContainText('5 of 5');
    await expect(lone.getByRole('img', { name: 'In a stack' })).toBeVisible();
    for (const title of ['Fold stacks', 'Draw the pips', 'Map the stack']) {
        await expect(screen.row(title)).toHaveCount(0);
    }

    // Dragged to "Done", the Todo share takes both its pull requests there, joining the one already in it.
    await todoShare.dragTo(screen.group('Done'));
    await expect(screen.rows('Done').filter({ hasText: '3 of 5' })).toContainText('Read stacks');
    await expect(screen.rows('Todo')).toHaveCount(3);
    await expect(screen.row('Merge a stack')).toHaveCount(0);
    await expect
        .poll(() => stack.map(id => sample.world.stateOf(id).projects[SAMPLE_PROJECT]))
        .toEqual(['Done', 'Done', 'In Progress', 'In Progress', 'Done']);
    expect(sample.world.edits.map(edit => [edit.mutation, edit.itemId])).toEqual([
        ['SetProjectFieldValue', stack[0]],
        ['SetProjectFieldValue', stack[1]],
    ]);
});

test('a draft written in a column shows there at once, and stays once GitHub took it with that column’s Status', async ({
    page,
    github,
}) => {
    const sample = createSampleTrackedWork();
    const { project, shell } = await openProject(page, github, sample);
    await project.tab('Board').click();

    const release = sample.world.holdEdits();
    await project.addDraft('In Progress', 'Try a denser layout');
    await expect(project.rows('In Progress')).toHaveText([/Remember the sidebar width/, /Try a denser layout/]);
    await expect(shell.statusBar).toContainText('Sending 1 change');
    expect(sample.world.draftsOf(sample.project)).toEqual([{ title: 'Sketch the settings page', status: 'Todo' }]);

    release();
    await expect(shell.statusBar).not.toContainText('Sending');
    await expect(shell.failedEdits).toHaveCount(0);
    await expect(project.rows('In Progress')).toHaveText([/Remember the sidebar width/, /Try a denser layout/]);
    expect(sample.world.draftsOf(sample.project)).toEqual([
        { title: 'Sketch the settings page', status: 'Todo' },
        { title: 'Try a denser layout', status: 'In Progress' },
    ]);
    expect(sample.world.edits.map(edit => edit.mutation)).toEqual(['AddDraftIssue', 'SetProjectFieldValue']);
});

/** Tracks the sample on the first sign-in, and opens its project from the sidebar. */
async function openProject(
    page: Page,
    github: GitHubMock,
    sample: SampleTrackedWork,
): Promise<{ shell: AppShellHarness; project: ProjectScreenHarness }> {
    const shell = await openTrackedWork(page, github, sample.world);
    await shell.tracked(SAMPLE_PROJECT).click();
    await expect(page).toHaveURL(SAMPLE_PROJECT_PATH);
    return { shell, project: new ProjectScreenHarness(page) };
}
