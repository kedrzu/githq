import { expect } from '@playwright/test';

import type { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';

/**
 * Selects the row titled `title` with the keyboard (`j`), without opening it — again until it is: a key pressed
 * while the screen still loads is lost.
 */
export async function selectRow(myWork: MyWorkScreenHarness, title: string): Promise<void> {
    await expect(async () => {
        await myWork.root.page().keyboard.press('j');
        await expect(myWork.selectedRow).toContainText(title, { timeout: 500 });
    }).toPass();
}
