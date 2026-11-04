import { isActivatableTarget } from './isActivatableTarget.js';

/**
 * Takes the focus off a button or a link a click left it on, when the list's keys move on: Enter is then the selected
 * row's again. To `root` if it can hold it. Not off what Tab placed it on, which holds the keys back ({@link useTabFocus}),
 * nor inside a dialog, whose focus stays in it.
 * @util
 */
export function takeFocusOffControl(root?: HTMLElement | null) {
    const active = document.activeElement;
    if (
        !(active instanceof HTMLElement) ||
        !isActivatableTarget(active) ||
        active.hasAttribute('data-tab-focus') ||
        active.closest('[role="dialog"]') !== null
    ) {
        return;
    }

    root?.focus({ preventScroll: true });
    if (document.activeElement === active) {
        active.blur();
    }
}
