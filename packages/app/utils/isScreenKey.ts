import { isSingleKeyShortcut } from './isSingleKeyShortcut.js';

/**
 * Whether a key event may run a screen's own single-key shortcut (a list's `j` or `x`, an opened item's `k`): a
 * single-key shortcut ({@link isSingleKeyShortcut}), not pressed inside a part that keeps the keys to itself
 * (`data-no-commands`), and no layer over the screen (`data-layer`: the new issue's capture, the command menu, the
 * help sheet) — the keys are then the layer's, even on one of its buttons.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isScreenKey(event: KeyboardEvent): boolean {
    const { target } = event;
    return (
        isSingleKeyShortcut(event) &&
        !(target instanceof Element && target.closest('[data-no-commands]') !== null) &&
        document.querySelector('[data-layer]') === null
    );
}
