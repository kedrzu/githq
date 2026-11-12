import type { Locator } from '@playwright/test';

/**
 * How far the scrolling container is scrolled down.
 *
 * @util
 */
export function getScrollTop(container: Locator) {
    return container.evaluate(element => element.scrollTop);
}
