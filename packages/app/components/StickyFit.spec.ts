import { composeStories } from '@storybook/vue3';
import { expect, onTestFinished, test, vi } from 'vitest';
import { createApp, h } from 'vue';

import StickyFit from './StickyFit.vue';
import * as stories from './StickyFit.stories.js';

const { Short, Tall } = composeStories(stories);

test('content that fits sticks to the top of its scroller', async () => {
    await Short.run();
    const { scroller, content } = getParts();

    scroller.scrollTop = 1000;

    await expect.poll(() => getOffsets(scroller, content)).toEqual({ top: 0, bottom: -180 });
});

test('content taller than its scroller scrolls until its bottom meets the scroller bottom, then stays', async () => {
    await Tall.run();
    const { scroller, content } = getParts();

    scroller.scrollTop = 100;
    await expect.poll(() => getOffsets(scroller, content)).toEqual({ top: -100, bottom: 200 });

    scroller.scrollTop = 1000;
    await expect.poll(() => getOffsets(scroller, content)).toEqual({ top: -300, bottom: 0 });
});

test('it switches both ways when the content resizes', async () => {
    await Short.run();
    const { scroller, content } = getParts();
    scroller.scrollTop = 1000;

    content.style.height = '600px';
    await expect.poll(() => getOffsets(scroller, content)).toEqual({ top: -300, bottom: 0 });

    content.style.height = '120px';
    await expect.poll(() => getOffsets(scroller, content)).toEqual({ top: 0, bottom: -180 });
});

test('it switches both ways when the scroller resizes', async () => {
    await Tall.run();
    const { scroller, content } = getParts();
    scroller.scrollTop = 1000;

    scroller.style.height = '700px';
    await expect.poll(() => getOffsets(scroller, content)).toEqual({ top: 0, bottom: -100 });

    scroller.style.height = '300px';
    await expect.poll(() => getOffsets(scroller, content)).toEqual({ top: -300, bottom: 0 });
});

test('unmounting disconnects the observer it set up', () => {
    const observe = vi.spyOn(ResizeObserver.prototype, 'observe');
    const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
    onTestFinished(() => {
        observe.mockRestore();
        disconnect.mockRestore();
    });
    const host = document.createElement('div');
    host.style.cssText = 'height: 300px; overflow-y: auto';
    document.body.append(host);
    onTestFinished(() => host.remove());
    const app = createApp(() => h(StickyFit, () => h('div', { style: 'height: 120px' })));
    app.mount(host);

    expect(observe).toHaveBeenCalledWith(host);
    expect(disconnect).not.toHaveBeenCalled();

    app.unmount();

    expect(disconnect).toHaveBeenCalledOnce();
});

function getParts() {
    const scroller = document.querySelector<HTMLElement>('[tid="scroller"]');
    const content = document.querySelector<HTMLElement>('[tid="content"]');
    if (!scroller || !content) {
        throw new Error('The story has no scroller or content');
    }

    return { scroller, content };
}

/** Where the content's top and bottom are from the scroller's top and bottom, in px; positive is lower. */
function getOffsets(scroller: HTMLElement, content: HTMLElement) {
    const outer = scroller.getBoundingClientRect();
    const inner = content.getBoundingClientRect();
    return { top: Math.round(inner.top - outer.top), bottom: Math.round(inner.bottom - outer.bottom) };
}
