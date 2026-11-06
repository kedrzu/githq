import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for Settings' Repositories and Projects (`TrackedListView.vue`, G8, T17): the head counting
 * what is tracked, the owners' groups, each a list named after the owner, and their rows.
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

    /** The note with nothing tracked (ES24): "No repositories tracked", "No projects tracked". */
    get nothingTracked(): Locator {
        return this.root.getByRole('heading', { level: 2, name: /^No\s\w+\stracked$/u });
    }

    /** The header of an owner's group: its icon, login, standing and counts, and "Track more". */
    groupHeader(owner: string): Locator {
        return this.root.getByRole('heading', { level: 3, name: owner, exact: true }).locator('..');
    }

    /** A row, by its owner's group and its name (a repository's without the owner, a project's title). */
    row(owner: string, name: string): Locator {
        return this.root
            .getByRole('list', { name: owner, exact: true })
            .getByRole('listitem')
            .filter({ has: this.page.getByText(name, { exact: true }) });
    }

    /** The row the keys act on. */
    get selectedRow(): Locator {
        return this.root.locator('li[aria-current="true"]');
    }
}
