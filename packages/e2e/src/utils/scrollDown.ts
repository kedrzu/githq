import type { Locator } from '@playwright/test';

import { expect } from '../fixtures.js';

import { getScrollTop } from './getScrollTop.js';

/**
 * Scrolls `container` as far down as it goes, and says where that is — never the top.
 *
 * @util
 */
export async function scrollDown(container: Locator) {
    await container.evaluate(element => {
        element.scrollTop = element.scrollHeight;
    });
    const top = await getScrollTop(container);
    expect(top).toBeGreaterThan(0);
    return top;
}
