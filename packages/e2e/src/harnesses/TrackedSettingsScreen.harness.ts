import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for a tracked repository's or project's settings (`RepositorySettingsView.vue`,
 * `ProjectSettingsView.vue`, T16, T17), under Settings' header.
 */
export class TrackedSettingsScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The head's name of the repository (`owner/name`) or project (its title). */
    heading(name: string): Locator {
        return this.root.getByRole('heading', { name, level: 2, exact: true });
    }

    /** The head's way back, named after the section of Settings ("Repositories", "Projects"). */
    backButton(section: 'Projects' | 'Repositories'): Locator {
        return this.root.getByRole('button', { name: section, exact: true });
    }

    /** What the Tracking section says of how it stands ("synced 14s ago · 3 open items in this browser"). */
    get trackingState(): Locator {
        return this.root.getByText(/open\sitems?\sin\sthis\sbrowser/u);
    }

    get untrackButton(): Locator {
        return this.root.getByRole('button', { name: 'Untrack', exact: true });
    }

    /** A repository's Workflow alerts section (actions T16, `WorkflowAlertsBlock.vue`). */
    get workflowAlerts(): Locator {
        return this.root.getByRole('region', { name: 'Workflow alerts', exact: true });
    }

    /** Workflow alerts' switch of the default branch. */
    get defaultBranchSwitch(): Locator {
        return this.workflowAlerts.getByRole('switch', { name: 'Default branch' });
    }

    /** Workflow alerts' add field, which turns into the editor. */
    get addPatternField(): Locator {
        return this.workflowAlerts.locator('#workflow-alerts-add');
    }

    /** A pattern's row in Workflow alerts. */
    pattern(pattern: string): Locator {
        return this.workflowAlerts.locator(`[data-alert-key="pattern:${pattern}"]`);
    }
}
