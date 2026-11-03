/** What a token is, by index in a {@link LineTokens}' ranges. Everything else is the normal text colour. */
export const SYNTAX_KINDS = ['comment', 'keyword', 'string', 'constant', 'name'] as const;

/** A kind of token: {@link SYNTAX_KINDS}. */
export type SyntaxKind = (typeof SYNTAX_KINDS)[number];

/**
 * A version of a file's tokens by line, flat and typed, so that they stay out of Vue's reactivity and cost little to
 * keep: the tokens of line `i` (0-based) are the triples from `starts[i]` to `starts[i + 1]` in `ranges`, each the
 * start and end in that line and the index of its kind.
 */
export interface LineTokens {
    readonly starts: Int32Array;
    readonly ranges: Int32Array;
}

/** A piece of a line's text; `kind` is `null` for the normal text colour. */
export interface LineSpan {
    readonly text: string;
    readonly kind: SyntaxKind | null;
}

/**
 * A line cut into spans by its tokens, whose texts together are exactly the line. Without tokens for it, the line whole.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getLineSpans(text: string, tokens: LineTokens | null, line: number): LineSpan[] {
    if (!tokens) {
        return [{ text, kind: null }];
    }

    const spans: LineSpan[] = [];
    let position = 0;
    const end = tokens.starts[line + 1] ?? 0;
    for (let index = tokens.starts[line] ?? 0; index < end; index += 3) {
        const from = tokens.ranges[index] ?? 0;
        const to = tokens.ranges[index + 1] ?? 0;
        if (from > position) {
            spans.push({ text: text.slice(position, from), kind: null });
        }

        spans.push({ text: text.slice(from, to), kind: SYNTAX_KINDS[tokens.ranges[index + 2] ?? 0] ?? null });
        position = to;
    }

    if (position < text.length) {
        spans.push({ text: text.slice(position), kind: null });
    }

    return spans;
}
