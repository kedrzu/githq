import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import type { GitHubMock } from '../github/GitHubMock.js';
import type { GitHubWorld } from '../github/GitHubWorld.js';
import type { AppShellHarness } from '../harnesses/AppShell.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { signIn } from '../session.js';

/** The signed-in app on "my work", as {@link openMyWork} leaves it. */
export interface OpenedMyWork {
    readonly shell: AppShellHarness;
    readonly myWork: MyWorkScreenHarness;
}

/** Signs in with GitHub answering from `world`, and waits for "my work" to arrive. */
export async function openMyWork(page: Page, github: GitHubMock, world: GitHubWorld): Promise<OpenedMyWork> {
    world.install(github);
    const shell = await signIn(page, github);
    const myWork = new MyWorkScreenHarness(page);
    await expect(shell.myWorkCount('My work')).toHaveText(/^\d+$/);
    return { shell, myWork };
}
