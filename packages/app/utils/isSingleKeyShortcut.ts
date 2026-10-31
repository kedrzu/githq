import { isEditableTarget } from './isEditableTarget.js';

/**
 * Whether a key event may run a single-key shortcut (`j`, `[`, `1`): nothing handled it yet, no modifier is
 * held — `⌘K` and the browser's own keys stay theirs — and the key is not being typed into something.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function isSingleKeyShortcut(event: KeyboardEvent): boolean {
    return (
        !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableTarget(event.target)
    );
}
