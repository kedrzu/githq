import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for Settings' Repositories and Projects sections (`TrackingView.vue` — G8): what is tracked, each row
 * with "Untrack" while it is hovered or focused, and what is not, each with "Track". The search and the owner filter
 * sit in the Settings header.
 */
export class TrackingScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The search field, in the header. */
    get search(): Locator {
        return this.root.getByRole('textbox', { name: 'Find something to track' });
    }

    /** The owner filter, in the header. */
    get ownerFilter(): Locator {
        return this.root.getByRole('button', { name: /^Owner: / });
    }

    /** The repository (`owner/name`) or project (its title) offered under "Not tracked". */
    notTracked(name: string): Locator {
        return this.root.getByRole('region', { name: 'Not tracked' }).getByRole('listitem').filter({ hasText: name });
    }

    /** The tracked repository (`owner/name`) or project (its title) of the section shown. */
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
