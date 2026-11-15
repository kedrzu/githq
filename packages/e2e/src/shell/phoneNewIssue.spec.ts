import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { expect, test } from '../fixtures.js';
import { openMyWork } from '../myWork/openMyWork.js';

// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };

test('mobile D42–D44: on a phone a new issue from My work chooses its repository first, fills in full screen and creates with a toast', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { shell } = await openMyWork(page, github, sample.world);
    await page.setViewportSize(PHONE);
    await expect(page.getByRole('button', { name: 'Open places' })).toBeVisible();

    // From My work, outside any repository: the repository is chosen first, at the bottom (D43).
    await page
        .getByRole('button', { name: /New issue/u })
        .first()
        .click();
    await page
        .getByRole('option', { name: /acme\/web/u })
        .first()
        .click();

    // The form full screen, the item's rows under the title; Assign to me in one tap (D42).
    const form = page.getByRole('dialog', { name: /New issue/u });
    await expect(form.getByText('acme/web').first()).toBeVisible();
    await form.getByRole('textbox', { name: /Title/u }).fill('Remember the last tab');
    await form.getByRole('button', { name: 'Assign to me' }).click();
    await expect(form.getByRole('button', { name: 'Assigned to me' })).toBeVisible();
    await form.getByRole('button', { name: 'Create', exact: true }).click();

    // Closed, the toast following (D44).
    await expect(form).toBeHidden();
    await expect(shell.issueCreatedToast).toContainText('Created in acme/web');
    await expect
        .poll(() => sample.world.findIssue('acme/web', 'Remember the last tab'))
        .toMatchObject({ assignees: [sample.world.viewer] });
});
