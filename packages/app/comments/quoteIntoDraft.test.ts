import { describe, expect, test } from 'bun:test';

import { quoteIntoDraft } from './quoteIntoDraft.js';

describe('quoteIntoDraft', () => {
    test('quotes every line into an empty draft, a blank line after it', () => {
        expect(quoteIntoDraft('First\nSecond', '')).toBe('> First\n> Second\n\n');
    });

    test('follows what is typed already, after a blank line', () => {
        expect(quoteIntoDraft('Looks right', 'Thanks!  \n')).toBe('Thanks!\n\n> Looks right\n\n');
    });

    test('leaves out HTML comments and the blank lines they leave', () => {
        expect(quoteIntoDraft('<!-- a hint -->\n\n\n\nThe bug', '')).toBe('> The bug\n\n');
    });
});
