import { createGlobMatcher } from './createGlobMatcher.js';
import type { GlobBudget, GlobToken } from './createGlobMatcher.js';
import { getFileName } from './getFileName.js';

/** One line of a `.gitattributes` saying something of `linguist-generated`. */
interface GeneratedRule {
    readonly matches: (path: string, budget: GlobBudget) => boolean;
    /** It has no slash at all: it goes by the file's name, which spares it walking the folders. */
    readonly byName: boolean;
    readonly generated: boolean;
}

/** The macros of a file: what each is defined as, and what that was worked out to say of the attribute. */
interface Macros {
    readonly bodies: ReadonlyMap<string, readonly string[]>;
    readonly said: Map<string, boolean | null>;
}

const ATTRIBUTE = 'linguist-generated';
const ANY_SEGMENTS = '**';
const SLASH: GlobToken = { kind: 'char', char: '/' };
const ANYTHING: GlobToken = { kind: 'anything' };
/** What follows a directory's name: everything under it. Stricter git matches nothing there, but that is what's meant. */
const UNDER_FOLDER: readonly GlobToken[] = [SLASH, ANYTHING];
/** A line this long says nothing, as for git: `ATTR_MAX_LINE_LENGTH` in its `attr.h`, checked with `>=` in `attr.c`. */
const MAX_LINE_BYTES = 2048;
/**
 * How much of the file may say something of this attribute: what is matched against every path, on the main thread. Long
 * lists of other rules, such as Git LFS's, cost next to nothing and don't count.
 */
const MAX_RULES_BYTES = 16 * 1024;
/**
 * How much matching a file's rules may cost, in the steps {@link createGlobMatcher} charges. About 0.8 s at worst, and 16 KB of
 * ordinary rules on 3,000 files eight folders deep stays under it; past it, even in the middle of a match, paths aren't
 * marked generated.
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

        rules.push({
            matches: createGlobMatcher(parsePattern(parts.pattern)),
            byName: !parts.pattern.includes('/'),
            generated: parts.generated,
        });
    }

    const budget: GlobBudget = { spent: 0, limit: MAX_MATCHING_WORK };
    let gaveUp = false;
    return path => {
        budget.spent += rules.length * path.split('/').length;
        const name = getFileName(path);
        const rule =
            budget.spent > MAX_MATCHING_WORK
                ? undefined
                : rules.findLast(({ matches, byName }) => matches(byName ? name : path, budget));
        if (budget.spent <= MAX_MATCHING_WORK) {
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

/**
 * A pattern with no slash goes by the file's name. With only a last one, `dist/`, it goes by that of any folder above the
 * file. Any other is anchored at the root, its whole `**` segments crossing folders; a `**` within a segment is two stars.
 */
function parsePattern(pattern: string): GlobToken[] {
    const directory = pattern.endsWith('/');
    const trimmed = directory ? pattern.slice(0, -1) : pattern;
    if (!trimmed.includes('/')) {
        return directory ? [{ kind: 'folders' }, ...parseSegment(trimmed), ...UNDER_FOLDER] : parseSegment(trimmed);
    }

    const segments = (trimmed.startsWith('/') ? trimmed.slice(1) : trimmed).split('/');
    const tokens: GlobToken[] = [];
    for (const [index, segment] of segments.entries()) {
        const last = index === segments.length - 1;
        if (segment !== ANY_SEGMENTS) {
            tokens.push(...parseSegment(segment), ...(last ? [] : [SLASH]));
        } else if (last) {
            tokens.push(ANYTHING);
        } else {
            tokens.push({ kind: 'folders' });
        }
    }

    return directory ? [...tokens, ...(tokens.at(-1) === ANYTHING ? [] : UNDER_FOLDER)] : tokens;
}

function parseSegment(segment: string): GlobToken[] {
    const characters = Array.from(segment);
    const tokens: GlobToken[] = [];
    let index = 0;
    while (index < characters.length) {
        const character = characters[index];
        const classEnd = character === '[' ? characters.indexOf(']', index + 2) : -1;
        if (character === '*') {
            tokens.push({ kind: 'name' });
        } else if (character === '?') {
            tokens.push({ kind: 'one' });
        } else if (classEnd > 0) {
            tokens.push(parseClass(characters.slice(index + 1, classEnd)));
            index = classEnd;
        } else {
            const literal = character === '\\' ? characters[++index] : character;
            tokens.push({ kind: 'char', char: literal ?? '' });
        }

        index++;
    }

    return tokens;
}

function parseClass(body: readonly string[]): GlobToken {
    const negated = body[0] === '!' || body[0] === '^';
    return { kind: 'class', members: negated ? body.slice(1) : body, negated };
}
