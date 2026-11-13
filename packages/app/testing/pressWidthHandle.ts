/**
 * For a component spec: presses the primary button on a `WidthHandle` at its left edge, as the mouse does (pointer 1),
 * for the test to move and let go. Dispatched, so no focus moves and the move need not stay within the window.
 *
 * @util
 */
export function pressWidthHandle(handle: Element) {
    const { left: x, top, height } = handle.getBoundingClientRect();
    const init = { pointerId: 1, button: 0, bubbles: true, clientY: top + height / 2 };
    handle.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x }));

    return {
        /** Moves the pointer `by` pixels from where it was pressed. */
        moveBy(by: number) {
            handle.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x + by }));
        },
        release() {
            handle.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: x }));
        },
    };
}
