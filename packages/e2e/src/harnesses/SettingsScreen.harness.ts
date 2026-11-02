import type { Locator, Page } from '@playwright/test';

/** Playwright harness for the Settings screen's own header (`SettingsView.vue`, D15). */
export class SettingsScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The screen's heading, "Settings". */
    get heading(): Locator {
        return this.root.getByRole('heading', { name: 'Settings', level: 1 });
    }

    /** A section's tab, by the start of its name (a count may follow it). */
    section(name: 'Account' | 'Projects' | 'Repositories' | 'Saving to GitHub'): Locator {
        return this.root
            .getByRole('group', { name: 'Settings sections' })
            .getByRole('button', { name: new RegExp(`^${name}`, 'u') });
    }
}
