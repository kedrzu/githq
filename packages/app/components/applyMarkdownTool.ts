import { assertNever } from '@nzyme/utils/assertNever.js';

/** A tool of the Markdown editor's head, in the order drawn. */
export type MarkdownTool =
    | 'heading'
    | 'bold'
    | 'italic'
    | 'code'
    | 'link'
    | 'bulletList'
    | 'numberedList'
    | 'taskList'
    | 'quote'
    | 'mention'
    | 'reference';

/** The part of a text an edit works on: the selection, or the caret where `start` equals `end`. */
export interface TextRange {
    start: number;
    end: number;
}

/** What a tool does: `range` of the text replaced by `insert`, then `selection` selected in the new text. */
export interface MarkdownEdit {
    range: TextRange;
    insert: string;
    selection: TextRange;
}

/**
 * What a Markdown tool does to the text at `selection`: bold, italic and code wrap it (a selection over several lines
 * goes in a code block), link makes it a link's text and selects `url`, the list, quote and heading tools start each
 * line it touches, and @ and # are typed over it. Returned as a replacement rather than the new text, so the text area
 * applies it as typing and its undo history keeps it.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function applyMarkdownTool(text: string, selection: TextRange, tool: MarkdownTool): MarkdownEdit {
    const selected = text.slice(selection.start, selection.end);
    switch (tool) {
        case 'bold':
            return wrap(selection, selected, '**');
        case 'italic':
            return wrap(selection, selected, '_');
        case 'code':
            return selected.includes('\n')
                ? wrap(selection, selected, '```\n', '\n```')
                : wrap(selection, selected, '`');
        case 'link': {
            const insert = `[${selected}](url)`;
            // Nothing selected: the caret goes where the link's text is typed; else `url` is selected, to be typed over.
            const at = selected ? selection.start + selected.length + 3 : selection.start + 1;
            return { range: selection, insert, selection: { start: at, end: selected ? at + 3 : at } };
        }
        case 'mention':
            return typeOver(selection, '@');
        case 'reference':
            return typeOver(selection, '#');
        case 'heading':
            return startLines(text, selection, () => '### ');
        case 'bulletList':
            return startLines(text, selection, () => '- ');
        case 'numberedList':
            return startLines(text, selection, index => `${index + 1}. `);
        case 'taskList':
            return startLines(text, selection, () => '- [ ] ');
        case 'quote':
            return startLines(text, selection, () => '> ');
        default:
            return assertNever(tool);
    }
}

function wrap(selection: TextRange, selected: string, before: string, after = before): MarkdownEdit {
    const start = selection.start + before.length;
    return {
        range: selection,
        insert: before + selected + after,
        selection: { start, end: start + selected.length },
    };
}

function typeOver(selection: TextRange, insert: string): MarkdownEdit {
    const at = selection.start + insert.length;
    return { range: selection, insert, selection: { start: at, end: at } };
}

function startLines(text: string, selection: TextRange, prefix: (index: number) => string): MarkdownEdit {
    const start = text.lastIndexOf('\n', selection.start - 1) + 1;
    // A selection ending right after a line break ends on the line before it.
    const last =
        selection.end > selection.start && text[selection.end - 1] === '\n' ? selection.end - 1 : selection.end;
    const lineEnd = text.indexOf('\n', last);
    const end = lineEnd === -1 ? text.length : lineEnd;

    const insert = text
        .slice(start, end)
        .split('\n')
        .map((line, index) => prefix(index) + line)
        .join('\n');

    if (selection.start === selection.end) {
        const at = selection.start + prefix(0).length;
        return { range: { start, end }, insert, selection: { start: at, end: at } };
    }

    return { range: { start, end }, insert, selection: { start, end: start + insert.length } };
}
