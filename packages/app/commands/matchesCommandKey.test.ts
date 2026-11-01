/// <reference types="bun" />
import { describe, expect, mock, test } from 'bun:test';

import { matchesCommandKey } from './matchesCommandKey.js';

let apple = true;
void mock.module('../utils/isApplePlatform.js', () => ({ isApplePlatform: () => apple }));

/** What the browser reports for a key pressed: `key` typed, its physical `code`, and the modifiers held. */
interface Pressed {
    readonly key: string;
    readonly code?: string;
    readonly metaKey?: boolean;
    readonly ctrlKey?: boolean;
    readonly altKey?: boolean;
    readonly shiftKey?: boolean;
}

describe('on a Mac', () => {
    test('Mod is ⌘; Ctrl with the key is not the shortcut — it is the text field’s', () => {
        apple = true;
        expect(matchesCommandKey(press({ key: 'k', metaKey: true }), 'Mod+K')).toBe(true);
        expect(matchesCommandKey(press({ key: 'k', ctrlKey: true }), 'Mod+K')).toBe(false);
        expect(matchesCommandKey(press({ key: 'k', metaKey: true, ctrlKey: true }), 'Mod+K')).toBe(false);
        expect(matchesCommandKey(press({ key: 'a', ctrlKey: true }), 'A')).toBe(false);
        expect(matchesCommandKey(press({ key: 'Enter', metaKey: true }), 'Mod+Enter')).toBe(true);
        expect(matchesCommandKey(press({ key: 'Enter', metaKey: true, altKey: true }), 'Alt+Mod+Enter')).toBe(true);
        expect(matchesCommandKey(press({ key: 'Enter', metaKey: true, altKey: true }), 'Mod+Enter')).toBe(false);
    });

    test('⌥ with a letter is told by its physical key: ⌥A types "å"', () => {
        apple = true;
        expect(matchesCommandKey(press({ key: 'å', code: 'KeyA', altKey: true }), 'Alt+A')).toBe(true);
        expect(matchesCommandKey(press({ key: '®', code: 'KeyR', altKey: true }), 'Alt+A')).toBe(false);
        expect(matchesCommandKey(press({ key: 'å', code: 'KeyA', altKey: true, metaKey: true }), 'Alt+A')).toBe(false);
        expect(matchesCommandKey(press({ key: 'a', code: 'KeyA', altKey: true }), 'A')).toBe(false);
    });
});

describe('elsewhere', () => {
    test('Mod is Ctrl; the Windows or Super key is not', () => {
        apple = false;
        expect(matchesCommandKey(press({ key: 'k', ctrlKey: true }), 'Mod+K')).toBe(true);
        expect(matchesCommandKey(press({ key: 'k', metaKey: true }), 'Mod+K')).toBe(false);
        expect(matchesCommandKey(press({ key: '.', ctrlKey: true }), 'Mod+.')).toBe(true);
        expect(matchesCommandKey(press({ key: 'Enter', ctrlKey: true, altKey: true }), 'Alt+Mod+Enter')).toBe(true);
        expect(matchesCommandKey(press({ key: 'a', code: 'KeyA', altKey: true }), 'Alt+A')).toBe(true);
    });

    test('AltGr (Ctrl+Alt) typing a character is not an Alt shortcut', () => {
        apple = false;
        expect(matchesCommandKey(press({ key: 'ą', code: 'KeyA', altKey: true, ctrlKey: true }), 'Alt+A')).toBe(false);
    });
});

test('a letter’s Shift must match, a symbol’s is the layout’s', () => {
    for (const platform of [true, false]) {
        apple = platform;
        expect(matchesCommandKey(press({ key: 'x' }), 'X')).toBe(true);
        expect(matchesCommandKey(press({ key: 'X', shiftKey: true }), 'X')).toBe(false);
        expect(matchesCommandKey(press({ key: 'X', shiftKey: true }), 'Shift+X')).toBe(true);
        expect(matchesCommandKey(press({ key: '?', shiftKey: true }), '?')).toBe(true);
        expect(matchesCommandKey(press({ key: 'Escape' }), 'Escape')).toBe(true);
        expect(matchesCommandKey(press({ key: ' ' }), 'Space')).toBe(true);
        expect(matchesCommandKey(press({ key: 'ArrowUp', shiftKey: true }), 'ArrowUp')).toBe(false);
    }
});

function press(pressed: Pressed) {
    return {
        code: '',
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        ...pressed,
    };
}
