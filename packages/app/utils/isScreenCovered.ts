/**
 * Whether a layer that takes the keys is over the screen (`data-layer`: the new issue's capture, the command menu, the
 * help sheet). Not a tooltip, unlike {@link isLayerOpen}, which is about whose Escape it is.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isScreenCovered(): boolean {
    return document.querySelector('[data-layer]') !== null;
}
