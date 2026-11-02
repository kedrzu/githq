import type { Locator, Page } from '@playwright/test';

/** A line of the merge panel's landing, by its label. */
export type MergePanelLineName = 'Commit' | 'Method';

/**
 * Playwright harness for the merge panel (`MergePanel.vue`, `⇧M`), the dialog "Merge owner/name#N" over any screen:
 * its read, the methods offered, the commit text and its editor, and GitHub's refusal.
 */
export class MergePanelHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('dialog', { name: /^Merge \S+#\d+$/ });
    }

    /** The method buttons, while there is more than one to choose from; the chosen one is pressed. */
    get methods(): Locator {
        return this.root.getByRole('group', { name: 'Merge method' }).getByRole('button');
    }

    /** The method button named `name` ("Squash", "Merge commit", "Rebase"). */
    method(name: string): Locator {
        return this.methods.filter({ hasText: name });
    }

    /** The value of a line of the landing: the method, or the commit's title and its first lines. */
    line(name: MergePanelLineName): Locator {
        return this.root.locator('dt', { hasText: name }).locator('xpath=following-sibling::dd[1]');
    }

    /** The commit title's field, while the text is edited (`E`). */
    get titleField(): Locator {
        return this.root.getByRole('textbox', { name: 'Commit title' });
    }

    /** Why GitHub refused the merge at once. */
    get refusal(): Locator {
        return this.root.getByRole('alert');
    }
}
