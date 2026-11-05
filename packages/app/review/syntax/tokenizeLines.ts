import hljs from 'highlight.js/lib/core';
import type { Emitter, LanguageFn } from 'highlight.js';

import type { SyntaxLanguage } from './getSyntaxLanguage.js';
import { SYNTAX_KINDS } from './getLineSpans.js';
import type { LineTokens, SyntaxKind } from './getLineSpans.js';

/** Longer lines stay plain: minified code, data on one line. Nobody reads them and each would draw thousands of spans. */
const MAX_LINE_LENGTH = 2000;

/** What highlight.js's scopes are. A scope not here says nothing, like one wrapping others: its text is what's around it. */
const KIND_BY_SCOPE: Readonly<Record<string, SyntaxKind | null>> = {
    attr: 'constant',
    attribute: 'constant',
    built_in: 'builtin',
    bullet: 'builtin',
    code: 'comment',
    comment: 'comment',
    doctag: 'keyword',
    formula: 'comment',
    keyword: 'keyword',
    literal: 'constant',
    meta: 'constant',
    name: 'tag',
    number: 'constant',
    operator: 'constant',
    quote: 'tag',
    regexp: 'string',
    section: 'constant',
    'selector-attr': 'constant',
    'selector-class': 'constant',
    'selector-id': 'constant',
    'selector-pseudo': 'tag',
    'selector-tag': 'tag',
    string: 'string',
    subst: null,
    symbol: 'builtin',
    'template-tag': 'keyword',
    'template-variable': 'keyword',
    title: 'title',
    type: 'keyword',
    variable: 'constant',
    'variable.language': 'keyword',
};

/** {@link KIND_BY_SCOPE} as indices into {@link SYNTAX_KINDS}: `-1` for the normal text colour. */
const KIND_INDEX_BY_SCOPE: ReadonlyMap<string, number> = new Map(
    Object.entries(KIND_BY_SCOPE).map(([scope, kind]) => [scope, kind === null ? -1 : SYNTAX_KINDS.indexOf(kind)]),
);

/**
 * Takes down what highlight.js finds, instead of the HTML it would write: flat ranges of the text, a nested scope's over
 * the one around it. Comes to be through its `__emitter` option, the only way to its tokens.
 */
class RangesEmitter implements Emitter {
    /** Triples: start, end, kind. */
    readonly ranges: number[] = [];
    length = 0;

    readonly #scopes: number[] = [];
    #kind = -1;

    addText(text: string) {
        this.#add(this.length, this.length + text.length, this.#kind);
        this.length += text.length;
    }

    startScope(scope: string) {
        this.#scopes.push(this.#kind);
        this.#kind =
            KIND_INDEX_BY_SCOPE.get(scope) ?? KIND_INDEX_BY_SCOPE.get(scope.slice(0, scope.indexOf('.'))) ?? this.#kind;
    }

    endScope() {
        this.#kind = this.#scopes.pop() ?? -1;
    }

    openNode(scope: string) {
        this.startScope(scope);
    }

    closeNode() {
        this.endScope();
    }

    __addSublanguage(emitter: Emitter) {
        if (emitter instanceof RangesEmitter) {
            for (let index = 0; index < emitter.ranges.length; index += 3) {
                this.#add(
                    this.length + (emitter.ranges[index] ?? 0),
                    this.length + (emitter.ranges[index + 1] ?? 0),
                    emitter.ranges[index + 2] ?? -1,
                );
            }

            this.length += emitter.length;
        }
    }

    finalize() {}

    toHTML() {
        return '';
    }

    #add(from: number, to: number, kind: number) {
        if (kind === -1 || from === to) {
            return;
        }

        const last = this.ranges.length - 3;
        if (this.ranges[last + 1] === from && this.ranges[last + 2] === kind) {
            this.ranges[last + 1] = to;
        } else {
            this.ranges.push(from, to, kind);
        }
    }
}

hljs.configure({ __emitter: RangesEmitter });

