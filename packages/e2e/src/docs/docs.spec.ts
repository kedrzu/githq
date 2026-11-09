import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { expect, test } from '../fixtures.js';
import { DocsSiteHarness } from '../harnesses/DocsSite.harness.js';
import { E2E_BASE_URL } from '../localApp.js';

// The docs (`packages/docs`, VitePress) as the Worker serves them from the local build, under `/docs/`
// (`packages/worker/src/docs.ts`). They need nothing from GitHub: a request to it would fail the test (`github`).

/**
 * The article the tests read, and its source: the sidebar's first page, which is the docs' address itself (they have no
 * home page; `packages/docs/.vitepress/sections.ts`).
 */
const ARTICLE = {
    path: '/docs/',
    title: 'What is githq',
    source: 'getting-started/what-is-githq.md',
    headings: [
        'One screen for every repository',
        'Built around the keyboard',
        "GitHub's model, nothing invented",
        'Fast because it keeps a copy',
        'Where it runs',
    ],
};

const DOCS_SOURCE = path.join(import.meta.dirname, '../../../docs/src');

test("/docs/ opens the sidebar's first page, /docs leads there, and the page has no second address", async ({
    page,
}) => {
    const docs = new DocsSiteHarness(page);
    const response = await page.goto('/docs/');
    expect(response?.status()).toBe(200);
    await expect(docs.heading).toHaveText(ARTICLE.title);
    await expect(docs.sidebarItem(ARTICLE.title)).toContainClass('is-active');
    await expect(docs.sidebar.getByRole('link', { name: ARTICLE.title, exact: true })).toHaveAttribute(
        'href',
        '/docs/',
    );

    await page.goto('/docs');
    await expect(page).toHaveURL('/docs/');
    await expect(docs.heading).toHaveText(ARTICLE.title);

    const old = await page.goto('/docs/getting-started/what-is-githq');
    expect(old?.status()).toBe(404);
    await expect(docs.notFound).toBeVisible();
});

