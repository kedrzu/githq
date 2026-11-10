import { composeStories } from '@storybook/vue3-vite';
import { expect, test } from 'vitest';

import { estimateReviewRowHeight } from './buildReviewRows.js';
import * as stories from './ReviewDiffRow.stories.js';

const { CodeKinds, Collapsed, Split, SplitColoured, Unified, UnifiedColoured } = composeStories(stories);

test('the end of a file, open or collapsed to its header, is drawn as tall as estimated', async () => {
    await Collapsed.run();

    const heights = (selector: string) =>
        [...document.querySelectorAll(selector)].map(end => end.parentElement?.getBoundingClientRect().height);
    const open = heights('[class*="reviewDiffRow_end"]:not([class*="reviewDiffRow_endCollapsed"])');
    const collapsed = heights('[class*="reviewDiffRow_endCollapsed"]');

    expect(open).toEqual([estimateReviewRowHeight({ kind: 'end', key: 'end', collapsed: false })]);
    const collapsedEstimate = estimateReviewRowHeight({ kind: 'end', key: 'end', collapsed: true });
    expect(collapsed).toEqual([collapsedEstimate, collapsedEstimate, collapsedEstimate, collapsedEstimate]);
});

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

test.each([
    ['split', SplitColoured],
    ['unified', UnifiedColoured],
])('an unchanged and an added line are drawn in one colour, %s', async (_layout, Coloured) => {
    await Coloured.run();

    const unchanged = getCode('const RETRY_DELAY_MS');
    const added = getCode('const MAX_BATCH = 50');

    expect(getComputedStyle(unchanged).color).toBe(getComputedStyle(added).color);
});

test('each kind of token has a colour of its own', async () => {
    await CodeKinds.run();

    const kinds = ['comment', 'keyword', 'string', 'constant', 'title', 'tag', 'builtin'];
    const colours = kinds.map(kind => {
        const span = document.querySelector(`[tid="code-${kind}"]`);
        expect(span, kind).not.toBeNull();
        return getComputedStyle(span!).color;
    });
    const code = getComputedStyle(document.querySelector('code')!).color;

    expect(new Set([...colours, code]).size).toBe(kinds.length + 1);
});

function getCode(text: string) {
    const code = [...document.querySelectorAll('code')].find(element => element.textContent?.includes(text));
    expect(code, text).toBeDefined();
    return code!;
}
