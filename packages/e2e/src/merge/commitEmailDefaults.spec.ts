import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { MergePanelHarness } from '../harnesses/MergePanel.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { TrackedSettingsScreenHarness } from '../harnesses/TrackedSettingsScreen.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { selectRow } from '../myWork/selectRow.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';

import { getMergeRequests } from './getMergeRequests.js';
import { getOperationCalls } from './getOperationCalls.js';
import { createSampleMergeableWork, FIRST_TITLE } from './sampleMergeableWork.js';

const OWNER = SAMPLE_VIEWER.viewer.login;
const REPOSITORY = `${OWNER}/app`;
const GITHUB_EMAIL = 'mona@github.dev';
const OWNER_EMAIL = 'mona@owner.dev';
const REPOSITORY_EMAIL = 'mona@repo.dev';
const TITLE = 'Ship the tour';

test('the owner default starts the panel with "default for <owner>", and ⌘↵ sends it as authorEmail past REST', async ({
    page,
    github,
}) => {
    const { world, pullRequest } = createTrackedWork();
    const { settings, panel, myWork } = await openTrackedWorkAndSettings(page, github, world);
    await settings.chooseCommitEmail(settings.commitEmailSelect(OWNER), OWNER_EMAIL);
    await expect(settings.commitEmailSelect(OWNER)).toContainText(OWNER_EMAIL);

    await openMergePanel(page, myWork);

    await expect(panel.line('Email')).toContainText(OWNER_EMAIL);
    await expect(panel.line('Email')).toContainText(`default for ${OWNER}`);
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.root).toBeHidden();
    expect(getOperationCalls(github, 'MergePullRequest')).toEqual([
        {
            pullRequestId: pullRequest,
            expectedHeadOid: world.headOf(pullRequest),
            mergeMethod: 'MERGE',
            authorEmail: OWNER_EMAIL,
        },
    ]);
    expect(getMergeRequests(github)).toEqual([]);
});

test('PM51, PM52: remembering a pick saves it as the repository default, the panel and the settings page show it; a pick without it is for this merge only', async ({
    page,
    github,
}) => {
    const { world } = createTrackedWork();
    const { settings, panel, myWork } = await openTrackedWorkAndSettings(page, github, world);
    await openMergePanel(page, myWork);
    await expect(panel.line('Email')).toContainText(GITHUB_EMAIL);

    // Off: only this merge changes.
    await panel.pickEmail(REPOSITORY_EMAIL);
    await expect(panel.line('Email')).toContainText(REPOSITORY_EMAIL);
    await expect(panel.line('Email')).not.toContainText("Saved as this repository's default");
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();
    await page.keyboard.press('Shift+M');
    await expect(panel.line('Email')).toContainText(GITHUB_EMAIL);

    // On: it becomes the repository's default.
    await page.keyboard.press('y');
    await expect(panel.emailMenu).toBeFocused();
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    await page.keyboard.press('Shift+Y');
    await page.keyboard.press('Enter');
    await expect(panel.emailMenu).toBeHidden();
    await expect(panel.line('Email')).toContainText("Saved as this repository's default");
    await expect(panel.line('Email')).toContainText(REPOSITORY_EMAIL);
    await page.keyboard.press('Escape');
    await expect(panel.root).toBeHidden();

    await page.keyboard.press('Shift+M');
    await expect(panel.line('Email')).toContainText(REPOSITORY_EMAIL);
    await expect(panel.line('Email')).toContainText('default for this repository');
    await page.keyboard.press('Escape');

    await page.goto(`/${REPOSITORY}/settings`);
    await expect(settings.commitEmailSelect('this repository')).toContainText(REPOSITORY_EMAIL);
});

