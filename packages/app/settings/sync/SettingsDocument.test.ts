/// <reference types="bun" />
import { expect, test } from 'bun:test';

import {
    DEFAULT_WORKFLOW_SETTINGS,
    parseSettings,
    readAnimations,
    readRepositoryLayout,
    readReviewCommentChoice,
    readWorkflowSettings,
    serializeSettings,
    writeWorkflowSettings,
} from './SettingsDocument.js';
import type {
    RepositoryLayout,
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

test.each<[unknown, RepositoryLayout]>([
    ['column', 'column'],
    ['a newer build’s layout', 'tabs'],
    [7, 'tabs'],
])('a file with the layout %j is readable, reads as %s and keeps what it holds', (written, reads) => {
    const parsed = parseSettings(JSON.stringify({ ...DOCUMENT, repositoryLayout: written }));
    if (parsed.kind !== 'ok') {
        throw new Error(`Not read: ${parsed.kind}`);
    }

    expect(readRepositoryLayout(parsed.document)).toBe(reads);
    expect(JSON.parse(serializeSettings(parsed.document))).toEqual({ ...DOCUMENT, repositoryLayout: written });
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
