/// <reference types="bun" />
import { expect, mock, test } from 'bun:test';

import { formatAriaKeyShortcuts } from './formatAriaKeyShortcuts.js';

let apple = true;
void mock.module('../utils/isApplePlatform.js', () => ({ isApplePlatform: () => apple }));

test('Mod names the key pressed: Meta on a Mac, Control elsewhere; the rest is left as written', () => {
    apple = true;
    expect(formatAriaKeyShortcuts('Mod+K')).toBe('Meta+K');
    expect(formatAriaKeyShortcuts('R Alt+Mod+Enter')).toBe('R Alt+Meta+Enter');
    apple = false;
    expect(formatAriaKeyShortcuts('Mod+K')).toBe('Control+K');
    expect(formatAriaKeyShortcuts('R Alt+Mod+Enter')).toBe('R Alt+Control+Enter');
    expect(formatAriaKeyShortcuts('Shift+O')).toBe('Shift+O');
});
