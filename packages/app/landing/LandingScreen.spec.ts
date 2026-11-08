import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './LandingScreen.stories.js';

const { Landing, OnLinux, OnWindows, Phone, SignInCancelled, SystemNotKnown } = composeStories(stories);

const REPOSITORY_URL = 'https://github.com/kedrzu/githq';

/** The whole page — the navigation and `main` — and nothing of Storybook's around it. */
function landingPage(): HTMLElement {
    const root = page.getByRole('main').element().parentElement;
    if (!root) {
        throw new Error('The landing page is not rendered');
    }
    return root;
}

test('every "Sign in" signs in: the navigation, the hero, the last call to action and the footer', async () => {
    const onSignIn = Landing.args.onSignIn;
    await Landing.run();

    // On a wide page the sections are in the bar, with no menu.
    await expect.element(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('banner').getByRole('button', { name: 'Sign in', exact: true }));
    expect(onSignIn).toHaveBeenCalledTimes(1);

    const signIns = page.getByRole('button', { name: 'Sign in with GitHub' });
    expect(signIns.elements()).toHaveLength(2);
    await userEvent.click(signIns.nth(0));
    expect(onSignIn).toHaveBeenCalledTimes(2);
    await userEvent.click(signIns.nth(1));
    expect(onSignIn).toHaveBeenCalledTimes(3);

    await userEvent.click(page.getByRole('contentinfo').getByRole('button', { name: 'Sign in', exact: true }));
    expect(onSignIn).toHaveBeenCalledTimes(4);
});

test('"Star on GitHub" opens the repository on GitHub, in a tab of its own', async () => {
    await Landing.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The pill above the headline and the open source card.
    const stars = page.getByRole('link', { name: 'Star on GitHub' }).elements();
    expect(stars).toHaveLength(2);
    for (const star of stars) {
        expect(star.getAttribute('href')).toBe(REPOSITORY_URL);
        expect(star.getAttribute('target')).toBe('_blank');
    }
});

test('"Download the app" downloads the build for the system, or opens /download with none to install on', async () => {
    const downloadLinks = () => page.getByRole('main').getByRole('link', { name: 'Download the app' }).elements();
    const installer = (name: string) => `https://githq.dev/download/${name}`;
    const expectEvery = (href: string) => {
        // The hero and the last call to action.
        expect(downloadLinks().map(link => link.getAttribute('href'))).toEqual([href, href]);
    };

    await Landing.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
    expectEvery(installer('macos-silicon'));

    await OnWindows.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
    expectEvery(installer('windows'));

    await OnLinux.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
    expectEvery(installer('linux-appimage'));

    await SystemNotKnown.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
    expectEvery('/download');
});

test('"Download the app" spins until the download has started, and takes no second click meanwhile', async () => {
    await OnWindows.run();
    // The test stays on its page: the browser would leave for githq.dev.
    const stay = (event: Event) => event.preventDefault();
    document.addEventListener('click', stay);
    onTestFinished(() => document.removeEventListener('click', stay));

    const download = page.getByRole('main').getByRole('link', { name: 'Download the app' }).first();
    await userEvent.click(download);
    await expect.element(download).toHaveAttribute('aria-busy', 'true');
    // Off githq.dev the Worker's cookie can't be read, so the spinner gives the redirects a moment and stops.
    await expect.element(download, { timeout: 3000 }).not.toHaveAttribute('aria-busy');
});

test('the page says nothing of the signatures or the permissions: /download does', async () => {
    await OnWindows.run();

    const main = page.getByRole('main');
    await expect.element(main).toHaveTextContent('In your browser, nothing to install');
    await expect.element(main).not.toHaveTextContent('SmartScreen');
    await expect.element(main).not.toHaveTextContent('GitHub will ask for full repository access');
});

test('every way off the page goes to githq on GitHub or to its installers on githq.dev, and every link within it lands on a section', async () => {
    await Landing.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();

    const root = landingPage();
    const links = [...root.querySelectorAll('a')].map(link => link.getAttribute('href') ?? '');
    const outside = links.filter(href => !href.startsWith('#') && href !== '/download');
    expect(outside).toContain(REPOSITORY_URL);
    expect(
        outside.filter(href => !href.startsWith(REPOSITORY_URL) && !href.startsWith('https://githq.dev/download/')),
    ).toEqual([]);
    expect(root.textContent).not.toContain('mlaine');

    // The navigation's, then the footer's.
    const sections = links.filter(href => href.startsWith('#'));
    expect(sections).toEqual(['#features', '#compare', '#how-it-works', '#open-source', '#features', '#keyboard']);
    for (const href of sections) {
        expect(root.querySelector(href)).not.toBeNull();
    }
});

