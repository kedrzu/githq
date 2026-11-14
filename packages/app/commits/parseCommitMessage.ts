/** A run of lines the author wrote together; their line breaks are kept. */
export interface CommitMessageParagraph {
    kind: 'paragraph';
    lines: string[];
}

/** A bulleted list; each item is one line, its wrapped continuation lines joined with a space. */
export interface CommitMessageList {
    kind: 'list';
    items: string[];
}

/** The closing `Co-Authored-By: …` / `Signed-off-by: …` lines. */
export interface CommitMessageTrailers {
    kind: 'trailers';
    lines: string[];
}

export type CommitMessageBlock = CommitMessageParagraph | CommitMessageList | CommitMessageTrailers;

const LIST_MARKER = /^[-*+] +/;
const TRAILER = /^[A-Za-z0-9-]+: .+/;

/**
 * Splits a commit message body into paragraphs, bullet lists and a closing trailer block. Nothing is
 * interpreted beyond that, so `#566`, `**x**` and `_x_` stay literal text and every non-blank line lands in a block.
 */
export function parseCommitMessage(body: string): CommitMessageBlock[] {
    const blocks = splitParagraphs(body).map(classifyParagraph);
    const last = blocks.at(-1);
    if (last?.kind === 'paragraph' && last.lines.every(line => TRAILER.test(line))) {
        blocks[blocks.length - 1] = { kind: 'trailers', lines: last.lines };
    }
    return blocks;
}

function splitParagraphs(body: string): string[][] {
    const paragraphs: string[][] = [];
    let current: string[] = [];
    for (const raw of body.split(/\r\n|\r|\n/)) {
        const line = raw.trimEnd();
        if (line.trim() === '') {
            if (current.length > 0) {
                paragraphs.push(current);
            }
            current = [];
        } else {
            current.push(line);
        }
    }
    if (current.length > 0) {
        paragraphs.push(current);
    }
    return paragraphs;
}

function classifyParagraph(lines: string[]): CommitMessageBlock {
    const [first] = lines;
    if (first === undefined || !LIST_MARKER.test(first)) {
        return { kind: 'paragraph', lines };
    }

    const items: string[] = [];
    for (const line of lines) {
        if (LIST_MARKER.test(line)) {
            items.push(line.replace(LIST_MARKER, ''));
        } else {
            items[items.length - 1] = `${items[items.length - 1]} ${line.trim()}`;
        }
    }
    return { kind: 'list', items };
}
