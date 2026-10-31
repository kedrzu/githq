import { isApplePlatform } from '@/utils/isApplePlatform.js';

const APPLE_NAMES: Readonly<Record<string, string>> = {
    Mod: '⌘',
    Control: '⌃',
    Alt: '⌥',
    Shift: '⇧',
};

const OTHER_NAMES: Readonly<Record<string, string>> = {
    Mod: 'Ctrl',
    Control: 'Ctrl',
    Alt: 'Alt',
    Shift: 'Shift',
};

const KEY_NAMES: Readonly<Record<string, string>> = {
    Enter: '↵',
    Backspace: '⌫',
    Tab: '⇥',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
};

/**
 * A key in the app's notation (`Mod+Enter`, `Shift+O`, `Escape`; alternatives apart by spaces: `ArrowUp ArrowDown`)
 * as its chip shows it on this platform: `⌘↵`, `⇧O`, `↑↓` on Apple's; `Ctrl+↵`, `Shift+O` elsewhere.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function formatCommandKey(key: string): string {
    const apple = isApplePlatform();
    const names = apple ? APPLE_NAMES : OTHER_NAMES;
    return key
        .split(' ')
        .map(shortcut =>
            shortcut
                .split('+')
                .map(part => names[part] ?? KEY_NAMES[part] ?? (part.length === 1 ? part.toUpperCase() : part))
                .join(apple ? '' : '+'),
        )
        .join('');
}
