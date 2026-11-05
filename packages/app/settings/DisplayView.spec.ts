import { composeStories } from '@storybook/vue3';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { matchText } from '@/testing/matchText.js';

import * as stories from './DisplayView.stories.js';

const { TabsChosen, ColumnChosen } = composeStories(stories);

test('the chosen layout is the checked card of a named group, each card described by its line', async () => {
    await ColumnChosen.run();

    const group = page.getByRole('radiogroup', { name: 'Repository layout' });
    await expect.element(group.getByRole('radio', { name: 'Column' })).toBeChecked();
    await expect.element(group.getByRole('radio', { name: 'Tabs' })).not.toBeChecked();
    await expect
        .element(group.getByRole('radio', { name: 'Tabs' }))
        .toHaveAccessibleDescription(
            matchText(
                "Sections as tabs beside the repository's name, each with its toolbar. The list and the graph keep the full width.",
            ),
        );
});

test('Tab lands on the chosen card without changing anything; arrows and a click choose', async () => {
    const onUpdate = vi.fn();
    await TabsChosen.run({ args: { ...TabsChosen.args, 'onUpdate:modelValue': onUpdate } });

    await userEvent.tab();
    await expect.element(page.getByRole('radio', { name: 'Tabs' })).toHaveFocus();
    expect(onUpdate).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowRight}');
    await expect.element(page.getByRole('radio', { name: 'Column' })).toHaveFocus();
    expect(onUpdate).toHaveBeenLastCalledWith('column');

    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(page.getByRole('radio', { name: 'Tabs' })).toHaveFocus();
    expect(onUpdate).toHaveBeenLastCalledWith('tabs');

    onUpdate.mockClear();
    await userEvent.click(page.getByRole('radio', { name: 'Column' }));
    expect(onUpdate).toHaveBeenLastCalledWith('column');
});
