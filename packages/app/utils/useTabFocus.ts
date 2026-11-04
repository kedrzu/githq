import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';

import { isEditableTarget } from './isEditableTarget.js';
import { isScreenCovered } from './isScreenCovered.js';

/**
 * Where Tab holds nothing: among a list's rows (`data-screen-keys`, never on a screen's head or toolbar), whose keys are
 * about what is focused there, and in a dialog or a picker, which keeps its keys.
 */
const KEEPS_ITS_KEYS = '[data-screen-keys], [role="dialog"]';
/** A list that takes the focus itself to be scrolled (the board): on it Tab holds nothing, on a control within it does. */
const LIST_ROOT = '[data-screen-keys-root]';

/**
 * Marks what Tab focuses outside the lists (`data-tab-focus`), holding the screen's keys back from it
 * ({@link isScreenKey}): the keyboard is on that control now, not on the list. `:focus-visible` cannot tell: it also
 * matches a clicked button once a key is pressed on it, and focus the app places after a key. Hence following the Tab
 * key itself, which arms this for the one focus it moves — if it moves any. One Escape gives the keys back, doing
 * nothing else; a field is never marked, its Escape being its own. Install once, from the shell.
 * @util
 */
export function useTabFocus() {
    let armed = false;

    // Before anything else on the window: an Escape it releases with is not also a toast's, a panel's or the checked
    // items'. A marked button's tooltip is no layer here: it closes with the focus.
    onWindowEvent(
        'keydown',
        event => {
            // With a modifier the system's or the browser's own: its keyup may never come here.
            if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey && !event.altKey) {
                armed = true;
            } else if (event.key === 'Escape' && isMarked(event.target) && !isScreenCovered()) {
                event.preventDefault();
                event.stopImmediatePropagation();
                event.target.blur();
            }
        },
        { capture: true },
    );
    onWindowEvent(
        'keyup',
        event => {
            if (event.key === 'Tab') {
                armed = false;
            }
        },
        { capture: true },
    );
    onWindowEvent(
        'pointerdown',
        () => {
            armed = false;
            // A click on what Tab focused keeps the focus there, but no longer by the keyboard.
            document.activeElement?.removeAttribute('data-tab-focus');
        },
        { capture: true },
    );
    onWindowEvent(
        'focusin',
        ({ target }) => {
            if (
                armed &&
                target instanceof Element &&
                !isEditableTarget(target) &&
                !target.closest(KEEPS_ITS_KEYS) &&
                !target.matches(LIST_ROOT)
            ) {
                target.setAttribute('data-tab-focus', '');
            }

            armed = false;
        },
        { capture: true },
    );
    onWindowEvent(
        'focusout',
        ({ target }) => {
            if (target instanceof Element) {
                target.removeAttribute('data-tab-focus');
            }
        },
        { capture: true },
    );
}

/**
 * Moves the focus Tab placed on to another control, which holds the keys back as it did: moving within the sidebar.
 * @util
 */
export function moveTabFocus(element: HTMLElement) {
    element.focus();
    element.setAttribute('data-tab-focus', '');
}

/**
 * Gives the keys back to the list, if Tab's focus holds them: a change of screen.
 * @util
 */
export function releaseTabFocus() {
    const active = document.activeElement;
    if (isMarked(active)) {
        active.blur();
    }
}

function isMarked(target: EventTarget | null): target is HTMLElement {
    return target instanceof HTMLElement && target.hasAttribute('data-tab-focus');
}
