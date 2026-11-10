import type { PersonSuggestion, ReferenceSuggestion } from './SuggestionTypes.js';

/** How many suggestions a menu shows at most. */
const SUGGESTION_LIMIT = 6;

/** A suggestion the typed text matches, and how well: higher is better. */
interface Found<T> {
    readonly value: T;
    readonly match: number;
}

// How well a text matches what is typed: nothing typed matches everything, as `INSIDE`.
const NONE = 0;
const INSIDE = 1;
const WORD_START = 2;
const START = 3;
const EXACT = 4;

/** What starts a word, before it. */
const WORD_BREAK = /[\s\-_./]/;

/**
 * The people `@query` suggests, best match first: their login, then that login starting with it, then a word of their
 * name starting with it, then either holding it anywhere, ignoring case. Among equal matches the order given stands,
 * so a thread's people, given first, come before the repository's. Each login once, the first time it is given; a
 * handful at most ({@link SUGGESTION_LIMIT}).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function rankPeople(query: string, people: readonly PersonSuggestion[]): PersonSuggestion[] {
    const typed = query.toLowerCase();
    const seen = new Set<string>();
    const found: Found<PersonSuggestion>[] = [];
    for (const person of people) {
        const login = person.login.toLowerCase();
        if (seen.has(login)) {
            continue;
        }

        seen.add(login);
        const byName = Math.min(matchText(typed, (person.name ?? '').toLowerCase()), WORD_START);
        const match = Math.max(matchText(typed, login), byName);
        if (match !== NONE) {
            found.push({ value: person, match });
        }
    }

    return rank(found);
}

/**
 * The issues and pull requests `#query` suggests, best match first: digits find by number — that number, then the
 * numbers starting with them — and anything typed finds by a word of the title starting with it, then by the title
 * holding it, ignoring case. Among equal matches the order given stands (the most recently updated first, as the
 * caller gives them); a handful at most ({@link SUGGESTION_LIMIT}).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function rankReferences(query: string, items: readonly ReferenceSuggestion[]): ReferenceSuggestion[] {
    const typed = query.toLowerCase();
    const found: Found<ReferenceSuggestion>[] = [];
    for (const item of items) {
        const byNumber = matchText(typed, String(item.number));
        // A title holding the digits counts below a number starting with them: `#12` is #12, #120, then "v12".
        const byTitle = Math.min(matchText(typed, item.title.toLowerCase()), WORD_START);
        const match = Math.max(byNumber >= START ? byNumber : NONE, byTitle);
        if (match !== NONE) {
            found.push({ value: item, match });
        }
    }

    return rank(found);
}

function matchText(typed: string, text: string) {
    if (typed === '') {
        return INSIDE;
    }

    if (text === typed) {
        return EXACT;
    }

    if (text.startsWith(typed)) {
        return START;
    }

    let match = NONE;
    for (let at = text.indexOf(typed); at !== -1; at = text.indexOf(typed, at + 1)) {
        if (WORD_BREAK.test(text[at - 1] ?? '')) {
            return WORD_START;
        }

        match = INSIDE;
    }

    return match;
}

/** Best match first, the given order among equals, cut to {@link SUGGESTION_LIMIT}. */
function rank<T>(found: readonly Found<T>[]): T[] {
    return found
        .toSorted((a, b) => b.match - a.match)
        .slice(0, SUGGESTION_LIMIT)
        .map(({ value }) => value);
}
