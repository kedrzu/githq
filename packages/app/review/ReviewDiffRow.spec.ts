import { composeStories } from '@storybook/vue3-vite';
import { expect, test } from 'vitest';

import * as stories from './ReviewDiffRow.stories.js';

const { Split, SplitColoured, Unified, UnifiedColoured } = composeStories(stories);

test.each([
    ['split', Split, SplitColoured],
    ['unified', Unified, UnifiedColoured],
])('colours change no text and no height, %s, a line that wraps included', async (_layout, Plain, Coloured) => {
    await Plain.run();
    const plain = readCode();
    await Coloured.run();
    const coloured = readCode();

    expect(coloured).toEqual(plain);
    expect(Math.max(...plain.heights)).toBeGreaterThan(20);
    expect(document.querySelectorAll('[class*="diffCode_keyword"]').length).toBeGreaterThan(0);
    expect(document.querySelector('code img')).toBeNull();
    expect(plain.texts.join('\n')).toContain('<img src=x>');
});

function readCode() {
    const codes = [...document.querySelectorAll('code')];
    return {
        texts: codes.map(code => code.textContent),
        heights: codes.map(code => code.getBoundingClientRect().height),
    };
}
