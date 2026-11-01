import { SIGNED_IN_HINT_COOKIE } from '@githq/github/oauth.js';
import type { APIResponse, BrowserContext, Page } from '@playwright/test';

import { expect, test } from '../fixtures.js';
import { GitHubHttpError } from '../github/GitHubMock.js';
import { SAMPLE_TOKEN, SAMPLE_VIEWER } from '../github/sampleViewer.js';
import { FirstSignInHarness } from '../harnesses/FirstSignIn.harness.js';
import { LandingHarness } from '../harnesses/Landing.harness.js';
import { MyWorkScreenHarness } from '../harnesses/MyWorkScreen.harness.js';
import { E2E_BASE_URL } from '../localApp.js';
import { signIn } from '../session.js';
import { answerTrackingCandidates } from '../tracking/answerTracking.js';

// `/` answers two pages by the signed-in hint cookie (`packages/worker/src/home.ts`): the prerendered landing page
// (`_landing.html`) without it, the SPA's shell (`index.html`) with it. Checked here at the Worker, raw and in the
// browser, along with the app keeping the cookie in step with the session (`AuthStore`).

const LOGIN = SAMPLE_VIEWER.viewer.login;

/** The landing page's headline as the server renders it (as `checkPrerenderedPages` looks for it). */
const LANDING_HEADING = '>Your GitHub issues,';

/** The headline's text, as the browser shows it. */
const LANDING_HEADING_TEXT = 'Your GitHub issues,';

/** The `Cookie` header of a browser holding the hint. */
const HINT_HEADER = `${SIGNED_IN_HINT_COOKIE.name}=${SIGNED_IN_HINT_COOKIE.value}`;

test('without the signed-in hint, / is the prerendered landing page, whatever the query, kept apart from the app in caches', async ({
    request,
}) => {
    for (const path of ['/', '/?utm_source=x', '/?next=/pulls&failed=cancelled']) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(200);
        const html = await response.text();
        expect(html, path).toContain('data-ssr="true"');
        expect(html, path).toContain(LANDING_HEADING);
        expect(html, path).toContain('<link rel="canonical" href="https://githq.dev/">');
        expect(html, path).toContain('<meta property="og:image" content="https://githq.dev/og.png">');
        expectHomeCaching(response, path);
    }

    const head = await request.head('/');
    expect(head.status()).toBe(200);
    expect(head.headers()['content-type']).toContain('text/html');
    expectHomeCaching(head, 'HEAD /');
});

test("with the signed-in hint, / is the app's shell, holding nothing of the landing page", async ({ request }) => {
    for (const path of ['/', '/?utm_source=x']) {
        const response = await request.get(path, { headers: { cookie: `theme=dark; ${HINT_HEADER}` } });
        expect(response.status(), path).toBe(200);
        expectShell(await response.text(), path);
        expectHomeCaching(response, path);
    }

    const head = await request.head('/', { headers: { cookie: HINT_HEADER } });
    expect(head.status()).toBe(200);
    expectHomeCaching(head, 'HEAD /');
});

test("the landing page has no address of its own, and deep links are served the app's shell as before", async ({
    request,
}) => {
    for (const path of ['/_landing', '/_landing?x=1', '/_landing.html', '/pulls', '/some/unknown/path']) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(200);
        expectShell(await response.text(), path);
    }
});

test('signed in, with the hint, home opens in the app without ever painting the landing page', async ({
    page,
    github,
}) => {
    const shell = await signIn(page, github);
    const landingHeadingAppeared = await watchForLandingHeading(page);

    const response = await page.reload();

    expectShell((await response?.text()) ?? '', '/');
    await expect(shell.account(LOGIN)).toBeVisible();
    await expect(new MyWorkScreenHarness(page).filter('All')).toBeVisible();
    await expect(page).toHaveURL('/');
    expect(await landingHeadingAppeared()).toBe(false);
});

test('a hint left with no session shows the landing page, drawn by the app, and is cleared', async ({
    page,
    context,
}) => {
    await context.addCookies([hintCookie()]);
    const landingHeadingAppeared = await watchForLandingHeading(page);

    const response = await page.goto('/');

    // The Worker trusted the hint; the app, finding no session, shows the landing page itself.
    expectShell((await response?.text()) ?? '', '/');
    await expect(new LandingHarness(page).heading).toContainText(LANDING_HEADING_TEXT);
    await expect(page).toHaveURL('/');
    expect(await landingHeadingAppeared()).toBe(true);
    await expect.poll(() => readHint(context)).toBeUndefined();

    // The next visit is served the prerendered landing page.
    expect(await (await page.reload())?.text()).toContain(LANDING_HEADING);
});

