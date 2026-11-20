/// <reference types="bun" />
import { expect, test } from 'bun:test';

import {
    DEFAULT_WORKFLOW_SETTINGS,
    parseSettings,
    readAnimations,
    readMaxWidth,
    readUsageStatistics,
    readOwnerCommitEmail,
    readRefSort,
    readRepositoryCommitEmail,
    readReviewCommentChoice,
    readWorkflowRunsGroupBy,
    readWorkflowSettings,
    serializeSettings,
    writeOwnerCommitEmail,
    writeRefSort,
    writeRepositoryCommitEmail,
    writeWorkflowRunsGroupBy,
    writeWorkflowSettings,
} from './SettingsDocument.js';
import type { WorkflowRunsGroupBy } from '@/workflows/WorkflowTypes.js';

import type {
    MaxWidth,
    RefSort,
    ReviewCommentChoice,
    SettingsDocument,
    SettingsRepository,
} from './SettingsDocument.js';

const DOCUMENT: SettingsDocument = {
    version: 1,
    repositories: [
        { nameWithOwner: 'kedrzu/githq', id: 'R_1', tracking: true },
        { nameWithOwner: 'acme/api', id: 'R_2', tracking: false },
    ],
    projects: [{ id: 'PVT_1', owner: 'kedrzu', ownerKind: 'user', number: 1, title: 'Roadmap', tracking: true }],
};

test('the file is formatted JSON in a stable key order with a trailing newline, and reads back', () => {
    // Keys in another order in memory: the file's order does not depend on it.
    const shuffled: SettingsDocument = {
        projects: DOCUMENT.projects.map(({ tracking, title, number, ownerKind, owner, id }) => ({
            tracking,
            title,
            number,
            ownerKind,
            owner,
            id,
        })),
        repositories: DOCUMENT.repositories.map(({ tracking, id, nameWithOwner }) => ({ tracking, id, nameWithOwner })),
        version: 1,
    };

    const text = serializeSettings(shuffled);
    expect(text).toBe(`{
  "version": 1,
  "repositories": [
    {
      "nameWithOwner": "kedrzu/githq",
      "id": "R_1",
      "tracking": true
    },
    {
      "nameWithOwner": "acme/api",
      "id": "R_2",
      "tracking": false
    }
  ],
  "projects": [
    {
      "id": "PVT_1",
      "owner": "kedrzu",
      "ownerKind": "user",
      "number": 1,
      "title": "Roadmap",
      "tracking": true
    }
  ]
}
`);
    expect(parseSettings(text)).toEqual({ kind: 'ok', document: DOCUMENT });
});

test.each([
    ['not JSON', '{ "version": 1,'],
    ['not an object', '[]'],
    ['no version', JSON.stringify({ repositories: [], projects: [] })],
    ['an older version', JSON.stringify({ version: 0, repositories: [], projects: [] })],
    ['no projects', JSON.stringify({ version: 1, repositories: [] })],
    [
        'an entry without tracking',
        JSON.stringify({ version: 1, repositories: [{ nameWithOwner: 'a/b', id: 'R' }], projects: [] }),
    ],
    [
        'a project of an unknown owner kind',
        JSON.stringify({
            version: 1,
            repositories: [],
            projects: [{ id: 'P', owner: 'a', ownerKind: 'team', number: 1, title: 'T', tracking: true }],
        }),
    ],
    [
        'two entries naming one repository',
        JSON.stringify({
            version: 1,
            repositories: [
                { nameWithOwner: 'a/b', id: 'R', tracking: true },
                { nameWithOwner: 'a/b', id: 'R', tracking: false },
            ],
            projects: [],
        }),
    ],
])('a file with %s is unreadable as a whole', (_, text) => {
    expect(parseSettings(text)).toEqual({ kind: 'unreadable' });
});

test('a file of a higher version is newer, whatever else it holds', () => {
    expect(parseSettings(JSON.stringify({ version: 2, repositories: 'changed', views: [] }))).toEqual({
        kind: 'newer',
        version: 2,
    });
});

test('fields this build does not know are read, and written back after the known ones as they came', () => {
    const text = `{
  "version": 1,
  "repositories": [
    {
      "nameWithOwner": "kedrzu/githq",
      "id": "R_1",
      "tracking": true,
      "workflows": {
        "defaultBranch": false,
        "refs": [
          "v*"
        ]
      }
    }
  ],
  "projects": [],
  "views": []
}
`;
    const parsed = parseSettings(text);

    expect(parsed).toEqual({
        kind: 'ok',
        document: {
            version: 1,
            repositories: [
                {
                    nameWithOwner: 'kedrzu/githq',
                    id: 'R_1',
                    tracking: true,
                    workflows: { defaultBranch: false, refs: ['v*'] },
                },
            ],
            projects: [],
            views: [],
        },
    });
    expect(parsed.kind === 'ok' && serializeSettings(parsed.document)).toBe(text);
});

