/** One line of a `.gitattributes` saying something of `linguist-generated`. */
interface GeneratedRule {
    /** The pattern's path segments, `**` one of them. */
    readonly segments: readonly (readonly PatternToken[])[];
    /** It has no slash but a last one: it goes by name, at any depth. Any other is anchored at the root. */
    readonly anywhere: boolean;
    readonly generated: boolean;
}

/** One token of a pattern's segment: `*`, or one character (a literal, `?` or a `[…]`). */
type PatternToken =
    | { readonly star: true }
    | { readonly star: false; matches(character: string, work: MatchingWork): boolean };

/** What matching has cost so far, one count for all the paths of a file. */
interface MatchingWork {
    spent: number;
}

/** The macros of a file: what each is defined as, and what that was worked out to say of the attribute. */
interface Macros {
    readonly bodies: ReadonlyMap<string, readonly string[]>;
    readonly said: Map<string, boolean | null>;
}

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
 * How much matching a file's rules may cost: rules times path segments for each path, plus every step of a wildcard match
 * (see {@link matchWithStars}), which is where the time goes. About 0.8 s at worst, and 16 KB of ordinary rules on 3,000
 * files eight folders deep stays under it; past it, even in the middle of a match, paths aren't marked generated.
 */
const MAX_MATCHING_WORK = 100_000_000;
const UTF8 = new TextEncoder();

/**
 * Reads a repository's root `.gitattributes` for `linguist-generated`, in the patterns git uses, and tells which paths it
 * marks: `*.gen.ts`, `dist/**`, `/src/api/*.ts`, `dist/` (everything under a directory: stricter git matches nothing
 * there, but that is what its author means). The last line matching a path decides. Any repository's author writes this
 * text, so it is matched without regular expressions over the path, in time proportional to pattern times path; a file
 * with more rules for this attribute than {@link MAX_RULES_BYTES} allows marks nothing generated, and once matching has cost
 * {@link MAX_MATCHING_WORK}, a deep tree being the author's too, the paths left aren't marked either. Either way
 * `onGaveUp` is told, once.
 *
 * Attribute macros count: `[attr]gen linguist-generated` makes `*.ts gen` a rule, wherever in the file it is defined, the
 * last definition winning. As in git only the plain name expands, so `-gen` says nothing.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function parseLinguistGenerated(text: string, onGaveUp?: () => void): (path: string) => boolean {
    const lines = text
        .split(/\r?\n/u)
        .filter(line => !isTooLong(line))
        .map(line => line.trim());
    const macros = readMacros(lines);
    const rules: GeneratedRule[] = [];
    let rulesBytes = 0;
    for (const line of lines) {
        const parts = splitLine(line, macros);
        if (!parts) {
            continue;
        }

        rulesBytes += UTF8.encode(line).length;
        if (rulesBytes > MAX_RULES_BYTES) {
            onGaveUp?.();
            return () => false;
        }

        rules.push({ ...parsePattern(parts.pattern), generated: parts.generated });
    }

    const work: MatchingWork = { spent: 0 };
    let gaveUp = false;
    return path => {
        const segments = path.split('/');
        work.spent += rules.length * segments.length;
        const rule = work.spent > MAX_MATCHING_WORK ? undefined : rules.findLast(r => matchesRule(r, segments, work));
        if (work.spent <= MAX_MATCHING_WORK) {
            return rule?.generated ?? false;
        }

        if (!gaveUp) {
            gaveUp = true;
            onGaveUp?.();
        }

        return false;
    };
}

/** Encoding only the few lines that could be: a character is at most three bytes of UTF-8 per UTF-16 unit. */
function isTooLong(line: string) {
    return (
        line.length >= MAX_LINE_BYTES ||
        (line.length * 3 >= MAX_LINE_BYTES && UTF8.encode(line).length >= MAX_LINE_BYTES)
    );
}

function readMacros(lines: readonly string[]): Macros {
    const bodies = new Map<string, readonly string[]>();
    for (const line of lines) {
        const macro = /^\[attr\](\S+)(.*)$/u.exec(line);
        if (macro) {
            bodies.set(macro[1] ?? '', (macro[2] ?? '').trim().split(/\s+/u));
        }
    }

    return { bodies, said: new Map() };
}

