import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { nextTick } from 'vue';

import * as stories from './ChoiceCards.stories.jsx';

const { Gallery } = composeStories(stories);

const card = (name: string) => page.getByRole('radiogroup', { name: 'Row density' }).getByRole('radio', { name });

test('the cards are radios of a named group: a click chooses, Tab lands on the chosen one, arrows move and choose', async () => {
    await Gallery.run();
    await expect.element(card('Comfortable')).toBeChecked();

    await userEvent.tab();
    await expect.element(card('Comfortable')).toHaveFocus();
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: comfortable');

    await userEvent.keyboard('{ArrowRight}');
    await expect.element(card('Compact')).toHaveFocus();
    await expect.element(card('Compact')).toBeChecked();
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: compact');

    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: comfortable');

    await userEvent.click(card('Dense'));
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: dense');
});

test('changed from outside under a focused card: focus coming back writes nothing over it, and the arrows still choose', async () => {
    await Gallery.run();
    await userEvent.click(card('Compact'));
    await expect.element(card('Compact')).toHaveFocus();

    // A click no pointer made, so the card keeps the focus.
    page.getByRole('button', { name: 'Chosen in another tab' })
        .element()
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: dense');

    // As when the window is refocused: the focus comes from nothing.
    const stale = card('Compact').element();
    stale.blur();
    stale.focus();
    await nextTick();
    await expect.element(card('Compact')).toHaveFocus();
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: dense');
    await expect.element(card('Dense')).toBeChecked();

    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(card('Comfortable')).toHaveFocus();
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: comfortable');
});

test('a right click on another card moves focus but chooses nothing', async () => {
    await Gallery.run();
    await userEvent.click(card('Compact'));
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: compact');

    await userEvent.click(card('Dense'), { button: 'right' });
    await expect.element(card('Compact')).toBeChecked();
    await expect.element(page.getByTestId('density')).toHaveTextContent('Density: compact');
});
