import type { Locator, Page } from '@playwright/test';

import { escapeRegExp } from '../utils/escapeRegExp.js';

/** Playwright harness for a pull request's review (`ReviewView.vue`): its toolbar, its list of files and its diff. */
export class ReviewScreenHarness {
    readonly page: Page;
    readonly fileList: Locator;
    readonly diff: Locator;
    readonly conversation: Locator;

    constructor(page: Page) {
        this.page = page;
        this.fileList = page.getByRole('region', { name: 'Files' });
        this.diff = page.getByRole('region', { name: 'Changes' });
        this.conversation = page.getByRole('region', { name: 'Conversation' });
    }

    /** The pull request's title in the toolbar. */
    get title(): Locator {
        return this.page.getByRole('heading', { level: 1 });
    }

    /** The button of the view options, naming what is on. */
    get viewOptionsButton(): Locator {
        return this.page.getByRole('button', { name: /^(Split|Unified)/ });
    }

    /** "Back". */
    get backButton(): Locator {
        return this.page.getByRole('button', { name: 'Back', exact: true });
    }

    /** Where it is in the list it was opened from, in the toolbar: "2 / 4". */
    get position(): Locator {
        return this.page.locator('header').getByText(/^\d+ \/ \d+$/);
    }

    /** The toolbar's `J`. */
    get nextPullRequestButton(): Locator {
        return this.page.getByRole('button', { name: 'Next pull request' });
    }

    /** The stack's and the files' column, which scrolls as one. */
    get leftColumn(): Locator {
        return this.fileList.locator('..');
    }

    /** The stack's rows at the top of the left column, first to last. */
    get stackRows(): Locator {
        return this.page.getByRole('list', { name: 'Pull requests of the stack' }).getByRole('link');
    }

    /** The stack's row of the pull request titled `title`. */
    stackRow(title: string): Locator {
        return this.stackRows.filter({ hasText: title });
    }

    /** The stack's row of the pull request under review. */
    get currentStackRow(): Locator {
        return this.page.getByRole('list', { name: 'Pull requests of the stack' }).locator('[aria-current="true"]');
    }

    /** "2 of 4" in the stack's head. */
    get stackPlace(): Locator {
        return this.page.getByRole('region', { name: 'The stack' }).getByText(/^\d+\s+of\s+\d+$/);
    }

    /** The bar pinned once the left column scrolls: its squares. */
    get stackStrip(): Locator {
        return this.page.getByRole('list', { name: 'Places in the stack' });
    }

    /** The bar's square of the pull request titled `title`. */
    stackSquare(title: string): Locator {
        return this.stackStrip.getByRole('link', { name: title });
    }

    /** The row of the file named `name` in the list. */
    fileRow(name: string): Locator {
        return this.fileList.getByRole('button', { name: new RegExp(`\\b${escapeRegExp(name)}\\b`) });
    }

    /** The row of the file the diff is at. */
    get currentFileRow(): Locator {
        return this.fileList.locator('[aria-current="true"]');
    }

    /**
     * The header of the file in the list, its real row: a header being pinned is in the page twice, the pinned copy
     * first.
     */
    fileHeader(path: string): Locator {
        return this.diff.getByRole('heading', { name: path, exact: true }).last();
    }

    /** A line of code in the diff, on whichever side. */
    code(text: string): Locator {
        return this.diff.locator('code', { hasText: text });
    }

    /** A coloured token of a line of code. */
    codeToken(text: string): Locator {
        return this.code(text).locator('[class*="diffCode_keyword"]');
    }

    /** How far below the top of the diff the file's header row is: 0 when it landed exactly. */
    async headerOffset(path: string): Promise<number> {
        const [header, diff] = await Promise.all([
            this.fileHeader(path).locator('..').boundingBox(),
            this.diff.boundingBox(),
        ]);
        if (!header || !diff) {
            throw new Error(`The header of ${path} is not on screen`);
        }

        return header.y - diff.y;
    }

