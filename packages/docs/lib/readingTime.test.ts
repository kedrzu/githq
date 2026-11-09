import { expect, test } from 'bun:test';

import { readingMinutes } from './readingTime.js';

test('a short page takes a minute', () => {
    expect(readingMinutes('# Title\n\nA line.')).toBe(1);
    expect(readingMinutes('')).toBe(1);
});

test('minutes are words at 200 a minute, rounded', () => {
    expect(readingMinutes('word '.repeat(1000))).toBe(5);
    expect(readingMinutes('word '.repeat(1099))).toBe(5);
    expect(readingMinutes('word '.repeat(1100))).toBe(6);
});

test('the frontmatter does not count', () => {
    const frontmatter = `---\ndescription: ${'word '.repeat(400)}\n---\n`;
    expect(readingMinutes(`${frontmatter}${'word '.repeat(200)}`)).toBe(1);
});

test('punctuation and markup alone are not words', () => {
    expect(readingMinutes('- ** ` # > | '.repeat(500))).toBe(1);
});
