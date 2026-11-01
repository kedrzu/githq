import { expect, test } from '../fixtures.js';
import { CommandMenuHarness } from '../harnesses/CommandMenu.harness.js';
import { NewIssueHarness } from '../harnesses/NewIssue.harness.js';
import { RepositoryScreenHarness } from '../harnesses/RepositoryScreen.harness.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

test("a repository's menu in the sidebar goes to its pull requests, starts an issue in it and opens it on GitHub", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    github.web(`/${SAMPLE_REPOSITORY}`, () => ({ status: 200, body: '<title>Repository</title>' }));

    let menu = await shell.openTrackedMenu(SAMPLE_REPOSITORY);
    await expect(menu).toContainText(SAMPLE_REPOSITORY);
    await menu.getByRole('menuitem', { name: 'Pull requests' }).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);

    menu = await shell.openTrackedMenu(SAMPLE_REPOSITORY);
    await menu.getByRole('menuitem', { name: 'New issue' }).click();
    const capture = new NewIssueHarness(page);
    await expect(capture.root).toContainText(SAMPLE_REPOSITORY);
    await page.keyboard.press('Escape');
    await expect(capture.root).toBeHidden();

    menu = await shell.openTrackedMenu(SAMPLE_REPOSITORY);
    const popup = page.waitForEvent('popup');
    await menu.getByRole('menuitem', { name: 'Open on GitHub' }).click();
    expect((await popup).url()).toBe(`https://github.com/${SAMPLE_REPOSITORY}`);
});

test("⌘K on a repository's view opens it on GitHub", async ({ page, github }) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    github.web(`/${SAMPLE_REPOSITORY}`, () => ({ status: 200, body: '<title>Repository</title>' }));
    await shell.tracked(SAMPLE_REPOSITORY).click();

    const menu = new CommandMenuHarness(page);
    await menu.open();
    await menu.field.pressSequentially('open on github');
    await expect(menu.option(`Open on GitHub ${SAMPLE_REPOSITORY}`)).toBeVisible();
    const popup = page.waitForEvent('popup');
    await page.keyboard.press('Enter');
    expect((await popup).url()).toBe(`https://github.com/${SAMPLE_REPOSITORY}`);
});

test("a repository view's title opens the same menu: its pull requests", async ({ page, github }) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await shell.tracked(SAMPLE_REPOSITORY).click();

    const repository = new RepositoryScreenHarness(page);
    const menu = await repository.openTitleMenu(SAMPLE_REPOSITORY);
    await expect(menu).toContainText(SAMPLE_REPOSITORY);
    await menu.getByRole('menuitem', { name: 'Pull requests' }).click();
    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/pulls`);
});
