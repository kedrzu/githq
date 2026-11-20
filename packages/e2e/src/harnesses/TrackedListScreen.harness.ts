import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for Settings' Repositories and Projects (`TrackedListView.vue`, G8, T17, D44): the head counting
 * what is tracked, then one flat list in the user's order, each row naming its owner before its name.
 */
export class TrackedListScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The head: "15 tracked repositories", "3 tracked projects". */
    get heading(): Locator {
        return this.root.getByRole('heading', { level: 2, name: /^\d+\stracked\s/u });
    }

    /** The note with nothing tracked (ES24): "No repositories tracked yet", "No projects tracked yet". */
    get nothingTracked(): Locator {
        return this.root.getByRole('heading', { level: 2, name: /^No\s\w+\stracked\syet$/u });
    }

    /** The list: "Tracked repositories" or "Tracked projects". */
    get list(): Locator {
        return this.root.getByRole('list', { name: /^Tracked\s(repositories|projects)$/u });
    }

    /** Every row, in the order shown. */
    get rows(): Locator {
        return this.list.getByRole('listitem');
    }

    /** A row by its owner and name as shown: a repository's `owner/name`, a project's `owner / title`. */
    row(title: string): Locator {
        return this.rows.filter({ has: this.page.getByText(title, { exact: true }) });
    }

    /** The row the keys act on. */
    get selectedRow(): Locator {
        return this.root.locator('li[aria-current="true"]');
    }
}
