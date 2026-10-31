import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

import type { MyWorkGroupName } from './MyWorkScreen.harness.js';

/**
 * Playwright harness for the signed-in app's frame (`AppShell.vue`): the sidebar (expanded, or collapsed to
 * the rail) with the account menu and what is tracked, the status bar, and the toasts over it (`EditToasts.vue`).
 */
export class AppShellHarness {
    readonly page: Page;
    readonly sidebar: Locator;

    constructor(page: Page) {
        this.page = page;
        this.sidebar = page.getByRole('navigation', { name: 'Sidebar' });
    }

    /** The account menu's button, "Account: <login>" — avatar and login, or the avatar alone on the rail. */
    account(login: string): Locator {
        return this.sidebar.getByRole('button', { name: `Account: ${login}` });
    }

    /** The sidebar's link to "My work" or to one of its groups. */
    myWorkLink(name: 'My work' | MyWorkGroupName): Locator {
        return this.sidebar.getByRole('link').filter({ has: this.page.getByText(name, { exact: true }) });
    }

    /** The count next to a sidebar link of "my work": its top-level rows, or "…" before the first download. */
    myWorkCount(name: 'My work' | MyWorkGroupName): Locator {
        return this.myWorkLink(name).locator('span').last();
    }

    /** The sidebar's link to a tracked repository (`owner/name`) or project (its title). */
    tracked(name: string): Locator {
        return this.sidebar.getByRole('link', { name: new RegExp(`^${escapeRegExp(name)} `) });
    }

    /**
     * What the sidebar says of a tracked repository or project: its open items, "waiting" or how far its download
     * is ("40%"), or "hidden".
     */
    trackedCount(name: string): Locator {
        return this.tracked(name).locator('span').last();
    }

    /** "Collapse sidebar", on the expanded sidebar only. */
    get collapseButton(): Locator {
        return this.sidebar.getByRole('button', { name: 'Collapse sidebar' });
    }

    /** "Expand sidebar", on the rail only. */
    get expandButton(): Locator {
        return this.sidebar.getByRole('button', { name: 'Expand sidebar' });
    }

    /** The status bar along the bottom; its first segment holds GitHub's allowance. */
    get statusBar(): Locator {
        return this.page.getByRole('contentinfo', { name: 'Status' });
    }

    /** The toasts showing, oldest first: each the failure of an edit (K1, K2). */
    get toasts(): Locator {
        return this.page.getByRole('region', { name: /^Notifications/ }).getByRole('listitem');
    }

    /** The status bar's button saying an edit failed ("1 change failed · …"), which shows its toast again. */
    get failedEdits(): Locator {
        return this.statusBar.getByRole('button', { name: /changes? failed/ });
    }

    /** Opens the account page (G9) through the account menu. */
    async openAccount(login: string): Promise<void> {
        await this.account(login).click();
        await this.page.getByRole('menuitem', { name: 'Account' }).click();
    }

    /**
     * The status bar's first segment while refresh is paused (K3), "Paused until 14:32 · 0 left": a button opening
     * why.
     */
    get pausedSegment(): Locator {
        return this.statusBar.getByRole('button', { name: /^Paused until/ });
    }

    /** Why refresh is paused, opened from {@link pausedSegment}. */
    get pausedExplanation(): Locator {
        return this.page.getByTestId('refresh-paused');
    }

    /** Signs out through the account menu. */
    async signOut(login: string): Promise<void> {
        await this.account(login).click();
        await this.page.getByRole('menuitem', { name: 'Sign out' }).click();
    }
}
