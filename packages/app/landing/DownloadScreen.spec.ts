import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { DESKTOP_BUILDS } from './desktopBuilds.js';
import * as stories from './DownloadScreen.stories.js';

const { OnAMac, OnWindows, Phone, SignedIn } = composeStories(stories);

test("every build has its own link, and only the visitor's is marked", async () => {
    await OnWindows.run();

    const links = page.getByRole('main').getByRole('link', { name: /^Download / });
    expect(links.elements().map(link => link.getAttribute('href'))).toEqual(
        Object.values(DESKTOP_BUILDS).map(build => build.url),
    );
    expect(page.getByText('Your system').elements()).toHaveLength(1);
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'Your system' }))
        .toHaveTextContent('Windows x64');
});

test('with no system known nothing is marked', async () => {
    await Phone.run();

    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.element(page.getByText('Your system')).not.toBeInTheDocument();
});

test('the warnings and the permission line are here, with the sign-in they belong to', async () => {
    const onSignIn = OnAMac.args.onSignIn;
    await OnAMac.run();

    const windows = page.getByRole('listitem').filter({ hasText: 'Windows x64' });
    await expect.element(windows).toHaveTextContent('More info → Run anyway');
    await expect.element(windows).toHaveTextContent('Smart App Control');
    await expect.element(page.getByRole('main')).toHaveTextContent('GitHub will ask for full repository access.');

    await userEvent.click(page.getByRole('main').getByRole('button', { name: 'Sign in with GitHub' }));
    expect(onSignIn).toHaveBeenCalledOnce();
});

test('signed in, the page opens the app and asks for nothing', async () => {
    await SignedIn.run();

    const main = page.getByRole('main');
    await expect.element(main.getByRole('link', { name: 'Open githq' })).toHaveAttribute('href', '/');
    await expect.element(main.getByRole('button', { name: 'Sign in with GitHub' })).not.toBeInTheDocument();
    await expect.element(main).not.toHaveTextContent('GitHub will ask for full repository access.');
    await expect
        .element(page.getByRole('banner').getByRole('link', { name: 'Open githq' }))
        .toHaveAttribute('href', '/');
});
