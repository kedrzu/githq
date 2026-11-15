import { SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { expect, test } from '../fixtures.js';
import { openTrackedWork } from '../tracking/openTrackedWork.js';
import { createSampleTrackedWork, SAMPLE_REPOSITORY } from '../tracking/sampleTrackedWork.js';

// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };

test('mobile D32, D33: on a phone Settings opens on the list of its sections, a row opens its own address and back returns to the list, then to where Settings was opened', async ({
    page,
    github,
}) => {
    await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.setViewportSize(PHONE);

    // From the account menu at the places panel's foot (D32).
    await page.getByRole('button', { name: 'Open places' }).click();
    const places = page.getByRole('dialog', { name: 'Places' });
    await places.getByRole('button', { name: `Account: ${SAMPLE_VIEWER.viewer.login}` }).click();
    await page.getByRole('menuitem', { name: /^Settings/u }).click();

    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    const sections = page.getByRole('navigation', { name: 'Settings' });
    await expect(sections.getByRole('link', { name: /^Display\s?Animations\son/u })).toBeVisible();
    await expect(
        sections.getByRole('link', { name: new RegExp(`^Account\\s?${SAMPLE_VIEWER.viewer.login}`, 'u') }),
    ).toBeVisible();

    // A section at its own address, with back to Settings.
    await sections.getByRole('link', { name: /^Display/u }).click();
    await expect(page).toHaveURL('/settings?tab=display');
    await expect(page.getByRole('heading', { name: 'Display', level: 1 })).toBeVisible();
    await page.getByRole('switch', { name: 'Animations' }).click();
    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page).toHaveURL('/settings');
    await expect(sections.getByRole('link', { name: /^Display\s?Animations\soff/u })).toBeVisible();

    // The list's back returns to where Settings was opened.
    await page.getByRole('button', { name: 'Back to My work' }).click();
    await expect(page).toHaveURL('/');
});

test("mobile D35: on a phone Repositories drill into a repository's settings, and Stop tracking there goes back with Undo", async ({
    page,
    github,
}) => {
    const shell = await openTrackedWork(page, github, createSampleTrackedWork().world);
    await page.setViewportSize(PHONE);

    // Opened by its address, with nothing behind it: back goes to the list of the sections.
    await page.goto('/settings?tab=repositories');
    await expect(page.getByRole('heading', { name: 'Repositories', level: 1 })).toBeVisible();
    const row = page.getByRole('button', { name: new RegExp(`^${SAMPLE_REPOSITORY}`, 'u') });
    await row.click();

    await expect(page).toHaveURL(`/${SAMPLE_REPOSITORY}/settings`);
    await expect(page.getByRole('heading', { name: SAMPLE_REPOSITORY, level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Stop tracking' }).click();

    await expect(page).toHaveURL('/settings?tab=repositories');
    const toast = shell.toasts.filter({ hasText: `Stopped tracking ${SAMPLE_REPOSITORY}` });
    await expect(toast).toBeVisible();
    await expect(row).toHaveCount(0);
    await toast.getByRole('button', { name: 'Undo' }).click();
    await expect(row).toBeVisible();

    await page.getByRole('button', { name: 'Back to Settings' }).click();
    await expect(page).toHaveURL('/settings');
});
