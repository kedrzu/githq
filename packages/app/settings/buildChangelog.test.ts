import type { GitHubRelease } from '@githq/github/rest/listReleases.js';
import { expect, test } from 'bun:test';

import { buildChangelog, findLastStable, getCommitsUrl } from './buildChangelog.js';
import type { BuildChangelogParams } from './buildChangelog.js';

const RELEASES: GitHubRelease[] = ['v0.1.0', 'v0.2.0', 'v0.1.10', 'v0.1.2'].map(tagName => ({
    tagName,
    publishedAt: '2026-11-03T10:00:00Z',
    bodyHtml: `<p>${tagName}</p>`,
}));

function build(params: Partial<BuildChangelogParams>) {
    return buildChangelog({
        releases: RELEASES,
        development: null,
        version: '0.2.0',
        previousVersion: null,
        ...params,
    });
}

function tagged(params: Partial<BuildChangelogParams>, tag: 'isNew' | 'running') {
    return build(params).flatMap(fold => (fold.kind === 'release' && fold[tag] ? [fold.version] : []));
}

test('Stable versions come newest first by number, without their v, with their text', () => {
    const folds = build({});

    expect(folds.map(fold => (fold.kind === 'release' ? fold.version : fold.kind))).toEqual([
        '0.2.0',
        '0.1.10',
        '0.1.2',
        '0.1.0',
    ]);
    expect(folds[0]).toMatchObject({ html: '<p>v0.2.0</p>', publishedAt: '2026-11-03T10:00:00Z' });
});

test('Running is the installed version; on a Development build no Stable version is', () => {
    expect(tagged({ version: '0.1.2' }, 'running')).toEqual(['0.1.2']);
    expect(tagged({ version: '0.3.0-dev.214' }, 'running')).toEqual([]);
});

test('New is every version newer than the one the user had; with none before, nothing is', () => {
    expect(tagged({ previousVersion: '0.1.2' }, 'isNew')).toEqual(['0.2.0', '0.1.10']);
    expect(tagged({ previousVersion: null }, 'isNew')).toEqual([]);
    expect(tagged({ version: '0.1.0', previousVersion: '0.3.0-dev.214' }, 'isNew')).toEqual([]);
});

test('a Development build has its own fold first, filtered as release notes are', () => {
    const [first, second] = build({
        version: '0.3.0-dev.214',
        development: {
            since: '0.2.0',
            limited: false,
            subjects: ['feat: add a thing (#3)', 'chore: tidy (#4)', 'fix(web): the landing page (#5)'],
        },
    });

    expect(first).toEqual({
        kind: 'development',
        since: '0.2.0',
        commits: 3,
        limited: false,
        groups: [{ kind: 'features', changes: [{ description: 'Add a thing', pullRequest: 3 }] }],
    });
    expect(second).toMatchObject({ kind: 'release', version: '0.2.0' });
});

test('the last Stable of a build is the newest before it, not one that came out after it', () => {
    expect(findLastStable(RELEASES, '0.3.0-dev.214')?.tagName).toBe('v0.2.0');
    expect(findLastStable(RELEASES, '0.2.0-dev.100')?.tagName).toBe('v0.1.10');
    expect(findLastStable(RELEASES, '0.1.0-dev.5')).toBeNull();
    expect(findLastStable([], '0.1.0-dev.5')).toBeNull();
});

test('a build with no commit, a local one, links to main; a Stable version has no commits to link to', () => {
    expect(getCommitsUrl('0.3.0-dev.214', 'abc')).toBe('https://github.com/kedrzu/githq/commits/abc');
    expect(getCommitsUrl('0.3.0-dev.214', null)).toBe('https://github.com/kedrzu/githq/commits/main');
    expect(getCommitsUrl('0.2.0', 'abc')).toBeNull();
});
