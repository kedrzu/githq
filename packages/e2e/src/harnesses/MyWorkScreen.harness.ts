import type { Locator, Page } from '@playwright/test';

/** A "my work" filter tab, by its label. */
export type MyWorkFilterName = 'All' | 'Needs me' | 'Waiting on others';

/** The "my work" groups by their labels — as the list and the sidebar name them — in their order. */
export const MY_WORK_GROUP_NAMES = ['Review requested', 'My pull requests', 'Assigned to me', 'Mentioned'] as const;

/** A "my work" group, by its label. */
export type MyWorkGroupName = (typeof MY_WORK_GROUP_NAMES)[number];

/**
 * Playwright harness for "my work" (`MyWorkView.vue`, on `/` and its groups' dashboard lists, `/pulls`, …): the
 * filter tabs, the grouping menu, the groups — named sections, each a header with its count over a list of rows; on the board, a
 * column with its cards — the selected row and the List / Board toggle.
 */
export class MyWorkScreenHarness {
    readonly root: Locator;

    constructor(page: Page) {
        this.root = page.getByRole('main');
    }

    /** The groups shown, top to bottom. */
    get groups(): Locator {
        return this.root.getByRole('region');
    }

    /** The row selected with j/k or a click (`aria-current="true"`). */
    get selectedRow(): Locator {
        return this.root.locator('li[aria-current="true"]');
    }

    /** The filter tab `name`, a toggle button pressed while it is the filter. */
    filter(name: MyWorkFilterName): Locator {
        return this.root.getByRole('group', { name: 'Filters' }).getByRole('button', { name, exact: true });
    }

    /** The grouping menu's button ("Group: Reason"). */
    get groupingButton(): Locator {
        return this.root.getByRole('button', { name: /^Group:/ });
    }

    /** The List / Board toggle's option `name`, pressed while it is the layout. */
    layout(name: 'Board' | 'List'): Locator {
        return this.root.getByRole('group', { name: 'Layout' }).getByRole('button', { name, exact: true });
    }

    /** The group `name`: a reason's, or — grouped otherwise — a status's, an author's login, a repository's. */
    group(name: string): Locator {
        return this.root.getByRole('region', { name, exact: true });
    }

    /** The count in the header of the group `name`: its top-level rows, or "…" while it is still arriving. */
    groupCount(name: string): Locator {
        return this.group(name).getByRole('heading').locator('span').last();
    }

    /** The rows of the group `name`, nested ones included, top to bottom. */
    rows(name: string): Locator {
        return this.group(name).getByRole('listitem');
    }

    /** The row titled `title`, in any group. */
    row(title: string): Locator {
        return this.root.getByRole('listitem').filter({ hasText: title });
    }
}
