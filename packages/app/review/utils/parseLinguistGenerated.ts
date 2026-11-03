/** One line of a `.gitattributes` saying something of `linguist-generated`. */
interface GeneratedRule {
    /** The pattern's path segments, `**` one of them. */
    readonly segments: readonly (readonly PatternToken[])[];
    /** It has no slash but a last one: it goes by name, at any depth. Any other is anchored at the root. */
    readonly anywhere: boolean;
    readonly generated: boolean;
}

/** One token of a pattern's segment: `*`, or one character (a literal, `?` or a `[…]`). */
type PatternToken = { readonly star: true } | { readonly star: false; matches(character: string): boolean };

const ATTRIBUTE = 'linguist-generated';
const ANY_SEGMENTS = '**';
/** A line this long says nothing, as for git: `ATTR_MAX_LINE_LENGTH` in its `attr.h`, checked with `>=` in `attr.c`. */
const MAX_LINE_BYTES = 2048;
/**
 * How much of the file may say something of this attribute: what is matched against every path, on the main thread. Long
 * lists of other rules, such as Git LFS's, cost next to nothing and don't count.
 */
const MAX_RULES_BYTES = 16 * 1024;
/**
 * How much matching a file's rules may cost, in rules times path segments: about 0.75 s at worst. A real repository stays far
 * below it (a hundred rules, 3,000 files, ten folders deep is 3 million); past it, paths aren't marked generated.
 */
const MAX_MATCHING_WORK = 50_000_000;
const UTF8 = new TextEncoder();

/**
 * Reads a repository's root `.gitattributes` for `linguist-generated`, in the patterns git uses, and tells which paths it
 * marks: `*.gen.ts`, `dist/**`, `/src/api/*.ts`, `dist/` (everything under a directory: stricter git matches nothing
 * there, but that is what its author means). The last line matching a path decides. Any repository's author writes this
 * text, so it is matched without regular expressions over the path, in time proportional to pattern times path; a file
 * with more rules for this attribute than {@link MAX_RULES_BYTES} allows marks nothing generated, and once matching has cost
 * {@link MAX_MATCHING_WORK}, a deep tree being the author's too, the paths left aren't marked either.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseLinguistGenerated(text: string): (path: string) => boolean {
    const rules: GeneratedRule[] = [];
    let rulesBytes = 0;
    for (const line of text.split(/\r?\n/u)) {
        const parts = isTooLong(line) ? null : splitLine(line.trim());
        if (!parts) {
            continue;
        }

        rulesBytes += UTF8.encode(line).length;
        if (rulesBytes > MAX_RULES_BYTES) {
            return () => false;
        }

        rules.push({ ...parsePattern(parts.pattern), generated: parts.generated });
    }

    let work = 0;
    return path => {
        const segments = path.split('/');
        work += rules.length * segments.length;
        if (work > MAX_MATCHING_WORK) {
            return false;
        }

        return rules.findLast(rule => matchesRule(rule, segments))?.generated ?? false;
    };
}

/** Encoding only the few lines that could be: a character is at most three bytes of UTF-8 per UTF-16 unit. */
function isTooLong(line: string) {
    return (
        line.length >= MAX_LINE_BYTES ||
        (line.length * 3 >= MAX_LINE_BYTES && UTF8.encode(line).length >= MAX_LINE_BYTES)
    );
}

/** The pattern of a line saying something of the attribute, and what. */
function splitLine(line: string) {
    if (line === '' || line.startsWith('#') || line.startsWith('[attr]')) {
        return null;
    }

    const quoted = line.startsWith('"') ? line.indexOf('"', 1) : -1;
    const patternEnd = quoted > 0 ? quoted + 1 : line.search(/\s|$/u);
    const pattern = quoted > 0 ? line.slice(1, quoted) : line.slice(0, patternEnd);
    const generated = readGenerated(line.slice(patternEnd));
    return generated === null || pattern === '' ? null : { pattern, generated };
}

