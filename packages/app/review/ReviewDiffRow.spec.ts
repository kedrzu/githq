import { composeStories } from '@storybook/vue3-vite';
import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { estimateReviewRowHeight, LINE_HEIGHT } from './buildReviewRows.js';
import type { ReviewGapRow, ReviewRow } from './buildReviewRows.js';
import * as stories from './ReviewDiffRow.stories.js';

const {
    CodeKinds,
    Collapsed,
    CursorSplit,
    CursorSplitAdded,
    CursorSplitChanged,
    CursorSplitDeleted,
    CursorUnifiedDeleted,
    ExpansionReset,
    ExpansionResetNothingHidden,
    FourDigitsSplit,
    FourDigitsUnified,
    Gaps,
    PatchPlaceholderSplit,
    PatchPlaceholderUnified,
    Split,
    SplitColoured,
    SplitCommented,
    ThreadReplying,
    Unified,
    UnifiedColoured,
    UnifiedCommented,
} = composeStories(stories);

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

    await ExpansionResetNothingHidden.run();
    // No arrow at all.
    expect(gaps()[0]).toBe(estimateReviewRowHeight(gapRow({ hidden: 0, afterStart: 10, afterEnd: 40 })));
});

test('a resolved thread is drawn as the one line estimated, a reply on its way leaving it one; a reply is only estimated', async () => {
    await ThreadReplying.run();
    await expect.element(page.getByRole('group', { name: 'Reply to sofiab' })).toBeVisible();
    const rows: ReviewRow[] = ThreadReplying.parameters.rows;
    const drawn = [...document.querySelectorAll('[role="group"][aria-label^="Thread by"]')].map(
        thread => thread.closest('[class*="reviewDiffRow"]')!.getBoundingClientRect().height,
    );
    const estimated = rows.map(estimateReviewRowHeight);

    expect(drawn).toHaveLength(5);
    // Resolved: one line, as estimated, and still one with a reply on its way, though that is estimated open.
    expect(drawn[3]).toBe(estimated[3]);
    expect(drawn[4]).toBe(drawn[3]);
});

test("a placeholder from the patch is drawn as tall as estimated, which is the diff's: its lines a line each, its gaps a gap's height", async () => {
    const gap = estimateReviewRowHeight(gapRow({ hidden: 30, afterStart: 10, afterEnd: 40 }));
    const lastGap = estimateReviewRowHeight(gapRow({ hidden: 30, afterStart: 10, afterEnd: 40, atFileEnd: true }));
    for (const story of [PatchPlaceholderSplit, PatchPlaceholderUnified]) {
        await story.run();
        const rows = [...document.querySelectorAll('[class*="reviewDiffRow_block"]')];
        const isGap = (row: Element) => row.querySelector('[tid="review-placeholder-gap"]') !== null;
        const height = (row: Element) => row.getBoundingClientRect().height;

        // A gap at the top, two between hunks, one after the last, which the block's own edge follows.
        expect(rows.filter(isGap).map(height)).toEqual([gap, gap, gap, lastGap]);
        const lines = rows.filter(row => !isGap(row));
        expect(lines.length).toBeGreaterThan(20);
        expect(lines.every(row => height(row) === LINE_HEIGHT)).toBe(true);
        expect(rows.filter(isGap).every(row => row.querySelector('button, [tabindex]') === null)).toBe(true);
    }
});

test('with the keyboard on an arrow, the count says what ↵ does; a click leaves it the count', async () => {
    await Gaps.run();

    await tabTo('Show 20 above line 27');
    await expect.element(page.getByText('↵ shows 20 above line 27', { exact: true })).toBeVisible();
    await userEvent.tab();
    await expect.element(page.getByText('↵ shows 20 below line 33', { exact: true })).toBeVisible();
    await expect.element(page.getByText('26 lines above', { exact: true })).toBeVisible();
    await tabTo('Show 8 lines');
    await expect.element(page.getByText('↵ shows 8 lines', { exact: true })).toBeVisible();
    await userEvent.tab({ shift: true });
    await expect.element(page.getByText('8 lines', { exact: true })).toBeVisible();

    const below = page.getByRole('button', { name: 'Show 20 below line 88' });
    await userEvent.click(below);
    await userEvent.unhover(below);
    await expect.element(page.getByText('32 lines below', { exact: true })).toBeVisible();
});

/** Tabs on until the button so named has the focus, past what comes before it in the story. */
async function tabTo(name: string) {
    for (let step = 0; step < 30 && document.activeElement?.getAttribute('aria-label') !== name; step++) {
        await userEvent.tab();
    }

    expect(document.activeElement?.getAttribute('aria-label')).toBe(name);
}

