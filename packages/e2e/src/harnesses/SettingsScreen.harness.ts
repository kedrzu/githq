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
        name: 'Account' | 'Display' | 'Projects' | 'Repositories' | 'Sync settings' | 'Updates' | 'Changelog',
    ): Locator {
        return this.root
            .getByRole('group', { name: 'Settings sections' })
            .getByRole('button', { name: new RegExp(`^${name}`, 'u') });
    }

    /** A card of the Display section's repository layout. */
    repositoryLayout(name: 'Column' | 'Tabs'): Locator {
        return this.root.getByRole('radiogroup', { name: 'Repository layout' }).getByRole('radio', { name });
    }

    /** The Display section's switch for animations. */
    get animationsSwitch(): Locator {
        return this.root.getByRole('switch', { name: 'Animations' });
    }
}
