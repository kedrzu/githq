import type { Locator, Page, Request } from '@playwright/test';

/** Playwright harness for the screen over the shell when a link was handed to the desktop app (`DesktopHandOffView.vue`). */
export class DesktopHandOffHarness {
    readonly page: Page;
    readonly root: Locator;
    /** The `githq:` addresses the page asked for since this harness was made, in order. */
    readonly handedOff: string[] = [];

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('dialog', { name: 'Opened in the githq desktop app' });
        // The browser has no handler for `githq:` here: the request fails, but it is seen.
        page.on('request', (request: Request) => {
            if (request.url().startsWith('githq:')) {
                this.handedOff.push(request.url());
            }
        });
    }

    /** "Open here instead". */
    get openHereButton(): Locator {
        return this.root.getByRole('button', { name: 'Open here instead' });
    }

    /** "Don't open links in the app". */
    get turnOffButton(): Locator {
        return this.root.getByRole('button', { name: "Don't open links in the app" });
    }
}
