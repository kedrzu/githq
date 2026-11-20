import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import type { ButtonSize } from './Button.vue';
import * as stories from './Button.stories.jsx';

const { AsyncClick, Sizes, Submit } = composeStories(stories);

/** Each size's height (the border included) and icon, from `docs/design/githq/buttons.md`. */
const SCALE: Record<ButtonSize, { height: number; icon: number }> = {
    sm: { height: 24, icon: 14 },
    md: { height: 32, icon: 16 },
    lg: { height: 40, icon: 16 },
    xl: { height: 48, icon: 18 },
};

test("each size is its height with or without an icon or a key, an icon in the label at the size's icon size", async () => {
    await Sizes.run();

    for (const [size, { height, icon }] of Object.entries(SCALE)) {
        const buttons = sizeButtons(size);
        for (const [kind, button] of Object.entries(buttons)) {
            expect(button.getBoundingClientRect().height, `${size} ${kind}`).toBe(height);
            expect(button.getAttribute('data-button-size'), `${size} ${kind}`).toBe(size);
        }

        const slotIcon = buttons.slotIcon.querySelector('svg');
        expect(slotIcon?.getBoundingClientRect().height, size).toBe(icon);
        expect(slotIcon?.getBoundingClientRect().width, size).toBe(icon);
    }
});

test('a key sits as far from the end as from the top and bottom, at every size', async () => {
    await Sizes.run();

    for (const size of Object.keys(SCALE)) {
        const { key, field } = sizeButtons(size);
        for (const [kind, button] of Object.entries({ key, field })) {
            const style = getComputedStyle(button);
            expect(style.paddingInlineEnd, `${size} ${kind}`).toBe(style.paddingTop);
        }
    }
});

test('runs its async action once however often it is activated meanwhile, then again once it settles', async () => {
    await AsyncClick.run();

    const track = page.getByRole('button', { name: 'Track these', exact: true });
    const runs = page.getByTestId('runs');

    const width = track.element().getBoundingClientRect().width;
    await userEvent.dblClick(track);
    // Busy: marked for assistive technology, and "Working…" joins its name.
    const busyTrack = page.getByRole('button', { name: 'Track these Working…' });
    await expect.element(busyTrack).toHaveAttribute('aria-busy', 'true');
    await expect.element(runs).toHaveTextContent('Runs: 1');
    // The label hidden under the spinner, not removed: the button keeps its width.
    expect(busyTrack.element().getBoundingClientRect().width).toBe(width);

    // Enter on the busy button does nothing either.
    busyTrack.element().focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(busyTrack);
    await expect.element(runs).toHaveTextContent('Runs: 1');

    await userEvent.click(page.getByRole('button', { name: 'Finish' }));
    await expect.element(track).not.toHaveAttribute('aria-busy');

    track.element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(runs).toHaveTextContent('Runs: 2');
});

test('a submit button submits its form once while the submission runs', async () => {
    await Submit.run();

    const create = page.getByRole('button', { name: 'Create issue', exact: true });
    await userEvent.dblClick(create);
    await expect
        .element(page.getByRole('button', { name: 'Create issue Working…' }))
        .toHaveAttribute('aria-busy', 'true');
    await expect.element(page.getByTestId('submits')).toHaveTextContent('Submits: 1');

    await userEvent.click(page.getByRole('button', { name: 'Finish' }));
    await expect.element(create).not.toHaveAttribute('aria-busy');
    await userEvent.click(create);
    await expect.element(page.getByTestId('submits')).toHaveTextContent('Submits: 2');
});

test('keyboard focus draws its ring', async () => {
    await Sizes.run();

    await userEvent.keyboard('{Tab}');
    const first = sizeButtons('sm').plain;
    await expect.element(first).toHaveFocus();
    expect(getComputedStyle(first).outlineStyle).toBe('solid');
});

/** The `Sizes` story's buttons of one size, in its order. */
function sizeButtons(size: string) {
    const [plain, icon, key, slotIcon, field] = page.getByTestId(size).element().querySelectorAll('button');
    return { plain: plain!, icon: icon!, key: key!, slotIcon: slotIcon!, field: field! };
}
