import { escapeRegExp } from '@/utils/escapeRegExp.js';

/** How a query is read, as the find bar's toggles say. */
export interface FindOptions {
    readonly matchCase: boolean;
    readonly wholeWord: boolean;
    /** The query is a JavaScript pattern rather than plain text. */
    readonly regex: boolean;
}

/**
 * The expression a query searches with, `null` for an empty query (nothing to search for) and `'invalid'` for a pattern
 * that doesn't compile. Case is ignored with the `i` flag rather than by lowering the text, so a match's offsets are those
 * of the text as drawn. A whole word is one with no word character on either side of it, whatever the pattern matches.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function compileFindQuery(query: string, options: FindOptions): RegExp | 'invalid' | null {
    if (query.length === 0) {
        return null;
    }

    const source = options.regex ? query : escapeRegExp(query);
    const flags = options.matchCase ? 'g' : 'gi';
    try {
        const expression = new RegExp(source, flags);
        // Compiled alone first: wrapped, `a)|(b` would compile into something the query never said.
        return options.wholeWord ? new RegExp(`(?<!\\w)(?:${source})(?!\\w)`, flags) : expression;
    } catch {
        return 'invalid';
    }
}
