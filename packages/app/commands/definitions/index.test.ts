import { expect, test } from 'bun:test';

import type { AnyAppCommand } from '../defineAppCommand.js';
import { findKeyConflicts } from '../findKeyConflicts.js';
import { keyOf } from '../keyOf.js';
import * as definitions from './index.js';

const ALL: readonly AnyAppCommand[] = Object.values(definitions);

test('every command is defined once, under its own id', () => {
    const ids = ALL.map(definition => definition.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
});

test('D8: no app-wide command takes a letter or a digit by default, only modifier keys and symbols', () => {
    const offending = ALL.flatMap(definition => {
        if (!definition.places.includes('app')) {
            return [];
        }

        if (definition.kind === 'family') {
            return [definition.id];
        }

        const key = keyOf(definition);
        const keys = [...(key === undefined ? [] : [key]), ...(definition.otherKeys ?? [])];
        return keys.some(candidate => !isAppWideKey(candidate)) ? [definition.id] : [];
    });

    expect(offending).toEqual([]);
});

test('D3: no two commands active together share a default key', () => {
    expect(findKeyConflicts(ALL).map(({ key, first, second }) => `${key}: ${first.id} and ${second.id}`)).toEqual([]);
});

/** With `Mod`, `Alt` or `Control`, or a symbol on its own (`?`, `,`); `Shift` alone still types a letter. */
function isAppWideKey(key: string) {
    const parts = key.split('+');
    const name = parts.at(-1) ?? '';
    return parts.some(part => part === 'Mod' || part === 'Alt' || part === 'Control') || /^[^\p{L}\p{N}]$/u.test(name);
}
