/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import {
    checkTitle,
    developmentVersion,
    findLastStableTag,
    hasNoCode,
    planRelease,
    renderNotes,
    userVisibleChanges,
} from './releasePlan.js';

function plan(subjects: string[], tags: string[]) {
    const result = planRelease({ subjects, tags });
    return result.kind === 'release' ? result.tag : 'nothing';
}

describe('checkTitle', () => {
    test('a scope needs a change under its paths', () => {
        expect(checkTitle('chore(cloud)!: drop the old route', ['packages/worker/src/a.ts']).valid).toBe(true);
        expect(checkTitle('fix(web): grow the pickers', ['packages/app/tracking/TrackPickerDialog.vue']).valid).toBe(
            false,
        );
        expect(checkTitle('fix(web): fix the hero', ['packages/app/landing/Hero.vue']).valid).toBe(true);
        expect(checkTitle('fix(web): fix a redirect', ['packages/worker/src/index.ts']).valid).toBe(true);
        expect(checkTitle('fix(cloud): fix the shell', ['packages/app/landing/Hero.vue']).valid).toBe(false);
        expect(checkTitle('fix(cloud): rate-limit', ['packages/worker/src/index.ts', 'nuxt.config.ts']).valid).toBe(
            true,
        );
        expect(checkTitle('fix(web): lost list', []).valid).toBe(true);
    });

    test.each([
        'Add the context menu',
        'revert: undo the menu',
        'feat(worker): add the menu',
        'feat:add the menu',
        'feat:  add the menu',
        'feat: ',
        'feat!(web): add the menu',
        'Feat: add the menu',
    ])('rejects %p with a one-line reason', title => {
        const check = checkTitle(title, []);
        expect(check.valid).toBe(false);
        if (!check.valid) {
            expect(check.reason).not.toContain('\n');
        }
    });

    test.each([
        { title: 'docs: a', files: ['README.md', 'docs/a.md', 'design/a.pen'] },
        { title: 'chore: a', files: ['README.md'] },
        { title: 'feat: a', files: ['README.md', 'src/a.ts'] },
        { title: 'feat: a', files: [] },
    ])('accepts $title with $files', ({ title, files }) => {
        expect(checkTitle(title, [...files])).toEqual({ valid: true });
    });

    test.each([
        { title: 'docs: a', files: ['README.md', 'src/a.ts'] },
        { title: 'feat: a', files: ['README.md'] },
        { title: 'fix: a', files: ['docs/design/shot.png'] },
        { title: 'perf: a', files: ['design/a.pen'] },
    ])('rejects $title with $files', ({ title, files }) => {
        expect(checkTitle(title, [...files]).valid).toBe(false);
    });

    test('a docs rejection names the first few code paths and stays one line', () => {
        const check = checkTitle('docs: a', ['README.md', 'a\nb.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts']);
        expect(check).toEqual({
            valid: false,
            reason: 'a docs PR cannot touch code, but this one changes "a\\nb.ts", "c.ts", "d.ts" and 2 more',
        });
    });
});

describe('hasNoCode', () => {
    test.each([
        { files: ['README.md', 'design/a.pen', 'docs/shot.png'], expected: true },
        { files: ['README.md', 'src/a.ts'], expected: false },
        { files: ['README.mdx'], expected: false },
        { files: ['packages/docs/a.ts'], expected: false },
        { files: [], expected: false },
    ])('$files gives $expected', ({ files, expected }) => {
        expect(hasNoCode([...files])).toBe(expected);
    });
});

describe('findLastStableTag', () => {
    test('compares numerically, ignores prereleases and unknown tags', () => {
        const tags = ['v0.9.0', 'v0.10.0', 'v0.11.0-rc.1', 'v1.0', 'latest', 'v0.10.0-beta', 'xv0.12.0'];
        expect(findLastStableTag(tags)).toBe('v0.10.0');
    });
});

