import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './TextField.stories.jsx';

const { Gallery, InForm } = composeStories(stories);

test('a submit with the required field empty shows its error on it, and the form is not sent', async () => {
    await InForm.run();

    const title = page.getByRole('textbox', { name: 'Title' });
    await expect.element(title).toBeValid();

    await userEvent.click(page.getByRole('button', { name: 'Create issue' }));
    await expect.element(title).toBeInvalid();
    // The message's typography joins its last words with a no-break space.
    await expect.element(title).toHaveAccessibleDescription(/^Field is\srequired$/u);
    await expect.element(page.getByRole('alert')).toHaveTextContent(/^Field is\srequired$/u);
    await expect.element(page.getByTestId('created')).toHaveTextContent('Created: nothing');

    // Typed: valid again, and the form goes through.
    await userEvent.type(title, 'DST reminders');
    await expect.element(title).toBeValid();
    await expect.element(title).not.toHaveAttribute('aria-describedby');
    await userEvent.click(page.getByRole('button', { name: 'Create issue' }));
    await expect.element(page.getByTestId('created')).toHaveTextContent('Created: DST reminders');
});

test('a value breaking a rule shows its error once the field is left', async () => {
    await InForm.run();

    const title = page.getByRole('textbox', { name: 'Title' });
    await userEvent.type(title, 'Reminders skip the first visit');
    await userEvent.tab();
    await expect.element(title).toBeInvalid();
    await expect.element(title).toHaveAccessibleDescription(/^Maximum length is 20\scharacters$/u);
});

test('a hint describes the field', async () => {
    await Gallery.run();

    await expect
        .element(page.getByRole('textbox', { name: 'Title' }))
        .toHaveAccessibleDescription('Shown in the list and on GitHub.');
});
