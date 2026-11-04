import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for a repository's Commits section (`CommitGraphView.vue`, `/owner/name/commits`): its rows —
 * only those near the viewport are drawn — the row under the cursor, a row's pull request and CI marks, the lines
 * under the rows and in place of them, the list of branches and tags left of them, and a commit's details right of them.
 */
export class CommitGraphHarness {
    readonly page: Page;
    readonly root: Locator;
    /** The list of branches and tags left of the graph, wherever it renders. */
    readonly refList: Locator;
    /** A commit's details (`CommitDetails.vue`). */
    readonly details: Locator;

    constructor(page: Page, nameWithOwner: string) {
        this.page = page;
        this.root = page.getByRole('main').getByRole('region', { name: `Commits of ${nameWithOwner}` });
        this.refList = page.getByRole('main').getByRole('region', { name: 'Branches and tags' });
        this.details = page.getByRole('main').getByRole('region', { name: 'Commit details' });
    }

    /** The headline in the details. */
    get detailsHeadline(): Locator {
        return this.details.getByRole('heading', { level: 2 });
    }

    /** The rows drawn, newest first. */
    get rows(): Locator {
        return this.root.getByRole('listitem');
    }

    /** The row of the commit whose headline is `headline`. */
    row(headline: string): Locator {
        return this.rows.filter({ hasText: headline });
    }

    /** The header's tool opening the branch and tag list. */
    get refListTool(): Locator {
        return this.page.getByRole('main').getByRole('button', { name: 'Branches and tags' });
    }

    /** The row under the cursor (`aria-current="true"`). */
    get cursorRow(): Locator {
        return this.root.locator('li[aria-current="true"]');
    }

    /** A row's mark named `name`: "Merged pull request", "Checks failing", "Pull request and checks not known yet"… */
    mark(row: Locator, name: string): Locator {
        return row.getByRole('img', { name, exact: true });
    }

    /** The divider between the graph and the rows; its value is how many lanes fit. */
    get divider(): Locator {
        return this.root.getByRole('separator', { name: 'Resize the commit graph' });
    }

    /** Drags the divider by `by` pixels with the mouse, running `whileHeld` before letting go. */
    async dragDivider(by: number, whileHeld?: () => Promise<void>): Promise<void> {
        const box = await this.divider.boundingBox();
        if (!box) {
            throw new Error('The divider is not on screen');
        }

        const x = box.x + box.width / 2;
        const y = box.y + 10;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        await this.page.mouse.move(x + by, y, { steps: 5 });
        await whileHeld?.();
        await this.page.mouse.up();
    }

    /** The edge of the repository's left column, in either layout. */
    get leftColumnEdge(): Locator {
        return this.page.getByRole('separator', { name: 'Resize the left column' });
    }

    /** How far the left column's edge is from the window's, the sidebar's width included. */
    async leftColumnEdgeX(): Promise<number> {
        const box = await this.leftColumnEdge.boundingBox();
        if (!box) {
            throw new Error("The left column's edge is not on screen");
        }

        return Math.round(box.x);
    }

    /** Drags the left column's edge by `by` pixels with the mouse. */
    async dragLeftColumnEdge(by: number): Promise<void> {
        const x = await this.leftColumnEdgeX();
        await this.page.mouse.move(x, 300);
        await this.page.mouse.down();
        await this.page.mouse.move(x + by, 300, { steps: 5 });
        await this.page.mouse.up();
    }

    /** The handle on the details' left edge, beside the graph. */
    get detailsHandle(): Locator {
        return this.details.getByRole('separator', { name: 'Resize the commit details' });
    }

    /** Drags the details' left edge by `by` pixels with the mouse. */
    async dragDetailsHandle(by: number): Promise<void> {
        const box = await this.detailsHandle.boundingBox();
        if (!box) {
            throw new Error("The details' handle is not on screen");
        }

        const x = box.x + box.width / 2;
        const y = box.y + 200;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        await this.page.mouse.move(x + by, y, { steps: 5 });
        await this.page.mouse.up();
    }

    /** The details' width as drawn, in pixels. */
    async detailsWidth(): Promise<number> {
        const box = await this.details.boundingBox();
        if (!box) {
            throw new Error('The details are not on screen');
        }

        return Math.round(box.width);
    }

    /** The list's filter. */
    get refFilter(): Locator {
        return this.refList.getByRole('combobox', { name: 'Filter branches and tags' });
    }

    /** The list's row of the branch or tag named `name`. */
    refRow(name: string): Locator {
        return this.refList.getByRole('option').filter({ hasText: name });
    }

    /** The list's selected row. */
    get selectedRef(): Locator {
        return this.refList.getByRole('option', { selected: true });
    }

    /** The line under the rows at the first commit of the repository. */
    get beginning(): Locator {
        return this.root.getByText(/The beginning of\s.*'s history/);
    }
}
