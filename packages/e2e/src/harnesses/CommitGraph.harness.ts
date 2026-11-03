import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for a repository's Commits section (`CommitGraphView.vue`, `/owner/name/commits`): its rows —
 * only those near the viewport are drawn — the row under the cursor, a row's pull request and CI marks, and the lines
 * under the rows and in place of them.
 */
export class CommitGraphHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page, nameWithOwner: string) {
        this.page = page;
        this.root = page.getByRole('main').getByRole('region', { name: `Commits of ${nameWithOwner}` });
    }

    /** The rows drawn, newest first. */
    get rows(): Locator {
        return this.root.getByRole('listitem');
    }

    /** The row of the commit whose headline is `headline`. */
    row(headline: string): Locator {
        return this.rows.filter({ hasText: headline });
    }

    /** The row under the cursor (`aria-current="true"`). */
    get cursorRow(): Locator {
        return this.root.locator('li[aria-current="true"]');
    }

    /** A row's mark named `name`: "Merged pull request", "Checks failing", "Pull request and checks not known yet"… */
    mark(row: Locator, name: string): Locator {
        return row.getByRole('img', { name, exact: true });
    }

    /** The line under the rows at the first commit of the repository. */
    get beginning(): Locator {
        return this.root.getByText(/The beginning of\s.*'s history/);
    }
}
