import type { Locator, Page } from '@playwright/test';

/** Playwright harness for the Settings screen's own column (`SettingsView.vue`, D26). */
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

    /** A section's row in the column, by the start of its name (a count may follow it). */
    section(
        name:
            | 'Account'
            | 'Code review'
            | 'Display'
            | 'Projects'
            | 'Repositories'
            | 'Sync settings'
            | 'Updates'
            | 'Changelog',
    ): Locator {
        return this.root
            .getByRole('group', { name: 'Settings sections' })
            .getByRole('button', { name: new RegExp(`^${name}`, 'u') });
    }

    /** A card of the Display section's repository layout. */
    repositoryLayout(name: 'Column' | 'Tabs'): Locator {
        return this.root.getByRole('radiogroup', { name: 'Repository layout' }).getByRole('radio', { name });
    }

    /** A card of the Code review section's comments. */
    reviewComment(name: 'Add it to a draft review' | 'Send it at once'): Locator {
        return this.root.getByRole('radiogroup', { name: 'Comments' }).getByRole('radio', { name });
    }
}
