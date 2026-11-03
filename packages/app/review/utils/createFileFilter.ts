import { assertNever } from '@nzyme/utils/assertNever.js';

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

type GlobToken =
    | { readonly kind: 'char'; readonly char: string }
    /** `?`: one character within a folder or name. */
    | { readonly kind: 'one' }
    /** `*`: any run within a folder or name. */
    | { readonly kind: 'name' }
    /** `**`: any run, across folders. */
    | { readonly kind: 'anything' }
    /** `**` + `/`: any number of whole folders, none too. */
    | { readonly kind: 'folders' };

/** A glob is in effect typed from any folder, as in VS Code, unless it starts at the root with one of these. */
const ROOTED = /^\.?\//u;
const WILDCARD = /[*?]/u;

/**
 * The test of paths a typed filter stands for (D11). Parts apart by commas each match on their own: `*.png` and `.png`
 * mean the extension, `docs/**` + `/*.png` a folder and an extension, plain text is found anywhere in a path, all whatever
 * the case. With `regex` the whole pattern is one regular expression, which is only ever run on paths.
 *
 * Globs run as a state machine, in time proportional to the path times the pattern whatever is typed: they are not
 * compiled to regular expressions, whose backtracking `*a*a*a*a*b` could hang the tab with.
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

    const tests = pattern
        .toLowerCase()
        .split(',')
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

function createPartTest(part: string): (path: string) => boolean {
    if (WILDCARD.test(part)) {
        const tokens = parseGlob(part);
        return path => matchesGlob(tokens, path);
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

/** Walks every token a prefix of the path can have reached: state `n` has matched the first `n` tokens. */
function matchesGlob(tokens: readonly GlobToken[], path: string) {
    let current = new Uint8Array(tokens.length + 1);
    let next = new Uint8Array(tokens.length + 1);
    current[0] = 1;
    spreadOverEmpty(tokens, current, true);

    for (const char of path) {
        next.fill(0);
        let alive = false;
        for (const [state, token] of tokens.entries()) {
            if (current[state] === 1 && step(token, char, state, next)) {
                alive = true;
            }
        }

        if (!alive) {
            return false;
        }

        spreadOverEmpty(tokens, next, char === '/');
        [current, next] = [next, current];
    }

    return current[tokens.length] === 1;
}

/** Takes `char` from a state on `token`, marking where it leads; whether it led anywhere. */
function step(token: GlobToken, char: string, state: number, next: Uint8Array) {
    const slash = char === '/';
    switch (token.kind) {
        case 'char':
            if (token.char !== char) {
                return false;
            }

            next[state + 1] = 1;
            return true;
        case 'one':
            if (slash) {
                return false;
            }

            next[state + 1] = 1;
            return true;
        case 'name':
            if (slash) {
                return false;
            }

            next[state] = 1;
            return true;
        case 'anything':
            next[state] = 1;
            return true;
        case 'folders':
            next[state] = 1;
            if (slash) {
                next[state + 1] = 1;
            }

            return true;
        default:
            return assertNever(token);
    }
}

/**
 * The tokens that can match nothing let a state through to the one after: they only ever lead forward. Whole folders can
 * only be none at the start of a name, `atNameStart`, or `docs/*` would match `mydocs/a`.
 */
function spreadOverEmpty(tokens: readonly GlobToken[], states: Uint8Array, atNameStart: boolean) {
    for (const [state, token] of tokens.entries()) {
        if (states[state] === 1 && canBeEmpty(token, atNameStart)) {
            states[state + 1] = 1;
        }
    }
}

function canBeEmpty({ kind }: GlobToken, atNameStart: boolean) {
    switch (kind) {
        case 'name':
        case 'anything':
            return true;
        case 'folders':
            return atNameStart;
        case 'char':
        case 'one':
            return false;
        default:
            return assertNever(kind);
    }
}
