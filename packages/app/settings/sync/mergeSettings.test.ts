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

function documentOf(repositories: SettingsRepository[], projects: SettingsProject[]): SettingsDocument {
    return { version: 1, repositories, projects };
}

function untracked(repository: SettingsRepository): SettingsRepository {
    return { ...repository, tracking: false };
}
