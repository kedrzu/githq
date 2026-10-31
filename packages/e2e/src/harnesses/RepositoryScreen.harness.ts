import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for a repository's view (`RepositoryView.vue`, on `/owner/name` and its lists
 * `/owner/name/issues` and `/owner/name/pulls`): the title opening its menu, the kind tabs, the toolbar's grouping and layout, its groups —
 * named sections, or a board's columns — and their rows; untracked, the callout offering to track it (J3).
 */
export class RepositoryScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The title of a tracked repository's view (`owner/name`), a button opening its menu (R1). */
    titleMenuButton(nameWithOwner: string): Locator {
        return this.root.getByRole('heading').getByRole('button', { name: `Actions of ${nameWithOwner}` });
    }

    /** Opens the repository's menu from its view's title; returns the menu. */
    async openTitleMenu(nameWithOwner: string): Promise<Locator> {
        await this.titleMenuButton(nameWithOwner).click();
        return this.page.getByRole('menu');
    }

    /** The groups shown, top to bottom. */
    get groups(): Locator {
        return this.root.getByRole('region');
    }

    /** The kind tab `name`, a toggle button pressed while it is the kind listed; its count follows the name. */
    kind(name: 'All' | 'Issues' | 'Pull requests'): Locator {
        return this.root.getByRole('group', { name: 'Kinds' }).getByRole('button', { name: new RegExp(`^${name}\\b`) });
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

    /** The row or card selected with j/k or a click (`aria-current="true"`). */
    get selectedRow(): Locator {
        return this.root.locator('li[aria-current="true"]');
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
