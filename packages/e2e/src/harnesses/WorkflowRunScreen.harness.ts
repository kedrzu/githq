import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for a workflow's run on its own page (`WorkflowRunView.vue`, actions W4a), at
 * `/owner/name/actions/runs/123`: its title, what the run is, its jobs and steps, and the log's pane.
 */
export class WorkflowRunScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main').getByRole('article');
    }

    /** The page's title: "Deploy #12". */
    heading(name: string): Locator {
        return this.root.getByRole('heading', { name, level: 1 });
    }

    /** What the run is: its state, ref, event, commit and when. */
    get summary(): Locator {
        return this.page.getByTestId('workflow-run-summary');
    }

    /** The jobs, in the order shown. */
    get jobs(): Locator {
        return this.page.getByTestId('workflow-job');
    }

    /** A job's button, by its name. */
    job(name: string): Locator {
        return this.jobs.filter({ hasText: name });
    }

    /** The selected job's steps. */
    get steps(): Locator {
        return this.page.getByTestId('workflow-step');
    }

    /** The lines of the log shown; none while something stands in for it. */
    get logLines(): Locator {
        return this.page.getByTestId('workflow-job-log').getByRole('listitem');
    }

    /** The heading of what stands in for the log or for the columns. */
    message(name: string): Locator {
        return this.root.getByRole('heading', { name, level: 2 });
    }
}
