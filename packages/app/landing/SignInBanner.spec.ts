import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './SignInBanner.stories.js';

const { Cancelled, TokenRejected } = composeStories(stories);

test('says what happened, in one line', async () => {
    await Cancelled.run();
    await expect
        .element(page.getByRole('status'))
        .toHaveTextContent(
            "Sign-in didn't finish. Access was cancelled on GitHub's screen, so nothing was shared with githq.",
        );
});

test('"Try again" signs in once more, and the banner can be dismissed', async () => {
    const { onTryAgain, onDismiss } = TokenRejected.args;
    await TokenRejected.run();

    await expect.element(page.getByRole('status')).toHaveTextContent('You were signed out.');
    await userEvent.click(page.getByRole('button', { name: 'Try again' }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    await userEvent.click(page.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
});
