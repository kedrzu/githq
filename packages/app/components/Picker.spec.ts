import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Picker.stories.jsx';

const { Labels, LabelsOfSeveral, MilestonePicker } = composeStories(stories);

test('several values: type to narrow, Enter and Space toggle, Escape closes and applies what changed', async () => {
    await Labels.run();

    const trigger = page.getByRole('button', { name: 'Labels' });
    await userEvent.click(trigger);
    const filter = page.getByRole('textbox', { name: 'Filter labels…' });
    await expect.element(filter).toHaveFocus();

    // Space toggles the first option (bug) while nothing is typed.
    await userEvent.keyboard(' ');
    await expect.element(page.getByRole('option', { name: 'bug' })).toHaveAttribute('aria-checked', 'false');

    // Typed, Space is part of the filter: "good first" narrows to one option, Enter toggles it.
    await userEvent.keyboard('good first');
    await expect.element(page.getByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    await expect
        .element(page.getByRole('option', { name: 'good first issue' }))
        .toHaveAttribute('aria-checked', 'true');
    // Still open: several values are applied together.
    await expect.element(page.getByTestId('applied')).toHaveTextContent('Nothing applied');

    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
    await expect.element(page.getByTestId('applied')).toHaveTextContent('Added: good first issue; removed: bug');
    await expect.element(trigger).toHaveFocus();
});

test('closing without a change applies nothing; toggling back and forth is no change', async () => {
    await Labels.run();

    await userEvent.click(page.getByRole('button', { name: 'Labels' }));
    await userEvent.keyboard('  ');
    await userEvent.keyboard('{Escape}');

    await expect.element(page.getByTestId('applied')).toHaveTextContent('Nothing applied');
});

test('a value some items have is half-chosen; toggling it adds it to all', async () => {
    await LabelsOfSeveral.run();

    await userEvent.click(page.getByRole('button', { name: 'Labels of 3 items' }));
    const perf = page.getByRole('option', { name: 'perf' });
    await expect.element(perf).toHaveAttribute('aria-checked', 'mixed');
    await expect.element(page.getByText('2 of 3 editable')).toBeInTheDocument();

    await userEvent.click(perf);
    await expect.element(perf).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Escape}');
    await expect.element(page.getByTestId('applied')).toHaveTextContent('Added: perf; removed: –');
});

test('one value: ↓ and Enter pick it and close; "none" clears it', async () => {
    await MilestonePicker.run();

    const trigger = page.getByRole('button', { name: 'Milestone' });
    await userEvent.click(trigger);
    // "No milestone" first, then the milestones.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: v4.3');
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    await userEvent.click(page.getByRole('option', { name: 'No milestone' }));
    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: none');
});
