import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { NewIssueHarness } from '../harnesses/NewIssue.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_PROJECT, SAMPLE_PROJECT_PATH } from '../tracking/sampleTrackedWork.js';

test("a project's menu in the sidebar goes to a saved view, starts an issue in it and opens it on GitHub", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    github.web(SAMPLE_PROJECT_PATH, () => ({ status: 200, body: '<title>Project</title>' }));

    let menu = await shell.openTrackedMenu(SAMPLE_PROJECT);
    await expect(menu).toContainText(SAMPLE_PROJECT);
    await menu.getByRole('menuitem', { name: 'Views' }).click();
    await page.getByRole('menuitem', { name: 'Board' }).click();
    await expect(page).toHaveURL(`${SAMPLE_PROJECT_PATH}/views/2`);

    menu = await shell.openTrackedMenu(SAMPLE_PROJECT);
    await menu.getByRole('menuitem', { name: 'New issue' }).click();
    const capture = new NewIssueHarness(page);
    await expect(capture.root).toContainText(SAMPLE_PROJECT);
    // No repository yet: the capture starts in its chooser, which Escape leaves before it closes the capture.
    await expect(capture.repositoryField).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(capture.title).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(capture.root).toBeHidden();

    menu = await shell.openTrackedMenu(SAMPLE_PROJECT);
    const popup = page.waitForEvent('popup');
    await menu.getByRole('menuitem', { name: 'Open on GitHub' }).click();
    expect((await popup).url()).toBe(`https://github.com${SAMPLE_PROJECT_PATH}`);
});

test("⌘K on a project's view opens it on GitHub", async ({ page, github }) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    github.web(SAMPLE_PROJECT_PATH, () => ({ status: 200, body: '<title>Project</title>' }));
    await shell.tracked(SAMPLE_PROJECT).click();

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('open on github');
    await expect(menu.option(`Open on GitHub ${SAMPLE_PROJECT}`)).toBeVisible();
    const popup = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    expect((await popup).url()).toBe(`https://github.com${SAMPLE_PROJECT_PATH}`);
});
