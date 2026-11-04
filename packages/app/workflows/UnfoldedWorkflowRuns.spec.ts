import { composeStories } from '@storybook/vue3';
import { beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import * as stories from './UnfoldedWorkflowRuns.stories.js';

const { ManyPages } = composeStories(stories);

/** Long enough for a page the screen does not need to have been asked for. */
const SETTLE_MS = 300;

beforeEach(async () => {
    await page.viewport(1000, 600);
});

test('W3b: older runs are read only as far as the user scrolls, not to the end of the history', async () => {
    const readMore = vi.fn();
    await ManyPages.run({ args: { ...ManyPages.args, onReadMore: readMore } });

    // The first page: the end was in view, and that page fills the screen.
    await vi.waitFor(() => expect(readMore).toHaveBeenCalled());
    await vi.waitFor(() => expect(document.querySelectorAll('[data-workflow-key^="run:"]').length).toBeGreaterThan(30));
    await settle();
    expect(readMore).toHaveBeenCalledTimes(1);

    // Scrolled to the end: one more page, which pushes the end out of view again.
    window.scrollTo(0, document.documentElement.scrollHeight);
    await vi.waitFor(() => expect(readMore).toHaveBeenCalledTimes(2));
    await settle();
    expect(readMore).toHaveBeenCalledTimes(2);
});

function settle() {
    return new Promise<void>(resolve => {
        setTimeout(resolve, SETTLE_MS);
    });
}
