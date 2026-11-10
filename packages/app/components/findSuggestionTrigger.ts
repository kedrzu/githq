import type { TextRange } from './applyMarkdownTool.js';

/** What the text at the caret asks suggestions for: `@` people, `#` issues and pull requests. */
export interface SuggestionTrigger {
    readonly kind: 'mention' | 'reference';
    /** Where the `@` or `#` is; the suggestion picked replaces the text from here to the caret. */
    readonly start: number;
    /** What is typed after it, up to the caret. */
    readonly query: string;
}

/** What a login is made of: letters, digits and hyphens. */
const MENTION_QUERY = /^[\dA-Za-z-]*$/;
/** A number or a word of a title. */
const REFERENCE_QUERY = /^[\dA-Za-z]*$/;
/** What may stand right before a trigger: it starts a word there, so `a@b.c` and `##` ask nothing. */
const WORD_START = /[\s([{]/;

/**
 * The `@` or `#` the user is typing a suggestion's query after, at the caret: one starting a word, followed by
 * nothing but a login's characters (`@`) or letters and digits (`#`) up to the caret. `null` when there is none, or
 * when text is selected.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function findSuggestionTrigger(text: string, selection: TextRange): SuggestionTrigger | null {
    if (selection.start !== selection.end) {
        return null;
    }

    const caret = selection.start;
    const before = text.slice(0, caret);
    const start = Math.max(before.lastIndexOf('@'), before.lastIndexOf('#'));
    if (start === -1) {
        return null;
    }

    const previous = text[start - 1];
    if (previous !== undefined && !WORD_START.test(previous)) {
        return null;
    }

    const query = before.slice(start + 1);
    const kind = text[start] === '@' ? 'mention' : 'reference';
    const allowed = kind === 'mention' ? MENTION_QUERY : REFERENCE_QUERY;
    return allowed.test(query) ? { kind, start, query } : null;
}
