import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

/**
 * Playwright harness for picking projects to track (T22): Settings' Projects section with its "Track projects" button
 * (`TrackedProjectsSection.vue`), and the dialog it opens (`TrackProjectsDialog.vue` over `ProjectChooser.vue`) — the owners
 * on the left, the filter above the projects, a checkbox on each, fixed and ticked on a tracked one, and the footer's
 * "Track N projects".
 */
export class ProjectTrackingScreenHarness {
    readonly page: Page;
    /** The dialog "Track projects". */
    readonly dialog: Locator;

    constructor(page: Page) {
        this.page = page;
        this.dialog = page.getByRole('dialog', { name: 'Track projects' });
    }

    /** The Projects section's button opening the dialog. */
    get openButton(): Locator {
        return this.page.getByRole('main').getByRole('button', { name: 'Track projects' });
    }

    /** The dialog's filter, above the projects. */
    get search(): Locator {
        return this.dialog.getByRole('textbox', { name: 'Filter projects' });
    }

    /** The checkbox of a project, by its title: ticked while it is tracked or picked. */
    row(title: string): Locator {
        return this.dialog
            .getByRole('region', { name: 'Projects', exact: true })
            .getByRole('checkbox', { name: new RegExp(`^${escapeRegExp(title)}\\s*#`, 'u') });
    }

    /** "Show" on the header of an owner whose every project is tracked, folded to it. */
    get showButton(): Locator {
        return this.dialog.getByRole('button', { name: 'Show', exact: true });
    }

    /** The footer's "Track N projects". */
    get trackButton(): Locator {
        return this.dialog.getByRole('button', { name: /^Track (?:\d+ )?projects?$/u });
    }
}
