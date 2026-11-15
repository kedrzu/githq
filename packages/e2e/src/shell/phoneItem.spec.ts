import { createSampleEditableWork } from '../edits/sampleEditableWork.js';
import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

// A phone in portrait (mobile D5: the phone layout below 640 px of window width).
const PHONE = { width: 390, height: 844 };
const ISSUE = 'Sign-in loops after the token expires';

test("mobile D45, D51: on a phone a property's menu sits at the bottom, and the composer from the command line comments and closes", async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    const { myWork } = await openMyWork(page, github, sample.world);
    await page.setViewportSize(PHONE);
    const item = new ItemViewHarness(page);
    await myWork.row(ISSUE).click();
    await expect(item.root).toContainText('No description provided.');

    // The project's Status: its menu at the bottom of the screen, the command line stepping aside meanwhile.
    await item.projectField('Status').click();
    const statusMenu = page.getByRole('dialog', { name: /Status/u });
    await expect(page.getByRole('button', { name: 'Command menu' })).toBeHidden();
    await statusMenu.getByRole('option', { name: 'In Progress' }).click();
    await expect.poll(() => sample.world.stateOf(sample.issue).projects).toEqual({ Roadmap: 'In Progress' });
    await expect(page.getByRole('button', { name: 'Command menu' })).toBeVisible();

    // The comment box grows into the desktop's composer; closing with a reason posts the comment, then closes.
    await page.getByRole('button', { name: /Leave a comment/u }).click();
    await page.keyboard.type('Not something we will do.');
    // Docked above the keyboard, outside the item's article.
    await page.getByRole('button', { name: 'More ways to close', exact: true }).click();
    await page
        .getByRole('dialog')
        .getByRole('menuitem', { name: /Close as not planned/u })
        .click();
    await expect
        .poll(() => sample.world.stateOf(sample.issue))
        .toMatchObject({ state: 'CLOSED', stateReason: 'NOT_PLANNED', comments: ['Not something we will do.'] });
    expect(sample.world.edits.map(edit => edit.mutation)).toEqual(['SetProjectFieldValue', 'AddComment', 'CloseIssue']);
});
