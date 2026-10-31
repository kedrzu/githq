import type { Locator, Page } from '@playwright/test';

/** Playwright harness for the account page (`AccountView.vue`, G9). */
export class AccountScreenHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** The page's heading, "Account". */
    get heading(): Locator {
        return this.root.getByRole('heading', { name: 'Account', level: 1 });
    }

    /** An organisation's row: its name, whether it hides its private data, and when approval was requested. */
    organization(login: string): Locator {
        return this.root.getByTestId('account-organization').filter({ hasText: login });
    }

    /** "Request approval" of an organisation hiding its private data: GitHub's page, in a new tab. */
    requestApproval(login: string): Locator {
        return this.root.getByRole('link', { name: `Request approval: ${login}` });
    }

    /** What this browser keeps: "15 repositories, 1 project · 3,020 items · 48 MB". */
    get copy(): Locator {
        return this.root.getByTestId('account-copy');
    }

    /** "Sign out and clear". */
    get signOutButton(): Locator {
        return this.root.getByRole('button', { name: 'Sign out and clear' });
    }
}
