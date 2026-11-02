/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { parseSettings, serializeSettings } from './SettingsDocument.js';
import type { SettingsDocument } from './SettingsDocument.js';

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
