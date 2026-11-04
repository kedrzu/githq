import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';

import type { LineTokens } from './getLineSpans.js';
import { getSyntaxLanguage } from './getSyntaxLanguage.js';
import type { SyntaxLanguage } from './getSyntaxLanguage.js';
import type { TokenizeRequest, TokenizeResponse } from './tokenize.worker.js';

/** A file's tokens on each side, `null` until they arrive and for good for one shown plain. Only a row drawn reads them. */
export interface FileSyntax {
    readonly before: Readonly<ShallowRef<LineTokens | null>>;
    readonly after: Readonly<ShallowRef<LineTokens | null>>;
}

/** The two versions of a file, `null` for a side it doesn't exist on. */
export interface FileVersions {
    readonly path: string;
    readonly before: string | null;
    readonly after: string | null;
}

/** What {@link createFileSyntax} gives. */
export interface FileSyntaxCache {
    get(versions: FileVersions): FileSyntax;
    /** Whether a version of this file still waits for its tokens. */
    isPending(versions: FileVersions): boolean;
    /** Has the worker start on what's next, unless it is busy: call it when a file arrives or opens. */
    tokenizeNext(): void;
    dispose(): void;
}

interface Side {
    readonly language: SyntaxLanguage;
    readonly text: string;
    readonly tokens: ShallowRef<LineTokens | null>;
    pending: boolean;
}

const NO_TOKENS = shallowRef<LineTokens | null>(null);

/**
 * Tokens of the versions of files, computed in a worker (measured, D20: tokenizing on the main thread dropped frames while
 * scrolling a large pull request, and a worker's round trip costs next to nothing) and kept for the cache's life by language
 * and content, so the same text never goes twice, whichever push or whitespace setting brings it back. The worker gets one
 * version at a time, so the next is always the nearest to where the reader is by then, as `findNext` says. A worker that
 * doesn't start leaves code plain.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createFileSyntax(findNext: () => FileVersions | null): FileSyntaxCache {
    const byLanguage = new Map<SyntaxLanguage, Map<string, Side>>();
    let worker: Worker | null = null;
    let current: Side | null = null;

    return { get, isPending, tokenizeNext, dispose };

    function get({ path, before, after }: FileVersions): FileSyntax {
        return {
            before: getSide(path, before)?.tokens ?? NO_TOKENS,
            after: getSide(path, after)?.tokens ?? NO_TOKENS,
        };
    }

    function isPending(versions: FileVersions) {
        return getPendingSide(versions) !== null;
    }

    function tokenizeNext() {
        const next = current === null ? findNext() : null;
        const side = next && getPendingSide(next);
        if (side) {
            current = side;
            side.pending = false;
            worker ??= startWorker();
            const request: TokenizeRequest = { language: side.language, text: side.text };
            worker.postMessage(request);
        }
    }

    function dispose() {
        worker?.terminate();
    }

    function getPendingSide({ path, before, after }: FileVersions) {
        const sideAfter = getSide(path, after);
        if (sideAfter?.pending) {
            return sideAfter;
        }

        const sideBefore = getSide(path, before);
        return sideBefore?.pending ? sideBefore : null;
    }

    function getSide(path: string, text: string | null) {
        const language = getSyntaxLanguage(path);
        if (text === null || language === null) {
            return null;
        }

        let sides = byLanguage.get(language);
        if (!sides) {
            sides = new Map();
            byLanguage.set(language, sides);
        }

        let side = sides.get(text);
        if (!side) {
            side = { language, text, tokens: shallowRef(null), pending: true };
            sides.set(text, side);
        }

        return side;
    }

    function startWorker() {
        const started = new Worker(new URL('./tokenize.worker.ts', import.meta.url), { type: 'module' });
        started.addEventListener('message', ({ data }: MessageEvent<TokenizeResponse>) => {
            if (current) {
                current.tokens.value = data;
            }

            current = null;
            tokenizeNext();
        });
        return started;
    }
}
