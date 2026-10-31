import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './LandingScreen.stories.js';

const { Landing, SignInCancelled } = composeStories(stories);

test('"Sign in with GitHub" signs in', async () => {
    const onSignIn = Landing.args.onSignIn;
    await Landing.run();

    await userEvent.click(page.getByRole('button', { name: 'Sign in with GitHub' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
});

test('"Star on GitHub" and "Why?" open the repository on GitHub, in a tab of their own', async () => {
    await Landing.run();

    const star = page.getByRole('link', { name: 'Star on GitHub' });
    await expect.element(star).toHaveAttribute('href', 'https://github.com/kedrzu/githq');
    await expect.element(star).toHaveAttribute('target', '_blank');
    const why = page.getByRole('link', { name: 'Why?' });
    await expect
        .element(why)
        .toHaveAttribute(
            'href',
            'https://github.com/kedrzu/githq/blob/main/docs/design/githq/README.md#what-githq-keeps-in-your-browser',
        );
    await expect.element(why).toHaveAttribute('target', '_blank');
});

test('the banner of a sign-in that did not finish sits above the hero', async () => {
    await SignInCancelled.run();

    await expect.element(page.getByRole('status')).toHaveTextContent("Sign-in didn't finish.");
    await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible();
});
