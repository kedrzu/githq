import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { GitHubMock } from '../github/GitHubMock.js';
import type { GitHubWorld } from '../github/GitHubWorld.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';

/**
 * Signs in for the first time with GitHub answering from `world`, tracks what the first sign-in chooses — the
 * viewer's own repositories and open projects — and lands on My work, waiting there until every one has all its items —
 * the status bar no longer tells a download — and every repository's workflows are read.
 */
export async function openTrackedWork(page: Page, github: GitHubMock, world: GitHubWorld): Promise<AppShellHarness> {
    world.install(github);
    github.graphql('Viewer', SAMPLE_VIEWER);
    await page.goto('/');
    await new LandingHarness(page).signInWithToken(SAMPLE_TOKEN);

    const firstSignIn = new FirstSignInHarness(page);
    await firstSignIn.trackAndOpenMyWork();

    const shell = new AppShellHarness(page);
    // Tracked before the shell is drawn, so a status bar that tells no download has everything in.
    await expect(shell.statusBar).toBeVisible();
    // The whole download, closed items too, grows with what is tracked: forty repositories take a while on CI.
    await expect(shell.downloadProgress).toHaveCount(0, { timeout: 30_000 });
    await expect(shell.sidebar.locator('[data-marker="unread"]')).toHaveCount(0);
    return shell;
}
