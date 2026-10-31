import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for the tracking page (`TrackingView.vue`, on `/tracking` — G8): what is tracked, each row with
 * "Untrack" while it is hovered or focused.
 */
export class TrackingScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The tracked repository (`owner/name`) or project (its title) of the tab shown. */
    tracked(name: string): Locator {
        return this.root
            .getByRole('region', { name: 'Tracked', exact: true })
            .getByRole('listitem')
            .filter({ has: this.page.getByRole('link', { name, exact: true }) });
    }

    /** Untracks a repository or project with its row's "Untrack", which shows while the row is hovered. */
    async untrack(name: string): Promise<void> {
        const row = this.tracked(name);
        await row.hover();
        await row.getByRole('button', { name: /^Untrack/ }).click();
    }
}
