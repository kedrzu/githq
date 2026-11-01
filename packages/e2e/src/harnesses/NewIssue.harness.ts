import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for the quick capture of a new issue (`NewIssueDialog.vue`, H1–H9): the repository chip and
 * its chooser, the title and the body, the chips, the templates, and what it says when a repository won't take
 * an issue or GitHub refused one.
 */
export class NewIssueHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('dialog', { name: 'New issue' });
    }

    /** The chip naming the repository ("Repository: acme/web. Choose another"). */
    get repository(): Locator {
        return this.root.getByRole('button', { name: /^Repository: |^Choose a repository$/u });
    }

    get title(): Locator {
        return this.root.getByRole('textbox', { name: 'Title' });
    }

    /** The body, once expanded (Tab, "Details"). */
    get body(): Locator {
        return this.root.getByRole('textbox', { name: 'Description' });
    }

    /**
     * "Create": enabled once the title is typed and the repository's details (whether the user can push, its
     * fields) are in. Until then the capture's keys — Enter, ⌘Enter, ⌥A — do nothing, so wait for it first.
     */
    get create(): Locator {
        return this.root.getByRole('button', { name: 'Create', exact: true });
    }

    /** The repository chooser's field (H2). */
    get repositoryField(): Locator {
        return this.root.getByRole('textbox', { name: 'Repository' });
    }

    /** What GitHub said when it did not create the issue (H9). */
    get rejection(): Locator {
        return this.root.getByRole('alert');
    }

    /** The issue templates offered (H7). */
    get templates(): Locator {
        return this.root.getByRole('listbox', { name: 'Issue templates' });
    }

    /** Opens it with `C` — again until it shows: a key pressed while the screen still loads is lost. */
    async open(): Promise<void> {
        await expect(async () => {
            await this.page.keyboard.press('c');
            await expect(this.root).toBeVisible({ timeout: 1000 });
        }).toPass();
    }

    /** Chooses the repository: types part of its name in the chooser and takes the first that takes an issue. */
    async chooseRepository(text: string, nameWithOwner: string): Promise<void> {
        await this.repositoryField.fill(text);
        await this.root
            .getByRole('option', { name: new RegExp(`^${nameWithOwner}`, 'u') })
            .first()
            .click();
        await expect(this.repository).toHaveAccessibleName(`Repository: ${nameWithOwner}. Choose another`);
    }
}
