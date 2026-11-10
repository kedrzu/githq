import { composeStories } from '@storybook/vue3-vite';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { estimateReviewRowHeight } from './buildReviewRows.js';
import type { ReviewGapRow } from './buildReviewRows.js';
import * as stories from './ReviewDiffRow.stories.js';

const { CodeKinds, Collapsed, ExpansionReset, Gaps, Split, SplitColoured, Unified, UnifiedColoured } =
    composeStories(stories);

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

test("a gap is drawn as tall as estimated: two arrows between hunks, one at a file's top, its end or for a short gap", async () => {
    await Gaps.run();
    const gaps = () =>
        [...document.querySelectorAll('[tid="review-gap"]')].map(gap => gap.getBoundingClientRect().height);

    expect(gaps()).toEqual([
        estimateReviewRowHeight(gapRow({ hidden: 26, afterStart: 0, afterEnd: 26 })),
        estimateReviewRowHeight(gapRow({ hidden: 33, afterStart: 33, afterEnd: 66 })),
        estimateReviewRowHeight(gapRow({ hidden: 8, afterStart: 73, afterEnd: 81 })),
        estimateReviewRowHeight(gapRow({ hidden: 32, afterStart: 88, afterEnd: 120, atFileEnd: true })),
    ]);

    await ExpansionReset.run();
    // Between hunks, saying the push reset it.
    expect(gaps()[0]).toBe(estimateReviewRowHeight(gapRow({ hidden: 30, afterStart: 10, afterEnd: 40 })));
});

test('an arrow says what it shows on hover; on the rest of the row the arrow a click takes lights and says it', async () => {
    await Gaps.run();
    const between = page.getByText('33 lines').element().closest('[tid="review-gap"]');
    expect(between).not.toBeNull();

    await userEvent.hover(page.getByRole('button', { name: 'Show 20 below line 33' }));
    await expect.element(page.getByText('Show 20 below line 33', { exact: true })).toBeVisible();

    await userEvent.hover(between!.querySelector('[class*="diffGap_count"]')!);
    await expect.element(page.getByText('Show 20 above line 67', { exact: true })).toBeVisible();
    expect(page.getByRole('button', { name: 'Show 20 above line 67' }).element().className).toContain(
        'diffGap_arrow_lit',
    );

    await userEvent.unhover(between!);
    await expect.element(page.getByText('33 lines', { exact: true })).toBeVisible();
});

test('an arrow shows 20 its way, a click on the row 20 toward the hunk named, a short gap all of it', async () => {
    await Gaps.run();
    const expanded = (direction: string, count: number) =>
        expect(Gaps.args.onExpand).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'gap' }), {
            direction,
            count,
        });

    await userEvent.click(page.getByRole('button', { name: 'Show 20 below line 33' }));
    expanded('down', 20);
    await userEvent.click(page.getByRole('button', { name: 'Show 20 above line 27' }));
    expanded('up', 20);
    await userEvent.click(page.getByText('33 lines', { exact: true }));
    expanded('up', 20);
    await userEvent.click(page.getByText('32 lines below', { exact: true }));
    expanded('down', 20);
    await userEvent.click(page.getByRole('button', { name: 'Show 8 lines' }));
    expanded('up', 8);
    expect(Gaps.args.onExpand).toHaveBeenCalledTimes(5);
});

interface GapRowParams {
    readonly hidden: number;
    readonly afterStart: number;
    readonly afterEnd: number;
    readonly atFileEnd?: boolean;
}

function gapRow({ hidden, afterStart, afterEnd, atFileEnd = false }: GapRowParams): ReviewGapRow {
    return {
        kind: 'gap',
        key: 'gap',
        hidden,
        firstLine: afterStart + 1,
        firstOlderLine: afterStart + 1,
        range: { beforeStart: afterStart, beforeEnd: afterEnd, afterStart, afterEnd },
        atFileEnd,
        enclosing: null,
        expansionReset: false,
    };
}

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
