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
        return this.root.getByTestId('workflow-run-summary');
    }

    /** The jobs, in the order shown. */
    get jobs(): Locator {
        return this.root.getByTestId('workflow-job');
    }

    /** A job's button, by its name. */
    job(name: string): Locator {
        return this.jobs.filter({ hasText: name });
    }

    /** What stands in for the jobs while they are read. */
    get jobsPlaceholder(): Locator {
        return this.root.getByTestId('workflow-jobs-placeholder');
    }

    /** The selected job's steps. */
    get steps(): Locator {
        return this.root.getByTestId('workflow-step');
    }

    /** The button a running job's pane offers to follow it on GitHub. */
    get watchOnGitHub(): Locator {
        return this.root.getByRole('button', { name: /Watch on GitHub/u });
    }

    /** The scrolling log; none while something stands in for it. */
    get log(): Locator {
        return this.root.getByTestId('workflow-job-log');
    }

    /** What stands in for the log while it is read. */
    get logPlaceholder(): Locator {
        return this.root.getByTestId('workflow-log-placeholder');
    }

    /** Every row of the log in the DOM, of whatever kind: only the ones around the view are there. */
    get logRows(): Locator {
        return this.log.getByRole('listitem');
    }

    /** The lines of the log in view: not its steps' heads, nor its folded steps' lines. */
    get logLines(): Locator {
        return this.log.getByTestId('workflow-log-line');
    }

    /** The text of those lines, without their numbers. */
    get logTexts(): Locator {
        return this.log.getByTestId('workflow-log-text');
    }

    /** "… N more characters" at the end of the lines cut short. */
    get logMore(): Locator {
        return this.log.getByTestId('workflow-log-more');
    }

    /** The line the cursor is on, while it isn't folded away. */
    get cursorLine(): Locator {
        return this.logLines.and(this.root.locator('[aria-current="true"]'));
    }

    /** A step's head in the log, by its name. */
    logStep(name: string): Locator {
        return this.log.getByTestId('workflow-log-step').filter({ hasText: name }).getByRole('button');
    }

    /** "Error 1 of 2", or that there is no marker. */
    get logErrors(): Locator {
        return this.root.getByTestId('workflow-log-errors');
    }

    /** What the log says at its end when the job failed with no error marker. */
    get logEnd(): Locator {
        return this.log.getByTestId('workflow-log-end');
    }

    /** The toolbar's toggle for wrapping the log's lines. */
    get wrapToggle(): Locator {
        return this.root.getByTestId('workflow-log-wrap');
    }

    /** The toolbar's toggle for showing the log's times. */
    get timesToggle(): Locator {
        return this.root.getByTestId('workflow-log-times');
    }

    /** The search bar, in the toolbar's place while a search is open. */
    get search(): Locator {
        return this.root.getByTestId('workflow-log-search');
    }

    /** The search bar's field. */
    get searchField(): Locator {
        return this.root.getByTestId('workflow-log-search-field');
    }

    /** "3 of 12", or among only the matches "12 lines". */
    get searchPosition(): Locator {
        return this.root.getByTestId('workflow-log-search-position');
    }

    /** A search's count on the selected job. */
    get jobMatches(): Locator {
        return this.root.getByTestId('workflow-job-matches');
    }

    /** A search's counts on the selected job's steps. */
    get stepMatches(): Locator {
        return this.root.getByTestId('workflow-step-matches');
    }

    /** The rows standing for lines left out among only a search's matches. */
    get logGaps(): Locator {
        return this.log.getByTestId('workflow-log-gap');
    }

    /** The way to GitHub offered by what stands in for the log or for the columns. */
    get openOnGitHubButton(): Locator {
        return this.root.getByRole('button', { name: /Open on GitHub/u });
    }

    /** The heading of what stands in for the log or for the columns. */
    message(name: string): Locator {
        return this.root.getByRole('heading', { name, level: 2 });
    }
}
