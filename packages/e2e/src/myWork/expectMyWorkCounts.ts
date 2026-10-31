import { expect } from '@playwright/test';

import type { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { MY_WORK_GROUP_NAMES } from '../harnesses/MyWorkScreen.harness.js';
import type { MyWorkGroupName, MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';

/** What {@link expectMyWorkCounts} checks. */
export interface ExpectMyWorkCountsParams {
    readonly myWork: MyWorkScreenHarness;
    readonly shell: AppShellHarness;
    /** The top-level rows of each group; a group with none is not listed. */
    readonly counts: Readonly<Record<MyWorkGroupName, number>>;
}

/**
 * Expects each group of the unfiltered list to have its count, the sidebar to show the same next to the group,
 * and "My work" in the sidebar their sum (D11).
 */
export async function expectMyWorkCounts(params: ExpectMyWorkCountsParams): Promise<void> {
    const { myWork, shell, counts } = params;
    let total = 0;
    for (const name of MY_WORK_GROUP_NAMES) {
        const count = counts[name];
        total += count;
        if (count > 0) {
            await expect(myWork.groupCount(name)).toHaveText(String(count));
        } else {
            await expect(myWork.group(name)).toBeHidden();
        }

        await expect(shell.myWorkCount(name)).toHaveText(String(count));
    }

    await expect(shell.myWorkCount('My work')).toHaveText(String(total));
}
