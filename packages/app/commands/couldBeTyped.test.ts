/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { couldBeTyped } from './couldBeTyped.js';

test('a Mod key that edits text is the field’s; any other Mod key is a command’s', () => {
    const fields = ['Mod+Z', 'Mod+A', 'Mod+C', 'Mod+V', 'Mod+X', 'Mod+Y', 'Mod+Enter', 'Mod+ArrowLeft', 'Shift+Mod+Z'];
    const extra = ['Alt+Mod+Enter', 'Shift+Mod+ArrowUp', 'Mod+Backspace', 'Alt+Mod+Delete', 'Mod+Home', 'Mod+End'];
    const commands = ['Mod+K', 'Mod+P', 'Shift+Mod+G', 'Alt+Mod+B', 'Mod+B', 'Mod+F', 'Mod+.', 'Mod+G', 'Mod+1'];

    expect([...fields, ...extra].filter(key => !couldBeTyped(key))).toEqual([]);
    expect(commands.filter(key => couldBeTyped(key))).toEqual([]);
});

test('a key without Mod is always the field’s: letters with Shift or Alt, symbols, arrows and the editing keys', () => {
    const keys = ['A', 'Shift+A', 'Alt+A', '1', '?', '[', 'ArrowDown', 'Enter', 'Escape', 'Tab', 'Backspace', 'Space'];

    expect(keys.filter(key => !couldBeTyped(key))).toEqual([]);
});