test('a gap a push reset with nothing hidden says only that: no arrow, no click', async () => {
    await ExpansionResetNothingHidden.run();
    const gap = page.getByText('Context you expanded here was reset by the push', { exact: true }).element();
    const row = gap.closest('[tid="review-gap"]')!;

    expect(row.querySelectorAll('button')).toHaveLength(0);
    await userEvent.click(gap);
    expect(ExpansionResetNothingHidden.args.onExpand).not.toHaveBeenCalled();
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

test.each([
    ['split', SplitCommented],
    ['unified', UnifiedCommented],
])('the lines a comment is being written on have their numbers on that side in accent, %s', async (_layout, Story) => {
    await Story.run();
    await expect.element(page.getByRole('button', { name: 'Comment on line 3' }).first()).toBeVisible();
    const accent = page
        .getByRole('button', { name: /^Comment on line/ })
        .elements()
        .filter(number => getComputedStyle(number).color === 'rgb(123, 135, 247)')
        .map(number => number.textContent.trim());

    // The story comments on lines 3–5 of the newer side.
    expect(accent).toEqual(['3', '4', '5']);
});

test.each([
    ['split', FourDigitsSplit],
    ['unified', FourDigitsUnified],
])(
    "on the cursor's row a four-digit number's comment button sits between it and the code, %s",
    async (_layout, Story) => {
        await Story.run();
        const row = getCursorRow();
        const buttons = getCommentButtons(row);
        expect(buttons.length).toBeGreaterThan(0);

        for (const button of buttons) {
            const box = button.getBoundingClientRect();
            const half = button.closest('[class*="diffRowSplit_cell"]') ?? row;
            const numbers = [...half.querySelectorAll('button:not([aria-keyshortcuts])')];
            const code = half.querySelector('code')!.getBoundingClientRect();
            expect(numbers.length).toBeGreaterThan(0);
            for (const number of numbers) {
                expect(number.getBoundingClientRect().right).toBeLessThanOrEqual(box.left);
            }
            expect(box.right).toBeLessThanOrEqual(code.left);
        }
    },
);

test.each([
    ['an unchanged line', CursorSplit, ['before', 'after']],
    ['an added line alone', CursorSplitAdded, ['after', 'after']],
    ['a deleted line alone', CursorSplitDeleted, ['before', 'before']],
    ['unified, a deleted line', CursorUnifiedDeleted, ['before']],
] as const)(
    "on the cursor's row each comment button comments on its half's line, an empty half's on the row's: %s",
    async (_name, Story, sides) => {
        await Story.run();
        const row = getCursorRow();
        const numbers = new Map(
            [...row.querySelectorAll('button:not([aria-keyshortcuts])')].map(number => [
                number.closest('[class*="diffRowSplit_cell"]')?.matches(':first-child') === false ? 'after' : 'before',
                Number(number.textContent),
            ]),
        );
        const buttons = getCommentButtons(row);
        expect(buttons).toHaveLength(sides.length);

        for (const [index, side] of sides.entries()) {
            // The unified row's numbers are one cell: the deleted line has only its older one.
            const line = numbers.get(side) ?? numbers.get('before');
            expect(line).toBeGreaterThan(0);
            await userEvent.click(buttons[index]!);
            expect(Story.args.onGutter).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'pointerdown' }),
                side,
                line,
            );
            expect(Story.args.onGutter).toHaveBeenLastCalledWith(
                expect.objectContaining({ type: 'click' }),
                side,
                line,
            );

            await userEvent.click(buttons[index]!, { modifiers: ['Shift'] });
            expect(Story.args.onGutter).toHaveBeenLastCalledWith(
                expect.objectContaining({ type: 'click', shiftKey: true }),
                side,
                line,
            );
        }
    },
);

test.each([
    ['split', Split, CursorSplitChanged],
    ['unified', Unified, CursorUnifiedDeleted],
])(
    "the cursor's row is tinted and its code neither moves nor stops being selectable, %s",
    async (_layout, Plain, Cursor) => {
        await Plain.run();
        const before = readCodeStarts();
        await Cursor.run();
        const after = readCodeStarts();
        const row = getCursorRow();

        expect(after).toEqual(before);
        for (const code of row.querySelectorAll('code')) {
            expect(getComputedStyle(code).userSelect).not.toBe('none');
        }
        const drawn = (line: Element) => line.querySelector('[class*="diffRowSplit"], [class*="diffRowUnified"]')!;
        const other = [...document.querySelectorAll('[data-cursor-key]')].find(
            line => line !== row && line.querySelector('code') !== null,
        )!;
        expect(getComputedStyle(drawn(row)).backgroundColor).not.toBe(getComputedStyle(drawn(other)).backgroundColor);
        expect(document.querySelectorAll('[data-cursor="true"]')).toHaveLength(1);
    },
);

test('every row names the cursor stop it is part of: a line its own, a row of a file on its way its header', async () => {
    await CursorSplit.run();
    const keys = [...document.querySelectorAll('[data-cursor-key]')].map(row => row.getAttribute('data-cursor-key'));
    expect(keys.length).toBeGreaterThan(10);
    expect(new Set(keys).size).toBe(keys.length);
    // A file's end is passed over.
    expect(document.querySelector('[class*="reviewDiffRow_end"]')!.parentElement!.hasAttribute('data-cursor-key')).toBe(
        false,
    );

    await PatchPlaceholderSplit.run();
    const header = document.querySelector('[data-cursor-key]')!.getAttribute('data-cursor-key');
    const placeholders = document.querySelectorAll('[class*="reviewDiffRow_block"]');
    expect(placeholders.length).toBeGreaterThan(20);
    for (const placeholder of placeholders) {
        expect(placeholder.parentElement!.getAttribute('data-cursor-key')).toBe(header);
    }
});

function getCursorRow() {
    const row = document.querySelector('[data-cursor="true"]');
    expect(row).not.toBeNull();
    return row!;
}

/** The comment buttons, told from the numbers of the same name by the key they name. */
function getCommentButtons(row: Element) {
    return [...row.querySelectorAll('button[aria-keyshortcuts]')];
}

/** Where the code of every line starts, the first line's halves apart. */
function readCodeStarts() {
    return [...document.querySelectorAll('code')].map(code => code.getBoundingClientRect().left);
}
