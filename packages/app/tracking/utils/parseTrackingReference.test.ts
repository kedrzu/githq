/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { TrackingReference } from './parseTrackingReference.js';
import { parseTrackingReference } from './parseTrackingReference.js';

test('a repository by its name or any address inside it', () => {
    const vite: TrackingReference = { kind: 'repository', owner: 'vitejs', name: 'vite' };
    for (const text of [
        'vitejs/vite',
        '  vitejs/vite ',
        'github.com/vitejs/vite',
        'https://github.com/vitejs/vite/issues/12',
        'https://www.github.com/vitejs/vite.git',
        'github.com/vitejs/vite?tab=readme',
    ]) {
        expect(parseTrackingReference(text), text).toEqual(vite);
    }

    expect(parseTrackingReference('kedrzu/my.dotfiles')).toEqual({
        kind: 'repository',
        owner: 'kedrzu',
        name: 'my.dotfiles',
    });
});

test('a project by its address, of an organisation or of a user, a view of it included', () => {
    expect(parseTrackingReference('github.com/orgs/tauri-apps/projects/2')).toEqual({
        kind: 'project',
        owner: 'tauri-apps',
        ownerKind: 'org',
        number: 2,
    });
    expect(parseTrackingReference('https://github.com/users/kedrzu/projects/14/views/3')).toEqual({
        kind: 'project',
        owner: 'kedrzu',
        ownerKind: 'user',
        number: 14,
    });
});

test('anything else names nothing', () => {
    for (const text of ['', 'vite', 'vitejs/', '/vite', '-bad/name', 'vitejs/..', 'https://example.com', 'a b/c']) {
        expect(parseTrackingReference(text), text).toBeNull();
    }
});
