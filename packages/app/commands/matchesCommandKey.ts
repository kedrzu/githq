/**
 * Whether a key event is an action's key (`A`, `Shift+X`, `[`, `?`, `Meta+K`). A letter's Shift must match — `A`
 * is not `⇧A` — but a symbol's is the keyboard's business (`?` is Shift+/ on most layouts). `Meta` is ⌘ or Ctrl.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function matchesCommandKey(event: KeyboardEvent, key: string): boolean {
    const parts = key.split('+');
    const name = parts.pop() ?? '';
    const shift = parts.includes('Shift');
    const meta = parts.includes('Meta');
    if (meta !== (event.metaKey || event.ctrlKey) || event.altKey) {
        return false;
    }

    if (name.length === 1) {
        if (event.key.toLowerCase() !== name.toLowerCase()) {
            return false;
        }

        return /[a-z]/iu.test(name) ? event.shiftKey === shift : true;
    }

    return event.key === name && event.shiftKey === shift;
}
