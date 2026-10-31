const SYMBOLS: Readonly<Record<string, string>> = {
    Meta: '⌘',
    Shift: '⇧',
    Enter: '↵',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
};

/**
 * An action's key (`Shift+X`) as the chips show it, one per key: `['⇧', 'X']`.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatCommandKey(key: string): string[] {
    return key.split('+').map(part => SYMBOLS[part] ?? part.toUpperCase());
}