test('a repository’s workflows setting reads as the default while absent or not understood', () => {
    const entry: SettingsRepository = { nameWithOwner: 'kedrzu/githq', id: 'R_1', tracking: true };

    expect(DEFAULT_WORKFLOW_SETTINGS).toEqual({ defaultBranch: true, refs: [] });
    expect(readWorkflowSettings(undefined)).toEqual(DEFAULT_WORKFLOW_SETTINGS);
    expect(readWorkflowSettings(entry)).toEqual(DEFAULT_WORKFLOW_SETTINGS);
    expect(readWorkflowSettings({ ...entry, workflows: { defaultBranch: 'yes', refs: [] } })).toEqual(
        DEFAULT_WORKFLOW_SETTINGS,
    );
    expect(readWorkflowSettings({ ...entry, workflows: { defaultBranch: false, refs: 'v*' } })).toEqual(
        DEFAULT_WORKFLOW_SETTINGS,
    );
    expect(readWorkflowSettings({ ...entry, workflows: { defaultBranch: false, refs: ['v*'], muted: [] } })).toEqual({
        defaultBranch: false,
        refs: ['v*'],
    });
});

test('writing the workflows setting replaces the value whole, keeps fields a newer githq added to it, and writes nothing unchanged', () => {
    const settings = { defaultBranch: true, refs: ['v*', 'release/*'] };
    const written = writeWorkflowSettings({ document: DOCUMENT, nameWithOwner: 'acme/api', settings });

    expect(written?.repositories).toEqual([
        { nameWithOwner: 'kedrzu/githq', id: 'R_1', tracking: true },
        { nameWithOwner: 'acme/api', id: 'R_2', tracking: false, workflows: settings },
    ]);
    expect(written && writeWorkflowSettings({ document: written, nameWithOwner: 'acme/api', settings })).toBeNull();
    expect(writeWorkflowSettings({ document: DOCUMENT, nameWithOwner: 'acme/web', settings })).toBeNull();

    const newer: SettingsDocument = {
        ...DOCUMENT,
        repositories: [
            { nameWithOwner: 'kedrzu/githq', id: 'R_1', tracking: true, workflows: { muted: ['CLA'], refs: 'v*' } },
        ],
    };
    expect(
        writeWorkflowSettings({ document: newer, nameWithOwner: 'kedrzu/githq', settings })?.repositories[0]?.workflows,
    ).toEqual({ muted: ['CLA'], defaultBranch: true, refs: ['v*', 'release/*'] });
});

test.each<[unknown, boolean]>([
    [false, false],
    [true, true],
    ['a newer build’s value', true],
    [0, true],
])('a file with animations %j is readable, reads as %s and keeps what it holds', (written, reads) => {
    const parsed = parseSettings(JSON.stringify({ ...DOCUMENT, animations: written }));
    if (parsed.kind !== 'ok') {
        throw new Error(`Not read: ${parsed.kind}`);
    }

    expect(readAnimations(parsed.document)).toBe(reads);
    expect(JSON.parse(serializeSettings(parsed.document))).toEqual({ ...DOCUMENT, animations: written });
});

test.each<[unknown, boolean]>([
    [false, false],
    [true, true],
    ['a newer build’s value', true],
    [0, true],
])('a file with usageStatistics %j is readable, reads as %s and keeps what it holds', (written, reads) => {
    const parsed = parseSettings(JSON.stringify({ ...DOCUMENT, usageStatistics: written }));
    if (parsed.kind !== 'ok') {
        throw new Error(`Not read: ${parsed.kind}`);
    }

    expect(readUsageStatistics(parsed.document)).toBe(reads);
    expect(JSON.parse(serializeSettings(parsed.document))).toEqual({ ...DOCUMENT, usageStatistics: written });
});

test.each<[unknown, ReviewCommentChoice]>([
    ['draft', 'draft'],
    ['a newer build’s way', 'single'],
    [7, 'single'],
])('a file with the comment choice %j is readable, reads as %s and keeps what it holds', (written, reads) => {
    const parsed = parseSettings(JSON.stringify({ ...DOCUMENT, reviewCommentChoice: written }));
    if (parsed.kind !== 'ok') {
        throw new Error(`Not read: ${parsed.kind}`);
    }

    expect(readReviewCommentChoice(parsed.document)).toBe(reads);
    expect(JSON.parse(serializeSettings(parsed.document))).toEqual({ ...DOCUMENT, reviewCommentChoice: written });
});

