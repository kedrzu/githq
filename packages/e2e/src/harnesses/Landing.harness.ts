import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for the landing page (`/` signed out, `LandingScreen.vue`) — "Sign in with GitHub", the
 * banner of a sign-in that did not finish (G1, `SignInBanner.vue`) and the development sign-in
 * (`DevTokenForm.vue`), which only the local build has.
 */
export class LandingHarness {
    readonly root: Locator;

    constructor(page: Page) {
        this.root = page.getByRole('main');
    }

    /** The hero's headline, the page's only `h1`. */
    get heading(): Locator {
        return this.root.getByRole('heading', { level: 1 });
    }

    /** The hero's "Sign in with GitHub", the first of the page's two (the other closes the page). */
    get signInButton(): Locator {
        return this.root.getByRole('button', { name: 'Sign in with GitHub' }).first();
    }

    /** Why the visitor is back from a sign-in (G1): cancelled, failed, signed out. */
    get banner(): Locator {
        return this.root.getByRole('status');
    }

    /** The banner's "Try again". */
    get tryAgainButton(): Locator {
        return this.banner.getByRole('button', { name: 'Try again' });
    }

    /** The banner's dismiss button. */
    get dismissButton(): Locator {
        return this.banner.getByRole('button', { name: 'Dismiss' });
    }

    /** Signs in with a pasted token (the development sign-in). */
    async signInWithToken(token: string): Promise<void> {
        await this.root.getByText('Use a token (dev only)').click();
        await this.root.getByLabel('Token', { exact: true }).fill(token);
        await this.root.getByRole('button', { name: 'Sign in with token' }).click();
    }
}
