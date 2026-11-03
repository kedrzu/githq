import type { Locator, Page } from '@playwright/test';

/** A line of the merge panel's landing, by its label. */
export type MergePanelLineName = 'Commit' | 'Email' | 'Method';

/**
 * Playwright harness for the merge panel (`MergePanel.vue`, `⇧M`), the dialog "Merge owner/name#N" — or "Merge the
 * stack …" — over any screen: its read, a stack's pull requests, the methods offered, the commit text and its editor,
 * and GitHub's refusal.
 */
export class MergePanelHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('dialog', { name: /^Merge (\S+#\d+|the stack .+)$/ });
    }

    /** A stack's pull requests, first to last, each with what it says now. */
    get stackMembers(): Locator {
        return this.root.getByTestId('stack-member');
    }

    /** The row of a stack's pull request `#number`. */
    stackMember(number: number): Locator {
        return this.stackMembers.filter({ hasText: new RegExp(`^#${number}\\D`) });
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

    /**
     * The primary action, `⌘↵`'s: the merge, the step towards it ("Mark ready for review", "Update branch"), the link
     * to GitHub's conflict editor, or — off — why there is none.
     */
    get primary(): Locator {
        return this.root.locator('footer').locator('a, button').last();
    }

    /** "Take out of queue" (`⇧Q`), while it is in a merge queue. */
    get takeOutButton(): Locator {
        return this.root.getByRole('button', { name: /Take out of queue/ });
    }

    /** "Jump the queue" (`⇧⌘↵`), while adding to a merge queue is the way forward. */
    get jumpButton(): Locator {
        return this.root.getByRole('button', { name: /Jump the queue/ });
    }

    /** "Bypass rules and merge" (`⌥⌘↵`), where the viewer may merge past what isn't met. */
    get bypassButton(): Locator {
        return this.root.getByRole('button', { name: /Bypass rules and merge/ });
    }

    /** Why GitHub refused the merge at once. */
    get refusal(): Locator {
        return this.root.getByRole('alert');
    }
}