test('signing in sets the hint, as a plain non-identifying cookie for a year; signing out clears it', async ({
    page,
    context,
    github,
}) => {
    expect(await readHint(context)).toBeUndefined();

    const shell = await signIn(page, github);

    const hint = await readHint(context);
    expect(hint).toMatchObject({ value: '1', path: '/', sameSite: 'Lax', secure: false, httpOnly: false });
    const yearFromNow = Date.now() / 1000 + SIGNED_IN_HINT_COOKIE.maxAgeSeconds;
    expect(hint?.expires).toBeGreaterThan(yearFromNow - 3600);
    expect(hint?.expires).toBeLessThanOrEqual(yearFromNow + 60);

    await shell.signOut(LOGIN);

    await expect(new LandingHarness(page).signInButton).toBeVisible();
    await expect.poll(() => readHint(context)).toBeUndefined();
    expect(await (await page.reload())?.text()).toContain(LANDING_HEADING);
});

test('a token GitHub rejects clears the hint, and the next visit is served the landing page with the banner', async ({
    page,
    context,
    github,
}) => {
    await signIn(page, github);
    expect(await readHint(context)).toBeDefined();

    github.graphql('Viewer', new GitHubHttpError(401, 'Bad credentials'));
    await page.reload();

    const landing = new LandingHarness(page);
    await expect(page).toHaveURL('/?failed=tokenRejected');
    await expect(landing.banner).toContainText('You were signed out.');
    await expect.poll(() => readHint(context)).toBeUndefined();

    expect(await (await page.reload())?.text()).toContain(LANDING_HEADING);
    await expect(landing.banner).toContainText('You were signed out.');
});

test('"/login?next=" leads to the landing page keeping where to go, and signing in goes there', async ({
    page,
    github,
}) => {
    github.graphql('Viewer', SAMPLE_VIEWER);
    answerTrackingCandidates(github, { login: LOGIN });

    await page.goto('/login?next=/pulls');

    const landing = new LandingHarness(page);
    await expect(landing.signInButton).toBeVisible();
    await expect(page).toHaveURL('/?next=/pulls');

    await landing.signInWithToken(SAMPLE_TOKEN);
    await expect(page).toHaveURL('/settings/tracking/new?next=/pulls');
    await new FirstSignInHarness(page).continueButton.click();
    await expect(page).toHaveURL('/pulls');
    await expect(new MyWorkScreenHarness(page).group('My pull requests')).toBeVisible();
});

test('under reduced motion the landing page plays nothing: no section waits to reveal, nothing animates', async ({
    page,
}) => {
    const landing = new LandingHarness(page);

    // With motion, the sections below the fold wait to reveal: what reduced motion has to switch off.
    await page.goto('/');
    await expect(landing.root.getByText('Use a token (dev only)')).toBeVisible();
    await expect(page.locator('[data-reveal="waiting"]').first()).toBeAttached();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    // The development sign-in appears once the page is mounted, when the motion would start.
    await expect(landing.root.getByText('Use a token (dev only)')).toBeVisible();
    await expect(page.locator('[data-reveal]')).toHaveCount(0);

    await page.getByRole('contentinfo').scrollIntoViewIfNeeded();
    await expect(page.getByRole('contentinfo')).toBeInViewport();

    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator('[data-reveal]')).toHaveCount(0);
    await expect(page.locator('[data-step]').first()).toHaveAttribute('data-step', 'githq');
});

/** Checks `html` is the SPA's shell (`index.html`), with nothing of the landing page in it. */
function expectShell(html: string, what: string): void {
    expect(html, what).toContain('data-ssr="false"');
    expect(html, what).not.toContain(LANDING_HEADING);
}

/** Checks a response for `/` cannot be reused for the other variant: `no-cache` and `Vary: Cookie`. */
function expectHomeCaching(response: APIResponse, what: string): void {
    const headers = response.headers();
    expect(headers['cache-control'], what).toBe('no-cache');
    expect(
        (headers['vary'] ?? '').split(',').map(name => name.trim().toLowerCase()),
        what,
    ).toContain('cookie');
}

/** The hint cookie as the app writes it, for this browser to hold. */
function hintCookie() {
    return { name: SIGNED_IN_HINT_COOKIE.name, value: SIGNED_IN_HINT_COOKIE.value, url: E2E_BASE_URL };
}

/** The hint cookie this browser holds, if any. */
async function readHint(context: BrowserContext) {
    const cookies = await context.cookies(E2E_BASE_URL);
    return cookies.find(cookie => cookie.name === SIGNED_IN_HINT_COOKIE.name);
}

/** Where the page records that the landing page's headline was in its DOM. */
const LANDING_SEEN_KEY = 'e2e.landingHeadingSeen';

/**
 * From the next page load on, watches the DOM from before it is parsed and records whether the landing page's
 * headline was ever in it, even for a moment; resolves with a reader of that record.
 */
async function watchForLandingHeading(page: Page): Promise<() => Promise<boolean>> {
    await page.addInitScript(
        ({ key, text }) => {
            const check = () => {
                for (const heading of document.querySelectorAll('h1')) {
                    if (heading.textContent?.includes(text)) {
                        sessionStorage.setItem(key, 'seen');
                    }
                }
            };
            new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
        },
        { key: LANDING_SEEN_KEY, text: LANDING_HEADING_TEXT },
    );

    return async () => (await page.evaluate(key => sessionStorage.getItem(key), LANDING_SEEN_KEY)) === 'seen';
}
