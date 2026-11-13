import type { Locator, Page } from '@playwright/test';

/** An item's own property with a picker, by its label. */
export type ItemPropertyName = 'Assignees' | 'Labels' | 'Milestone';

/**
 * Playwright harness for an opened item (`ItemView.vue`, the one on screen — in the panel or on its own page): its header with the item menu, the way through the list and the button to the other arrangement; the map of
 * the stack a pull request is in; its properties, projects and reviewers; its comments and the comment box.
 */
export class ItemViewHarness {
    readonly page: Page;
    readonly root: Locator;

    constructor(page: Page) {
        this.page = page;
        this.root = page.getByRole('article');
    }

    /** The item's title. */
    get title(): Locator {
        return this.root.getByRole('heading', { level: 1 });
    }

    /** Where it is in the list it was opened from: "3 / 8". */
    get position(): Locator {
        return this.root.getByText(/^\d+ \/ \d+$/);
    }

    /**
     * Its content in one column (narrower than 1000px on a page, 1300px in the panel), what scrolls: the summary and
     * then the thread. In two columns it holds only the {@link timeline} and does not scroll: {@link columns} does.
     */
    get content(): Locator {
        return this.root.locator('[data-route-scroll^="item-main:"]');
    }

    /** In two columns, the one scroll of the {@link summary} beside the {@link timeline}, and of the width beside them. */
    get columns(): Locator {
        return this.root.locator('[data-route-scroll^="item-columns:"]');
    }

    /** Its title, where it stands and its properties: the content's first block, or the left column in two. */
    get summary(): Locator {
        return this.root.locator('[data-item-column="summary"]');
    }

    /** Its description and activity: after the summary, or the right column in two. Never scrolls on its own. */
    get timeline(): Locator {
        return this.root.locator('[data-item-column="timeline"]');
    }

    /** "Previous item" (`K`). */
    get previousButton(): Locator {
        return this.root.getByRole('button', { name: 'Previous item' });
    }

    /** "Next item" (`J`). */
    get nextButton(): Locator {
        return this.root.getByRole('button', { name: 'Next item' });
    }

    /** The item's reference in its header, opening the item menu (M1–M2, `⌘.`). */
    get menuButton(): Locator {
        return this.root.getByRole('button', { name: /^Actions of / });
    }

    /** The line saying why the user can't set labels, assignees and milestone here (K1b). */
    get restrictedNote(): Locator {
        return this.root.getByRole('note');
    }

    /** "Merge…" of a pull request's standing (`⇧M`), where the user may merge it. */
    get mergeButton(): Locator {
        return this.root.getByRole('button', { name: 'Merge…', exact: true });
    }

    /** "Add to project". */
    get addToProjectButton(): Locator {
        return this.root.getByRole('button', { name: 'Add to project' });
    }

    /** The rows of the map of the stack an opened pull request is in (`StackMap`), first to last. */
    get stackMapRows(): Locator {
        return this.root
            .getByRole('region', { name: 'The stack' })
            .getByRole('list', { name: 'Pull requests of the stack' })
            .getByRole('button');
    }

    /** The map's row of the opened pull request (`aria-current="true"`). */
    get stackMapCurrent(): Locator {
        return this.stackMapRows.and(this.root.locator('[aria-current="true"]'));
    }

    /** The comment box (`R`). */
    get commentBox(): Locator {
        return this.root.getByRole('textbox', { name: 'Comment' });
    }

    /** The line saying why the user can't comment, in place of the comment box. */
    get readOnlyComposer(): Locator {
        // `\s`: short words are held to the next by no-break spaces.
        return this.root.getByText(/so\syou\scan\sread\sit\sbut\snot\scomment|so\sit\stakes\sno\snew\scomments/);
    }

    /** A button of the composer at the thread's end, by its label: "Close issue", "More ways to close", "Comment". */
    composerButton(name: string): Locator {
        return this.root.getByRole('button', { name, exact: true });
    }

    /** "Open full screen" (`⇧Enter`), in the panel. */
    get fullScreenButton(): Locator {
        return this.root.getByRole('button', { name: 'Open full screen', exact: true });
    }

    /** "Back to the panel" (`⇧Enter`), on the item's page. */
    get backToPanelButton(): Locator {
        return this.root.getByRole('button', { name: 'Back to the panel', exact: true });
    }

    /** The value of a property the user may change — a button opening its picker, named "Labels: bug". */
    property(name: ItemPropertyName): Locator {
        return this.root.getByRole('button', { name: new RegExp(`^${name}: `) });
    }

    /** The value of a project field the user may change, named "Status: Todo". */
    projectField(name: string): Locator {
        return this.root.getByRole('button', { name: new RegExp(`^${name}: `) });
    }

    /** The card of the project `title`, by its heading. */
    project(title: string): Locator {
        return this.root.getByRole('heading', { level: 3, name: title });
    }

    /** The state pill under the title, by its text ("Open", "Not planned"). */
    statePill(text: string): Locator {
        return this.title.locator('xpath=following-sibling::p[1]').getByText(text, { exact: true });
    }

    /** The comments of its thread, those shown, oldest first: the entries with a comment's ⋯. */
    get comments(): Locator {
        return this.root
            .getByRole('listitem')
            .filter({ has: this.page.getByRole('button', { name: 'Comment actions' }) });
    }

    /** The comment the address's fragment names, marked as the current location (`aria-current="location"`). */
    get linkedComment(): Locator {
        return this.comments.and(this.root.locator('[aria-current="location"]'));
    }

    /** A comment or a reviewer's line holding `text`. */
    entry(text: string): Locator {
        return this.root.getByRole('listitem').filter({ hasText: text });
    }

    /** The line "N new since you looked" standing before what others did since the item was last open here. */
    get newSince(): Locator {
        return this.root.getByRole('listitem').filter({ hasText: /new since you looked/u });
    }

    /** The thread's entry right after `entry`. */
    entryAfter(entry: Locator): Locator {
        return entry.locator('xpath=following-sibling::li[1]');
    }

    /** Picks `action` ("Edit", "Delete…") from the ⋯ menu of the comment holding `text`. */
    async commentAction(text: string, action: string): Promise<void> {
        await this.entry(text).getByRole('button', { name: 'Comment actions' }).click();
        await this.page.getByRole('menuitem', { name: action }).click();
    }

    /** Posts a comment through the comment box: `R`, the text, ⌘↵. */
    async comment(text: string): Promise<void> {
        await this.page.keyboard.press('r');
        await this.commentBox.fill(text);
        await this.commentBox.press('ControlOrMeta+Enter');
    }
}