test.each<[unknown, RefSort]>([
    [undefined, { branches: 'newest', tags: 'newest' }],
    [
        { branches: 'name', tags: 'name' },
        { branches: 'name', tags: 'name' },
    ],
    // Each group on its own: one not understood reads as newest first, the other as written.
    [
        { branches: 'name', tags: 'by-semver' },
        { branches: 'name', tags: 'newest' },
    ],
    [{ tags: 'name' }, { branches: 'newest', tags: 'name' }],
    ['name', { branches: 'newest', tags: 'newest' }],
    [[], { branches: 'newest', tags: 'newest' }],
])('a file with the ref sort %j is readable, reads as %j and keeps what it holds', (written, reads) => {
    const parsed = parseSettings(JSON.stringify({ ...DOCUMENT, refSort: written }));
    if (parsed.kind !== 'ok') {
        throw new Error(`Not read: ${parsed.kind}`);
    }

    expect(readRefSort(parsed.document)).toEqual(reads);
    expect(JSON.parse(serializeSettings(parsed.document))).toEqual({ ...DOCUMENT, refSort: written });
});

test("a group's order is written over what else the ref sort holds, the rest of the document as it was", () => {
    const document: SettingsDocument = {
        ...DOCUMENT,
        reviewCommentChoice: 'draft',
        refSort: { tags: 'by-semver', pinned: ['main'] },
    };

    const written = writeRefSort({ document, group: 'branches', order: 'name' });

    const expected: SettingsDocument = {
        ...document,
        refSort: { tags: 'by-semver', pinned: ['main'], branches: 'name' },
    };
    expect(written).toEqual(expected);
});

test('an order the group reads as already writes nothing, so a value not understood stays until the user picks the other', () => {
    expect(writeRefSort({ document: DOCUMENT, group: 'branches', order: 'newest' })).toBeNull();
    const newer: SettingsDocument = { ...DOCUMENT, refSort: { branches: 'by-semver' } };
    expect(writeRefSort({ document: newer, group: 'branches', order: 'newest' })).toBeNull();
    expect(writeRefSort({ document: newer, group: 'branches', order: 'name' })).toEqual({
        ...DOCUMENT,
        refSort: { branches: 'name' },
    });
});

test.each<[unknown, MaxWidth | null]>([
    [1200, 1200],
    ['full', 'full'],
    [undefined, null],
    [0, null],
    [-5, null],
    // Pixels are whole: a fractional width is not understood rather than rounded, so it stays as written.
    [12.5, null],
    ['wide', null],
    ['1200', null],
])('a file with the item page width %j is readable, reads as %j and keeps what it holds', (written, reads) => {
    const parsed = parseSettings(JSON.stringify({ ...DOCUMENT, itemPageWidth: written, reviewDiffWidth: written }));
    if (parsed.kind !== 'ok') {
        throw new Error(`Not read: ${parsed.kind}`);
    }

    expect(readMaxWidth(parsed.document.itemPageWidth)).toBe(reads);
    expect(readMaxWidth(parsed.document.reviewDiffWidth)).toBe(reads);
    expect(JSON.parse(serializeSettings(parsed.document))).toEqual({
        ...DOCUMENT,
        itemPageWidth: written,
        reviewDiffWidth: written,
    });
});

test.each<[unknown, WorkflowRunsGroupBy]>([
    [{ groupBy: 'ref' }, 'ref'],
    [undefined, 'none'],
    [{ groupBy: 'week' }, 'none'],
    [{}, 'none'],
    ['ref', 'none'],
])('a file with the runs grouping %j is readable, reads as %s and keeps what it holds', (written, reads) => {
    const parsed = parseSettings(JSON.stringify({ ...DOCUMENT, workflowRuns: written }));
    if (parsed.kind !== 'ok') {
        throw new Error(`Not read: ${parsed.kind}`);
    }

    expect(readWorkflowRunsGroupBy(parsed.document)).toBe(reads);
    expect(JSON.parse(serializeSettings(parsed.document))).toEqual({ ...DOCUMENT, workflowRuns: written });
});

test('writing the runs grouping keeps the keys a newer build put beside it, and writes nothing when it reads as that already', () => {
    const document: SettingsDocument = { ...DOCUMENT, workflowRuns: { groupBy: 'week', collapsed: true } };

    expect(writeWorkflowRunsGroupBy(document, 'none')).toBeNull();
    const written = writeWorkflowRunsGroupBy(document, 'status');
    expect(written?.workflowRuns).toEqual({ groupBy: 'status', collapsed: true });
    expect(written?.version).toBe(1);
    expect(written && writeWorkflowRunsGroupBy(written, 'status')).toBeNull();
});

