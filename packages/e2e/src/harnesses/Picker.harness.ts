import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

/**
 * Playwright harness for an open picker (`Picker.vue`) — a panel with a filter and a list of options named after
 * what it picks ("Labels"). One value is picked by choosing it; several are toggled, then applied
 * together when the picker closes ({@link close}).
 */
export class PickerHarness {
    readonly page: Page;
    readonly root: Locator;

    /** @param label The picker's name: "Labels", "Status", "Request a review". */
    constructor(page: Page, label: string) {
        this.page = page;
        // The panel is named after its trigger ("Labels: bug"); its list after what it picks.
        this.root = page.getByRole('dialog').filter({ has: page.getByRole('listbox', { name: label, exact: true }) });
    }

    /** The filter the keys go to while it is open. */
    get filter(): Locator {
        return this.root.getByRole('textbox');
    }

    /** The option labelled `name`, whatever dim detail follows it ("octocat you"). */
    option(name: string): Locator {
        return this.root.getByRole('option', {
            name: new RegExp(`^${escapeRegExp(name)}( |$)`),
        });
    }

    /**
     * Chooses each option in turn from the keyboard — its name typed into the filter, then Enter: picks one
     * value, or toggles one of several.
     */
    async choose(...names: readonly string[]): Promise<void> {
        // Typed before the options arrive, the filter would highlight nothing (they come with the repository's
        // metadata, read as the picker opens).
        await expect(this.root.getByRole('option').first()).toBeVisible();
        for (const name of names) {
            await this.filter.fill(name);
            await expect(this.root.getByRole('option')).toHaveCount(1);
            // Enter acts on the highlighted option, which the filter moves to the first match.
            await expect(this.option(name)).toHaveAttribute('data-highlighted');
            await this.filter.press('Enter');
        }
    }

    /** Closes it with Escape: a picker of several values applies what was toggled. */
    async close(): Promise<void> {
        await this.page.keyboard.press('Escape');
    }
}
