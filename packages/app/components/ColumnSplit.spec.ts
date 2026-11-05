import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import { expect, onTestFinished, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createApp, h, ref } from 'vue';
import type { VNode } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import ColumnSplit from './ColumnSplit.vue';

const WIDTH = { key: 'testColumn', default: 280, min: 200, max: 480 };
const WIDTH_KEY = 'githq.panelWidth.testColumn';
const LABEL = 'Resize the left column';
/** Beside the split on the window, as the app's sidebar is: the split does not have all of the window. */
const SIDEBAR_WIDTH = 236;

const edge = page.getByRole('separator', { name: LABEL });

test('by default 280 px, left of the pane, which has the rest, with the line on the column', async () => {
    const view = await mount({ window: 1400 });

    await expect.poll(view.columnWidth).toBe(280);
    expect(view.paneWidth()).toBe(1400 - SIDEBAR_WIDTH - 280);
    expect(view.column().parentElement?.getBoundingClientRect().right).toBe(view.pane().getBoundingClientRect().left);
    expect(getComputedStyle(view.column().parentElement ?? document.body).borderRightWidth).toBe('1px');
    expect(view.width()).toBeCloseTo(280);
    expect(window.localStorage.getItem(WIDTH_KEY)).toBeNull();
});

test('the arrow keys on the edge change the width between 200 and 480 px, kept when released, and what follows the width follows', async () => {
    // 10% of the group a press.
    const view = await mount({ window: SIDEBAR_WIDTH + 1000 });
    await expect.poll(view.columnWidth).toBe(280);
    edge.element().focus();

    await userEvent.keyboard('{ArrowRight}');
    await expect.poll(view.columnWidth).toBe(380);
    expect(view.width()).toBeCloseTo(380);
    await expect.poll(kept).toBe('380');

    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await expect.poll(view.columnWidth).toBe(480);
    await expect.poll(kept).toBe('480');

    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    await expect.poll(view.columnWidth).toBe(200);
    await expect.poll(kept).toBe('200');
});

test('dragging the edge changes the width, kept once let go, and stops at the limits', async () => {
    const view = await mount({ window: 1400 });
    await expect.poll(view.columnWidth).toBe(280);

    const drag = press(edge.element());
    drag.moveBy(60);
    await expect.poll(view.columnWidth).toBe(340);
    expect(kept()).toBeNull();
    drag.moveBy(500);
    await expect.poll(view.columnWidth).toBe(480);
    drag.moveBy(-40);
    await expect.poll(view.columnWidth).toBe(240);
    drag.moveBy(-200);
    await expect.poll(view.columnWidth).toBe(200);
    drag.release();
    await expect.poll(kept).toBe('200');
});

test('with 480 px kept on a 1,000 px window the column gives way, the pane keeps 400 px, and at a wider window 480 px is back, still kept', async () => {
    const view = await mount({ window: 1000, kept: '480' });

    // What is left of the window beside the sidebar: its own width is not the group's.
    await expect.poll(view.paneWidth).toBe(400);
    expect(view.columnWidth()).toBe(1000 - SIDEBAR_WIDTH - 400);
    expect(view.width()).toBeCloseTo(1000 - SIDEBAR_WIDTH - 400);
    expect(kept()).toBe('480');

    await page.viewport(1500, 800);
    await expect.poll(view.columnWidth).toBe(480);
    expect(view.paneWidth()).toBe(1500 - SIDEBAR_WIDTH - 480);
    expect(kept()).toBe('480');

    await page.viewport(1000, 800);
    await expect.poll(view.paneWidth).toBe(400);
    expect(kept()).toBe('480');
});

test('on a window with no room for both minimums the column keeps its 200 px', async () => {
    const view = await mount({ window: SIDEBAR_WIDTH + 500, kept: '480' });

    await expect.poll(view.columnWidth).toBe(200);
    expect(view.paneWidth()).toBe(300);
    expect(kept()).toBe('480');
});

test('a squeezed width is not kept by coming across the edge: a key released on it, or a press that does not move', async () => {
    const view = await mount({ window: 1000, kept: '480' });
    await expect.poll(view.paneWidth).toBe(400);

    // Focus lands on the edge between the press of Tab and its release, as it does going through the page.
    view.column().focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(edge.element());
    await userEvent.keyboard('{Shift}');
    expect(kept()).toBe('480');

    press(edge.element()).release();
    expect(kept()).toBe('480');
    // An arrow against the room there is moves nothing either.
    await userEvent.keyboard('{ArrowRight}');
    expect(kept()).toBe('480');

    await page.viewport(1500, 800);
    await expect.poll(view.columnWidth).toBe(480);
});

test('squeezed, what the user does choose is kept: dragging it narrower', async () => {
    const view = await mount({ window: 1000, kept: '480' });
    await expect.poll(view.paneWidth).toBe(400);

    const drag = press(edge.element());
    drag.moveBy(-64);
    await expect.poll(view.columnWidth).toBe(300);
    drag.release();
    await expect.poll(kept).toBe('300');

    await page.viewport(1500, 800);
    await expect.poll(view.paneWidth).toBe(1500 - SIDEBAR_WIDTH - 300);
    expect(view.columnWidth()).toBe(300);
});

