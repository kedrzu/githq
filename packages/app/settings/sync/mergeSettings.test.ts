/// <reference types="bun" />
import { expect, test } from 'bun:test';

import { mergeSettings } from './mergeSettings.js';
import { EMPTY_SETTINGS_DOCUMENT } from './SettingsDocument.js';
import type { SettingsDocument, SettingsProject, SettingsRepository } from './SettingsDocument.js';

const WEB: SettingsRepository = { nameWithOwner: 'acme/web', id: 'R_web', tracking: true };
const API: SettingsRepository = { nameWithOwner: 'acme/api', id: 'R_api', tracking: true };
const DOCS: SettingsRepository = { nameWithOwner: 'acme/docs', id: 'R_docs', tracking: true };
const CLI: SettingsRepository = { nameWithOwner: 'acme/cli', id: 'R_cli', tracking: true };
const ROADMAP: SettingsProject = {
    id: 'PVT_1',
    owner: 'acme',
    ownerKind: 'org',
    number: 1,
    title: 'Roadmap',
    tracking: true,
};

test('a key only one side changed takes that side’s value; one both changed takes the file’s', () => {
    const base = documentOf([WEB, API, DOCS], [ROADMAP]);
    const local = documentOf(
        [untracked(WEB), API, untracked(DOCS)],
        [{ ...ROADMAP, title: 'Roadmap (here)', tracking: false }],
    );
    const remote = documentOf(
        [WEB, untracked(API), { ...DOCS, tracking: true, id: 'R_docs2' }],
        [{ ...ROADMAP, title: 'Plan' }],
    );

    expect(mergeSettings({ local, remote, base })).toEqual(
        documentOf(
            // web: only here; api: only there; docs: tracking only here, id only there.
            [untracked(WEB), untracked(API), { ...DOCS, id: 'R_docs2', tracking: false }],
            // title changed on both: the file's; tracking only here.
            [{ ...ROADMAP, title: 'Plan', tracking: false }],
        ),
    );
});

test('both sides changing a key to the same value agree, and the file wins a real conflict', () => {
    const base = documentOf([WEB], []);
    const local = documentOf([untracked(WEB)], []);

    expect(mergeSettings({ local, remote: local, base })).toEqual(local);
    expect(
        mergeSettings({
            local: documentOf([{ ...WEB, id: 'R_here' }], []),
            remote: documentOf([{ ...WEB, id: 'R_there' }], []),
            base,
        }),
    ).toEqual(documentOf([{ ...WEB, id: 'R_there' }], []));
});

test('entries new on either side are kept: the file’s order, then this device’s new ones in its order', () => {
    const base = documentOf([WEB], []);
    const local = documentOf([CLI, WEB, DOCS], [ROADMAP]);
    const remote = documentOf([API, WEB], []);

    expect(mergeSettings({ local, remote, base })).toEqual(documentOf([API, WEB, CLI, DOCS], [ROADMAP]));
});

test('an entry new on both sides is the file’s', () => {
    const local = documentOf([API], []);
    const remote = documentOf([untracked(API)], []);

    expect(mergeSettings({ local, remote, base: documentOf([], []) })).toEqual(remote);
});

test('nothing is removed: an entry deleted from the file by hand stays as this device has it', () => {
    const base = documentOf([WEB, API], [ROADMAP]);
    const local = documentOf([WEB, untracked(API)], [ROADMAP]);
    const remote = documentOf([WEB], []);

    expect(mergeSettings({ local, remote, base })).toEqual(documentOf([WEB, untracked(API)], [ROADMAP]));
});

test('an entry missing here but in the file stays the file’s', () => {
    const base = documentOf([WEB, API], []);

    expect(mergeSettings({ local: documentOf([WEB], []), remote: base, base })).toEqual(base);
});

