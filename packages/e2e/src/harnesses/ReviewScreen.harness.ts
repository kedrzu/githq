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

    /** The toolbar at the foot of the diff while the viewer has a draft review (D28). */
    get pendingToolbar(): Locator {
        return this.page.getByRole('region', { name: 'Your draft review' });
    }

    /** The toolbar's "Submit review…". */
    get submitReviewButton(): Locator {
        return this.pendingToolbar.getByRole('button', { name: 'Submit review…' });
    }

    /** The toolbar's "Discard review…". */
    get discardReviewButton(): Locator {
        return this.pendingToolbar.getByRole('button', { name: 'Discard review…' });
    }

    /** The toast of a comment box just discarded (D40), in the review's own notifications at the foot of the diff. */
    get discardedToast(): Locator {
        return this.page
            .getByRole('region', { name: /^Messages of this screen/ })
            .getByRole('listitem')
            .filter({ hasText: 'discarded' });
    }

    /** The submit dialog (CR75). */
    get submitDialog(): Locator {
        return this.page.getByRole('dialog', { name: /^Submit your review/ });
    }

    /** The discard dialog (CR39). */
    get discardDialog(): Locator {
        return this.page.getByRole('dialog', { name: /^Discard your pending review/ });
    }

    /**
     * A line's number on a side of the file in view: `Comment on line 50`, the newer side last in split. The number, not
     * the comment button the cursor's row has after it under the same name, which shows no number.
     */
    lineNumber(line: number): Locator {
        return this.diff
            .getByRole('button', { name: `Comment on line ${line}`, exact: true })
            .filter({ hasText: new RegExp(`^${line}$`, 'u') })
            .last();
    }

    /** The row holding the line cursor (D44), both halves of it in split. */
    get cursorRow(): Locator {
        return this.diff.locator('[data-cursor="true"]');
    }

    /** The key of the stop holding the line cursor: a header's, a line's, a thread's or a gap's. */
    async cursorKey(): Promise<string> {
        const key = await this.cursorRow.getAttribute('data-cursor-key');
        if (key === null) {
            throw new Error('No row holds the cursor');
        }

        return key;
    }

    /** The file the line cursor is in: its key's first part. */
    async cursorPath(): Promise<string> {
        const key = await this.cursorKey();
        return key.slice(0, key.indexOf('\0'));
    }

    /** The key of the first stop wholly under the pinned header, where a scroll down brings a cursor it took off the top. */
    async firstStopKey(): Promise<string> {
        return await this.diff.evaluate(diff => {
            const top = diff.getBoundingClientRect().top + 38;
            const rows = [...diff.querySelectorAll('[data-cursor-key]')]
                .map(row => ({ key: row.getAttribute('data-cursor-key'), top: row.getBoundingClientRect().top }))
                .toSorted((a, b) => a.top - b.top);
            const first = rows.find(row => row.top >= top - 1);
            if (first?.key) {
                return first.key;
            }

            throw new Error('No stop is under the pinned header');
        });
    }

    /**
     * Moves the pointer onto `target`, by a real move: the first pointer event a page sees is not taken for one (D44), nor
     * one where the pointer already was.
     */
    async pointAt(target: Locator): Promise<void> {
        await target.scrollIntoViewIfNeeded();
        const box = await target.boundingBox();
        if (!box) {
            throw new Error('What to point at is not on screen');
        }

        const x = box.x + Math.min(box.width / 2, 40);
        const y = box.y + box.height / 2;
        await this.page.mouse.move(x - 2, y);
        await this.page.mouse.move(x, y, { steps: 2 });
    }

    /** A comment box; by the line it says, or the only one. */
    commentBox(where?: string): Locator {
        return this.diff.getByRole('group', { name: where ?? /^Comment on line/ });
    }

    /** The text of a comment box. */
    commentField(where?: string): Locator {
        return this.commentBox(where).getByRole('textbox');
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
        return this.code(text).getByTestId('code-keyword');
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

    /** The left column's right edge, which resizes it. */
    get fileListEdge(): Locator {
        return this.page.getByRole('separator', { name: 'Resize the file list' });
    }

    /** The conversation's left edge, which resizes it. */
    get conversationEdge(): Locator {
        return this.page.getByRole('separator', { name: 'Resize the conversation' });
    }

    /** How far the left column's edge is from the window's. */
    async fileListEdgeX(): Promise<number> {
        const box = await this.fileListEdge.boundingBox();
        if (!box) {
            throw new Error("The file list's edge is not on screen");
        }

        return Math.round(box.x);
    }

    /** Drags the left column's edge by `by` pixels with the mouse. */
    async dragFileListEdge(by: number): Promise<void> {
        const x = await this.fileListEdgeX();
        await this.page.mouse.move(x, 300);
        await this.page.mouse.down();
        await this.page.mouse.move(x + by, 300, { steps: 5 });
        await this.page.mouse.up();
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

    /**
     * A gap's arrow in the diff, by what it shows (D42): `above` 20 lines above the hunk below, `below` 20 below the hunk
     * above, `all` the whole of a short gap.
     */
    gapArrow(shows: 'above' | 'below' | 'all'): Locator {
        const names = {
            above: /^Show \d+ above line \d+$/u,
            below: /^Show \d+ below line \d+$/u,
            all: /^Show \d+ lines?$/u,
        };
        return this.diff.getByRole('button', { name: names[shows] });
    }

    /** Every gap in the diff: a row of hidden lines. */
    get gaps(): Locator {
        return this.diff.locator('[tid="review-gap"]');
    }

    /** Every gap of a file still on its way (D45): its patch's gap rows, which nothing acts on. */
    get placeholderGaps(): Locator {
        return this.diff.locator('[tid="review-placeholder-gap"]');
    }

    /** A gap in the diff by what its count says, "94 lines", which it says while the pointer is not on it. */
    gap(count: string): Locator {
        return this.gaps.filter({ has: this.page.getByText(count, { exact: true }) });
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
