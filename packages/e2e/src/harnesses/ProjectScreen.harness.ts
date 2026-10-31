import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for a tracked project's view (`ProjectView.vue`, on `/users|orgs/<owner>/projects/<n>`): its
 * saved views as tabs, the shown view's filter, the toolbar's grouping and layout, "Changed here · Reset", its groups
 * — named sections, or a board's columns — with their rows or cards, and "New draft in …" at the end of each.
 */
export class ProjectScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The tabs of the saved views, in GitHub's order. */
    get tabs(): Locator {
        return this.root.getByRole('navigation', { name: 'Saved views' }).getByRole('link');
    }

    /** The tab shown now. */
    get currentTab(): Locator {
        return this.tabs.and(this.root.locator('[aria-current="page"]'));
    }

    /** The grouping menu's button ("Group: Status"). */
    get groupingButton(): Locator {
        return this.root.getByRole('button', { name: /^Group:/ });
    }

    /** "Reset" beside "Changed here", while the view's options differ from the saved view's. */
    get resetButton(): Locator {
        return this.root.getByRole('button', { name: 'Reset', exact: true });
    }

    /** The groups shown, top to bottom or left to right. */
    get groups(): Locator {
        return this.root.getByRole('region');
    }

    /** The row or card selected with j/k or the arrows (`aria-current="true"`). */
    get selectedRow(): Locator {
        return this.root.locator('li[aria-current="true"]');
    }

    /** The tab of the saved view `name`. */
    tab(name: string): Locator {
        return this.tabs.filter({ hasText: name });
    }

    /** The shown view's filter, term by term, under the toolbar. */
    filter(view: string): Locator {
        return this.root.getByRole('group', { name: `Filter of “${view}”` });
    }

    /** The List / Board toggle's option `name`, pressed while it is the layout. */
    layout(name: 'Board' | 'List'): Locator {
        return this.root.getByRole('group', { name: 'Layout' }).getByRole('button', { name, exact: true });
    }

    /** The group or column `name`. */
    group(name: string): Locator {
        return this.root.getByRole('region', { name, exact: true });
    }

    /** The rows or cards of the group `name`, top to bottom. */
    rows(name: string): Locator {
        return this.group(name).getByRole('listitem');
    }

    /** The row or card titled `title`, in any group. */
    row(title: string): Locator {
        return this.root.getByRole('listitem').filter({ hasText: title });
    }

    /** Writes a draft issue at the end of the group `name`: "New draft in …", its title, Enter. */
    async addDraft(group: string, title: string): Promise<void> {
        await this.group(group)
            .getByRole('button', { name: `New draft in ${group}` })
            .click();
        const field = this.root.getByRole('textbox', { name: `New draft issue in ${group}` });
        await field.fill(title);
        await field.press('Enter');
    }
}
