import { assertNever } from '@nzyme/utils/assertNever.js';

/** One step of a glob. Each parser decides what its syntax turns into. */
export type GlobToken =
    | { readonly kind: 'char'; readonly char: string }
    /** One character within a folder or name. */
    | { readonly kind: 'one' }
    /** One character within a folder or name, among (or with `negated`, not among) `members`: `a`, or `a-z` over three. */
    | { readonly kind: 'class'; readonly members: readonly string[]; readonly negated: boolean }
    /** Any run within a folder or name. */
    | { readonly kind: 'name' }
    /** Any run, across folders. */
    | { readonly kind: 'anything' }
    /** Any number of whole folders, none too. */
    | { readonly kind: 'folders' };

/** What matching has cost so far, for a caller matching what someone else wrote: past `limit`, nothing matches. */
export interface GlobBudget {
    spent: number;
    readonly limit: number;
}

/**
 * Tells whether a path matches a glob, as a state machine: state `n` has matched the first `n` tokens, and every state a
 * prefix of the path can have reached is walked at once. So its time is proportional to the path times the pattern whatever
 * the pattern is, where the backtracking of a regular expression could hang the tab on `*a*a*a*a*b`.
 *
 * States only ever lead forward, so nothing past the furthest one reached is looked at: on the many patterns failing early,
 * which is what lets 16 KB of rules be asked of 3,000 files, that is a few states and not the whole pattern. For the same
 * reason the states are kept between paths.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function createGlobMatcher(tokens: readonly GlobToken[]) {
    let current = new Uint8Array(tokens.length + 1);
    let next = new Uint8Array(tokens.length + 1);

    return (path: string, budget?: GlobBudget) => {
        current.fill(0);
        next.fill(0);
        current[0] = 1;
        let reach = spreadOverEmpty(tokens, current, 0, true);
        const work = budget ?? { spent: 0, limit: Infinity };
        work.spent += tokens.length;

        for (const char of path) {
            work.spent += reach + 1;
            for (let state = 0; state <= reach + 1; state++) {
                next[state] = 0;
            }

            let alive = false;
            for (let state = 0; state <= reach; state++) {
                const token = tokens[state];
                if (token && current[state] === 1) {
                    work.spent += token.kind === 'class' ? token.members.length : 0;
                    alive = step(token, char, state, next) || alive;
                }
            }

            if (!alive || work.spent > work.limit) {
                return false;
            }

            reach = spreadOverEmpty(tokens, next, reach, char === '/');
            const stepped = next;
            next = current;
            current = stepped;
        }

        return current[tokens.length] === 1;
    };
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
        case 'class':
            if (slash || isInClass(token.members, char) === token.negated) {
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

function isInClass(members: readonly string[], char: string) {
    for (let index = 0; index < members.length; index++) {
        const from = members[index] ?? '';
        const to = members[index + 2];
        if (members[index + 1] === '-' && to !== undefined) {
            if (from <= char && char <= to) {
                return true;
            }

            index += 2;
        } else if (from === char) {
            return true;
        }
    }

    return false;
}

/**
 * The tokens that can match nothing let a state through to the one after; returns the furthest state reached yet, which
 * a step can only have passed by one. Whole folders can only be none at the start of a name, `atNameStart`, or `docs/*`
 * would match `mydocs/a`.
 */
function spreadOverEmpty(tokens: readonly GlobToken[], states: Uint8Array, reach: number, atNameStart: boolean) {
    let furthest = reach;
    for (let state = 0; state <= furthest + 1; state++) {
        if (states[state] === 1) {
            furthest = Math.max(furthest, state);
            const token = tokens[state];
            if (token && canBeEmpty(token, atNameStart)) {
                states[state + 1] = 1;
            }
        }
    }

    return furthest;
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
        case 'class':
            return false;
        default:
            return assertNever(kind);
    }
}