test('a page is served without .html, with the sidebar on it and its headings in the outline, and asks nothing of any other server', async ({
    page,
}) => {
    const elsewhere: string[] = [];
    page.on('request', request => {
        if (new URL(request.url()).origin !== E2E_BASE_URL) {
            elsewhere.push(request.url());
        }
    });
    const docs = new DocsSiteHarness(page);

    const response = await page.goto(ARTICLE.path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(ARTICLE.path);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(ARTICLE.title);

    await expect(docs.sidebarItem(ARTICLE.title)).toContainClass('is-active');
    await expect(docs.sidebarItem('Sign in and install')).not.toContainClass('is-active');
    await expect(docs.outline.getByRole('link')).toHaveText(ARTICLE.headings);

    const next = await page.goto('/docs/getting-started/sign-in-and-install');
    expect(next?.status()).toBe(200);
    await expect(page).toHaveURL('/docs/getting-started/sign-in-and-install');
    await expect(docs.heading).toHaveText('Sign in and install');
    await expect(docs.sidebarItem('Sign in and install')).toContainClass('is-active');

    await page.waitForLoadState('networkidle');
    expect(elsewhere).toEqual([]);
});

test('an unknown /docs/ address answers 404 with the docs\' "not found" page, not the app', async ({ page }) => {
    const docs = new DocsSiteHarness(page);
    for (const address of ['/docs/no-such-page', '/docs/getting-started/no-such-page']) {
        const response = await page.goto(address);
        expect(response?.status(), address).toBe(404);
        await expect(docs.notFound).toBeVisible();
        await expect(docs.heading).toHaveText("This page isn't in the docs");
        await expect(docs.notFound.getByRole('link', { name: 'Start of the docs' })).toHaveAttribute('href', '/docs/');
        // Nothing of the app's shell: Nuxt mounts on `#__nuxt`.
        await expect(page.locator('#__nuxt')).toHaveCount(0);
    }
});

for (const key of ['/', 'ControlOrMeta+k']) {
    test(`on a page, ${key} opens the search, a word of a heading finds its page and Enter goes there`, async ({
        page,
    }) => {
        const docs = new DocsSiteHarness(page);
        await page.goto(ARTICLE.path);
        await expect(docs.heading).toHaveText(ARTICLE.title);

        await docs.openSearchWith(key);
        await docs.searchField.fill('uninstalling');
        await expect(docs.searchResults.first()).toHaveAccessibleName(/^Sign in and install > .*Uninstalling$/u);
        await page.keyboard.press('Enter');

        await expect(page).toHaveURL('/docs/getting-started/sign-in-and-install#uninstalling');
        await expect(docs.heading).toHaveText('Sign in and install');
        await expect(docs.searchField).toBeHidden();
    });
}

test('the search field atop the sidebar opens the search, and the top bar has none of its own', async ({ page }) => {
    const docs = new DocsSiteHarness(page);
    await page.goto(ARTICLE.path);
    await expect(docs.heading).toHaveText(ARTICLE.title);
    // The default theme's own search button is still in the bar, hidden: it holds the search box and its keys.
    const topBarSearch = page
        .getByRole('banner')
        .getByRole('button', { name: /Search the docs/u, includeHidden: true });
    await expect(topBarSearch).toHaveCount(1);
    await expect(topBarSearch).toBeHidden();

    await docs.openSearchFromSidebar();
    await docs.searchField.fill('uninstalling');
    await expect(docs.searchResults.first()).toHaveAccessibleName(/^Sign in and install > .*Uninstalling$/u);
});

test('an article says when it last changed, by its last commit, and links to its file on main to edit it', async ({
    page,
}) => {
    const docs = new DocsSiteHarness(page);
    await page.goto(ARTICLE.path);

    const file = path.join(DOCS_SOURCE, ARTICLE.source);
    const [authored, commit] = execFileSync('git', ['log', '-1', '--format=%at %h', '--', file], {
        cwd: DOCS_SOURCE,
        encoding: 'utf8',
    })
        .trim()
        .split(' ');
    expect(commit, `${ARTICLE.source} is committed`).toBeTruthy();
    const date = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(Number(authored) * 1000),
    );

    await expect(docs.updated).toHaveText(`Updated ${date} · ${commit}`);
    await expect(docs.updated.locator('time')).toHaveAttribute(
        'datetime',
        new Date(Number(authored) * 1000).toISOString(),
    );
    await expect(docs.articleMeta).toContainText(`Updated ${date}`);

    await expect(docs.editLink).toHaveText('Edit this page on GitHub');
    await expect(docs.editLink).toHaveAttribute(
        'href',
        `https://github.com/kedrzu/githq/edit/main/packages/docs/src/${ARTICLE.source}`,
    );
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the sidebar is hidden, the menu button opens it, Escape closes it, and nothing scrolls sideways', async ({
        page,
    }) => {
        const docs = new DocsSiteHarness(page);
        await page.goto(ARTICLE.path);
        await expect(docs.heading).toHaveText(ARTICLE.title);

        await expect(docs.sidebar).not.toBeInViewport();
        expect(await docs.scrollsSideways()).toBe(false);

        await docs.menuButton.click();
        await expect(docs.sidebar).toBeInViewport({ ratio: 1 });
        await expect(docs.menuButton).toHaveAttribute('aria-expanded', 'true');

        await page.keyboard.press('Escape');
        await expect(docs.sidebar).not.toBeInViewport();
        await expect(docs.menuButton).toHaveAttribute('aria-expanded', 'false');
        expect(await docs.scrollsSideways()).toBe(false);
    });

    test('the search field atop the menu opens the search', async ({ page }) => {
        const docs = new DocsSiteHarness(page);
        await page.goto(ARTICLE.path);
        await expect(docs.heading).toHaveText(ARTICLE.title);

        await docs.menuButton.click();
        await expect(docs.sidebarSearch).toBeInViewport({ ratio: 1 });
        await docs.openSearchFromSidebar();
    });

    test('the "not found" page does not scroll sideways', async ({ page }) => {
        const docs = new DocsSiteHarness(page);
        await page.goto('/docs/no-such-page');
        await expect(docs.notFound).toBeVisible();
        expect(await docs.scrollsSideways()).toBe(false);
    });
});
