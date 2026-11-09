import { expect, test } from 'bun:test';

import { applyMarkdownTool } from './applyMarkdownTool.js';
import type { MarkdownTool, TextRange } from './applyMarkdownTool.js';

/** The text after the tool, with `[` `]` around what ends up selected (one `|` for a caret). */
function run(text: string, selection: TextRange, tool: MarkdownTool) {
    const edit = applyMarkdownTool(text, selection, tool);
    const result = text.slice(0, edit.range.start) + edit.insert + text.slice(edit.range.end);
    const { start, end } = edit.selection;
    return start === end
        ? `${result.slice(0, start)}|${result.slice(start)}`
        : `${result.slice(0, start)}[${result.slice(start, end)}]${result.slice(end)}`;
}

test('bold, italic and code wrap the selection and keep it selected; with nothing selected the caret goes between', () => {
    expect(run('a fix here', { start: 2, end: 5 }, 'bold')).toBe('a **[fix]** here');
    expect(run('a fix here', { start: 2, end: 5 }, 'italic')).toBe('a _[fix]_ here');
    expect(run('a fix here', { start: 2, end: 5 }, 'code')).toBe('a `[fix]` here');
    expect(run('a ', { start: 2, end: 2 }, 'bold')).toBe('a **|**');
});

test('code over several lines becomes a code block', () => {
    expect(run('one\ntwo', { start: 0, end: 7 }, 'code')).toBe('```\n[one\ntwo]\n```');
});

test('a link takes the selection as its text and selects the address to type over it; with nothing selected, the caret goes in its text', () => {
    expect(run('see docs', { start: 4, end: 8 }, 'link')).toBe('see [docs]([url])');
    expect(run('see ', { start: 4, end: 4 }, 'link')).toBe('see [|](url)');
});

test('lists, quote and heading start every line the selection touches, the first line from its start', () => {
    expect(run('intro\none\ntwo', { start: 8, end: 12 }, 'bulletList')).toBe('intro\n[- one\n- two]');
    expect(run('one\ntwo\n', { start: 0, end: 8 }, 'numberedList')).toBe('[1. one\n2. two]\n');
    expect(run('one', { start: 1, end: 1 }, 'taskList')).toBe('- [ ] o|ne');
    expect(run('a\nb', { start: 2, end: 2 }, 'quote')).toBe('a\n> |b');
    expect(run('Title', { start: 5, end: 5 }, 'heading')).toBe('### Title|');
});

test('@ and # are typed over the selection', () => {
    expect(run('hi ', { start: 3, end: 3 }, 'mention')).toBe('hi @|');
    expect(run('see 12', { start: 4, end: 6 }, 'reference')).toBe('see #|');
});
