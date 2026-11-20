import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * The window width below which the app takes its phone layout: `PHONE_MAX_WIDTH` in `packages/app/shell/PhoneLayout.ts`,
 * which brings the app's service container along when imported.
 */
const PHONE_MAX_WIDTH = 640;

/** A button whose size is not its size's, as measured in the page. */
interface ButtonSizeOffender {
    readonly name: string;
    readonly size: string;
    readonly expected: string;
    readonly measured: string;
}

/**
 * Checks every visible button of the app (`Button`, `IconButton`, `SplitButton`: `data-button-size` on the rendered
 * `<button>` or `<a>`) against the scale of `docs/design/githq/buttons.md`: a `Button` is 24, 32, 40 or 48 px tall
 * (`sm`–`xl`), an `IconButton` 24 × 24 or 32 × 32 (`sm`, `md`) and 34 tall on the rail. A `link` button takes its text's
 * height, a split button's chevron its button's and a toggle (`aria-pressed`) its own, so none is measured; on a phone an `IconButton` in a phone's bar
 * may be a finger's square of 44 to 48 instead (`touch-icon-buttons`, the command line's menu). Soft, one message per button, so a walk reports every one at once.
 *
 * @param within A CSS selector: only the buttons inside it are checked (a menu over the page).
 */
export async function expectButtonSizes(page: Page, state: string, within?: string): Promise<void> {
    const phone = (page.viewportSize()?.width ?? Infinity) < PHONE_MAX_WIDTH;
    const offenders = await page.evaluate(
        ({ scope, onPhone }) => {
            const BUTTON_HEIGHTS: Record<string, number> = { sm: 24, md: 32, lg: 40, xl: 48 };
            const ICON_BUTTON_BOXES: Record<string, { width: number | null; height: number }> = {
                sm: { width: 24, height: 24 },
                md: { width: 32, height: 32 },
                rail: { width: null, height: 34 },
            };
            const TOUCH_TARGET = { min: 44, max: 48 };

            const roots = scope === undefined ? [document.body] : [...document.querySelectorAll(scope)];
            const found: ButtonSizeOffender[] = [];
            for (const root of roots) {
                for (const element of root.querySelectorAll<HTMLElement>('[data-button-size]')) {
                    const size = element.dataset.buttonSize ?? '';
                    const variant = element.dataset.buttonVariant;
                    // A toggle (`aria-pressed`) is outside the guideline: it keeps its design's own size.
                    if (
                        size === 'split' ||
                        variant === 'link' ||
                        element.hasAttribute('aria-pressed') ||
                        !element.checkVisibility()
                    ) {
                        continue;
                    }

                    const width = element.offsetWidth;
                    const height = element.offsetHeight;
                    const name = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 60);
                    // Only a `Button` says its variant.
                    if (variant !== undefined) {
                        const expected = BUTTON_HEIGHTS[size];
                        if (height !== expected) {
                            found.push({
                                name,
                                size: `${variant} ${size}`,
                                expected: `${expected ?? 'a size on the scale'} tall`,
                                measured: `${height} tall`,
                            });
                        }

                        continue;
                    }

                    const box = ICON_BUTTON_BOXES[size];
                    const fits =
                        box !== undefined && height === box.height && (box.width === null || width === box.width);
                    const touch =
                        onPhone && width === height && height >= TOUCH_TARGET.min && height <= TOUCH_TARGET.max;
                    if (!fits && !touch) {
                        found.push({
                            name,
                            size: `icon ${size}`,
                            expected:
                                box === undefined
                                    ? 'a size on the scale'
                                    : `${box.width ?? 'any'} × ${box.height}${onPhone ? ` or a square of ${TOUCH_TARGET.min} to ${TOUCH_TARGET.max}` : ''}`,
                            measured: `${width} × ${height}`,
                        });
                    }
                }
            }

            return found;
        },
        { scope: within, onPhone: phone },
    );

    for (const offender of offenders) {
        expect
            .soft(offender.measured, `button size on ${state}: "${offender.name}" (${offender.size})`)
            .toBe(offender.expected);
    }
}