    /** The file's header as the mouse reaches it: the pinned copy covers the row while there is one. */
    topHeader(path: string): Locator {
        return this.diff.getByRole('heading', { name: path, exact: true }).first();
    }

    /** The header's "Viewed" of the file. */
    viewedButton(path: string): Locator {
        return this.topHeader(path).locator('..').getByRole('button', { name: 'Viewed' });
    }

    /** The eye in the list's head. */
    get hideViewedButton(): Locator {
        return this.fileList.getByRole('button', { name: 'Hide viewed files' });
    }

    /** The filter in the list's head. */
    get filterField(): Locator {
        return this.fileList.getByRole('textbox', { name: 'Filter files' });
    }

    /** The toggle of the filter to a regular expression. */
    get regexToggle(): Locator {
        return this.fileList.getByRole('button', { name: 'Use a regular expression' });
    }

    /** The bar at the foot of the list, naming how many are selected. */
    selectionCount(text: string): Locator {
        return this.fileList.getByText(text, { exact: true });
    }

    /** The bar's "Mark viewed". */
    get markViewedButton(): Locator {
        return this.fileList.getByRole('button', { name: 'Mark viewed' });
    }

    /** The file list's toggle in the toolbar. */
    get fileListToggle(): Locator {
        return this.page.getByRole('button', { name: 'File list', exact: true });
    }

    /** The conversation's toggle in the toolbar. */
    get conversationToggle(): Locator {
        return this.page.getByRole('button', { name: 'Conversation', exact: true });
    }

    /** The thread holding that text, in the diff. */
    thread(text: string): Locator {
        return this.diff.getByRole('group', { name: /^Thread/ }).filter({ hasText: text });
    }

    /** The thread N and ⇧N are at. */
    get focusedThread(): Locator {
        return this.diff.locator('[role="group"][aria-current="true"]');
    }

    /** How far below the top of the diff the thread is. */
    async threadOffset(text: string): Promise<number> {
        const [thread, diff] = await Promise.all([this.thread(text).boundingBox(), this.diff.boundingBox()]);
        if (!thread || !diff) {
            throw new Error(`The thread "${text}" is not on screen`);
        }

        return thread.y - diff.y;
    }

    /** The mark on a file's row in the list saying how many of its threads are open. */
    openThreadsMark(name: string, count: number): Locator {
        return this.fileRow(name).getByRole('img', { name: count === 1 ? '1 open thread' : `${count} open threads` });
    }

    /** A gap's button of that name, in the diff. */
    gapButton(name: 'Show 20' | 'Show all'): Locator {
        return this.diff.getByRole('button', { name, exact: true });
    }

    /** The first line of code starting with `prefix` wholly below the pinned header, and how high on the page it is. */
    async topLine(prefix: string): Promise<{ text: string; y: number }> {
        return await this.diff.evaluate((diff, wanted) => {
            const top = diff.getBoundingClientRect().top + 38;
            for (const code of diff.querySelectorAll('code')) {
                const { y } = code.getBoundingClientRect();
                if (y >= top && code.textContent?.startsWith(wanted)) {
                    return { text: code.textContent, y };
                }
            }

            throw new Error(`No line starting with ${wanted} is on screen`);
        }, prefix);
    }

    /** Opens the view options and picks the layout; closes them again. */
    async chooseLayout(layout: 'Split' | 'Unified'): Promise<void> {
        await this.viewOptionsButton.click();
        await this.page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: layout }).click();
        await this.page.keyboard.press('Escape');
    }

    /** Opens the view options and flips "Hide whitespace changes"; closes them again. */
    async toggleHideWhitespace(): Promise<void> {
        await this.viewOptionsButton.click();
        await this.page.getByRole('switch', { name: 'Hide whitespace changes' }).click();
        await this.page.keyboard.press('Escape');
    }
}
