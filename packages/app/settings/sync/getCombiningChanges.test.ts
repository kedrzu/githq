import { expect, test } from 'bun:test';

import { getCombiningChanges } from './getCombiningChanges.js';
import type { SettingsDocument } from './SettingsDocument.js';

test('names what starts being tracked here, what the file gains, and what the file untracks here', () => {
    const local: SettingsDocument = {
        version: 1,
        repositories: [
            { nameWithOwner: 'mlaine/tasklet', id: 'R_1', tracking: true },
            { nameWithOwner: 'mlaine/dotfiles', id: 'R_2', tracking: true },
            { nameWithOwner: 'acme/api', id: 'R_3', tracking: true },
            { nameWithOwner: 'acme/old', id: 'R_4', tracking: false },
        ],
        projects: [],
    };
    const remote: SettingsDocument = {
        version: 1,
        repositories: [
            { nameWithOwner: 'mlaine/tasklet', id: 'R_1', tracking: true },
            { nameWithOwner: 'acme/api', id: 'R_3', tracking: false },
            { nameWithOwner: 'fitloop/mobile', id: 'R_5', tracking: true },
            { nameWithOwner: 'acme/old', id: 'R_4', tracking: true },
        ],
        projects: [
            { id: 'PVT_1', owner: 'mlaine', ownerKind: 'user', number: 1, title: 'Docs revamp', tracking: true },
        ],
    };

    expect(getCombiningChanges(local, remote)).toEqual({
        download: [
            { target: { kind: 'repository', nameWithOwner: 'fitloop/mobile' }, name: 'fitloop/mobile' },
            { target: { kind: 'repository', nameWithOwner: 'acme/old' }, name: 'acme/old' },
            { target: { kind: 'project', id: 'PVT_1' }, name: 'Docs revamp' },
        ],
        saved: [{ target: { kind: 'repository', nameWithOwner: 'mlaine/dotfiles' }, name: 'mlaine/dotfiles' }],
        untracked: [{ target: { kind: 'repository', nameWithOwner: 'acme/api' }, name: 'acme/api' }],
    });
});

test('the same settings on both sides change nothing', () => {
    const document: SettingsDocument = {
        version: 1,
        repositories: [{ nameWithOwner: 'mlaine/tasklet', id: 'R_1', tracking: true }],
        projects: [],
    };

    expect(getCombiningChanges(document, document)).toEqual({ download: [], saved: [], untracked: [] });
});
