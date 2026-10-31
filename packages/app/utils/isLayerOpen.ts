/**
 * Whether a picker, a menu or a tooltip (reka-ui's popper layers) is open — or a layer marked `data-layer` (the
 * command menu, the help sheet, the new issue's capture). Escape is then theirs: it closes the
 * layer, and must not also close or clear what is under it — the layer is still in the page while the key is
 * being handled, so this holds for the whole Escape that closes it.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isLayerOpen(): boolean {
    return document.querySelector('[data-reka-popper-content-wrapper], [data-layer]') !== null;
}
