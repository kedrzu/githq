import { expect, test } from 'bun:test';

import { parseCommitMessage } from './parseCommitMessage.js';
import type { CommitMessageBlock } from './parseCommitMessage.js';

test('a squash message keeps its bullets whole when they wrap onto unindented lines', () => {
    const body = [
        '* Add the ref list folders so that a long',
        'branch name wraps',
        '* Remember what was unfolded',
        '  per repository',
        '',
        'Co-authored-by: Ann <ann@example.com>',
    ].join('\n');

    const expected: CommitMessageBlock[] = [
        {
            kind: 'list',
            items: [
                'Add the ref list folders so that a long branch name wraps',
                'Remember what was unfolded per repository',
            ],
        },
        { kind: 'trailers', lines: ['Co-authored-by: Ann <ann@example.com>'] },
    ];
    expect(parseCommitMessage(body)).toEqual(expected);
});

test('dash and plus lists become lists, paragraphs keep their line breaks', () => {
    const expected: CommitMessageBlock[] = [
        { kind: 'paragraph', lines: ['First line', 'second line'] },
        { kind: 'list', items: ['one', 'two'] },
        { kind: 'list', items: ['three'] },
    ];
    expect(parseCommitMessage('First line\nsecond line\n\n- one\n- two\n\n+ three')).toEqual(expected);
});

test('only the last paragraph can be trailers, and only when every line has the trailer shape', () => {
    const expected: CommitMessageBlock[] = [
        { kind: 'paragraph', lines: ['Fixes: #1', 'Signed-off-by: Bob <b@example.com>'] },
        { kind: 'paragraph', lines: ['Closing words', 'Signed-off-by: Bob <b@example.com>'] },
    ];
    expect(
        parseCommitMessage(
            'Fixes: #1\nSigned-off-by: Bob <b@example.com>\n\nClosing words\nSigned-off-by: Bob <b@example.com>',
        ),
    ).toEqual(expected);
});

test('a paragraph that looks like trailers in the middle stays a paragraph', () => {
    const expected: CommitMessageBlock[] = [
        { kind: 'paragraph', lines: ['Reviewed-by: Ann <a@example.com>'] },
        { kind: 'paragraph', lines: ['The end'] },
    ];
    expect(parseCommitMessage('Reviewed-by: Ann <a@example.com>\n\nThe end')).toEqual(expected);
});

test('references and Markdown stay literal text', () => {
    const expected: CommitMessageBlock[] = [
        { kind: 'paragraph', lines: ['See #566 and **x** and _x_ and <b>y</b>'] },
        { kind: 'list', items: ['**bold** #566 _x_'] },
    ];
    expect(parseCommitMessage('See #566 and **x** and _x_ and <b>y</b>\n\n- **bold** #566 _x_')).toEqual(expected);
});

test('CRLF, leading and trailing blank lines, and an empty body', () => {
    const expected: CommitMessageBlock[] = [
        { kind: 'paragraph', lines: ['a', 'b'] },
        { kind: 'paragraph', lines: ['c'] },
    ];
    expect(parseCommitMessage('\r\n\r\na\r\nb\r\n\r\n\r\nc\r\n\r\n')).toEqual(expected);
    expect(parseCommitMessage('')).toEqual([]);
    expect(parseCommitMessage(' \n\n')).toEqual([]);
});

test('every non-blank line ends up in some block', () => {
    const body = 'a\nb\n\n- c\nd\n- e\n\nf: g';
    const texts = parseCommitMessage(body).flatMap(block => (block.kind === 'list' ? block.items : block.lines));
    expect(texts.join(' ')).toBe('a b c d e f: g');
});
