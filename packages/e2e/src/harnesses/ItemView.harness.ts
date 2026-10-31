import type { Locator, Page } from '@playwright/test';

/** An arrangement of the item view's switch, by its label. */
export type ItemArrangementName = 'Panel' | 'Modal' | 'Full page';

/** An item's own property with a picker, by its label. */
export type ItemPropertyName = 'Assignees' | 'Labels' | 'Milestone';

/**
 * Playwright harness for an opened item (`ItemView.vue`, the one on screen — in the panel, the modal or on its
 * own page): its header with the way through the list, the arrangement switch and the state menu; its
 * properties, projects and reviewers; its comments and the comment box.
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

    /** "Previous item" (`K`). */
    get previousButton(): Locator {
        return this.root.getByRole('button', { name: 'Previous item' });
    }

    /** The modal the item is opened in, named after it. */
    get modal(): Locator {
        return this.page.getByRole('dialog').filter({ has: this.root });
    }

    /** The menu closing, reopening or turning a pull request into a draft and back (`⇧X`). */
    get stateMenu(): Locator {
        return this.root.getByRole('button', { name: 'Close or reopen' });
    }

    /** The line saying why the user can't set labels, assignees and milestone here (K1b). */
    get restrictedNote(): Locator {
        return this.root.getByRole('note');
    }

    /** "Add to project". */
    get addToProjectButton(): Locator {
        return this.root.getByRole('button', { name: 'Add to project' });
    }

    /** The comment box (`R`). */
    get commentBox(): Locator {
        return this.root.getByRole('textbox', { name: 'Comment' });
    }

    /** The switch's button moving the item to `name`. */
    arrangement(name: ItemArrangementName): Locator {
        return this.root.getByRole('group', { name: 'Arrangement' }).getByRole('button', { name, exact: true });
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

    /** A comment or a reviewer's line holding `text`. */
    entry(text: string): Locator {
        return this.root.getByRole('listitem').filter({ hasText: text });
    }

    /** Posts a comment through the comment box: `R`, the text, ⌘↵. */
    async comment(text: string): Promise<void> {
        await this.page.keyboard.press('r');
        await this.commentBox.fill(text);
        await this.commentBox.press('ControlOrMeta+Enter');
    }
}