test('T24, T25: the owner, then the repository override, then "Same as <owner>" decide the address the settings page and the panel show', async ({
    page,
    github,
}) => {
    const { world } = createTrackedWork();
    const { settings, panel, myWork } = await openTrackedWorkAndSettings(page, github, world);
    const ownerSelect = settings.commitEmailSelect(OWNER);
    const repositorySelect = settings.commitEmailSelect('this repository');

    await settings.chooseCommitEmail(ownerSelect, OWNER_EMAIL);
    await expect(repositorySelect).toContainText(`Same as ${OWNER}`.replaceAll(' ', ' '));
    await expect(settings.commitEmail).toContainText(OWNER_EMAIL);

    await settings.chooseCommitEmail(repositorySelect, REPOSITORY_EMAIL);
    await expect(repositorySelect).toContainText(REPOSITORY_EMAIL);
    await expect(settings.commitEmail).toContainText(`commits as ${REPOSITORY_EMAIL}`.replaceAll(' ', ' '));
    await openMergePanel(page, myWork);
    await expect(panel.line('Email')).toContainText(REPOSITORY_EMAIL);
    await page.keyboard.press('Escape');
    await page.goto(`/${REPOSITORY}/settings`);

    await settings.chooseCommitEmail(repositorySelect, 'Same as');
    await expect(settings.commitEmail).toContainText(OWNER_EMAIL);
    await openMergePanel(page, myWork);
    await expect(panel.line('Email')).toContainText(OWNER_EMAIL);
    await expect(panel.line('Email')).toContainText(`default for ${OWNER}`);
});

test('PM53: turning auto-merge on sends the address picked for it as authorEmail', async ({ page, github }) => {
    const sample = createSampleMergeableWork({
        repository: { autoMergeAllowed: true, commitEmails: [GITHUB_EMAIL, OWNER_EMAIL] },
        first: { reviewDecision: 'REVIEW_REQUIRED' },
    });
    const { myWork } = await openMyWork(page, github, sample.world);
    const panel = new MergePanelHarness(page);
    await selectRow(myWork, FIRST_TITLE);

    await page.keyboard.press('Shift+M');
    await expect(panel.primary).toHaveAccessibleName('Enable auto-merge');
    await panel.pickEmail(OWNER_EMAIL);
    await expect(panel.line('Email')).toContainText(OWNER_EMAIL);
    await page.keyboard.press('ControlOrMeta+Enter');

    await expect(panel.primary).toHaveAccessibleName('Turn off auto-merge');
    expect(getOperationCalls(github, 'EnablePullRequestAutoMerge')).toEqual([
        expect.objectContaining({ pullRequestId: sample.first, authorEmail: OWNER_EMAIL }),
    ]);
});

/** The viewer's tracked repository with one approved pull request, offering two addresses (GitHub's default first). */
function createTrackedWork() {
    const world = new GitHubWorld(OWNER);
    world.repository(REPOSITORY, {
        defaultMergeMethod: 'MERGE',
        commitEmails: [GITHUB_EMAIL, OWNER_EMAIL, REPOSITORY_EMAIL],
    });
    const pullRequest = world.pullRequest({
        repository: REPOSITORY,
        number: 7,
        title: TITLE,
        foundBy: ['authored'],
        reviewDecision: 'APPROVED',
        minutesAgo: 5,
    });
    return { world, pullRequest };
}

/** Tracks the world, opens the repository's settings page, and hands over the harnesses. */
async function openTrackedWorkAndSettings(page: Page, github: GitHubMock, world: GitHubWorld) {
    await openTrackedWork(page, github, world);
    await page.goto(`/${REPOSITORY}/settings`);
    const settings = new TrackedSettingsScreenHarness(page);
    await expect(settings.commitEmail).toBeVisible();
    return { settings, panel: new MergePanelHarness(page), myWork: new MyWorkScreenHarness(page) };
}

/** Goes to My work, selects the pull request and opens its merge panel. */
async function openMergePanel(page: Page, myWork: MyWorkScreenHarness) {
    await new AppShellHarness(page).myWorkLink('My work').click();
    await selectRow(myWork, TITLE);
    await page.keyboard.press('Shift+M');
}
