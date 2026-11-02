import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

import type { MyWorkGroupName } from './MyWorkScreen.harness.js';
import { SettingsScreenHarness } from './SettingsScreen.harness.js';

/**
 * Playwright harness for the signed-in app's frame (`AppShell.vue`): the sidebar (expanded, or collapsed to
 * the rail) with the account menu and what is tracked, the status bar, and the toasts over it (`EditToasts.vue`, `SyncStoppedToast.vue`).
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

    /** Right-clicks a tracked repository (`owner/name`) or project (its title) in the sidebar: its context menu. */
    async openTrackedMenu(name: string): Promise<Locator> {
        await this.tracked(name).click({ button: 'right' });
        return this.page.getByRole('menu');
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

    /** The handle on the expanded sidebar's edge, dragged to resize it. */
    get sidebarHandle(): Locator {
        return this.page.getByRole('separator', { name: 'Resize sidebar' });
    }

    /** The handle on the edge of an item opened in the panel, dragged to resize the panel. */
    get panelHandle(): Locator {
        return this.page.getByRole('separator', { name: 'Resize item panel' });
    }

    /** Drags `handle` sideways by `by` pixels — right when positive. */
    async drag(handle: Locator, by: number): Promise<void> {
        const box = await handle.boundingBox();
        if (!box) {
            throw new Error('The handle is not on screen');
        }

        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        await this.page.mouse.move(x + by, y, { steps: 5 });
        await this.page.mouse.up();
    }

    /** The status bar along the bottom; its first segment holds GitHub's allowance. */
    get statusBar(): Locator {
        return this.page.getByRole('contentinfo', { name: 'Status' });
    }

    /** The account menu's button while syncing the settings stopped: its avatar carries an amber dot (T9). */
    accountSyncStopped(login: string): Locator {
        return this.sidebar.getByRole('button', { name: `Account: ${login} · syncing stopped`, exact: true });
    }

    /** The toast saying syncing the settings stopped, and why (settings-sync T9). */
    get syncStoppedToast(): Locator {
        return this.toasts.filter({ hasText: 'Syncing settings stopped' });
    }

    /** The toasts showing, oldest first: the failures of edits (K1, K2), and that syncing the settings stopped (T9). */
    get toasts(): Locator {
        return this.page.getByRole('region', { name: /^Notifications/ }).getByRole('listitem');
    }

    /** The status bar's button saying an edit failed ("1 change failed · …"), which shows its toast again. */
    get failedEdits(): Locator {
        return this.statusBar.getByRole('button', { name: /changes? failed/ });
    }

    /** Opens Settings' Account section (G9), with "Settings" of the account menu and then its tab. */
    async openAccount(login: string): Promise<void> {
        await this.account(login).click();
        await this.page.getByRole('menuitem', { name: 'Settings' }).click();
        await new SettingsScreenHarness(this.page).section('Account').click();
    }

    /**
     * The status bar's first segment while refresh is paused (K3), "Paused until 14:32 · 0 left": a button opening
     * why.
     */
    get pausedSegment(): Locator {
        return this.statusBar.getByRole('button', { name: /^Paused until/ });
    }

    /** The desktop app's notice of an update ready to run (U1), "githq 1.4.0 is ready". */
    get updateNotice(): Locator {
        return this.statusBar.getByText(/^githq \S+ is\sready$/);
    }

    /** "Restart" of {@link updateNotice}: into the update. */
    get restartToUpdateButton(): Locator {
        return this.statusBar.getByRole('button', { name: 'Restart', exact: true });
    }

    /** "Later" of {@link updateNotice}: hides it until the app next starts. */
    get updateLaterButton(): Locator {
        return this.statusBar.getByRole('button', { name: 'Later', exact: true });
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
