import { createGlobMatcher } from './createGlobMatcher.js';
import type { GlobToken } from './createGlobMatcher.js';

/** What the user typed in the file list's filter (D11). */
export interface FileFilterInput {
    readonly pattern: string;
    /** The pattern is a regular expression, matched anywhere in the whole path. */
    readonly regex: boolean;
    /** These files exactly, whatever the pattern, which only says so to the reader. Editing it goes back to what it says. */
    readonly paths?: readonly string[];
}

/** What a typed filter means: nothing, a test of paths, or a regular expression that doesn't compile. */
export type FileFilter =
    | { readonly kind: 'off' }
    | { readonly kind: 'on'; readonly matches: (path: string) => boolean }
    | { readonly kind: 'invalid' };

/** A glob is in effect typed from any folder, as in VS Code, unless it starts at the root with one of these. */
const ROOTED = /^\.?\//u;
const WILDCARD = /[*?]/u;
/** A part: up to a comma that isn't in braces. A brace never closed is a character like any other. */
const PART = /(?:\{[^{}]*\}|[^,])+/gu;
/** Braces holding alternatives; `{id}.vue` holds none, and `[id].vue` no pattern: both are that file. */
const ALTERNATIVES = /\{([^{}]*,[^{}]*)\}/gu;
/** What `{a,b}` braces may multiply a part into: past it, they are just characters. */
const MAX_ALTERNATIVES = 64;

/**
 * The test of paths a typed filter stands for (D11). Parts apart by commas each match on their own: `*.png` and `.png`
 * mean the extension, `docs/**` + `/*.png` a folder and an extension, `*.{ts,tsx}` either extension, plain text is found
 * anywhere in a path unless it starts at the root, all whatever the case. With `regex` the whole pattern is one regular
 * expression, which is only ever run on paths.
 *
 * Globs run on {@link createGlobMatcher}, so nothing typed can hang the tab.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createFileFilter({ pattern, regex, paths }: FileFilterInput): FileFilter {
    if (paths) {
        const exact = new Set(paths);
        return { kind: 'on', matches: path => exact.has(path) };
    }

    if (pattern.trim() === '') {
        return { kind: 'off' };
    }

    if (regex) {
        return compileRegex(pattern);
    }

    const tests = (pattern.toLowerCase().match(PART) ?? [])
        .flatMap(expandAlternatives)
        .map(part => part.trim())
        .filter(part => part !== '')
        .map(createPartTest);
    if (tests.length === 0) {
        return { kind: 'off' };
    }

    return {
        kind: 'on',
        matches: path => {
            const lower = path.toLowerCase();
            return tests.some(test => test(lower));
        },
    };
}

function compileRegex(pattern: string): FileFilter {
    try {
        const expression = new RegExp(pattern, 'iu');
        return { kind: 'on', matches: path => expression.test(path) };
    } catch {
        return { kind: 'invalid' };
    }
}

function expandAlternatives(part: string) {
    let expanded = [''];
    let end = 0;
    for (const group of part.matchAll(ALTERNATIVES)) {
        const head = part.slice(end, group.index);
        const alternatives = (group[1] ?? '').split(',').map(alternative => alternative.trim());
        if (expanded.length * alternatives.length > MAX_ALTERNATIVES) {
            return [part];
        }

        expanded = expanded.flatMap(start => alternatives.map(alternative => `${start}${head}${alternative}`));
        end = group.index + group[0].length;
    }

    const tail = part.slice(end);
    return expanded.map(start => `${start}${tail}`);
}

function createPartTest(part: string): (path: string) => boolean {
    if (WILDCARD.test(part)) {
        return createGlobMatcher(parseGlob(part));
    }

    const rooted = ROOTED.exec(part);
    if (rooted) {
        const text = part.slice(rooted[0].length);
        const folder = text === '' || text.endsWith('/') ? text : `${text}/`;
        return path => path === text || path.startsWith(folder);
    }

    // `.png` is the extension and never `.pngx`; `.github` has no file to end, but is a folder.
    if (part.startsWith('.') && !part.includes('/')) {
        return path => path.endsWith(part) || path.startsWith(`${part}/`) || path.includes(`/${part}/`);
    }

    return path => path.includes(part);
}

function parseGlob(part: string): GlobToken[] {
    const rooted = ROOTED.exec(part);
    const tokens: GlobToken[] = rooted ? [] : [{ kind: 'folders' }];
    const text = rooted ? part.slice(rooted[0].length) : part;
    for (let index = 0; index < text.length; index++) {
        const char = text.charAt(index);
        switch (char) {
            case '?':
                tokens.push({ kind: 'one' });
                break;
            case '*': {
                let end = index + 1;
                while (text[end] === '*') {
                    end++;
                }

                if (end === index + 1) {
                    tokens.push({ kind: 'name' });
                } else if (text[end] === '/') {
                    tokens.push({ kind: 'folders' });
                    end++;
                } else {
                    tokens.push({ kind: 'anything' });
                }

                index = end - 1;
                break;
            }
            default:
                tokens.push({ kind: 'char', char });
        }
    }

    return tokens;
}
