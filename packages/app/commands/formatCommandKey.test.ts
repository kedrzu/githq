/// <reference types="bun" />
import { describe, expect, mock, test } from 'bun:test';

import { formatCommandKey } from './formatCommandKey.js';

let apple = true;
void mock.module('../utils/isApplePlatform.js', () => ({ isApplePlatform: () => apple }));

describe('on a Mac', () => {
    test('modifiers and named keys are glyphs, one chip with no joins', () => {
        apple = true;
        expect(formatCommandKey('Mod+K')).toBe('⌘K');
        expect(formatCommandKey('Alt+Mod+Enter')).toBe('⌥⌘↵');
        expect(formatCommandKey('Shift+O')).toBe('⇧O');
        expect(formatCommandKey('Alt+a')).toBe('⌥A');
        expect(formatCommandKey('Control+Alt+Shift+Mod+K')).toBe('⌃⌥⇧⌘K');
        expect(formatCommandKey('Backspace')).toBe('⌫');
        expect(formatCommandKey('Tab')).toBe('⇥');
    });
});

describe('elsewhere', () => {
    test('modifiers are words joined by "+"; Enter, Backspace and the arrows stay glyphs', () => {
        apple = false;
        expect(formatCommandKey('Mod+K')).toBe('Ctrl+K');
        expect(formatCommandKey('Alt+Mod+Enter')).toBe('Alt+Ctrl+↵');
        expect(formatCommandKey('Shift+O')).toBe('Shift+O');
        expect(formatCommandKey('Alt+A')).toBe('Alt+A');
        expect(formatCommandKey('Backspace')).toBe('⌫');
    });
});

test('single keys, words and alternatives read the same on both', () => {
    for (const platform of [true, false]) {
        apple = platform;
        expect(formatCommandKey('c')).toBe('C');
        expect(formatCommandKey('?')).toBe('?');
        expect(formatCommandKey('Escape')).toBe('Esc');
        expect(formatCommandKey('Space')).toBe('Space');
        expect(formatCommandKey('Enter')).toBe('↵');
        expect(formatCommandKey('ArrowUp ArrowDown')).toBe('↑↓');
    }
});
