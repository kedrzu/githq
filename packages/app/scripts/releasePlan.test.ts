/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import { checkTitle, findLastStableTag, planRelease, renderNotes } from './releasePlan.js';
import type { ReleaseMode } from './releasePlan.js';

function plan(subjects: string[], tags: string[], mode: ReleaseMode = 'stable') {
    const result = planRelease({ subjects, tags, mode });
    return result.kind === 'release' ? result.tag : 'nothing';
}

describe('checkTitle', () => {
    test.each([
        'feat: add the context menu',
        'fix(web): keep the focus',
        'chore(cloud)!: drop the old route',
        'refactor!: rename the store',
        'perf: load the list faster',
    ])('accepts %p', title => {
        expect(checkTitle(title)).toEqual({ valid: true });
    });

    test.each([
        'Add the context menu',
        'revert: undo the menu',
        'feature: add the menu',
        'feat(worker): add the menu',
        'feat(web)(cloud): add the menu',
        'feat:add the menu',
        'feat:  add the menu',
        'feat: ',
        'feat!(web): add the menu',
        'Feat: add the menu',
    ])('rejects %p with a one-line reason', title => {
        const check = checkTitle(title);
        expect(check.valid).toBe(false);
        if (!check.valid) {
            expect(check.reason).not.toContain('\n');
        }
    });
});

describe('findLastStableTag', () => {
    test('compares numerically, ignores candidates and unknown tags', () => {
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
        { base: 'v1.2.3', subjects: ['fix: a'], tag: 'v1.2.4' },
        { base: 'v1.2.3', subjects: ['perf: a'], tag: 'v1.2.4' },
        { base: 'v1.2.3', subjects: ['feat: a'], tag: 'v1.3.0' },
        { base: 'v1.2.3', subjects: ['feat!: a'], tag: 'v2.0.0' },
        { base: 'v1.2.3', subjects: ['chore!: a'], tag: 'v2.0.0' },
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

    test('the base is the highest stable tag, numerically', () => {
        expect(plan(['fix: a'], ['v0.9.0', 'v0.10.0'])).toBe('v0.10.1');
    });
});

describe('planRelease exclusions', () => {
    test.each([
        ['chore: x'],
        ['refactor: x'],
        ['docs: x'],
        ['test: x'],
        ['build: x'],
        ['ci: x'],
        ['feat(web): x'],
        ['fix(cloud): x'],
        ['feat(web)!: x'],
        ['feat(worker): x'],
        ['Add the context menu (#26)'],
        ["Merge branch 'main' into feat/x"],
        ['revert: x'],
        [''],
    ])('%p counts for nothing', subject => {
        for (const mode of ['preview', 'candidate', 'stable'] as const) {
            expect(plan([subject], ['v0.3.1'], mode)).toBe('nothing');
        }
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
    test.each([['fix: a'], ['feat: a'], ['feat!: a'], ['chore!: a']])('%p gives v0.1.0', subject => {
        expect(plan([subject], [])).toBe('v0.1.0');
        expect(plan([subject], ['v0.1.0-rc.1', 'nightly'])).toBe('v0.1.0');
    });
});

describe('planRelease modes', () => {
    test('preview is the stable tag, and nothing when nothing counts', () => {
        expect(plan(['feat: a'], ['v0.3.1', 'v0.4.0-rc.2'], 'preview')).toBe('v0.4.0');
        expect(plan(['chore: a'], ['v0.3.1'], 'preview')).toBe('nothing');
    });

    test('a candidate numbers from rc.1 and one past the highest, numerically', () => {
        expect(plan(['feat: a'], ['v0.3.1'], 'candidate')).toBe('v0.4.0-rc.1');
        expect(plan(['feat: a'], ['v0.3.1', 'v0.4.0-rc.1', 'v0.4.0-rc.9'], 'candidate')).toBe('v0.4.0-rc.10');
        expect(plan(['feat: a'], ['v0.3.1', 'v0.4.0-rc.9', 'v0.4.0-rc.10'], 'candidate')).toBe('v0.4.0-rc.11');
    });

    test('candidates of other versions do not count for numbering', () => {
        expect(plan(['feat: a'], ['v0.3.1', 'v0.5.0-rc.4'], 'candidate')).toBe('v0.4.0-rc.1');
    });

    test('candidates never move the stable base', () => {
        expect(plan(['fix: a'], ['v0.1.0', 'v0.2.0-rc.1'], 'candidate')).toBe('v0.1.1-rc.1');
        expect(plan(['fix: a'], ['v0.1.0', 'v0.2.0-rc.1'], 'stable')).toBe('v0.1.1');
    });

    test('a first candidate is a v0.1.0 candidate', () => {
        expect(plan(['fix: a'], [], 'candidate')).toBe('v0.1.0-rc.1');
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