test('the comparison says every mark in words, not only with an icon', async () => {
    await Landing.run();

    const table = page.getByRole('table', { name: 'Your tracker is already on GitHub.' });
    await expect.element(table).toBeVisible();
    const columns = table.getByRole('columnheader').elements();
    expect(columns.map(textOf)).toEqual(['github.com', 'A dedicated tracker', 'git/hq']);
    // githq's column is headed by the wordmark, named for screen readers.
    await expect.element(table.getByRole('columnheader', { name: 'githq' })).toBeVisible();

    const rows = [...table.element().querySelectorAll('tbody tr')].map(row => [...row.children].map(textOf));
    expect(rows).toEqual([
        ['Your work lives next to your code', 'Yes', 'No', 'Yes'],
        ['Instant — no spinner on navigation', 'No', 'Yes', 'Yes'],
        ['Everything from the keyboard', 'Partly', 'Yes', 'Yes'],
        ['All your repositories in one view', 'Partly', 'Yes', 'Yes'],
        [
            'Pull requests, checks and failing workflows next to your issues',
            'Partly, one repository at a time',
            'Partly',
            'Yes',
        ],
        ['Nothing to import or keep in sync', 'Yes', 'No', 'Yes'],
        ['Price for your team', 'Free', 'Per seat', 'Free'],
    ]);
    for (const cell of table.element().querySelectorAll('tbody th')) {
        expect(cell.getAttribute('scope')).toBe('row');
    }
});

/** An element's text with its spaces made plain: the translations keep "A" with the word after it (a no-break space). */
function textOf(element: Element): string {
    return element.textContent.replaceAll(/\s+/g, ' ').trim();
}

test('the hero screenshot loads first; the rest wait for the reader, with their size known before they load', async () => {
    await Landing.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();

    const [hero, ...rest] = [...landingPage().querySelectorAll('img')];
    expect(hero?.getAttribute('src')).toBe('/landing/hero-my-work.webp');
    expect(hero?.getAttribute('fetchpriority')).toBe('high');
    expect(hero?.getAttribute('loading')).toBeNull();
    expect(rest).toHaveLength(7);
    for (const image of rest) {
        expect(image.getAttribute('loading')).toBe('lazy');
        expect(image.getAttribute('decoding')).toBe('async');
        expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
        expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
    }
});

test('on a phone the sections are behind a menu, which a chosen section closes', async () => {
    await Phone.run();

    const menuButton = page.getByRole('button', { name: 'Menu' });
    const header = page.getByRole('banner');
    await expect.element(header.getByRole('link', { name: 'Compare' })).not.toBeInTheDocument();
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(menuButton);
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('navigation', { name: 'Menu' });
    await expect.element(menu.getByRole('link', { name: 'kedrzu/githq' })).toHaveAttribute('href', REPOSITORY_URL);

    // Following the link would scroll the test runner's own page away.
    document.addEventListener('click', event => event.preventDefault(), { once: true });
    await userEvent.click(menu.getByRole('link', { name: 'Compare' }));
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect.element(menu).not.toBeInTheDocument();
});

test('the banner of a sign-in that did not finish sits above the hero', async () => {
    await SignInCancelled.run();

    await expect.element(page.getByRole('status')).toHaveTextContent("Sign-in didn't finish.");
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('a section waits hidden only if it is below the viewport after mount, and reveals once as it scrolls in', async () => {
    await Landing.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();

    // In view from the start: never hidden.
    expect(sectionOf(page.getByRole('heading', { level: 1 }).element()).hasAttribute('data-reveal')).toBe(false);

    const comparison = sectionOf(page.getByRole('table').element());
    expect(comparison.getAttribute('data-reveal')).toBe('waiting');

    comparison.scrollIntoView();
    await expect.poll(() => comparison.getAttribute('data-reveal')).toBe('revealed');

    // Never again on scroll-back.
    landingPage().scrollIntoView();
    comparison.scrollIntoView();
    expect(comparison.getAttribute('data-reveal')).toBe('revealed');
});

test('under reduced motion nothing hides or moves: no section waits, the address stays githq’s', async () => {
    const matchMedia = window.matchMedia.bind(window);
    // A query the browser always matches stands in for the visitor's setting.
    const spy = vi
        .spyOn(window, 'matchMedia')
        .mockImplementation(query =>
            matchMedia(query === '(prefers-reduced-motion: reduce)' ? '(min-width: 0px)' : query),
        );
    onTestFinished(() => spy.mockRestore());

    await Landing.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Past the point where the loop would select GitHub's host.
    await new Promise(resolve => {
        setTimeout(resolve, 800);
    });

    const root = landingPage();
    expect(root.querySelectorAll('[data-reveal]')).toHaveLength(0);
    const steps = [...root.querySelectorAll('[data-step]')].map(loop => loop.getAttribute('data-step'));
    expect(steps).toEqual(['githq']);
});

/** The landing section an element is in. */
function sectionOf(element: Element): HTMLElement {
    const section = element.closest('section');
    if (!section) {
        throw new Error('The element is not in a section');
    }
    return section;
}
