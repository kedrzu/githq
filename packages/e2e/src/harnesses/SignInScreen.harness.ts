import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for the sign-in page (`/sign-in`, `SignInScreen.vue` — G1b, and G1c after a failure),
 * with the development sign-in (`DevTokenForm.vue`), which only the local build has.
 */
export class SignInScreenHarness {
    readonly root: Locator;

    constructor(page: Page) {
        this.root = page.getByRole('main');
    }

    /** "Sign in with GitHub". */
    get signInButton(): Locator {
        return this.root.getByRole('button', { name: 'Sign in with GitHub' });
    }

    /** What GitHub's consent screen will ask for (G1b): the explainer, by its title. */
    get permissions(): Locator {
        return this.root.getByRole('heading', { name: "What GitHub's next screen will ask for" });
    }

    /** Why the user is back on sign-in (G1c): cancelled, failed, signed out. */
    get notice(): Locator {
        return this.root.getByRole('status');
    }

    /** Signs in with a pasted token (the development sign-in). */
    async signInWithToken(token: string): Promise<void> {
        await this.root.getByText('Use a token (dev only)').click();
        await this.root.getByLabel('Token', { exact: true }).fill(token);
        await this.root.getByRole('button', { name: 'Sign in with token' }).click();
    }
}
