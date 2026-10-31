/** What Enter activates on its own: a button, a link or a disclosure's summary. */
const ACTIVATABLE = 'button, a, summary';

/**
 * Whether a key event's target is something Enter already activates, so a page-wide Enter must leave the key
 * alone (fields are `isEditableTarget`'s).
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isActivatableTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(ACTIVATABLE) !== null;
}
