import { composeStories } from '@storybook/vue3';
import { expect, test } from 'vitest';
import { createApp, h } from 'vue';

import * as itemRowStories from '@/lists/ItemRow.stories.js';

import * as ghostRowStories from './GhostRow.stories.js';
import Skeleton from './Skeleton.vue';
import SkeletonBar from './SkeletonBar.vue';
import * as stories from './Skeleton.stories.js';

/** `$skeleton-pass` and `$skeleton-row-stagger`, in ms. */
const PASS = 1600;
const STAGGER = 80;

const { Shapes, AnimationsOff } = composeStories(stories);
const { ChecksPassedWaiting } = composeStories(itemRowStories);
const { Default: GhostRowDefault } = composeStories(ghostRowStories);

test('every shape of a wrapper shows the same band, and the row below shows it 80 ms later', async () => {
    const canvasElement = mount();
    await Shapes.run({ canvasElement });
    await new Promise(requestAnimationFrame);

    // The same moment for every shape: 800 ms into the first row's pass.
    for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 800;
    }

    const [first, second] = [0, 1].map(row => getBandStarts(canvasElement, row));
    expect(first!.length).toBe(9);
    for (const start of first!) {
        expect(start).toBeCloseTo(first![0]!, 0);
    }
    for (const start of second!) {
        expect(start).toBeCloseTo(second![0]!, 0);
    }
    // 80 ms of a 1.6 s pass across 1.5 spans later.
    const span = getRow(canvasElement, 1).getBoundingClientRect().width;
    expect(first![0]! - second![0]!).toBeCloseTo((1.5 * span * STAGGER) / PASS, 0);
});

test('a row mounted later lands on the same clock: its stagger behind row 0, whenever it came', async () => {
    const canvasElement = mount();
    await Shapes.run({ canvasElement });
    await new Promise(resolve => {
        setTimeout(resolve, 300);
    });

    // A fourth row, 300 ms after the others, in the same column.
    const late = document.createElement('div');
    canvasElement.firstElementChild?.append(late);
    createApp(() =>
        h(Skeleton, { row: 3, 'data-testid': 'row-3' }, () => [
            h(SkeletonBar, { width: 200 }),
            h(SkeletonBar, { width: 80 }),
        ]),
    ).mount(late);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    // Frozen in one go, so each keeps the phase it had at this moment.
    for (const animation of document.getAnimations()) {
        animation.pause();
    }

    const clocks = [0, 1, 2, 3].map(row => getClock(canvasElement, row));
    for (const clock of clocks) {
        expect(getCircularDistance(clock, clocks[0]!)).toBeLessThan(3);
    }
});

test('with animations off the shapes stand still in their base tones', async () => {
    const canvasElement = mount();
    await AnimationsOff.run({ canvasElement });

    const shapes = [...getRow(canvasElement, 0).querySelectorAll('span[aria-hidden]')];
    expect(shapes.length).toBe(9);
    for (const shape of shapes) {
        const style = getComputedStyle(shape);
        expect(style.animationName).toBe('none');
        expect(style.backgroundImage).toBe('none');
    }
    // The icon dot strong, the meta bar weak.
    expect(getComputedStyle(shapes[0]!).backgroundColor).toBe('rgb(34, 40, 49)');
    expect(getComputedStyle(shapes[2]!).backgroundColor).toBe('rgb(28, 33, 40)');
});

test('a ghost row is as tall as the row that replaces it, so nothing jumps', async () => {
    // One story at a time: running the next unmounts the one before.
    const real = mount();
    await ChecksPassedWaiting.run({ canvasElement: real });
    const rowHeight = getHeight(real);
    const ghost = mount();
    await GhostRowDefault.run({ canvasElement: ghost });

    expect(rowHeight).toBeGreaterThan(0);
    expect(getHeight(ghost)).toBe(rowHeight);
});

/**
 * The shared clock as the row's band shows it, in ms of a pass: how far its band is, read from the screen, plus its
 * row's stagger. The band's image starts 1.5 spans before the wrapper at the start of a pass and at the wrapper at its end.
 */
function getClock(canvas: HTMLElement, row: number) {
    const wrapper = getRow(canvas, row).getBoundingClientRect();
    const start = getBandStarts(canvas, row)[0]!;
    const phase = PASS * (1 + (start - wrapper.left) / (1.5 * wrapper.width));
    return (((phase + row * STAGGER) % PASS) + PASS) % PASS;
}

function getCircularDistance(a: number, b: number) {
    const distance = Math.abs(a - b) % PASS;
    return Math.min(distance, PASS - distance);
}

function mount() {
    const canvas = document.createElement('div');
    document.body.append(canvas);
    return canvas;
}

function getHeight(canvas: HTMLElement) {
    return canvas.firstElementChild?.getBoundingClientRect().height;
}

function getRow(canvas: HTMLElement, row: number) {
    const element = canvas.querySelector<HTMLElement>(`[data-testid="row-${row}"]`);
    if (!element) {
        throw new Error(`No row ${row}`);
    }
    return element;
}

/** Where the band's image starts on screen, for each shape of the row: its left edge plus its background's offset. */
function getBandStarts(canvas: HTMLElement, row: number) {
    return [...getRow(canvas, row).querySelectorAll<HTMLElement>('span[aria-hidden]')].map(
        shape => shape.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(shape).backgroundPositionX),
    );
}
