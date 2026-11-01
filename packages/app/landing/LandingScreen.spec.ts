import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './LandingScreen.stories.js';

const { Landing, Phone, SignInCancelled } = composeStories(stories);

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

test('"Star on GitHub" and "Why?" open the repository on GitHub, in a tab of their own', async () => {
    await Landing.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The hero, the open source card and the last call to action.
    const stars = page.getByRole('link', { name: 'Star on GitHub' }).elements();
    expect(stars).toHaveLength(3);
    for (const star of stars) {
        expect(star.getAttribute('href')).toBe(REPOSITORY_URL);
        expect(star.getAttribute('target')).toBe('_blank');
    }
    // The hero and the last call to action.
    const whys = page.getByRole('link', { name: 'Why?' }).elements();
    expect(whys).toHaveLength(2);
    for (const why of whys) {
        expect(why.getAttribute('href')).toBe(
            `${REPOSITORY_URL}/blob/main/docs/design/githq/README.md#what-githq-keeps-in-your-browser`,
        );
        expect(why.getAttribute('target')).toBe('_blank');
    }
});

test('every way off the page goes to githq on GitHub, and every link within it lands on a section', async () => {
    await Landing.run();
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();

    const root = landingPage();
    const links = [...root.querySelectorAll('a')].map(link => link.getAttribute('href') ?? '');
    const outside = links.filter(href => !href.startsWith('#'));
    expect(outside).toContain(REPOSITORY_URL);
    expect(outside.filter(href => !href.startsWith(REPOSITORY_URL))).toEqual([]);
    expect(root.textContent).not.toContain('mlaine');

    // The navigation's, then the footer's.
    const sections = links.filter(href => href.startsWith('#'));
    expect(sections).toEqual([
        '#features',
        '#keyboard',
        '#how-it-works',
        '#open-source',
        '#features',
        '#keyboard',
        '#install',
    ]);
    for (const href of sections) {
        expect(root.querySelector(href)).not.toBeNull();
    }
});

test('the comparison says every mark in words, not only with an icon', async () => {
    await Landing.run();

    const table = page.getByRole('table', { name: 'The best of both. Without the second tool.' });
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
    expect(rest).toHaveLength(5);
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
    await expect.element(header.getByRole('link', { name: 'Keyboard' })).not.toBeInTheDocument();
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(menuButton);
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'true');
    const menu = page.getByRole('navigation', { name: 'Menu' });
    await expect.element(menu.getByRole('link', { name: 'kedrzu/githq' })).toHaveAttribute('href', REPOSITORY_URL);

    // Following the link would scroll the test runner's own page away.
    document.addEventListener('click', event => event.preventDefault(), { once: true });
    await userEvent.click(menu.getByRole('link', { name: 'Keyboard' }));
    await expect.element(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect.element(menu).not.toBeInTheDocument();
});

test('the banner of a sign-in that did not finish sits above the hero', async () => {
    await SignInCancelled.run();

    await expect.element(page.getByRole('status')).toHaveTextContent("Sign-in didn't finish.");
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
});
