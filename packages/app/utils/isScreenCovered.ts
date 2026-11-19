/** What {@link isScreenCovered} leaves out. */
export interface IsScreenCoveredOptions {
    /**
     * The command menu (`data-layer="command-menu"`) does not count: a command key that passes its field runs from it,
     * closing it (commands D15).
     */
    readonly exceptCommandMenu?: boolean;
}

/**
 * Whether a layer that takes the keys is over the screen (`data-layer`: the new issue's capture, the command menu, the
 * help sheet). Not a tooltip, unlike {@link isLayerOpen}, which is about whose Escape it is.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isScreenCovered(options: IsScreenCoveredOptions = {}): boolean {
    const layer = options.exceptCommandMenu ? '[data-layer]:not([data-layer="command-menu"])' : '[data-layer]';
    return document.querySelector(layer) !== null;
}
