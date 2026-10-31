/** What takes typed keys: form fields and editable content (not content explicitly made read-only). */
const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Whether a key event's target is something being typed into, so a single-key shortcut must leave the key
 * alone.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(EDITABLE) !== null;
}
