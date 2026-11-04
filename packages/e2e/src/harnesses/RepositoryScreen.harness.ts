import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for a repository's view (`RepositoryView.vue`, on its sections `/owner/name/issues`,
 * `/owner/name/pulls` and `/owner/name/actions`, and `/owner/name` opening one): the title opening its menu, the section
 * tabs, the workflows and the Alerts bar, the toolbar's grouping and layout, its groups — named regions, or a board's
 * columns — and their rows; untracked, the lines saying what githq has of it (J3). In the column layout the same
 * sections and title are in the column.
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

    /** The section tab `name`, a toggle button pressed while it is shown; tracked, its count of open items follows. */
    section(name: 'Commits' | 'Issues' | 'Pull requests' | 'Workflows'): Locator {
        return this.root
            .getByRole('group', { name: 'Sections' })
            .getByRole('button', { name: new RegExp(`^${name}\\b`) });
    }

    /** The pane's title in the column layout: the section's name. */
    sectionTitle(name: 'Commits' | 'Issues' | 'Pull requests' | 'Workflows'): Locator {
        return this.root.getByRole('heading', { name, level: 1 });
    }

    /** The grouping menu's button ("Group: Milestone"). */
    get groupingButton(): Locator {
        return this.root.getByRole('button', { name: /^Group:/ });
    }

    /** The List / Board toggle's option `name`, pressed while it is the layout. */
    layout(name: 'Board' | 'List'): Locator {
        return this.root.getByRole('group', { name: 'Layout' }).getByRole('button', { name, exact: true });
    }

    /** The lines under an untracked repository's list (J3). */
    notTracked(nameWithOwner: string): Locator {
        return this.root.getByRole('region', { name: `You're not tracking ${nameWithOwner}` });
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

    /** A workflow's row button in the Workflows section, by the workflow's name. */
    workflow(name: string): Locator {
        return this.root.getByRole('button', { name, exact: true });
    }

    /** The runs of the workflow `name` unfolded under its row (actions W3b): its ref filter and a button per run. */
    runsOf(name: string): Locator {
        return this.root.getByRole('group', { name: `Runs of ${name}`, exact: true });
    }

    /** The lines of the runs of the workflow `name` unfolded under its row. */
    runLines(name: string): Locator {
        return this.runsOf(name).locator('button[data-mark]');
    }

    /** The Workflows section's Alerts bar: which branches and tags raise alerts. */
    get alertsBar(): Locator {
        return this.root.getByTestId('workflow-alerts-bar');
    }
}
