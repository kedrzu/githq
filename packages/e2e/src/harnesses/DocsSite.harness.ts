import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Playwright harness for the docs (`packages/docs`, VitePress under `/docs/`): the home page's section cards, an
 * article with its sidebar, outline, "Updated" line and edit link, the "not found" page, the phone's menu and the
 * search (the default theme's local search, ⌘K or `/`).
 */
export class DocsSiteHarness {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /** The page's title: the home page's hero, an article's or the "not found" page's `h1`. */
    get heading(): Locator {
        return this.page.getByRole('heading', { level: 1 });
    }

    /** The home page's card of each section, in order. */
    get sectionCards(): Locator {
        return this.page.getByTestId('docs-section-card');
    }

    /** The sidebar, every section's pages; off the screen on a phone until {@link menuButton} opens it. */
    get sidebar(): Locator {
        return this.page.getByRole('navigation', { name: 'Sidebar Navigation' });
    }

    /**
     * The sidebar's row of the page `name`. The default theme marks the current page's row with `is-active` only (no
     * `aria-current`), so this is its row, not its link.
     */
    sidebarItem(name: string): Locator {
        return this.sidebar
            .getByRole('link', { name, exact: true })
            .locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " VPSidebarItem ")][1]');
    }

    /** "On this page": the article's headings. */
    get outline(): Locator {
        return this.page.getByRole('navigation', { name: 'On this page' });
    }

    /** The footer's "Edit this page on GitHub". */
    get editLink(): Locator {
        return this.page.getByTestId('docs-edit-link');
    }

    /** The footer's "Updated <date> · <commit>". */
    get updated(): Locator {
        return this.page.getByTestId('docs-updated');
    }

    /** The line under the article's lead: "Updated <date>" and its reading time. */
    get articleMeta(): Locator {
        return this.page.getByTestId('docs-article-meta');
    }

    /** The "not found" page's content. */
    get notFound(): Locator {
        return this.page.getByTestId('docs-not-found');
    }

    /** The phone's menu button, which opens the sidebar. */
    get menuButton(): Locator {
        return this.page.getByRole('button', { name: 'Menu' });
    }

    /** The search's field, there while the search is open. */
    get searchField(): Locator {
        return this.page.getByRole('searchbox');
    }

    /** The search's results, best first. */
    get searchResults(): Locator {
        return this.page.getByRole('listbox').getByRole('option');
    }

    /**
     * Presses `key` until the search opens: a key pressed before the page has hydrated is lost. Only while it is
     * closed, as the field then takes the key.
     */
    async openSearchWith(key: string): Promise<void> {
        await expect(async () => {
            if (!(await this.searchField.isVisible())) {
                await this.page.keyboard.press(key);
            }

            await expect(this.searchField).toBeFocused({ timeout: 1000 });
        }).toPass();
    }

    /** Whether the page scrolls sideways: wider than the window. */
    async scrollsSideways(): Promise<boolean> {
        return await this.page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
    }
}
