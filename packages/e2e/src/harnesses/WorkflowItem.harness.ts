import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

import { PickerHarness } from './Picker.harness.js';

/** A filter of a workflow's runs, as its chip names it. */
export type WorkflowRunFilterLabel = 'Ref' | 'Event' | 'Status' | 'Actor';

/** What each filter's picker calls its option clearing it. */
const ANY_LABELS: Record<WorkflowRunFilterLabel, string> = {
    Ref: 'Any ref',
    Event: 'Any event',
    Status: 'Any status',
    Actor: 'Anyone',
};

/**
 * Playwright harness for an opened workflow (`WorkflowView.vue`, actions W30–W33, W42–W45), in the panel beside the
 * Workflows section or on its page at `/owner/name/actions/workflows/<file>`: its runs with their filters and
 * grouping, its details, and the tabs Runs and Details that stand for the two columns in a narrow layout.
 */
export class WorkflowItemHarness {
    readonly page: Page;
    readonly root: Locator;

    /** @param name The workflow's name: "Deploy". */
    constructor(page: Page, name: string) {
        this.page = page;
        this.root = page.getByRole('article', { name, exact: true });
    }

    /** The runs: the toolbar and the list under it. */
    get runs(): Locator {
        return this.root.getByRole('region', { name: 'Runs' });
    }

    /** Every run's row, in the order shown. */
    get runRows(): Locator {
        return this.runs.locator('[data-run-key]');
    }

    /** The row of the run numbered `number` (`#12`). */
    run(number: number): Locator {
        return this.runRows.filter({ hasText: new RegExp(`#${number}(?!\\d)`, 'u') });
    }

    /** The groups' headings, each its name and how many runs it holds ("Failed 2"). */
    get groupHeadings(): Locator {
        return this.runs.getByRole('heading', { level: 2 });
    }

    /** "48 runs · newest first", "30+ runs · newest first" while older ones remain. */
    get count(): Locator {
        return this.runs.getByText(/runs? · newest first|^No runs$/u);
    }

    /** The details: triggers, the refs it counts on, its runs, the file. */
    get details(): Locator {
        return this.root.getByRole('region', { name: 'Details' });
    }

    /** One of the narrow layout's tabs, "Runs" or "Details". */
    tab(name: 'Runs' | 'Details'): Locator {
        return this.root.getByRole('group', { name: 'Runs and details' }).getByRole('button', { name });
    }

    /** A filter's chip by its name ("Ref"), whatever value it has set. */
    filterChip(label: WorkflowRunFilterLabel): Locator {
        return this.runs
            .getByRole('group', { name: 'Filter runs' })
            .getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}(: |$)`, 'u') });
    }

    /** Sets a filter to `value` through its chip's picker; `null` clears it, choosing "Any …". */
    async filter(label: WorkflowRunFilterLabel, value: string | null): Promise<void> {
        await this.filterChip(label).click();
        const picker = new PickerHarness(this.page, label);
        if (value === null) {
            // The "Any …" option stands only above an empty filter, so it is clicked.
            await picker.option(ANY_LABELS[label]).click();
        } else {
            await picker.choose(value);
        }
    }

    /** Groups the runs as the menu names it: "None", "Status", "Ref", "Event", "Day", "Actor". */
    async groupBy(name: string): Promise<void> {
        await this.runs.getByRole('button', { name: /^Group: /u }).click();
        await this.page.getByRole('menuitemradio', { name: new RegExp(`^${escapeRegExp(name)}`, 'u') }).click();
    }
}
