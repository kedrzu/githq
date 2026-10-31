import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';
import { ProjectScreenHarness } from '../harnesses/ProjectScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_PROJECT_PATH } from '../tracking/sampleTrackedWork.js';

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