describe('planRelease bump', () => {
    test.each([
        { base: 'v0.3.1', subjects: ['fix: a'], tag: 'v0.3.2' },
        { base: 'v0.3.1', subjects: ['perf: a'], tag: 'v0.3.2' },
        { base: 'v0.3.1', subjects: ['feat: a'], tag: 'v0.4.0' },
        { base: 'v0.3.1', subjects: ['feat: a!'], tag: 'v0.4.0' },
        { base: 'v0.3.1', subjects: ['fix!: a'], tag: 'v0.4.0' },
        { base: 'v0.3.1', subjects: ['chore!: a'], tag: 'v0.4.0' },
        { base: 'v1.2.3', subjects: ['feat!: a'], tag: 'v2.0.0' },
        { base: 'v0.3.1', subjects: ['fix: a', 'feat: b', 'fix: c'], tag: 'v0.4.0' },
        { base: 'v1.2.3', subjects: ['fix: a', 'feat!: b', 'feat: c'], tag: 'v2.0.0' },
    ])('$base with $subjects gives $tag', ({ base, subjects, tag }) => {
        expect(plan([...subjects], ['v0.1.0', base])).toBe(tag);
    });

    test('a BREAKING CHANGE footer is not a breaking marker', () => {
        expect(plan(['fix: a', 'BREAKING CHANGE: b'], ['v1.2.3'])).toBe('v1.2.4');
    });

    test('a squashed pull request suffix is parsed through', () => {
        expect(plan(['feat: a (#45)'], ['v0.3.1'])).toBe('v0.4.0');
        expect(plan(['feat!: a (#45)'], ['v1.0.0'])).toBe('v2.0.0');
    });
});

describe('planRelease exclusions', () => {
    test.each([['chore: x'], ['feat(web)!: x'], ['Add the context menu (#26)']])('%p counts for nothing', subject => {
        expect(plan([subject], ['v0.3.1'])).toBe('nothing');
        expect(plan([subject], [])).toBe('nothing');
    });

    test('no subjects is nothing to release', () => {
        expect(plan([], ['v0.3.1'])).toBe('nothing');
    });

    test('a counted subject among excluded ones still releases', () => {
        expect(plan(['chore: a', 'Add b (#2)', 'fix: c'], ['v0.3.1'])).toBe('v0.3.2');
    });
});

describe('planRelease first release', () => {
    test.each([['fix: a'], ['feat!: a']])('%p gives v0.1.0', subject => {
        expect(plan([subject], [])).toBe('v0.1.0');
        expect(plan([subject], ['v0.1.0-dev.4', 'nightly'])).toBe('v0.1.0');
    });
});

describe('developmentVersion', () => {
    test.each([
        [['v0.9.0', 'v0.10.0'], 5, '0.11.0-dev.5'],
        [['v1.4.0'], 9, '1.5.0-dev.9'],
        [[], 3, '0.1.0-dev.3'],
        [['v0.2.0', 'v0.3.0-dev.9', 'nightly'], 7, '0.3.0-dev.7'],
    ])('%p at %p commits is %p', (tags, commitCount, expected) => {
        expect(developmentVersion({ tags, commitCount })).toBe(expected);
    });
});

describe('userVisibleChanges', () => {
    test('keeps what users notice, under the headings of the notes, in their order, with its pull request', () => {
        expect(
            userVisibleChanges([
                'perf: load the list faster (#5)',
                'chore: tidy (#8)',
                'fix(web): the landing page (#9)',
                'feat: add the menu',
                'Merge branch main',
                'refactor!: drop the old store (#2)',
            ]),
        ).toEqual([
            { kind: 'breaking', changes: [{ description: 'Drop the old store', pullRequest: 2 }] },
            { kind: 'features', changes: [{ description: 'Add the menu', pullRequest: undefined }] },
            { kind: 'performance', changes: [{ description: 'Load the list faster', pullRequest: 5 }] },
        ]);
    });
});

describe('renderNotes', () => {
    const POLICY = 'https://example.test/policy';

    test('groups in order, capitalises, keeps the pull request, leaves out the rest', () => {
        const notes = renderNotes({
            subjects: [
                'perf: load the list faster (#5)',
                'fix: keep the focus (#4)',
                'feat(web): web only (#9)',
                'chore: tidy (#8)',
                'Add the context menu (#26)',
                'feat: add the menu (#3)',
                'chore!: drop the old store (#2)',
                'fix: second fix',
            ],
            policyUrl: POLICY,
        });
        expect(notes).toBe(
            [
                '## Breaking changes\n\n- Drop the old store (#2)',
                '## Features\n\n- Add the menu (#3)',
                '## Fixes\n\n- Keep the focus (#4)\n- Second fix',
                '## Performance\n\n- Load the list faster (#5)',
                `Installers for macOS, Windows and Linux. How builds are signed, and what the app talks to: [Code signing policy](${POLICY}).`,
            ].join('\n\n') + '\n',
        );
    });

    test('with nothing to list, only the closing sentence remains', () => {
        const notes = renderNotes({ subjects: ['chore: a'], policyUrl: POLICY });
        expect(notes).not.toContain('##');
        expect(notes).toContain(POLICY);
    });
});
