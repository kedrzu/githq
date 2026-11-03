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
    section(name: 'Account' | 'Display' | 'Projects' | 'Repositories' | 'Sync settings'): Locator {
        return this.root
            .getByRole('group', { name: 'Settings sections' })
            .getByRole('button', { name: new RegExp(`^${name}`, 'u') });
    }

    /** A card of the Display section's repository layout. */
    repositoryLayout(name: 'Column' | 'Tabs'): Locator {
        return this.root.getByRole('radiogroup', { name: 'Repository layout' }).getByRole('radio', { name });
    }

    /** The line under the repository layout's cards saying where the choice is kept, by its text. */
    repositoryLayoutKept(text: string): Locator {
        return this.root.getByText(text);
    }
}
