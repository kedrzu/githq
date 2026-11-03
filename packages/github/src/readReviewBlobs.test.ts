import type { Fetch } from '@nzyme/types/Fetch.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';
import { expect, test } from 'bun:test';

import { createGitHubRequester } from './createGitHubRequester.js';
import { readReviewBlobOids, readReviewBlobTexts } from './readReviewBlobs.js';
import type { ReviewBlobOidAnswer, ReviewBlobTextAnswer } from './readReviewBlobs.js';

const REPOSITORY = { owner: 'kedrzu', name: 'githq' };

test('a path travels only as a variable, whatever it holds', async () => {
    const path = 'head:src/"quoted" $e1 \\ {}\n.ts';
    const github = answering({ data: { repository: { b0: { oid: 'abc', byteSize: 3, isBinary: false } } } });

    await readReviewBlobOids(github.requester, REPOSITORY, [path]);

    const [sent] = github.bodies;
    expect(sent?.variables).toEqual({ owner: 'kedrzu', name: 'githq', e0: path });
    expect(sent?.query).not.toContain('quoted');
    expect(sent?.query).toMatch(/^query ReviewBlobOids\(/);
    expect(sent?.query).toContain('b0: object(expression: $e0) { ... on Blob { oid byteSize isBinary } }');
});

test('oids: a blob, nothing, something else and a failed one are told apart', async () => {
    const github = answering({
        data: {
            repository: {
                b0: { oid: 'abc', byteSize: 3, isBinary: null },
                b1: null,
                b2: {},
                b3: null,
            },
        },
        errors: [{ type: 'SERVICE_UNAVAILABLE', message: 'Try later', path: ['repository', 'b3'] }],
    });

    const answers = await readReviewBlobOids(github.requester, REPOSITORY, ['h:a', 'h:b', 'h:c', 'h:d']);

    const expected: Partial<Record<string, ReviewBlobOidAnswer>> = {
        'h:a': { kind: 'blob', oid: 'abc', byteSize: 3, isBinary: false },
        'h:b': { kind: 'missing' },
        'h:c': { kind: 'notBlob' },
    };
    for (const [expression, answer] of Object.entries(expected)) {
        expect(answers.get(expression)).toEqual(answer);
    }

    expect(answers.get('h:d')).toMatchObject({
        kind: 'failed',
        error: { errors: [{ type: 'SERVICE_UNAVAILABLE', message: 'Try later' }] },
    });
});

test('texts: a truncated blob gives no text at all; binary and failed ones are told apart', async () => {
    const github = answering({
        data: {
            repository: {
                b0: { oid: 'a', text: 'whole', isTruncated: false, isBinary: false, byteSize: 5 },
                b1: { oid: 'b', text: 'cut of', isTruncated: true, isBinary: false, byteSize: 928861 },
                b2: { oid: 'c', text: null, isTruncated: false, isBinary: true, byteSize: 9 },
                b3: { oid: 'd', text: null, isTruncated: false, isBinary: null, byteSize: 9 },
                b4: { oid: 'e', text: '', isTruncated: false, isBinary: false, byteSize: 0 },
                b5: null,
            },
        },
    });

    const answers = await readReviewBlobTexts(github.requester, REPOSITORY, ['a', 'b', 'c', 'd', 'e', 'f']);

    const expected: Partial<Record<string, ReviewBlobTextAnswer>> = {
        a: { kind: 'text', text: 'whole' },
        b: { kind: 'truncated' },
        c: { kind: 'binary' },
        d: { kind: 'binary' },
        e: { kind: 'text', text: '' },
    };
    for (const [oid, answer] of Object.entries(expected)) {
        expect(answers.get(oid)).toEqual(answer);
    }

    expect(answers.get('f')?.kind).toBe('failed');
    expect(github.bodies[0]?.query).toContain('b0: object(oid: $o0)');
    expect(github.bodies[0]?.query).toContain('$o0: GitObjectID!');
});

test('a repository GitHub would not give fails the whole query', async () => {
    const github = answering({
        data: { repository: null },
        errors: [{ type: 'NOT_FOUND', message: 'Could not resolve', path: ['repository'] }],
    });

    await expect(readReviewBlobOids(github.requester, REPOSITORY, ['h:a'])).rejects.toMatchObject({
        name: 'GitHubApiError',
        errors: [{ type: 'NOT_FOUND', message: 'Could not resolve', path: ['repository'] }],
    });
});

interface SentBody {
    readonly query: unknown;
    readonly variables: unknown;
}

function answering(answer: unknown) {
    const bodies: SentBody[] = [];
    const fetch: Fetch = (_, init) => {
        const body: unknown = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        if (isPlainObject(body)) {
            bodies.push({ query: body.query, variables: body.variables });
        }

        return Promise.resolve(Response.json(answer));
    };

    return { bodies, requester: createGitHubRequester({ getToken: () => 'gho_token', fetch }) };
}
