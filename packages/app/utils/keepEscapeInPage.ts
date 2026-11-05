/**
 * Keeps Escape in the page, away from the system. An Escape the page leaves unhandled goes on from WebKit to the window,
 * and on macOS a window in full screen takes that as leaving it: closing a menu would also shrink the app. Only
 * `preventDefault` stops it, and reka-ui's layers don't call it.
 *
 * It has to come after every other listener, since they read `defaultPrevented` to tell whether the key is still theirs.
 * So the capture listener, ahead of them, adds one to the end of the window's list, for this event's way back up. A
 * listener that stops the event has prevented its default itself (they all do), and the one added then waits for the next
 * key: it does nothing there and is gone.
 * @util
 * @returns What stops it again.
 */
export function keepEscapeInPage() {
    window.addEventListener('keydown', onKeydown, { capture: true });
    return () => window.removeEventListener('keydown', onKeydown, { capture: true });
}

function onKeydown(event: KeyboardEvent) {
    // While composing, Escape cancels the composition, which is the input method's.
    if (event.key !== 'Escape' || event.isComposing) {
        return;
    }

    window.addEventListener(
        'keydown',
        last => {
            if (last === event) {
                event.preventDefault();
            }
        },
        { once: true },
    );
}