test('an untouched document with commit emails serialises byte-identically and keeps what it holds', () => {
    const text = `${JSON.stringify(
        {
            ...DOCUMENT,
            repositories: [{ ...GITHQ, commitEmail: null, future: 1 }, API],
            refSort: { branches: 'name' },
            commitEmails: { Acme: 'me@work.test', other: 7 },
            futureField: true,
        },
        null,
        2,
    )}\n`;

    const parsed = parseSettings(text);

    expect(parsed.kind === 'ok' && serializeSettings(parsed.document)).toBe(text);
});

test('an owner reads without regard to case; absent or a value not understood reads as GitHub default', () => {
    const document: SettingsDocument = { ...DOCUMENT, commitEmails: { Acme: 'me@work.test', odd: 7, empty: '' } };

    expect(readOwnerCommitEmail(document, 'acme')).toBe('me@work.test');
    expect(readOwnerCommitEmail(document, 'odd')).toBeNull();
    expect(readOwnerCommitEmail(document, 'empty')).toBeNull();
    expect(readOwnerCommitEmail(DOCUMENT, 'acme')).toBeNull();
    expect(readOwnerCommitEmail({ ...DOCUMENT, commitEmails: ['x'] }, 'acme')).toBeNull();
});

test("an owner's email replaces a key in another case, with the given spelling, and keeps the other keys", () => {
    const document: SettingsDocument = { ...DOCUMENT, commitEmails: { ACME: 'a@x.test', odd: 7 } };

    expect(writeOwnerCommitEmail({ document, owner: 'acme', email: 'b@x.test' })).toEqual({
        ...DOCUMENT,
        commitEmails: { odd: 7, acme: 'b@x.test' },
    });
});

test("GitHub's default removes the owner's key, and the map once it is empty; reading as it already writes nothing", () => {
    const document: SettingsDocument = { ...DOCUMENT, commitEmails: { Acme: 'a@x.test', other: 'o@x.test' } };

    expect(writeOwnerCommitEmail({ document, owner: 'acme', email: null })).toEqual({
        ...DOCUMENT,
        commitEmails: { other: 'o@x.test' },
    });
    expect(
        writeOwnerCommitEmail({
            document: { ...DOCUMENT, commitEmails: { Acme: 'a@x.test' } },
            owner: 'acme',
            email: null,
        }),
    ).toEqual(DOCUMENT);
    expect(writeOwnerCommitEmail({ document: DOCUMENT, owner: 'acme', email: null })).toBeNull();
    expect(writeOwnerCommitEmail({ document, owner: 'acme', email: 'a@x.test' })).toBeNull();
    const newer: SettingsDocument = { ...DOCUMENT, commitEmails: { acme: { by: 'newer' } } };
    expect(writeOwnerCommitEmail({ document: newer, owner: 'acme', email: null })).toBeNull();
});

test.each<[unknown, string | null | undefined]>([
    [undefined, undefined],
    [null, null],
    ['me@work.test', 'me@work.test'],
    [7, undefined],
    ['', undefined],
    [{ by: 'newer' }, undefined],
])('a repository with commitEmail %j reads as %j', (written, reads) => {
    expect(readRepositoryCommitEmail({ ...GITHQ, commitEmail: written })).toBe(reads);
    expect(readRepositoryCommitEmail(undefined)).toBeUndefined();
});

test('the repository choice is written in its entry only, inherit removes the key, no entry or no change writes nothing', () => {
    const nameWithOwner = 'kedrzu/githq';
    const set = writeRepositoryCommitEmail({ document: DOCUMENT, nameWithOwner, email: 'me@work.test' });
    expect(set?.repositories).toEqual([{ ...GITHQ, commitEmail: 'me@work.test' }, API]);
    const github = writeRepositoryCommitEmail({ document: DOCUMENT, nameWithOwner, email: null });
    expect(github?.repositories[0]?.commitEmail).toBeNull();
    expect(set && writeRepositoryCommitEmail({ document: set, nameWithOwner, email: undefined })).toEqual(DOCUMENT);
    expect(writeRepositoryCommitEmail({ document: DOCUMENT, nameWithOwner, email: undefined })).toBeNull();
    expect(set && writeRepositoryCommitEmail({ document: set, nameWithOwner, email: 'me@work.test' })).toBeNull();
    expect(writeRepositoryCommitEmail({ document: DOCUMENT, nameWithOwner: 'x/none', email: null })).toBeNull();
});

const GITHQ: SettingsRepository = { nameWithOwner: 'kedrzu/githq', id: 'R_1', tracking: true };
const API: SettingsRepository = { nameWithOwner: 'acme/api', id: 'R_2', tracking: false };
