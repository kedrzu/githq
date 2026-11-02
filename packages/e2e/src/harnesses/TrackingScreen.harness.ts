import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

/**
 * Playwright harness for Settings' What to track section (`TrackingSection.vue` over `TrackingChooser.vue` — G8): the
 * owners on the left, the search above the rows, and a checkbox on each repository and project, ticked while it is
 * tracked. Ticking and unticking only stage changes; the bar "Changes to save" saves them or discards them.
 */
export class TrackingScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The search field, above the repositories. */
    get search(): Locator {
        return this.root.getByRole('textbox', { name: 'Filter repositories' });
    }

    /** An owner in the owners list on the left, by login. */
    owner(login: string): Locator {
        return this.root
            .getByRole('radiogroup', { name: 'Owners' })
            .getByRole('radio', { name: new RegExp(`^${escapeRegExp(login)} `, 'u') });
    }

    /** The checkbox of a repository (`owner/name`) or project (its title), ticked while it is tracked or staged so. */
    row(name: string): Locator {
        if (name.includes('/')) {
            return this.root
                .getByRole('region', { name: 'Repositories', exact: true })
                .getByRole('checkbox', { name: new RegExp(`^${escapeRegExp(name)}(?: |$)`, 'u') });
        }

        return this.root
            .getByRole('region', { name: 'Projects', exact: true })
            .getByRole('checkbox', { name: new RegExp(`^${escapeRegExp(name)}(?: |$)`, 'u') });
    }

    /** The bar of the staged changes, "Changes to save". */
    get pending(): Locator {
        return this.root.getByRole('region', { name: 'Changes to save' });
    }

    /** Saves the staged changes with the bar's "Save N changes". */
    async save(): Promise<void> {
        await this.pending.getByRole('button', { name: /^Save \d+ changes?/u }).click();
    }

    /** Discards the staged changes with the bar's "Discard". */
    async discard(): Promise<void> {
        await this.pending.getByRole('button', { name: /^Discard/u }).click();
    }

    /** Tracks a repository or project: ticks it and saves. */
    async track(name: string): Promise<void> {
        await this.row(name).check();
        await this.save();
    }

    /** Untracks a repository or project: unticks it and saves. */
    async untrack(name: string): Promise<void> {
        await this.row(name).uncheck();
        await this.save();
    }
}
