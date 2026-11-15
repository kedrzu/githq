/** How {@link swipeElement} swipes. */
export interface SwipeElementOptions {
    /** Touch when not given. */
    readonly pointerType?: 'mouse' | 'pen' | 'touch';
    /** Where on the screen it starts; the element's middle when not given. */
    readonly startX?: number;
}

/**
 * For a component spec or story: moves a pointer across `element` by `dx` pixels, a frame between its steps, as a
 * finger swipes. Dispatched, so the move need not stay within the window.
 *
 * @util
 */
export async function swipeElement(element: Element, dx: number, options: SwipeElementOptions = {}) {
    const box = element.getBoundingClientRect();
    const x = options.startX ?? box.left + box.width / 2;
    const init = {
        bubbles: true,
        pointerId: 11,
        pointerType: options.pointerType ?? 'touch',
        isPrimary: true,
        clientY: box.top + box.height / 2,
    };
    element.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: x }));
    for (let step = 1; step <= 5; step++) {
        element.dispatchEvent(new PointerEvent('pointermove', { ...init, clientX: x + (dx * step) / 5 }));
        await new Promise(requestAnimationFrame);
    }

    element.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: x + dx }));
}
