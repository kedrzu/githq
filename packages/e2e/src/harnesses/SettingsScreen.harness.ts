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
            | 'Privacy'
            | 'Projects'
            | 'Repositories'
            | 'Sync settings'
            | 'Updates',
    ): Locator {
        return this.root
            .getByRole('group', { name: 'Settings sections' })
            .getByRole('button', { name: new RegExp(`^${name}`, 'u') });
    }

    /** The Display section's switch for animations. */
    get animationsSwitch(): Locator {
        return this.root.getByRole('switch', { name: 'Animations' });
    }

    /** A preset of the Display section's typography (`TypographyBlock.vue`), pressed while chosen. */
    preset(name: 'Compact' | 'Custom' | 'Default' | 'Spaced'): Locator {
        return this.root.getByRole('group', { name: 'Preset' }).getByRole('button', { name, exact: true });
    }

    /** The font select of a typography role's card, named by the font it shows now; it opens the role's fonts. */
    font(role: 'Code' | 'Interface' | 'Reading', current: string): Locator {
        return this.root
            .getByRole('region', { name: role })
            .getByRole('button', { name: `Font ${current}`, exact: true });
    }

    /** The Privacy section's switch for usage statistics. */
    get usageStatisticsSwitch(): Locator {
        return this.root.getByRole('switch', { name: 'Share usage statistics' });
    }

    /** A card of the Code review section's comments. */
    reviewComment(name: 'Add it to a draft review' | 'Send it at once'): Locator {
        return this.root.getByRole('radiogroup', { name: 'Comments' }).getByRole('radio', { name });
    }
}
