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

test('"Sign in" in the navigation and "Sign in with GitHub" in the hero both sign in', async () => {
    const onSignIn = Landing.args.onSignIn;
    await Landing.run();

    // On a wide page the sections are in the bar, with no menu.
    await expect.element(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('button', { name: 'Sign in', exact: true }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    await userEvent.click(page.getByRole('button', { name: 'Sign in with GitHub' }));
    expect(onSignIn).toHaveBeenCalledTimes(2);
});

test('"Star on GitHub" and "Why?" open the repository on GitHub, in a tab of their own', async () => {
    await Landing.run();

    const star = page.getByRole('link', { name: 'Star on GitHub' });
    await expect.element(star).toHaveAttribute('href', REPOSITORY_URL);
    await expect.element(star).toHaveAttribute('target', '_blank');
    const why = page.getByRole('link', { name: 'Why?' });
    await expect
        .element(why)
        .toHaveAttribute(
            'href',
            `${REPOSITORY_URL}/blob/main/docs/design/githq/README.md#what-githq-keeps-in-your-browser`,
        );
    await expect.element(why).toHaveAttribute('target', '_blank');
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

    // "Open source" (`#open-source`) lands on a section the rest of the page brings.
    const sections = links.filter(href => href.startsWith('#') && href !== '#open-source');
    expect(sections).toEqual(['#features', '#keyboard', '#how-it-works']);
    for (const href of sections) {
        expect(root.querySelector(href)).not.toBeNull();
    }
});

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
    await expect.element(page.getByRole('link', { name: 'Keyboard' })).not.toBeInTheDocument();
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