/** The pattern of a line saying something of the attribute, and what. */
function splitLine(line: string, macros: Macros) {
    if (line === '' || line.startsWith('#') || line.startsWith('[attr]')) {
        return null;
    }

    const quoted = line.startsWith('"') ? line.indexOf('"', 1) : -1;
    const patternEnd = quoted > 0 ? quoted + 1 : line.search(/\s|$/u);
    const pattern = quoted > 0 ? line.slice(1, quoted) : line.slice(0, patternEnd);
    const generated = readGenerated(line.slice(patternEnd).trim().split(/\s+/u), macros);
    return generated === null || pattern === '' ? null : { pattern, generated };
}

/**
 * What the attributes say; `null` when they don't name it. As in git the last one on a line decides, and a name it mentions
 * in any form is decided: `gen -gen` doesn't expand.
 */
function readGenerated(attributes: readonly string[], macros: Macros): boolean | null {
    const decided = new Set<string>();
    for (const attribute of attributes.toReversed()) {
        switch (attribute) {
            case ATTRIBUTE:
            case `${ATTRIBUTE}=true`:
                return true;
            case `-${ATTRIBUTE}`:
            case `!${ATTRIBUTE}`:
            case `${ATTRIBUTE}=false`:
                return false;
            default:
                break;
        }

        const name = attribute.replace(/^[-!]|=.*$/gu, '');
        const generated = attribute === name && !decided.has(name) ? readMacro(name, macros) : null;
        if (generated !== null) {
            return generated;
        }

        decided.add(name);
    }

    return null;
}

/** Worked out once, for a file can use one on every line; one that comes back to itself says nothing more that way. */
function readMacro(name: string, macros: Macros) {
    if (macros.said.has(name)) {
        return macros.said.get(name) ?? null;
    }

    macros.said.set(name, null);
    const generated = readGenerated(macros.bodies.get(name) ?? [], macros);
    macros.said.set(name, generated);
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
    return (character: string, work: MatchingWork) => {
        work.spent += members.length;
        return isInClass(members, character) !== negated;
    };
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

function matchesRule({ anywhere, segments }: GeneratedRule, path: readonly string[], work: MatchingWork) {
    const [first] = segments;
    if (!anywhere || first === undefined) {
        return matchesSegments(segments, path, work);
    }

    // By name: the file's or, for `dist/`, that of any folder above it, as a pattern with no other slash goes by name.
    const names = segments.length === 1 ? path.slice(-1) : path.slice(0, -1);
    return names.some(name => matchesSegment(first, name, work));
}

function matchesSegments(segments: readonly (readonly PatternToken[])[], path: readonly string[], work: MatchingWork) {
    return matchWithStars({
        pattern: segments,
        length: path.length,
        work,
        isStar: segment => segment.length === 2 && segment.every(token => token.star),
        matchesAt: (segment, index) => matchesSegment(segment, path[index] ?? '', work),
    });
}

function matchesSegment(tokens: readonly PatternToken[], name: string, work: MatchingWork) {
    return matchWithStars({
        pattern: tokens,
        length: name.length,
        work,
        isStar: token => token.star,
        matchesAt: (token, index) => !token.star && token.matches(name.charAt(index), work),
    });
}

interface MatchWithStarsParams<T> {
    readonly pattern: readonly T[];
    /** How long the sequence matched is. */
    readonly length: number;
    readonly work: MatchingWork;
    readonly isStar: (item: T) => boolean;
    readonly matchesAt: (item: T, index: number) => boolean;
}

/**
 * Wildcard matching: on a miss only the last star takes one more, which is all a greedy match ever has to go back to. Each
 * step is charged to `work`, and past {@link MAX_MATCHING_WORK} no match is found.
 */
function matchWithStars<T>({ pattern, length, work, isStar, matchesAt }: MatchWithStarsParams<T>) {
    let at = 0;
    let item = 0;
    let lastStar = -1;
    let lastStarAt = 0;
    while (at < length) {
        if (++work.spent > MAX_MATCHING_WORK) {
            return false;
        }

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

    work.spent += pattern.length - item;
    return pattern.slice(item).every(isStar);
}
