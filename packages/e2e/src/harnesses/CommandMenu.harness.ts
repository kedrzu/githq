import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for the command menu (`CommandMenu.vue`, ⌘K): its field and chip, its lines — actions, values found
 * directly, places and items — the groups they sit in and the submenu it is in.
 */
export class CommandMenuHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('dialog', { name: 'Command menu' });
    }

    /** The field: "Type a command or search…", or "Filter options…" in a submenu. */
    get field(): Locator {
        return this.root.getByRole('textbox');
    }

    /** A line of the list, by its text. */
    option(name: string | RegExp): Locator {
        return this.root.getByRole('option', { name });
    }

    /** The group of lines headed `name`: a repository's actions sit under its name. */
    group(name: string): Locator {
        return this.root.getByRole('listbox', { name: 'Command menu' }).getByRole('group', { name, exact: true });
    }

    /** The chip in the field's line naming what the actions act on, by its text; not a line of the list. */
    chip(name: string | RegExp): Locator {
        return this.field.locator('xpath=..').getByText(name, { exact: typeof name === 'string' });
    }

    /** Opens it with ⌘K (Ctrl+K) — again until it shows: a key pressed while the screen still loads is lost. */
    async open(): Promise<void> {
        await expect(async () => {
            await this.page.keyboard.press('ControlOrMeta+k');
            await expect(this.field).toBeFocused({ timeout: 1000 });
        }).toPass();
    }

    /** Opens "Search repositories…": its submenu's field asks GitHub for what is typed. */
    async openRepositorySearch(): Promise<void> {
        await this.run('Search repositories');
        await expect(this.root.getByRole('textbox', { name: 'Search GitHub for a repository…' })).toBeVisible();
    }

    /** Opens it, types `text` and runs the best match with Enter. */
    async run(text: string): Promise<void> {
        await this.open();
        await this.field.pressSequentially(text);
        await this.page.keyboard.press('Enter');
    }
}