const GRAMMARS: Readonly<Record<SyntaxLanguage, () => Promise<{ default: LanguageFn }>>> = {
    bash: () => import('highlight.js/lib/languages/bash'),
    c: () => import('highlight.js/lib/languages/c'),
    cpp: () => import('highlight.js/lib/languages/cpp'),
    csharp: () => import('highlight.js/lib/languages/csharp'),
    css: () => import('highlight.js/lib/languages/css'),
    diff: () => import('highlight.js/lib/languages/diff'),
    dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
    go: () => import('highlight.js/lib/languages/go'),
    ini: () => import('highlight.js/lib/languages/ini'),
    java: () => import('highlight.js/lib/languages/java'),
    json: () => import('highlight.js/lib/languages/json'),
    kotlin: () => import('highlight.js/lib/languages/kotlin'),
    lua: () => import('highlight.js/lib/languages/lua'),
    makefile: () => import('highlight.js/lib/languages/makefile'),
    markdown: () => import('highlight.js/lib/languages/markdown'),
    php: () => import('highlight.js/lib/languages/php'),
    python: () => import('highlight.js/lib/languages/python'),
    ruby: () => import('highlight.js/lib/languages/ruby'),
    rust: () => import('highlight.js/lib/languages/rust'),
    scss: () => import('highlight.js/lib/languages/scss'),
    sql: () => import('highlight.js/lib/languages/sql'),
    swift: () => import('highlight.js/lib/languages/swift'),
    typescript: () => import('highlight.js/lib/languages/typescript'),
    xml: () => import('highlight.js/lib/languages/xml'),
    yaml: () => import('highlight.js/lib/languages/yaml'),
};

const loading = new Map<SyntaxLanguage, Promise<void>>();

/** Fetches a language's grammar, once: a chunk of its own, so that only the languages a review comes across pay for theirs. */
export function loadGrammar(language: SyntaxLanguage): Promise<void> {
    let load = loading.get(language);
    if (!load) {
        load = importGrammar(language);
        loading.set(language, load);
    }

    return load;
}

/**
 * The tokens of a version of a file, its grammar loaded by {@link loadGrammar}, or `null` when the tokenizer fails: the
 * file then shows plain. The whole file is tokenized at once since a line's tokens depend on those before it (a comment,
 * a template string), but for lines over {@link MAX_LINE_LENGTH}, which it sees as empty.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function tokenizeLines(language: SyntaxLanguage, lines: readonly string[]): LineTokens | null {
    const seen = lines.map(line => (line.length > MAX_LINE_LENGTH ? '' : line));
    try {
        const result = hljs.highlight(seen.join('\n'), { language, ignoreIllegals: true });
        const emitter = result._emitter;
        return emitter instanceof RangesEmitter && result.errorRaised === undefined
            ? splitIntoLines(
                  emitter.ranges,
                  seen.map(line => line.length),
              )
            : null;
    } catch {
        return null;
    }
}

/** Ranges of the whole text as ranges in each line, one going over a line's end being cut there. */
function splitIntoLines(ranges: readonly number[], lengths: readonly number[]): LineTokens {
    const starts = new Int32Array(lengths.length + 1);
    const out: number[] = [];
    let index = 0;
    let lineStart = 0;
    for (const [line, length] of lengths.entries()) {
        starts[line] = out.length;
        const lineEnd = lineStart + length;
        while (index < ranges.length && (ranges[index] ?? 0) < lineEnd) {
            const from = Math.max(ranges[index] ?? 0, lineStart);
            const to = Math.min(ranges[index + 1] ?? 0, lineEnd);
            if (to > from) {
                out.push(from - lineStart, to - lineStart, ranges[index + 2] ?? 0);
            }

            if ((ranges[index + 1] ?? 0) > lineEnd) {
                break;
            }

            index += 3;
        }

        lineStart = lineEnd + 1;
    }

    starts[lengths.length] = out.length;
    return { starts, ranges: Int32Array.from(out) };
}

async function importGrammar(language: SyntaxLanguage) {
    // Markup holds the two others in `<script>` and `<style>`.
    if (language === 'xml') {
        await Promise.all([loadGrammar('typescript'), loadGrammar('css')]);
    }

    const { default: grammar } = await GRAMMARS[language]();
    hljs.registerLanguage(language, grammar);
    // JavaScript is TypeScript's grammar too: it holds the JavaScript one, and the name is what `<script>` in markup
    // looks for, so `<script lang="ts">` of a Vue file is coloured as what it is.
    if (language === 'typescript') {
        hljs.registerLanguage('javascript', grammar);
    }
}