/** What the line's attributes say; `null` when they don't name it. Git lets the last of them on a line win as well. */
function readGenerated(attributes: string): boolean | null {
    let generated: boolean | null = null;
    for (const attribute of attributes.trim().split(/\s+/u)) {
        switch (attribute) {
            case ATTRIBUTE:
            case `${ATTRIBUTE}=true`:
                generated = true;
                break;
            case `-${ATTRIBUTE}`:
            case `!${ATTRIBUTE}`:
            case `${ATTRIBUTE}=false`:
                generated = false;
                break;
            default:
                break;
        }
    }

    return generated;
}

function parsePattern(pattern: string): Pick<GeneratedRule, 'anywhere' | 'segments'> {
    const directory = pattern.endsWith('/');
    const trimmed = directory ? pattern.slice(0, -1) : pattern;
    const anchored = trimmed.includes('/');
    const names = (trimmed.startsWith('/') ? trimmed.slice(1) : trimmed).split('/');
    return {
        anywhere: !anchored,
        segments: (directory ? [...names, ANY_SEGMENTS] : names).map(parseSegment),
    };
}

function parseSegment(segment: string): readonly PatternToken[] {
    const tokens: PatternToken[] = [];
    let index = 0;
    while (index < segment.length) {
        const character = segment.charAt(index);
        const classEnd = character === '[' ? segment.indexOf(']', index + 2) : -1;
        if (character === '*') {
            tokens.push({ star: true });
        } else if (character === '?') {
            tokens.push({ star: false, matches: () => true });
        } else if (classEnd > 0) {
            tokens.push({ star: false, matches: parseClass(segment.slice(index + 1, classEnd)) });
            index = classEnd;
        } else {
            const literal = character === '\\' ? segment.charAt(++index) : character;
            tokens.push({ star: false, matches: other => other === literal });
        }

        index++;
    }

    return tokens;
}

function parseClass(body: string) {
    const negated = body.startsWith('!') || body.startsWith('^');
    const members = negated ? body.slice(1) : body;
    return (character: string) => isInClass(members, character) !== negated;
}

function isInClass(members: string, character: string) {
    for (let index = 0; index < members.length; index++) {
        const from = members.charAt(index);
        if (members[index + 1] === '-' && index + 2 < members.length) {
            if (from <= character && character <= members.charAt(index + 2)) {
                return true;
            }

            index += 2;
        } else if (from === character) {
            return true;
        }
    }

    return false;
}

function matchesRule({ anywhere, segments }: GeneratedRule, path: readonly string[]) {
    const [first] = segments;
    if (!anywhere || first === undefined) {
        return matchesSegments(segments, path);
    }

    // By name: the file's or, for `dist/`, that of any folder above it, as a pattern with no other slash goes by name.
    const names = segments.length === 1 ? path.slice(-1) : path.slice(0, -1);
    return names.some(name => matchesSegment(first, name));
}

function matchesSegments(segments: readonly (readonly PatternToken[])[], path: readonly string[]) {
    return matchWithStars({
        pattern: segments,
        length: path.length,
        isStar: segment => segment.length === 2 && segment.every(token => token.star),
        matchesAt: (segment, index) => matchesSegment(segment, path[index] ?? ''),
    });
}

function matchesSegment(tokens: readonly PatternToken[], name: string) {
    return matchWithStars({
        pattern: tokens,
        length: name.length,
        isStar: token => token.star,
        matchesAt: (token, index) => !token.star && token.matches(name.charAt(index)),
    });
}

interface MatchWithStarsParams<T> {
    readonly pattern: readonly T[];
    /** How long the sequence matched is. */
    readonly length: number;
    readonly isStar: (item: T) => boolean;
    readonly matchesAt: (item: T, index: number) => boolean;
}

/** Wildcard matching: on a miss only the last star takes one more, which is all a greedy match ever has to go back to. */
function matchWithStars<T>({ pattern, length, isStar, matchesAt }: MatchWithStarsParams<T>) {
    let at = 0;
    let item = 0;
    let lastStar = -1;
    let lastStarAt = 0;
    while (at < length) {
        const current = pattern[item];
        if (current !== undefined && isStar(current)) {
            lastStar = item++;
            lastStarAt = at;
        } else if (current !== undefined && matchesAt(current, at)) {
            item++;
            at++;
        } else if (lastStar >= 0) {
            item = lastStar + 1;
            at = ++lastStarAt;
        } else {
            return false;
        }
    }

    return pattern.slice(item).every(isStar);
}
