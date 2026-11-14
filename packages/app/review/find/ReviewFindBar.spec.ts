import { composeStories } from '@storybook/vue3-vite';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import * as stories from './ReviewFindBar.stories.js';

const { Default } = composeStories(stories);

const field = () => page.getByRole('textbox', { name: 'Find in the code' });

test('the field steps with Enter, F3 and Mod+G, back with Shift, and closes with Escape', async () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onClose = vi.fn();
    await Default.run({ args: { ...Default.args, onNext, onPrevious, onClose } });
    await userEvent.click(field());

    await userEvent.keyboard('{Enter}{F3}{ControlOrMeta>}g{/ControlOrMeta}');
    expect(onNext).toHaveBeenCalledTimes(3);
    expect(onPrevious).not.toHaveBeenCalled();

    await userEvent.keyboard('{Shift>}{Enter}{F3}{/Shift}{Shift>}{ControlOrMeta>}g{/ControlOrMeta}{/Shift}');
    expect(onPrevious).toHaveBeenCalledTimes(3);
    expect(onNext).toHaveBeenCalledTimes(3);

    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
});

test('Mod+F selects what is typed, to type over', async () => {
    await Default.run();
    await userEvent.click(field());
    const input = field().element();
    if (!(input instanceof HTMLInputElement)) {
        throw new TypeError('The field is not an input');
    }

    input.setSelectionRange(2, 2);
    await userEvent.keyboard('{ControlOrMeta>}f{/ControlOrMeta}');

    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'review'.length]);
});

test('the buttons act and leave the focus in the field', async () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onToggle = vi.fn();
    await Default.run({ args: { ...Default.args, onNext, onPrevious, onToggle } });
    await userEvent.click(field());

    await userEvent.click(page.getByRole('button', { name: 'Next match' }));
    await userEvent.click(page.getByRole('button', { name: 'Previous match' }));
    await userEvent.click(page.getByRole('button', { name: 'Match whole word' }));
    await userEvent.click(page.getByRole('button', { name: 'Use a regular expression' }));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onToggle.mock.calls).toEqual([['wholeWord'], ['regex']]);
    await expect.element(field()).toHaveFocus();
});
