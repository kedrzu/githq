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

    /** The scrolling log; none while something stands in for it. */
    get log(): Locator {
        return this.page.getByTestId('workflow-job-log');
    }

    /** The lines of the log in view: not its steps' heads, nor its folded steps' lines. */
    get logLines(): Locator {
        return this.log.getByTestId('workflow-log-line');
    }

    /** The text of those lines, without their numbers. */
    get logTexts(): Locator {
        return this.log.getByTestId('workflow-log-text');
    }

    /** The line the cursor is on, while it isn't folded away. */
    get cursorLine(): Locator {
        return this.logLines.and(this.page.locator('[aria-current="true"]'));
    }

    /** A step's head in the log, by its name. */
    logStep(name: string): Locator {
        return this.log.getByTestId('workflow-log-step').filter({ hasText: name }).getByRole('button');
    }

    /** "Error 1 of 2", or that there is no marker. */
    get logErrors(): Locator {
        return this.page.getByTestId('workflow-log-errors');
    }

    /** The heading of what stands in for the log or for the columns. */
    message(name: string): Locator {
        return this.root.getByRole('heading', { name, level: 2 });
    }
}
