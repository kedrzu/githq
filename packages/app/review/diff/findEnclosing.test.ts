import { expect, test } from 'bun:test';

import { findEnclosing } from './findEnclosing.js';

const LINES = [
    'import { a } from "a";',
    '',
    'export class SyncEngine {',
    '    first() {',
    '        one();',
    '    }',
    '',
    '    second() {',
    '        two();',
    '    }',
    '}',
    '',
    'const top = 1;',
];

test('the nearest earlier line indented less is what a line sits in', () => {
    expect(findEnclosing(LINES, 4)).toBe('first() {');
    expect(findEnclosing(LINES, 8)).toBe('second() {');
});

test('closing brackets and what is deeper on the way up do not count', () => {
    expect(findEnclosing(LINES, 7)).toBe('export class SyncEngine {');
});

test('a blank line is read as the first line after it', () => {
    expect(findEnclosing(LINES, 6)).toBe('export class SyncEngine {');
});

test('the top level, or past the last line, sits in nothing', () => {
    expect(findEnclosing(LINES, 12)).toBeNull();
    expect(findEnclosing(LINES, 40)).toBeNull();
    expect(findEnclosing(['    indented with nothing above'], 0)).toBeNull();
});
