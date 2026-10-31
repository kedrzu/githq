import { expect, test } from '../fixtures.js';
import { ItemViewHarness } from '../harnesses/ItemView.harness.js';
import { openMyWork } from '../myWork/openMyWork.js';

import { createSampleEditableWork } from './sampleEditableWork.js';

test('in a repository the user may only read, the edits it does not allow are not offered: no pickers, L does nothing, the comment box stays', async ({
    page,
    github,
}) => {
    const sample = createSampleEditableWork();
    sample.world.repository('acme/web', { viewerPermission: 'READ' });
    const { myWork } = await openMyWork(page, github, sample.world);
    const item = new ItemViewHarness(page);

    // Someone else's issue: the user may comment, nothing more.
    await myWork.row('Sign-in loops after the token expires').click();
    await expect(item.restrictedNote).toContainText("set by acme/web's maintainers");
    await expect(item.property('Labels')).toHaveCount(0);
    await expect(item.property('Assignees')).toHaveCount(0);
    await expect(item.property('Milestone')).toHaveCount(0);
    await expect(item.commentBox).toBeEditable();

    // Its menu offers what the user may do — comment, copy it — and none of the edits.
    await item.menuButton.click();
    await expect(page.getByRole('menuitem', { name: 'Comment' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /^Add or remove labels/ })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /^Close issue/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);

    await page.keyboard.press('l');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(item.title).toBeVisible();
    expect(sample.world.edits).toEqual([]);
});
