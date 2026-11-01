import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './AccountView.stories.js';

const { Account, Failed, NotRequested } = composeStories(stories);

test('an organisation hiding its private data says so, with a link to request approval that is remembered', async () => {
    const onRequestApproval = vi.fn();
    await NotRequested.run({ args: { ...NotRequested.args, onRequestApproval } });

    await expect.element(page.getByText('Private repositories and projects hidden')).toBeVisible();
    await expect.element(page.getByText(/You requested approval/)).not.toBeInTheDocument();
    const request = page.getByRole('link', { name: 'Request approval: acme-health' });
    await expect.element(request).toHaveAttribute('href', 'https://githq.test/api/auth/approval');
    await expect.element(request).toHaveAttribute('target', '_blank');

    await userEvent.click(request);
    expect(onRequestApproval).toHaveBeenCalledWith('acme-health');
});

test('the account, its organisations, what this browser keeps and signing out', async () => {
    const onSignOut = vi.fn();
    await Account.run({ args: { ...Account.args, onSignOut } });

    await expect.element(page.getByText('Signed in with GitHub · member of 3 organisations')).toBeVisible();
    await expect.element(page.getByText('You requested approval on Oct 28.', { exact: false })).toBeVisible();
    // Its approval was requested from here and it hides nothing now; the other never hid anything.
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'skyline-labs' }))
        .toHaveTextContent(/skyline-labs\s*Approved/);
    await expect
        .element(page.getByRole('listitem').filter({ hasText: 'kedrzu-labs' }))
        .toHaveTextContent(/kedrzu-labs\s*No restrictions/);
    await expect.element(page.getByText('15 repositories, 1 project · 3,020 items · 48.2 MB')).toBeVisible();
    await expect.element(page.getByText('In the background, about every 30 seconds · last 14s ago')).toBeVisible();
    await expect
        .element(page.getByTestId('account-allowance'))
        .toHaveTextContent(/^4,812 of 5,000 left this hour · resets at \d\d:\d\d$/);

    await userEvent.click(page.getByRole('button', { name: 'Sign out and clear' }));
    expect(onSignOut).toHaveBeenCalled();
});

test('organisations GitHub could not be asked for can be asked for again', async () => {
    const onRetry = vi.fn();
    await Failed.run({ args: { ...Failed.args, onRetry } });

    await userEvent.click(page.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
});
