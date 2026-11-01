import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRestRequester } from '../rest/createGitHubRestRequester.js';
import { readSettingsFile } from './readSettingsFile.js';
import { writeSettingsFile } from './writeSettingsFile.js';

test('a file written is read back as the same text, beyond ASCII too', async () => {
    const text = '{\n  "title": "Plán — 計画"\n}\n';
    let sent: unknown;
    let written = '';
    const writer = restAnswering(init => {
        sent = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
        written = isPlainObject(sent) && typeof sent.content === 'string' ? sent.content : '';
        return Response.json({ content: { sha: 'new' } }, { status: 201 });
    });

    expect(await writeSettingsFile(writer, { owner: 'kedrzu', text, sha: 'old' })).toEqual({
        kind: 'written',
        sha: 'new',
    });
    expect(sent).toMatchObject({ message: 'Save githq settings', sha: 'old' });

    // GitHub breaks the content into lines.
    const content = written.replaceAll(/(.{8})/g, '$1\n');
    const reader = restAnswering(() =>
        Response.json({ encoding: 'base64', content, sha: 'new' }, { headers: { etag: '"new"' } }),
    );
    expect(await readSettingsFile(reader, { owner: 'kedrzu', etag: null })).toEqual({
        status: 200,
        text,
        sha: 'new',
        etag: '"new"',
    });
});

test.each([
    [409, 'settings.json does not match abc'],
    [422, '"sha" wasn\'t supplied.'],
])('a write GitHub refuses with %i is a conflict', async (status, message) => {
    const rest = restAnswering(() => Response.json({ message }, { status }));

    expect(await writeSettingsFile(rest, { owner: 'kedrzu', text: '{}\n', sha: null })).toEqual({ kind: 'conflict' });
});

function restAnswering(answer: (init: RequestInit | undefined) => Response) {
    const fetch: Fetch = (_, init) => Promise.resolve(answer(init));
    return createGitHubRestRequester({ getToken: () => 'token', fetch });
}
