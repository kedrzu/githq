import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for the desktop app's sign-in (home signed out, `DesktopSignIn.vue` — S1–S4): "Sign in with
 * GitHub", then the device code with "Copy code and open GitHub".
 */
export class DesktopSignInScreenHarness {
    readonly root: Locator;

    constructor(page: Page) {
        this.root = page.getByRole('main');
    }

    /** "Sign in with GitHub" (S1). */
    get signInButton(): Locator {
        return this.root.getByRole('button', { name: 'Sign in with GitHub' });
    }

    /** The device code the user types on GitHub (S2). */
    get deviceCode(): Locator {
        return this.root.getByTestId('device-code');
    }

    /** "Copy code and open GitHub" (S2). */
    get copyAndOpenButton(): Locator {
        return this.root.getByRole('button', { name: 'Copy code and open GitHub' });
    }
}
