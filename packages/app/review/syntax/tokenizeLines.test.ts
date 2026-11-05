import { expect, test } from 'bun:test';

import { getLineSpans } from './getLineSpans.js';
import type { LineTokens, LineSpan } from './getLineSpans.js';
import type { SyntaxLanguage } from './getSyntaxLanguage.js';
import { loadGrammar, tokenizeLines } from './tokenizeLines.js';

const SAMPLES: readonly (readonly [SyntaxLanguage, string])[] = [
    [
        'typescript',
        'const a: string = `x${1 + 2}y`; // c\n/* multi\n line */\nfunction f() {}\n\n\ttype T = "😀 é";\r\nreturn <div a="b">{f()}</div>;',
    ],
    ['json', '{\n  "a": [1, true, null],\n  "b": "c\\n"\n}'],
    ['markdown', '# Title\n\nSome *text* and `code`.\n\n- item\n\n```ts\nconst a = 1;\n```\n<b>raw</b>'],
    [
        'xml',
        '<template>\n  <div :a="b">{{ c }}</div>\n</template>\n<script lang="ts" setup>\ninterface A { b: string }\n</script>\n<style lang="scss">\n.a { color: red; }\n</style>',
    ],
    ['go', 'package main\n\n// Hello.\nfunc main() {\n\tprintln("x", 1)\n}'],
    ['rust', 'fn main() {\n    let x: u32 = 1; // c\n    println!("{}", x);\n}'],
    ['python', 'def f(a):\n    """doc\n    more"""\n    return a + 1 # c'],
    ['yaml', 'a: 1\nb:\n  - "c"\n# d'],
    ['bash', '#!/bin/sh\nif [ -z "$A" ]; then echo $(ls); fi'],
    ['css', '.a > b { color: #fff; }\n/* c */'],
    ['scss', '$a: 1;\n.b { &:hover { c: $a; } }'],
];

test.each(SAMPLES)('the spans of %s are exactly its lines', async (language, text) => {
    await loadGrammar(language);
    const lines = text.split('\n');

    const tokens = tokenizeLines(language, lines);

    expect(tokens).not.toBeNull();
    expect(kindsIn(tokens, lines).size).toBeGreaterThan(0);
    for (const [index, line] of lines.entries()) {
        expect(
            getSpans(line, tokens, index)
                .map(span => span.text)
                .join(''),
        ).toBe(line.replace(/\r$/, ''));
    }
});

test('a comment over several lines colours each of them', async () => {
    await loadGrammar('typescript');
    const lines = ['const a = 1;', '/* one', 'two', 'three */ const b = 2;'];

    const tokens = tokenizeLines('typescript', lines);

    expect(getSpans(lines[1], tokens, 1)).toEqual([{ text: '/* one', kind: 'comment' }]);
    expect(getSpans(lines[2], tokens, 2)).toEqual([{ text: 'two', kind: 'comment' }]);
    expect(getSpans(lines[3], tokens, 3).slice(0, 2)).toEqual([
        { text: 'three */', kind: 'comment' },
        { text: ' ', kind: null },
    ]);
});

test('text inside a string template is the normal colour, a string around it is not', async () => {
    await loadGrammar('typescript');
    const lines = ['const a = `x${b}y`;'];

    const spans = getSpans(lines[0], tokenizeLines('typescript', lines), 0);

    expect(spans.find(span => span.text.includes('`x'))?.kind).toBe('string');
    expect(spans.find(span => span.text.includes('b'))?.kind).toBe(null);
});

test('a line too long stays plain, and what follows it is coloured as if it were empty', async () => {
    await loadGrammar('typescript');
    const long = `const a = "${'x'.repeat(3000)}";`;
    const lines = ['/* c */', long, 'const b = 1;'];

    const tokens = tokenizeLines('typescript', lines);

    expect(getSpans(long, tokens, 1)).toEqual([{ text: long, kind: null }]);
    expect(getSpans(lines[2], tokens, 2)[0]).toEqual({ text: 'const', kind: 'keyword' });
});

test('`<script lang="ts">` of a Vue file is TypeScript, and markup a line holds stays text', async () => {
    await loadGrammar('xml');
    const lines = ['<script lang="ts">', 'interface A {}', 'const b = "<img src=x>";', '</script>'];

    const tokens = tokenizeLines('xml', lines);

    expect(getSpans(lines[1], tokens, 1)[0]).toEqual({ text: 'interface', kind: 'keyword' });
    expect(getSpans(lines[2], tokens, 2).find(span => span.text.includes('img'))?.text).toBe('"<img src=x>"');
});

test.each([
    ['python', 'print(1)', 'print', 'builtin'],
    ['xml', '<div>x</div>', 'div', 'tag'],
    ['typescript', 'class A {}', 'A', 'title'],
    ['typescript', 'let a = this;', 'this', 'keyword'],
    ['typescript', 'let a = 1;', 'a', null],
] as const)('%s: in `%s`, %s is %s', async (language, line, word, kind) => {
    await loadGrammar(language);

    const spans = getSpans(line, tokenizeLines(language, [line]), 0);

    expect(spans.find(span => span.text === word)?.kind ?? null).toBe(kind);
});

test('a grammar not there is no error: the file has no tokens', () => {
    expect(tokenizeLines('swift', ['let a = 1'])).toBeNull();
});

function getSpans(text: string | undefined, tokens: LineTokens | null, line: number): LineSpan[] {
    return getLineSpans(text?.replace(/\r$/, '') ?? '', tokens, line);
}

function kindsIn(tokens: LineTokens | null, lines: readonly string[]) {
    return new Set(
        lines.flatMap((line, index) => getSpans(line, tokens, index).map(span => span.kind)).filter(Boolean),
    );
}