test('first contact (D9) combines the tracked lists, and what the file untracked ends untracked here', () => {
    const local = documentOf([WEB, API], []);
    const remote = documentOf([untracked(API), DOCS], [ROADMAP]);

    expect(mergeSettings({ local, remote, base: EMPTY_SETTINGS_DOCUMENT })).toEqual(
        documentOf([untracked(API), DOCS, WEB], [ROADMAP]),
    );
});

test('a write whose answer was lost merges to no change', () => {
    const base = documentOf([WEB], []);
    const written = documentOf([WEB, API], [ROADMAP]);

    expect(mergeSettings({ local: written, remote: written, base })).toEqual(written);
});

test('fields this build does not know merge key by key like the known ones, and one removed on a side stays removed', () => {
    const base = { ...documentOf([{ ...WEB, workflows: { refs: ['v*'] }, color: 'red' }], []), views: [] };
    const local = {
        ...documentOf([{ ...WEB, workflows: { refs: ['v*', 'release/*'] }, color: 'red' }], []),
        views: [],
    };
    const remote = { ...documentOf([{ ...WEB, workflows: { refs: ['v*'] } }], []), views: ['mine'] };

    expect(mergeSettings({ local, remote, base })).toEqual({
        ...documentOf([{ ...WEB, workflows: { refs: ['v*', 'release/*'] } }], []),
        views: ['mine'],
    });
});

test('commit emails merge per D11: the owner map as one value, a repository’s choice key by key, a removal staying removed', () => {
    const base = { ...documentOf([WEB, { ...API, commitEmail: 'a@x.test' }], []), commitEmails: { acme: 'w@x.test' } };
    // Here: GitHub's default for web, API back to inheriting, the owner's choice removed.
    const { commitEmails: _removed, ...withoutOwners } = base;
    const local = { ...withoutOwners, repositories: [{ ...WEB, commitEmail: null }, API] };
    // There: a choice for docs-owner's map only.
    const remote = { ...base, commitEmails: { acme: 'w@x.test', other: 'o@x.test' } };

    // The owner map changed only there (here it was removed): both sides changed, so the file's value wins.
    expect(mergeSettings({ local, remote, base })).toEqual({
        ...documentOf([{ ...WEB, commitEmail: null }, API], []),
        commitEmails: { acme: 'w@x.test', other: 'o@x.test' },
    });
});

test('a reorder made only here is kept, with the entries new in the file last', () => {
    const base = documentOf([WEB, API, DOCS], []);
    const local = documentOf([DOCS, WEB, API], []);

    expect(mergeSettings({ local, remote: base, base })).toEqual(local);
    expect(mergeSettings({ local, remote: documentOf([WEB, CLI, API, DOCS], []), base })).toEqual(
        documentOf([DOCS, WEB, API, CLI], []),
    );
});

test('a reorder made only here keeps an entry only this device has in its place, and still merges fields', () => {
    const base = documentOf([WEB, API], []);
    const local = documentOf([API, CLI, untracked(WEB)], []);
    const remote = documentOf([WEB, { ...API, id: 'R_api2' }], []);

    expect(mergeSettings({ local, remote, base })).toEqual(
        documentOf([{ ...API, id: 'R_api2' }, CLI, untracked(WEB)], []),
    );
});

test('a reorder made on both sides takes the file’s order', () => {
    const base = documentOf([WEB, API, DOCS], []);
    const local = documentOf([DOCS, WEB, API], []);
    const remote = documentOf([API, DOCS, WEB], []);

    expect(mergeSettings({ local, remote, base })).toEqual(remote);
});

test('an order only the file changed is the file’s', () => {
    const base = documentOf([WEB, API], []);
    const remote = documentOf([API, WEB], []);

    expect(mergeSettings({ local: base, remote, base })).toEqual(remote);
});

function documentOf(repositories: SettingsRepository[], projects: SettingsProject[]): SettingsDocument {
    return { version: 1, repositories, projects };
}

function untracked(repository: SettingsRepository): SettingsRepository {
    return { ...repository, tracking: false };
}
