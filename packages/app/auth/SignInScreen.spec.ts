import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SignInScreen.stories.js';

const { FirstVisit, Cancelled } = composeStories(stories);

test('Enter signs in, as the button does', async () => {
    const onSignIn = FirstVisit.args.onSignIn;
    await FirstVisit.run();

    await userEvent.keyboard('{Enter}');
    expect(onSignIn).toHaveBeenCalledTimes(1);

    await userEvent.click(page.getByRole('button', { name: 'Sign in with GitHub' }));
    expect(onSignIn).toHaveBeenCalledTimes(2);
});

test('after a failure the permissions wait behind "Why?"', async () => {
    await Cancelled.run();

    await expect.element(page.getByText("Sign-in didn't finish")).toBeVisible();
    const explainerTitle = page.getByText("What GitHub's next screen will ask for");
    await expect.element(explainerTitle).not.toBeInTheDocument();

    await userEvent.click(page.getByRole('button', { name: 'Why?' }));
    await expect.element(explainerTitle).toBeVisible();
});
