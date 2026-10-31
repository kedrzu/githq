import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for a repository's view (`RepositoryView.vue`, on `/owner/name`): the toolbar's grouping and
 * layout, its groups — named sections, or a board's columns — and their rows; untracked, the callout offering to
 * track it (J3).
 */
export class RepositoryScreenHarness {
    readonly root: Locator;

    constructor(page: Page) {
        this.root = page.getByRole('main');
    }

    /** The groups shown, top to bottom. */
    get groups(): Locator {
        return this.root.getByRole('region');
    }

    /** The grouping menu's button ("Group: Milestone"). */
    get groupingButton(): Locator {
        return this.root.getByRole('button', { name: /^Group:/ });
    }

    /** The List / Board toggle's option `name`, pressed while it is the layout. */
    layout(name: 'Board' | 'List'): Locator {
        return this.root.getByRole('group', { name: 'Layout' }).getByRole('button', { name, exact: true });
    }

    /** The callout of an untracked repository (J3). */
    notTracked(nameWithOwner: string): Locator {
        return this.root.getByRole('region', { name: `You're not tracking ${nameWithOwner}` });
    }

    /** The callout's "Track owner/name". */
    trackButton(nameWithOwner: string): Locator {
        return this.root.getByRole('button', { name: `Track ${nameWithOwner}` });
    }

    /** The group `name`. */
    group(name: string): Locator {
        return this.root.getByRole('region', { name, exact: true });
    }

    /** The rows or cards of the group `name`, top to bottom. */
    rows(name: string): Locator {
        return this.group(name).getByRole('listitem');
    }

    /** The row titled `title`, in any group. */
    row(title: string): Locator {
        return this.root.getByRole('listitem').filter({ hasText: title });
    }
}
