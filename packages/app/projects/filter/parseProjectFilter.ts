/** A comparison of a number, date or iteration field (`priority:>1`, `date:<=@today`). */
export type ProjectFilterOperator = '<' | '<=' | '>' | '>=';

/** One value of a qualifier; a comma separates several, any of which may match. */
export type ProjectFilterValue =
    | { readonly kind: 'equals'; readonly value: string }
    | { readonly kind: 'compare'; readonly operator: ProjectFilterOperator; readonly value: string }
    /** Inclusive; `*` on either side is open. */
    | { readonly kind: 'range'; readonly from: string; readonly to: string };

/** One term of a filter; the terms are all required (AND). */
export type ProjectFilterTerm =
    | {
          readonly kind: 'qualifier';
          /** `-status:Done`. */
          readonly negated: boolean;
          /** As written, without quotes ("Story points" from `"Story points":3`). */
          readonly qualifier: string;
          /** The qualifier was quoted (`"Story points":3`). */
          readonly quotedQualifier: boolean;
          readonly values: readonly ProjectFilterValue[];
          /** The term as written, for the chips and for naming what githq can't evaluate. */
          readonly text: string;
      }
    | {
          /** Free text, searched in titles and text fields. */
          readonly kind: 'text';
          readonly negated: boolean;
          readonly value: string;
          readonly text: string;
      };

/** A filter as written, read into terms; `null` when it is not well formed (an unclosed quote). */
export type ParsedProjectFilter = readonly ProjectFilterTerm[] | null;

/** One run of a term: text inside or outside quotes. */
interface Chunk {
    readonly text: string;
    readonly quoted: boolean;
}

/**
 * Reads GitHub's project filter syntax (`status:Todo,Done -label:bug "story points":>3 api`) into terms — the
 * syntax only; what a qualifier means is `compileProjectFilter`'s. Terms are split on whitespace outside quotes
 * (`"` or `'`); a term with a `:` outside quotes is a qualifier, any other is free text.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseProjectFilter(filter: string): ParsedProjectFilter {
    const terms: ProjectFilterTerm[] = [];
    for (const raw of splitTerms(filter) ?? [null]) {
        if (raw === null) {
            return null;
        }

        terms.push(parseTerm(raw));
    }

    return terms;
}

/** The terms as written, each a list of chunks; `null` for an unclosed quote. */
function splitTerms(filter: string): Chunk[][] | null {
    const terms: Chunk[][] = [];
    let chunks: Chunk[] = [];
    let plain = '';
    let index = 0;
    while (index < filter.length) {
        const char = filter.charAt(index);
        if (char === '"' || char === "'") {
            const end = filter.indexOf(char, index + 1);
            if (end === -1) {
                return null;
            }

            if (plain) {
                chunks.push({ text: plain, quoted: false });
                plain = '';
            }

            chunks.push({ text: filter.slice(index + 1, end), quoted: true });
            index = end + 1;
            continue;
        }

        if (/\s/.test(char)) {
            if (plain) {
                chunks.push({ text: plain, quoted: false });
                plain = '';
            }

            if (chunks.length > 0) {
                terms.push(chunks);
                chunks = [];
            }
        } else {
            plain += char;
        }

        index++;
    }

    if (plain) {
        chunks.push({ text: plain, quoted: false });
    }

    if (chunks.length > 0) {
        terms.push(chunks);
    }

    return terms;
}

function parseTerm(chunks: readonly Chunk[]): ProjectFilterTerm {
    const text = chunks.map(chunk => (chunk.quoted ? `"${chunk.text}"` : chunk.text)).join('');
    let rest = [...chunks];
    let negated = false;
    const first = rest[0];
    if (first && !first.quoted && first.text.startsWith('-') && (first.text.length > 1 || rest.length > 1)) {
        negated = true;
        rest = first.text.length > 1 ? [{ text: first.text.slice(1), quoted: false }, ...rest.slice(1)] : rest.slice(1);
    }

    // The qualifier ends at the first `:` outside quotes.
    const colonChunk = rest.findIndex(chunk => !chunk.quoted && chunk.text.includes(':'));
    if (colonChunk === -1) {
        return { kind: 'text', negated, value: rest.map(chunk => chunk.text).join(''), text };
    }

    const before = rest.slice(0, colonChunk);
    const split = rest[colonChunk]?.text ?? '';
    const colon = split.indexOf(':');
    const qualifier = [...before.map(chunk => chunk.text), split.slice(0, colon)].join('');
    const valueChunks: Chunk[] = [{ text: split.slice(colon + 1), quoted: false }, ...rest.slice(colonChunk + 1)];
    return {
        kind: 'qualifier',
        negated,
        qualifier,
        quotedQualifier: before.some(chunk => chunk.quoted),
        values: parseValues(valueChunks),
        text,
    };
}

/** The comma-separated values after the qualifier, each an equality, a comparison or a range. */
function parseValues(chunks: readonly Chunk[]): ProjectFilterValue[] {
    const values: ProjectFilterValue[] = [];
    let current: Chunk[] = [];
    for (const chunk of chunks) {
        if (chunk.quoted) {
            current.push(chunk);
            continue;
        }

        const parts = chunk.text.split(',');
        for (const [index, part] of parts.entries()) {
            if (index > 0) {
                values.push(parseValue(current));
                current = [];
            }

            if (part) {
                current.push({ text: part, quoted: false });
            }
        }
    }

    values.push(parseValue(current));
    return values;
}

function parseValue(chunks: readonly Chunk[]): ProjectFilterValue {
    const joined = chunks.map(chunk => chunk.text).join('');
    const first = chunks[0];
    if (first && !first.quoted) {
        const operator = /^(<=|>=|<|>)/.exec(first.text)?.[1];
        if (operator === '<' || operator === '<=' || operator === '>' || operator === '>=') {
            return { kind: 'compare', operator, value: joined.slice(operator.length) };
        }
    }

    // `a..b`, also inside quotes ("Iteration 1..Iteration 4").
    const range = joined.indexOf('..');
    if (range !== -1) {
        return { kind: 'range', from: joined.slice(0, range), to: joined.slice(range + 2) };
    }

    return { kind: 'equals', value: joined };
}
