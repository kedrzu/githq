import type { Locator, Page } from '@playwright/test';

/** Playwright harness for Settings' Saving to GitHub section (`SavingView.vue`, settings-sync T3–T8). */
export class SavingScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** "Save what I track to my GitHub account" (T3). */
    get choice(): Locator {
        return this.root.getByRole('checkbox', { name: 'Save what I track to my GitHub account' });
    }

    /** That saving is on (T4). */
    get on(): Locator {
        return this.root.getByText('Saving what you track to your GitHub account');
    }

    /** What combining with the repository found changes (T6). */
    get combining(): Locator {
        return this.root.getByRole('region', { name: /already exists, so it will be combined with this device$/u });
    }

    /** One group of what combining changes: tracked here and downloaded, added to the file, untracked here. */
    combiningGroup(group: 'download' | 'saved' | 'untracked'): Locator {
        return this.root.getByTestId(`saving-${group}`);
    }

    /** "Combine and turn on" (T6). */
    get combineButton(): Locator {
        return this.root.getByRole('button', { name: 'Combine and turn on' });
    }

    /** Syncing stopped (T7): its box, with the reason. */
    get stopped(): Locator {
        return this.root.getByRole('region', { name: 'Syncing stopped' });
    }

    /** "Turn off" (T4, T7). */
    get turnOffButton(): Locator {
        return this.root.getByRole('button', { name: 'Turn off', exact: true });
    }

    /** "Try again" of the stopped box. */
    get tryAgainButton(): Locator {
        return this.stopped.getByRole('button', { name: 'Try again' });
    }
}
