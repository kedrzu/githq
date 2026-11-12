import { expect, test } from 'bun:test';

import { parsePatchLayout } from './parsePatchLayout.js';

test('reads each hunk start and the kind of each of its lines, past the section text after the header', () => {
    const patch = [
        '@@ -3,4 +3,5 @@ export function first() {',
        ' a',
        '-b',
        '+c',
        '+d',
        ' e',
        '@@ -20,2 +21,1 @@ class Second @@ odd',
        ' f',
        '-g',
    ].join('\n');

    expect(parsePatchLayout(patch)).toEqual({
        hunks: [
            { beforeStart: 3, afterStart: 3, lines: ' -++ ' },
            { beforeStart: 20, afterStart: 21, lines: ' -' },
        ],
    });
});

test('a count left out is a hunk of one line, and an added file starts at 0', () => {
    expect(parsePatchLayout('@@ -1 +1 @@\n-a\n+b')).toEqual({
        hunks: [{ beforeStart: 1, afterStart: 1, lines: '-+' }],
    });
    expect(parsePatchLayout('@@ -0,0 +1,3 @@\n+a\n+b\n+c')).toEqual({
        hunks: [{ beforeStart: 0, afterStart: 1, lines: '+++' }],
    });
});

test('"No newline at end of file" is no line, and neither is a trailing newline', () => {
    const patch = '@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+a\n\\ No newline at end of file\n';

    expect(parsePatchLayout(patch)).toEqual({ hunks: [{ beforeStart: 1, afterStart: 1, lines: '-+' }] });
});

test('carriage returns inside a patch change nothing', () => {
    expect(parsePatchLayout('@@ -1,2 +1,2 @@ section\r\n a\r\n-b\r\n+c\r\n')).toEqual({
        hunks: [{ beforeStart: 1, afterStart: 1, lines: ' -+' }],
    });
});

test('an empty patch has no hunks', () => {
    expect(parsePatchLayout('')).toEqual({ hunks: [] });
});

test('a patch it cannot read is null', () => {
    expect(parsePatchLayout('@@')).toBeNull();
    expect(parsePatchLayout(' a\n-b')).toBeNull();
    expect(parsePatchLayout('@@ -1 +1 @@\n*a')).toBeNull();
});
