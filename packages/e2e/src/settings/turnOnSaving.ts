import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { GitHubMock } from '../github/GitHubMock.js';
import { SavingScreenHarness } from '../harnesses/SavingScreen.harness.js';

import { answerSettingsRepository } from './answerSettingsRepository.js';
import type { SettingsRepository } from './answerSettingsRepository.js';

/**
 * Turns saving on in Settings for a signed-in app, its repository answered as `repository` says: a file already
 * there is combined with this device's settings, so what the file holds is taken in. Returns `repository`, which
 * changes as the app writes.
 */
export async function turnOnSaving(
    page: Page,
    github: GitHubMock,
    repository: SettingsRepository,
): Promise<SettingsRepository> {
    const answered = answerSettingsRepository(github, repository);
    await page.goto('/settings?tab=sync');
    const saving = new SavingScreenHarness(page);
    await saving.choice.click();
    if (answered.file) {
        await saving.combineButton.click();
    }

    await expect(saving.on).toBeVisible();
    return answered;
}
