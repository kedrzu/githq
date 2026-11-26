import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import type { TypographyRoleChange } from '@/typography/readTypography.js';

import * as stories from './TypographyBlock.stories.js';

const { Default, CustomOtherFonts, RangeEnds } = composeStories(stories);

const card = (name: string) => page.getByRole('region', { name });
const preset = (name: string) => page.getByRole('group', { name: 'Preset' }).getByRole('button', { name });
const stepper = (role: string, name: string) => card(role).getByRole('group', { name });

beforeEach(async () => {
    await page.viewport(1280, 900);
});

test('a hand-made Reading size shows Custom; choosing Compact afterwards drops it for the preset size', async () => {
    await Default.run();

    await expect.element(preset('Default')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(preset('Custom')).toBeDisabled();

    const size = stepper('Reading', 'Size');
    await userEvent.click(size.getByRole('button', { name: 'Increase' }));
    await expect.element(size.getByRole('status')).toHaveTextContent(/^14\.5\s*px$/u);
    await expect.element(preset('Custom')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(preset('Default')).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(preset('Compact'));
    await expect.element(preset('Compact')).toHaveAttribute('aria-pressed', 'true');
    await expect.element(preset('Custom')).toBeDisabled();
    await expect.element(size.getByRole('status')).toHaveTextContent(/^13\s*px$/u);
});

test('with hand-made values Custom is the choice; pressing it asks nothing, a preset is still picked from there', async () => {
    const onPreset = vi.fn();
    await CustomOtherFonts.run({ args: { ...CustomOtherFonts.args, onPreset } });

    await expect.element(preset('Custom')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(preset('Custom'));
    expect(onPreset).not.toHaveBeenCalled();

    await userEvent.click(preset('Spaced'));
    expect(onPreset).toHaveBeenLastCalledWith('spaced');
});

test('a font is picked from its menu by the keys, each role asking for its own', async () => {
    const onChange = vi.fn();
    await CustomOtherFonts.run({ args: { ...CustomOtherFonts.args, onChange } });

    const code = card('Code').getByRole('button', { name: /^Font IBM Plex Mono$/u });
    await userEvent.click(code);
    await expect.element(page.getByRole('menuitemradio', { name: /^IBM Plex Mono$/u })).toBeChecked();
    await expect
        .element(page.getByRole('menuitemradio', { name: /^System\s*SF Mono, Cascadia, Menlo$/u }))
        .toBeVisible();
    await userEvent.click(page.getByRole('menuitemradio', { name: /^Fira Code$/u }));
    const expected: TypographyRoleChange = { role: 'code', font: 'fira-code' };
    expect(onChange).toHaveBeenLastCalledWith(expected);

    card('Interface')
        .getByRole('button', { name: /^Font IBM Plex Sans$/u })
        .element()
        .focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(page.getByRole('menuitemradio', { name: /^Literata$/u })).not.toBeInTheDocument();
    await userEvent.click(page.getByRole('menuitemradio', { name: /^System\s*SF Pro, Segoe UI$/u }));
    const interfaceChange: TypographyRoleChange = { role: 'interface', font: 'system' };
    expect(onChange).toHaveBeenLastCalledWith(interfaceChange);
});

test('a stepper at the end of its range keeps its focus and goes no further', async () => {
    const onChange = vi.fn();
    await RangeEnds.run({ args: { ...RangeEnds.args, onChange } });

    const increase = stepper('Reading', 'Size').getByRole('button', { name: 'Increase' });
    await expect.element(increase).toHaveAttribute('aria-disabled', 'true');
    increase.element().focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await expect.element(increase).toHaveFocus();

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await expect.element(stepper('Reading', 'Size').getByRole('button', { name: 'Decrease' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    const smaller: TypographyRoleChange = { role: 'reading', size: 19.5 };
    expect(onChange).toHaveBeenLastCalledWith(smaller);

    await userEvent.click(stepper('Code', 'Line height').getByRole('button', { name: 'Decrease' }));
    const shorter: TypographyRoleChange = { role: 'code', lineHeight: 27 };
    expect(onChange).toHaveBeenLastCalledWith(shorter);
});
