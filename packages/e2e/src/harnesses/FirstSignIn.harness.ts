import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

/**
 * Playwright harness for the first sign-in's steps: choosing what to track (`/settings/tracking/new`, `TrackingChooser.vue` —
 * G2, G5, G10, and settings-sync's G11–G14) and the first download (`/settings/tracking/download`, `FirstDownloadView.vue` — G6).
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

    /** The first download's progress of a repository (`owner/name`) or project (its title). */
    progress(name: string): Locator {
        return this.root
            .getByRole('list', { name: 'Download progress' })
            .getByRole('listitem')
            .filter({ has: this.page.getByRole('progressbar', { name, exact: true }) });
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
        return this.root.getByRole('checkbox', { name: 'Save what I track to my GitHub account' });
    }

    /** "Continue to My work", when there was nothing to choose (G10). */
    get continueButton(): Locator {
        return this.root.getByRole('button', { name: 'Continue to My work' });
    }

    /** "Open My work" on the first download (G6). */
    get openMyWorkButton(): Locator {
        return this.root.getByRole('button', { name: 'Open My work' });
    }

    /** "Request approval on GitHub" of an organisation hiding its private data (G5). */
    get requestApprovalLink(): Locator {
        return this.root.getByRole('link', { name: 'Request approval on GitHub' });
    }
}
