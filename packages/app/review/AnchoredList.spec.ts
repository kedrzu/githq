import { composeStories } from '@storybook/vue3-vite';
import { afterEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { nextTick } from 'vue';

import * as stories from './AnchoredList.stories.jsx';

const { Default, PinnedHeaders, TwoHundredThousandRows, Wrapping } = composeStories(stories);

const ESTIMATE = 24;
/** What the browser's own rounding of the scroll position to its pixels may leave: our sums keep the fractions. */
const ROUNDING = 0.5;
/** What may move while the list corrects itself. */
const ONE_PIXEL = 1;

/** A resize loop the browser had to break off is reported here, and nowhere a test would otherwise see it. */
const pageErrors: string[] = [];
window.addEventListener('error', event => pageErrors.push(event.message));

afterEach(() => {
    expect(pageErrors.splice(0)).toEqual([]);
});

test('a jump lands on its target at the asked distance, at once and frame after frame as the rows above get measured', async () => {
    await Default.run({ args: { ...Default.args, jumpOffset: 40 } });
    const list = scroller();
    const listTop = list.getBoundingClientRect().top;

    // Natively, so the first check runs before any frame could have drawn or measured anything.
    jumpButton().click();
    await nextTick();
    expectWithin(topOf('row-5000'), listTop + 40, ROUNDING);

    for (let frame = 0; frame < 10; frame++) {
        await frames(1);
        expectWithin(topOf('row-5000'), listTop + 40, ROUNDING);
    }

    // The estimates were far off: otherwise this proves nothing.
    expect(Math.abs(list.scrollTop - 5000 * ESTIMATE)).toBeGreaterThan(100);

    // Scroll up through rows nobody has measured: each step moves the target by the step and nothing else.
    for (let step = 0; step < 30; step++) {
        const before = topOf('row-5000');
        list.scrollTop -= 15;
        await frames(2);
        expectWithin(topOf('row-5000'), before + 15, ONE_PIXEL);
    }

    jumpButton().click();
    await nextTick();
    expectWithin(topOf('row-5000'), listTop + 40, ROUNDING);
    await frames(3);
    expectWithin(topOf('row-5000'), listTop + 40, ROUNDING);
});

test('a jump the list is still too short for takes its place as soon as measuring has made room', async () => {
    // The 14 rows below it are estimated at less than the list's height, and really take more.
    await Default.run({ args: { ...Default.args, jumpKey: 'row-9985' } });
    const list = scroller();

    await clickButton('Jump');
    await frames(5);

    expect(list.scrollTop).toBeLessThan(list.scrollHeight - list.clientHeight);
    expectWithin(topOf('row-9985'), list.getBoundingClientRect().top, ROUNDING);
});

test('a row that grows above the viewport moves nothing you see, nor re-runs the slots of the rows it moved', async () => {
    const rendered: string[] = [];
    await Default.run({ args: { ...Default.args, reportRender: key => rendered.push(key) } });
    await clickButton('Jump');
    await frames(3);
    const list = scroller();
    const before = topOf('row-5000');
    const scrollTop = list.scrollTop;
    const rendersBefore = rendered.length;

    await clickButton('Grow above');
    await frames(3);

    expectWithin(list.scrollTop, scrollTop + 137.5, ONE_PIXEL);
    expectWithin(topOf('row-5000'), before, ONE_PIXEL);
    expect(rendered.slice(rendersBefore)).toHaveLength(1);
});

test('rows inserted above move nothing you see', async () => {
    await Default.run();
    await clickButton('Jump');
    await frames(3);
    const list = scroller();
    const before = topOf('row-5000');
    const scrollTop = list.scrollTop;

    await clickButton('Insert above');
    await frames(3);

    expect(list.querySelector('[tid="inserted-1"]')).not.toBeNull();
    expectWithin(list.scrollTop, scrollTop + 5 * 41.5, ONE_PIXEL);
    expectWithin(topOf('row-5000'), before, ONE_PIXEL);
});

test('a change of width that re-wraps the rows moves nothing you see', async () => {
    await Wrapping.run();
    await clickButton('Jump');
    await frames(3);
    const list = scroller();
    const before = topOf('row-1000');
    const heightBefore = heightOf('row-999');
    const scrollTop = list.scrollTop;

    await clickButton('Change width');
    await frames(3);

    expect(heightOf('row-999')).toBeGreaterThan(heightBefore);
    expect(list.scrollTop).toBeGreaterThan(scrollTop);
    expectWithin(topOf('row-1000'), before, ONE_PIXEL);

    await clickButton('Change width');
    await frames(3);
    expect(heightOf('row-999')).toBe(heightBefore);
    expectWithin(topOf('row-1000'), before, ONE_PIXEL);
});

test('200,000 rows leave a few dozen in the DOM, wherever you are', async () => {
    await TwoHundredThousandRows.run();
    await frames(2);
    const list = scroller();
    expect(list.querySelectorAll('[tid^="row-"]').length).toBeLessThan(80);

    await clickButton('Jump');
    await frames(3);
    expect(list.querySelector('[tid="row-150000"]')).not.toBeNull();
    expect(list.querySelectorAll('[tid^="row-"]').length).toBeLessThan(80);
    expect(list.querySelectorAll('*').length).toBeLessThan(250);
});

test('scrolling through 200,000 rows keeps to the frame rate, at the cost of 2,000', async () => {
    await Default.run({ args: { ...Default.args, count: 2000, jumpKey: 'row-1000' } });
    const small = await measureScrolling();

    await TwoHundredThousandRows.run();
    const large = await measureScrolling();

    console.info(`Scroll frames, 2,000 rows: ${small.summary}`);
    console.info(`Scroll frames, 200,000 rows: ${large.summary}`);
    expect(large.medianInterval).toBeLessThan(25);
    expect(large.medianWork).toBeLessThan(small.medianWork * 2 + 2);
});

test('the pinned header is the one of the section you are inside, pushed away by the next', async () => {
    await PinnedHeaders.run();
    await clickButton('Jump');
    await frames(3);
    const list = scroller();
    const listTop = list.getBoundingClientRect().top;

    // Inside the section of rows 200–299, its header drawn only in the overlay, at the top.
    expect(list.querySelectorAll('[tid="row-200"]')).toHaveLength(1);
    expect(topOf('row-200')).toBe(listTop);
    expect(heightOf('row-200')).toBe(30);
    expect(list.querySelector('[tid="row-100"]')).toBeNull();

    // Bring the next header to ten pixels from the top: the overlay's bottom sits on it.
    while (list.querySelector('[tid="row-300"]') === null) {
        list.scrollTop += 300;
        await frames(2);
    }

    list.scrollTop += topOf('row-300') - listTop - 10;
    await frames(3);
    expect(topOf('row-200')).toBeLessThan(listTop);
    expectWithin(bottomOf('row-200'), listTop + 10, ONE_PIXEL);
    expectWithin(lastTopOf('row-300'), listTop + 10, ONE_PIXEL);

    // Past it: the overlay holds the next section, the old header gone.
    list.scrollTop += 200;
    await frames(3);
    expect(topOf('row-300')).toBe(listTop);
    expect(list.querySelector('[tid="row-200"]')).toBeNull();
});

test('the keys scroll the focused list natively, and the anchor follows: the first row still in view', async () => {
    await Default.run();
    const list = scroller();
    list.focus();

    await userEvent.keyboard('{PageDown}');
    await expect.poll(() => list.scrollTop).toBeGreaterThan(300);
    await frames(2);

    const [key, offset] = (page.getByTestId('anchor').element().textContent ?? '').split(' ');
    const listTop = list.getBoundingClientRect().top;
    expect(Number(offset)).toBeLessThanOrEqual(0);
    expectWithin(topOf(key!) - listTop, Number(offset), ONE_PIXEL);
    expect(bottomOf(key!)).toBeGreaterThan(listTop);
});

/** The main thread's work per scrolled frame: the scroll event, Vue, then layout, measuring and paint. */
async function measureScrolling() {
    await clickButton('Jump');
    await frames(3);
    const list = scroller();
    const intervals: number[] = [];
    const work: number[] = [];
    let scrollStarted = 0;
    const onScrollStart = () => (scrollStarted = performance.now());
    list.addEventListener('scroll', onScrollStart, { capture: true });

    let previous = performance.now();
    for (let frame = 0; frame < 240; frame++) {
        // The scroll runs ahead of the frame's animation callbacks, the layout and paint right after them.
        list.scrollTop += 60;
        await frames(1);
        await afterPaint();
        const now = performance.now();
        intervals.push(now - previous);
        work.push(now - scrollStarted);
        previous = now;
    }

    list.removeEventListener('scroll', onScrollStart, { capture: true });
    const medianInterval = percentile(intervals, 0.5);
    const medianWork = percentile(work, 0.5);
    return {
        medianInterval,
        medianWork,
        summary:
            `interval median ${medianInterval.toFixed(1)} ms, p95 ${percentile(intervals, 0.95).toFixed(1)} ms; ` +
            `work median ${medianWork.toFixed(1)} ms, p95 ${percentile(work, 0.95).toFixed(1)} ms, ` +
            `worst ${percentile(work, 1).toFixed(1)} ms`,
    };
}

function percentile(values: number[], share: number) {
    const sorted = values.toSorted((a, b) => a - b);
    return sorted[Math.min(Math.floor(sorted.length * share), sorted.length - 1)]!;
}

function afterPaint() {
    return new Promise<void>(resolve => {
        const channel = new MessageChannel();
        channel.port1.addEventListener('message', () => resolve());
        channel.port1.start();
        channel.port2.postMessage(null);
    });
}

function scroller() {
    const element = page.getByRole('region', { name: 'Rows' }).element();
    if (!(element instanceof HTMLElement)) {
        throw new TypeError('The list is not an HTML element');
    }

    return element;
}

function jumpButton() {
    const element = page.getByRole('button', { name: 'Jump', exact: true }).element();
    if (!(element instanceof HTMLElement)) {
        throw new TypeError('The button is not an HTML element');
    }

    return element;
}

/** The first of the row's elements: when the pinned overlay holds it too, the overlay's, which comes first. */
function rowElement(key: string) {
    const element = scroller().querySelector(`[tid="${key}"]`);
    if (element === null) {
        throw new Error(`Row ${key} is not in the DOM`);
    }

    return element;
}

function topOf(key: string) {
    return rowElement(key).getBoundingClientRect().top;
}

function bottomOf(key: string) {
    return rowElement(key).getBoundingClientRect().bottom;
}

function heightOf(key: string) {
    return rowElement(key).getBoundingClientRect().height;
}

/** The row's place in the list itself, when the overlay holds it too. */
function lastTopOf(key: string) {
    const elements = scroller().querySelectorAll(`[tid="${key}"]`);
    return elements[elements.length - 1]!.getBoundingClientRect().top;
}

function expectWithin(actual: number, expected: number, tolerance: number) {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

async function clickButton(name: string) {
    await userEvent.click(page.getByRole('button', { name, exact: true }));
}

async function frames(count: number) {
    for (let frame = 0; frame < count; frame++) {
        await new Promise(requestAnimationFrame);
    }
}
