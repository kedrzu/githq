import { isApplePlatform } from '@/utils/isApplePlatform.js';

/** What {@link matchesCommandKey} reads of a key event. */
type CommandKeyEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/**
 * Whether a key event is a key in the app's notation (`A`, `Shift+X`, `[`, `?`, `Mod+K`, `Alt+A`, `Alt+Mod+Enter`).
 * `Mod` is ⌘ on Apple's platforms and Ctrl elsewhere; the other one of the two never matches (on a Mac Ctrl+A is the
 * text field's). A letter's Shift must match — `A` is not `Shift+A` — but a symbol's is the keyboard's business (`?`
 * is Shift+/ on most layouts). A letter with Alt is told by its physical key, since ⌥A types "å" on a Mac.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function matchesCommandKey(event: CommandKeyEvent, key: string): boolean {
    const parts = key.split('+');
    const name = parts.pop() ?? '';
    const apple = isApplePlatform();
    const alt = parts.includes('Alt');
    const shift = parts.includes('Shift');
    if (
        parts.includes('Mod') !== (apple ? event.metaKey : event.ctrlKey) ||
        (apple ? event.ctrlKey : event.metaKey) ||
        alt !== event.altKey
    ) {
        return false;
    }

    if (/^[a-z]$/iu.test(name)) {
        const pressed = alt
            ? event.code === `Key${name.toUpperCase()}`
            : event.key.toLowerCase() === name.toLowerCase();
        return pressed && event.shiftKey === shift;
    }

    if (name.length === 1) {
        return event.key === name;
    }

    return event.key === (name === 'Space' ? ' ' : name) && event.shiftKey === shift;
}
