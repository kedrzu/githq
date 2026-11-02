import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

/**
 * Playwright harness for picking repositories to track (T18): Settings' Repositories section with its "Track
 * repositories" button (`TrackedRepositoriesSection.vue`), and the dialog it opens (`TrackRepositoriesDialog.vue` over
 * `TrackingChooser.vue`) — the owners on the left, the filter above the rows, a checkbox on each repository, fixed and
 * ticked on a tracked one, and the footer's "Track N repositories".
 */
export class TrackingScreenHarness {
    readonly page: Page;
    /** The dialog "Track repositories". */
    readonly dialog: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dialog = page.getByRole('dialog', { name: 'Track repositories' });
    }

    /** The Repositories section's button opening the dialog. */
    get openButton(): Locator {
        return this.page.getByRole('main').getByRole('button', { name: 'Track repositories' });
    }

    /** The dialog's filter, above the repositories. */
    get search(): Locator {
        return this.dialog.getByRole('textbox', { name: 'Filter repositories' });
    }

    /** An owner in the dialog's owners list on the left, by login. */
    owner(login: string): Locator {
        return this.dialog
            .getByRole('radiogroup', { name: 'Owners' })
            .getByRole('radio', { name: new RegExp(`^${escapeRegExp(login)} `, 'u') });
    }

    /** The checkbox of a repository (`owner/name`) in the dialog: ticked while it is tracked or picked. */
    row(nameWithOwner: string): Locator {
        return this.dialog
            .getByRole('region', { name: 'Repositories', exact: true })
            .getByRole('checkbox', { name: new RegExp(`^${escapeRegExp(nameWithOwner)}(?: |$)`, 'u') });
    }

    /** The footer's "Track N repositories". */
    get trackButton(): Locator {
        return this.dialog.getByRole('button', { name: /^Track (?:\d+ )?repositor(?:y|ies)$/u });
    }

    /** Tracks repositories (`owner/name`) in the open dialog: ticks them and confirms. */
    async track(...names: string[]): Promise<void> {
        for (const name of names) {
            await this.row(name).check();
        }

        await this.trackButton.click();
        await this.dialog.waitFor({ state: 'hidden' });
    }
}
