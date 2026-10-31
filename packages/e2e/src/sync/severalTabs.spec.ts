import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import type { GitHubMock } from '../github/GitHubMock.js';
import { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { expectMyWorkCounts } from '../myWork/expectMyWorkCounts.js';
import { openMyWork } from '../myWork/openMyWork.js';
import { createSampleMyWork } from '../myWork/sampleMyWork.js';

test('of two tabs only one asks GitHub for changes, a change shows in both, and when that tab closes the other takes over', async ({
    context,
    page,
    github,
}) => {
    // Time runs as usual in both tabs, and the 30 seconds to the next poll can be skipped.
    await context.clock.install();
    const sample = createSampleMyWork();
    await openMyWork(page, github, sample.world);

    const other = await context.newPage();
    await other.goto('/');
    const otherShell = new AppShellHarness(other);
    const otherMyWork = new MyWorkScreenHarness(other);
    await expectMyWorkCounts({
        myWork: otherMyWork,
        shell: otherShell,
        counts: { 'Review requested': 1, 'My pull requests': 3, 'Assigned to me': 2, Mentioned: 1 },
    });

    sample.world.retitle(sample.otherAssignedIssue, 'Document every keyboard shortcut');
    await context.clock.fastForward('00:30');
    await expect(new MyWorkScreenHarness(page).rows('Assigned to me').first()).toHaveText(
        /Document every keyboard shortcut/,
    );
    await expect(otherMyWork.rows('Assigned to me').first()).toHaveText(/Document every keyboard shortcut/);
    await expect(otherShell.statusBar).toContainText('Up to date');
    expect(polls(github, page)).toContain('GET /search/issues');
    expect(polls(github, other)).toEqual([]);

    // The syncing tab closes: the other one polls from now on, from where it was.
    await page.close();
    sample.world.retitle(sample.mention, 'Dark mode for the whole app');
    await context.clock.fastForward('00:30');
    await expect(otherMyWork.rows('Mentioned')).toHaveText([/Dark mode for the whole app/]);
    await expect(otherShell.statusBar).toContainText('Up to date');
    expect(polls(github, other)).toContain('GET /search/issues');
});

/** What `page` asked GitHub besides who the user is, which every tab checks once it opens. */
function polls(github: GitHubMock, page: Page) {
    return github.apiRequestsOf(page).filter(request => request !== 'Viewer');
}
