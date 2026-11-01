import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './Picker.stories.jsx';

const { Grouped, Labels, LabelsOfSeveral, MilestonePicker } = composeStories(stories);

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

test('Enter right after typing picks the best match of all groups, its group first', async () => {
    await Grouped.run();

    await userEvent.click(page.getByRole('button', { name: 'Status' }));
    // "Not done yet" comes first in the list as given, but "Done" is the whole text.
    await userEvent.keyboard('done');
    await expect.element(page.getByRole('option').first()).toHaveAccessibleName('Done');
    await expect.element(page.getByRole('option')).toHaveLength(2);
    await userEvent.keyboard('{Enter}');

    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: done');
});

test('Enter typed in one go with the query picks the same best match', async () => {
    await Grouped.run();

    await userEvent.click(page.getByRole('button', { name: 'Status' }));
    await userEvent.keyboard('done{Enter}');

    await expect.element(page.getByTestId('picked')).toHaveTextContent('Picked: done');
});

test('words in another order, a name without its diacritics and scattered letters find the same line', async () => {
    await Grouped.run();

    await userEvent.click(page.getByRole('button', { name: 'Status' }));
    const filter = page.getByRole('textbox', { name: 'Filter…' });
    for (const typed of ['sprint zolty', 'zolty', 'ztys']) {
        await userEvent.clear(filter);
        await userEvent.type(filter, typed);
        await expect.element(page.getByRole('option')).toHaveLength(1);
        await expect.element(page.getByRole('option', { name: 'Żółty sprint' })).toBeInTheDocument();
    }
});

test('the "none" row shows only while nothing is typed', async () => {
    await MilestonePicker.run();

    await userEvent.click(page.getByRole('button', { name: 'Milestone' }));
    const none = page.getByRole('option', { name: 'No milestone' });
    await expect.element(none).toBeInTheDocument();
    await userEvent.keyboard('dec');
    await expect.element(none).not.toBeInTheDocument();
    await expect.element(page.getByRole('option').first()).toHaveAccessibleName(/^v4\.3/);

    await userEvent.clear(page.getByRole('textbox'));
    await expect.element(none).toBeInTheDocument();
});

test('a half-chosen option stays half-chosen when typed text finds it', async () => {
    await LabelsOfSeveral.run();

    await userEvent.click(page.getByRole('button', { name: 'Labels of 3 items' }));
    await userEvent.keyboard('prf');
    await expect.element(page.getByRole('option', { name: 'perf' })).toHaveAttribute('aria-checked', 'mixed');
});
