/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { TrackedProject, TrackedRepository } from '../TrackingTypes.js';
import { applyStagedChanges } from './applyStagedChanges.js';

const WEB: TrackedRepository = { nameWithOwner: 'acme/web', id: 'R_web' };
const API: TrackedRepository = { nameWithOwner: 'acme/api', id: 'R_api' };
const DOCS: TrackedRepository = { nameWithOwner: 'acme/docs', id: 'R_docs' };
const NEW: TrackedRepository = { nameWithOwner: 'acme/new', id: 'R_new' };
const VITE: TrackedRepository = { nameWithOwner: 'vitejs/vite', id: 'R_vite' };
const ROADMAP: TrackedProject = { id: 'PVT_1', owner: 'acme', ownerKind: 'org', number: 1, title: 'Roadmap' };
const BUGS: TrackedProject = { id: 'PVT_2', owner: 'acme', ownerKind: 'org', number: 2, title: 'Bugs' };

test('exactly the staged changes: those staying keep their order, new ones come after in the order given', () => {
    expect(
        applyStagedChanges(
            { repositories: [WEB, API, DOCS], projects: [ROADMAP] },
            {
                repositories: { added: [VITE, NEW], removed: ['acme/api'] },
                projects: { added: [BUGS], removed: ['PVT_1'] },
            },
        ),
    ).toEqual({ repositories: [WEB, DOCS, VITE, NEW], projects: [BUGS] });
});

test('what is tracked but was not unticked stays tracked: tracked meanwhile, or never shown as a row', () => {
    // `acme/docs` was tracked in another tab after the section opened: the ticks never knew it.
    expect(
        applyStagedChanges(
            { repositories: [WEB, DOCS], projects: [ROADMAP] },
            { repositories: { added: [NEW], removed: ['acme/web'] }, projects: { added: [], removed: [] } },
        ),
    ).toEqual({ repositories: [DOCS, NEW], projects: [ROADMAP] });
});

test('a staged change already made true changes nothing: no second entry, nothing untracked twice', () => {
    expect(
        applyStagedChanges(
            { repositories: [WEB, NEW], projects: [] },
            { repositories: { added: [NEW], removed: ['acme/api'] }, projects: { added: [], removed: ['PVT_1'] } },
        ),
    ).toEqual({ repositories: [WEB, NEW], projects: [] });
});
