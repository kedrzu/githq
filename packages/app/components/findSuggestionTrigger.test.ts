import { expect, test } from 'bun:test';

import { findSuggestionTrigger } from './findSuggestionTrigger.js';
import type { SuggestionTrigger } from './findSuggestionTrigger.js';

/** The trigger at the caret, written as `|` in the text. */
function at(textWithCaret: string) {
    const caret = textWithCaret.indexOf('|');
    const text = textWithCaret.replace('|', '');
    return findSuggestionTrigger(text, { start: caret, end: caret });
}

test('an @ or # starting a word asks for what is typed after it up to the caret', () => {
    const mention: SuggestionTrigger = { kind: 'mention', start: 7, query: 'so' };
    expect(at('thanks @so|')).toEqual(mention);
    const reference: SuggestionTrigger = { kind: 'reference', start: 9, query: '12' };
    expect(at('fixed in #12| already')).toEqual(reference);
    expect(at('@|')).toEqual({ kind: 'mention', start: 0, query: '' });
    expect(at('see (#ca|')).toEqual({ kind: 'reference', start: 5, query: 'ca' });
    expect(at('line\n@sofia-b|')).toEqual({ kind: 'mention', start: 5, query: 'sofia-b' });
});

test('nothing is asked inside a word, after a space, past the caret or over a selection', () => {
    expect(at('mail me@ex|')).toBeNull();
    expect(at('## heading|')).toBeNull();
    expect(at('##|')).toBeNull();
    expect(at('@sofiab |')).toBeNull();
    expect(at('# |')).toBeNull();
    expect(at('|@sofiab')).toBeNull();
    expect(at('@so.b|')).toBeNull();
    expect(findSuggestionTrigger('@sofiab', { start: 1, end: 4 })).toBeNull();
});
