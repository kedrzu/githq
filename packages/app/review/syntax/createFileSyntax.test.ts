import { afterEach, beforeEach, expect, test } from 'bun:test';

import { createFileSyntax } from './createFileSyntax.js';
import type { FileVersions } from './createFileSyntax.js';
import type { LineTokens } from './getLineSpans.js';
import type { TokenizeRequest } from './tokenize.worker.js';

const TOKENS: LineTokens = { starts: new Int32Array([0, 3]), ranges: new Int32Array([0, 1, 1]) };
const RealWorker = globalThis.Worker;
let posted: TokenizeRequest[] = [];
let answer: (tokens: LineTokens | null) => void = () => {};

class FakeWorker extends EventTarget {
    constructor() {
        super();
        answer = tokens => this.dispatchEvent(new MessageEvent('message', { data: tokens }));
    }

    postMessage(request: TokenizeRequest) {
        posted.push(request);
    }

    terminate() {}
}

beforeEach(() => {
    posted = [];
    Object.assign(globalThis, { Worker: FakeWorker });
});

afterEach(() => {
    Object.assign(globalThis, { Worker: RealWorker });
});

test('the worker gets one version at a time, each time the nearest by then, and the rows reading it get its tokens', () => {
    const a: FileVersions = { path: 'a.ts', before: 'old', after: 'new' };
    const b: FileVersions = { path: 'b.ts', before: null, after: 'other' };
    let queue = [a, b];
    const syntax = createFileSyntax(() => queue.find(versions => syntax.isPending(versions)) ?? null);

    syntax.tokenizeNext();
    syntax.tokenizeNext();

    expect(posted).toEqual([{ language: 'typescript', text: 'new' }]);
    expect(syntax.get(a).after.value).toBeNull();

    queue = [b, a];
    answer(TOKENS);

    expect(syntax.get(a).after.value).toBe(TOKENS);
    expect(posted.at(-1)).toEqual({ language: 'typescript', text: 'other' });
    answer(TOKENS);
    expect(posted.at(-1)).toEqual({ language: 'typescript', text: 'old' });
    answer(null);
    expect(syntax.get(a).before.value).toBeNull();
    expect(syntax.isPending(a)).toBe(false);
    expect(posted).toHaveLength(3);
});

test('the same text never goes twice, whichever file or push brings it back', () => {
    const a: FileVersions = { path: 'a.ts', before: null, after: 'same' };
    const moved: FileVersions = { path: 'moved/a.ts', before: 'same', after: 'same' };
    const syntax = createFileSyntax(() => (syntax.isPending(a) ? a : null));

    syntax.tokenizeNext();
    answer(TOKENS);

    expect(syntax.isPending(moved)).toBe(false);
    expect(syntax.get(moved).before.value).toBe(TOKENS);
    expect(posted).toHaveLength(1);
});

test('a file of no known language, or a side that does not exist, never reaches the worker', () => {
    const unknown: FileVersions = { path: 'LICENSE', before: 'x', after: 'y' };
    const added: FileVersions = { path: 'a.ts', before: null, after: null };
    const syntax = createFileSyntax(() => null);

    expect(syntax.isPending(unknown)).toBe(false);
    expect(syntax.isPending(added)).toBe(false);
    expect(syntax.get(unknown).after.value).toBeNull();
});