test('the pane stays mounted as the column comes and goes, the column landing before it at its width, and the edge moving it, not the pane', async () => {
    const view = await mount({ window: 1400, shown: false, kept: '320' });
    const pane = view.pane();
    const held = page.getByRole('textbox', { name: 'In the pane' });
    await userEvent.fill(held, 'kept');
    expect(view.paneWidth()).toBe(1400 - SIDEBAR_WIDTH);
    await expect.element(edge).not.toBeInTheDocument();
    expect(view.width()).toBe(320);

    view.shown.value = true;
    await expect.poll(view.columnWidth).toBe(320);
    expect(view.pane()).toBe(pane);
    await expect.element(held).toHaveValue('kept');
    expect(view.column().compareDocumentPosition(pane)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expect.poll(view.paneWidth).toBe(1400 - SIDEBAR_WIDTH - 320);

    // Column first in Reka's order too: the wrong way round, the width would go to the pane.
    edge.element().focus();
    await userEvent.keyboard('{ArrowRight}');
    // 10% of the group a press.
    const chosen = 320 + (1400 - SIDEBAR_WIDTH) / 10;
    await expect.poll(view.columnWidth).toBeCloseTo(chosen, 1);
    await expect.poll(kept).toBe(String(Math.round(chosen)));

    view.shown.value = false;
    await expect.poll(view.paneWidth).toBe(1400 - SIDEBAR_WIDTH);
    expect(view.pane()).toBe(pane);
    await expect.element(held).toHaveValue('kept');
    // The group reports the pane alone, in percent: never taken for the column's width.
    expect(view.width()).toBe(Math.round(chosen));

    view.shown.value = true;
    await expect.poll(view.columnWidth).toBe(Math.round(chosen));
    expect(view.pane()).toBe(pane);
    expect(kept()).toBe(String(Math.round(chosen)));

    // The edge answers to the keys every time the column comes, not only when it was there from the start.
    edge.element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.poll(view.columnWidth).toBeLessThan(Math.round(chosen));
});

test('while not shown, what follows the width has the kept one, not one squeezed before the column went', async () => {
    const view = await mount({ window: 1000, kept: '480' });
    await expect.poll(view.paneWidth).toBe(400);
    expect(view.width()).toBeCloseTo(1000 - SIDEBAR_WIDTH - 400);

    view.shown.value = false;
    await expect.poll(view.width).toBe(480);
    await page.viewport(900, 800);
    await expect.poll(view.paneWidth).toBe(900 - SIDEBAR_WIDTH);
    expect(view.width()).toBe(480);
    expect(kept()).toBe('480');
});

test('a split inside the pane of another, one column shown: the same width, and no id twice', async () => {
    const view = await mount({
        window: 1400,
        shown: false,
        kept: '320',
        pane: () =>
            h(
                ColumnSplit,
                { shown: true, width: WIDTH, label: LABEL },
                { column: () => h('p', { tid: 'inner' }), default: () => h('p', 'Inner pane') },
            ),
    });
    const inner = page.getByTestId('inner');

    await expect.poll(() => inner.element().parentElement?.getBoundingClientRect().width).toBe(320);
    const ids = [...view.host.querySelectorAll('[id]')].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(3);
});

interface MountOptions {
    /** The window's width. */
    readonly window: number;
    readonly shown?: boolean;
    /** What is kept on this device as the width. */
    readonly kept?: string;
    /** The pane's content, instead of an input. */
    readonly pane?: () => VNode;
}

/** Mounts the split with a sidebar beside it across the whole of a window `window` wide. */
async function mount({ window: windowWidth, shown: firstShown = true, kept: keptWidth, pane }: MountOptions) {
    await page.viewport(windowWidth, 800);
    window.localStorage.removeItem(WIDTH_KEY);
    if (keptWidth !== undefined) {
        window.localStorage.setItem(WIDTH_KEY, keptWidth);
    }

    const shown = ref(firstShown);
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    const host = document.createElement('div');
    host.style.cssText = 'position: fixed; inset: 0; display: flex';
    document.body.append(host);

    const app = createApp({
        setup: () => () => [
            h('div', { style: { flex: 'none', width: `${SIDEBAR_WIDTH}px` } }),
            h(
                ColumnSplit,
                { shown: shown.value, width: WIDTH, label: LABEL },
                {
                    column: () => h('button', { tid: 'column', style: { flex: 1 } }, 'In the column'),
                    default: () =>
                        h('div', { tid: 'pane', style: { flex: 1 } }, [
                            pane ? pane() : h('input', { 'aria-label': 'In the pane' }),
                        ]),
                },
            ),
        ],
    });
    app.use(IocPlugin, { container });
    app.mount(host);
    onTestFinished(async () => {
        app.unmount();
        host.remove();
        window.localStorage.removeItem(WIDTH_KEY);
        await page.viewport(414, 896);
    });

    const column = () => page.getByTestId('column').element();
    const paneElement = () => page.getByTestId('pane').element();

    return {
        host,
        shown,
        column,
        pane: paneElement,
        columnWidth: () => column().parentElement?.getBoundingClientRect().width,
        paneWidth: () => paneElement().parentElement?.getBoundingClientRect().width,
        /** What follows the width in the pane reads. */
        width: () => Number.parseFloat(getComputedStyle(paneElement()).getPropertyValue('--column-split-width')),
    };
}

function kept() {
    return window.localStorage.getItem(WIDTH_KEY);
}

/** Presses the mouse on `handle`, as Reka hears it: it listens on the body and takes no width to be clicked by a tool. */
function press(handle: Element) {
    const { left: x, top, height } = handle.getBoundingClientRect();
    const y = top + height / 2;
    document.body.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));

    return {
        /** Moves the mouse `by` pixels from where it was pressed. */
        moveBy(by: number) {
            document.body.dispatchEvent(new MouseEvent('mousemove', { clientX: x + by, clientY: y, bubbles: true }));
        },
        release() {
            handle.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
        },
    };
}
