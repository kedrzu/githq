import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

/**
 * Playwright harness for the first sign-in: choosing what to track (`/settings/tracking/new`, `TrackingChooser.vue` —
 * G2, G5, G10, and settings-sync's G11–G14).
 */
export class FirstSignInHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('main');
    }

    /** A repository's checkbox on the choice, by `owner/name`. */
    repository(nameWithOwner: string): Locator {
        return this.root.getByRole('checkbox', {
            name: new RegExp(`^${escapeRegExp(nameWithOwner)} (public|private)`),
        });
    }

    /** A project's checkbox on the choice, by its title. */
    project(title: string): Locator {
        return this.root
            .getByRole('region', { name: 'Projects', exact: true })
            .getByRole('checkbox', { name: new RegExp(`^${escapeRegExp(title)} `) });
    }

    /** An owner on the left of the choice. */
    owner(login: string): Locator {
        return this.root
            .getByRole('radiogroup', { name: 'Owners' })
            .getByRole('radio', { name: new RegExp(`^${login} `) });
    }

    /** "Track these". */
    get trackButton(): Locator {
        return this.root.getByRole('button', { name: 'Track these' });
    }

    /** "Only my repositories": the user's own, nothing else, tracked. */
    get onlyMineButton(): Locator {
        return this.root.getByRole('button', { name: 'Only my repositories' });
    }

    /** The box to save what is tracked to the user's GitHub account (settings-sync G2, G12). */
    get savingChoice(): Locator {
        return this.root.getByRole('checkbox', { name: 'Save my settings to my GitHub account' });
    }

    /** "Continue to My work", when there was nothing to choose (G10). */
    get continueButton(): Locator {
        return this.root.getByRole('button', { name: 'Continue to My work' });
    }

    /**
     * Tracks what is chosen and lands on My work, where it downloads in the background — once the choice is gone:
     * the address changes before the app's shell is loaded and drawn.
     */
    async trackAndOpenMyWork(): Promise<void> {
        await this.trackButton.click();
        await expect(this.page).toHaveURL('/');
        await expect(this.trackButton).toHaveCount(0);
    }

    /** "Request approval on GitHub" of an organisation hiding its private data (G5). */
    get requestApprovalLink(): Locator {
        return this.root.getByRole('link', { name: 'Request approval on GitHub' });
    }
}
