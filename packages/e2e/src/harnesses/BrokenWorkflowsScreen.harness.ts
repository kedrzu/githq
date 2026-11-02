import type { Locator, Page } from '@playwright/test';

/** The groups of the broken workflows' screen, top to bottom. */
export type BrokenWorkflowsGroupName = 'New' | 'Ongoing' | 'Not known yet' | "Can't tell";

/**
 * Playwright harness for the broken workflows of every tracked repository (`BrokenWorkflowsView.vue`, actions W2):
 * its heading, its groups and their rows, and the all-green state.
 */
export class BrokenWorkflowsScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The screen's heading, "Broken workflows". */
    get heading(): Locator {
        return this.root.getByRole('heading', { name: 'Broken workflows', level: 1 });
    }

    /** A group of rows, by its heading. */
    group(name: BrokenWorkflowsGroupName): Locator {
        return this.root.getByRole('region', { name, exact: true });
    }

    /** A broken workflow's row button, by the workflow's name. */
    workflow(name: string): Locator {
        return this.root.getByRole('button', { name, exact: true });
    }

    /** The all-green state's title, "All green, exit code 0" (W2b). */
    get allGreen(): Locator {
        return this.root.getByRole('heading', { name: 'All green, exit code 0' });
    }
}
