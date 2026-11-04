import type { Locator, Page } from '@playwright/test';

/** A state the list filters by, as its button and menu name it. */
type RepositoryStateName = 'Closed' | 'Open' | 'Open and closed';

/**
 * Playwright harness for a repository's view (`RepositoryView.vue`, on its sections `/owner/name/issues`,
 * `/owner/name/pulls` and `/owner/name/actions`, and `/owner/name` opening one): the title opening its menu, the section
 * tabs, the workflows and the Alerts bar, the toolbar's grouping and layout, its groups — named regions, or a board's
 * columns — and their rows; untracked, read on demand (D34), "not tracked", how much is read and "Read more", or that
 * GitHub does not show it. In the column layout the same sections and title are in the column.
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

    /** Filters by `state`, from the button naming the state now shown. */
    async chooseState(from: RepositoryStateName, state: RepositoryStateName): Promise<void> {
        await this.root.getByRole('button', { name: from, exact: true }).click();
        await this.page.getByRole('menuitemradio', { name: state, exact: true }).click();
    }

    /** "not tracked", beside the title of a repository githq does not track. */
    get notTrackedChip(): Locator {
        return this.root.getByText('not tracked', { exact: true });
    }

    /** How much of the section's state is read ("100 of 130"), the toolbar's, while it is not tracked. */
    get readCount(): Locator {
        return this.root.getByText(/^\d+\sof\s\d+$/u);
    }

    /** The board's "Read more", beside the count: the next page of a repository not tracked. */
    get readMore(): Locator {
        return this.root.getByRole('button', { name: 'Read more', exact: true });
    }

    /** What a repository GitHub does not show says instead of its list. */
    get notShown(): Locator {
        return this.root.getByText('GitHub does not show this repository', { exact: true });
    }

    /** The way to the repository on GitHub, instead of its list when GitHub does not show it. */
    get openOnGitHub(): Locator {
        return this.root.getByRole('link', { name: 'Open on GitHub', exact: true });
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
