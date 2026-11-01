import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './DesktopSignIn.stories.js';

const { BeforeSigningIn, CodeShown, Expired, NoKeychain } = composeStories(stories);

const NO_KEYCHAIN = "githq can't reach your system keychain, so you'll sign in again next time you open it.";

test('without a keychain to keep the token, a note says so up front', async () => {
    await NoKeychain.run();

    await expect.element(page.getByText(NO_KEYCHAIN)).toBeVisible();
});

test('with a keychain, there is no note', async () => {
    await BeforeSigningIn.run();

    await expect.element(page.getByRole('button', { name: 'Sign in with GitHub' })).toBeVisible();
    await expect.element(page.getByText(NO_KEYCHAIN)).not.toBeInTheDocument();
});

test('before signing in, Enter asks for a code, as the button does; Esc does nothing', async () => {
    const { onStart, onCancel } = BeforeSigningIn.args;
    await BeforeSigningIn.run();

    await userEvent.keyboard('{Enter}');
    expect(onStart).toHaveBeenCalledTimes(1);
    await userEvent.click(page.getByRole('button', { name: 'Sign in with GitHub' }));
    expect(onStart).toHaveBeenCalledTimes(2);

    await userEvent.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
});

test('with the code shown, Enter copies it and opens GitHub, Esc cancels', async () => {
    const { onStart, onOpen, onCancel } = CodeShown.args;
    await CodeShown.run();

    await expect.element(page.getByText('WDJB-MJHT')).toBeVisible();
    await expect.element(page.getByText('the code works for 15 minutes')).toBeVisible();

    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
    await userEvent.click(page.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
});

test('a failed attempt says why and offers a new code, on Enter too', async () => {
    const { onStart } = Expired.args;
    await Expired.run();

    await expect.element(page.getByText('The code expired before it was used on GitHub.')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Get a new code' }));
    expect(onStart).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Enter}');
    expect(onStart).toHaveBeenCalledTimes(2);
});
