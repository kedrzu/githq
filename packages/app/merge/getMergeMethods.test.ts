/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { MergeRules, MergeSettings } from './getMergeMethods.js';
import { getMergeMethods } from './getMergeMethods.js';

const ALL: MergeSettings = {
    mergeCommitAllowed: true,
    squashMergeAllowed: true,
    rebaseMergeAllowed: true,
    viewerDefaultMergeMethod: 'MERGE',
};

test('before the rules arrive, the settings alone, listed squash, merge commit, rebase', () => {
    expect(getMergeMethods(ALL, null)).toEqual({ methods: ['SQUASH', 'MERGE', 'REBASE'], defaultMethod: 'MERGE' });
    expect(getMergeMethods({ ...ALL, mergeCommitAllowed: false, rebaseMergeAllowed: false }, null).methods).toEqual([
        'SQUASH',
    ]);
});

test('a method the rulesets do not allow is never offered; no ruleset restricting them leaves the settings', () => {
    expect(getMergeMethods(ALL, rules({ allowedMergeMethods: ['SQUASH', 'REBASE'] })).methods).toEqual([
        'SQUASH',
        'REBASE',
    ]);
    // A ruleset allowing what the settings disable does not bring it back.
    expect(
        getMergeMethods({ ...ALL, rebaseMergeAllowed: false }, rules({ allowedMergeMethods: ['REBASE', 'MERGE'] }))
            .methods,
    ).toEqual(['MERGE']);
    expect(getMergeMethods(ALL, rules({})).methods).toEqual(['SQUASH', 'MERGE', 'REBASE']);
});

test('linear history required: no merge commit, whatever the settings and rulesets allow', () => {
    expect(getMergeMethods(ALL, rules({ requiresLinearHistory: true })).methods).toEqual(['SQUASH', 'REBASE']);
    expect(
        getMergeMethods(ALL, rules({ allowedMergeMethods: ['MERGE', 'SQUASH'], requiresLinearHistory: true })).methods,
    ).toEqual(['SQUASH']);
});

test('the default is the viewer’s when offered, else the first offered; none when nothing is', () => {
    expect(getMergeMethods(ALL, rules({ requiresLinearHistory: true })).defaultMethod).toBe('SQUASH');
    expect(getMergeMethods({ ...ALL, viewerDefaultMergeMethod: 'REBASE' }, null).defaultMethod).toBe('REBASE');
    expect(
        getMergeMethods(
            { ...ALL, squashMergeAllowed: false, viewerDefaultMergeMethod: 'SQUASH' },
            rules({ allowedMergeMethods: ['SQUASH', 'REBASE'] }),
        ),
    ).toEqual({ methods: ['REBASE'], defaultMethod: 'REBASE' });
    expect(
        getMergeMethods(
            { ...ALL, mergeCommitAllowed: true, squashMergeAllowed: false, rebaseMergeAllowed: false },
            rules({ requiresLinearHistory: true }),
        ),
    ).toEqual({ methods: [], defaultMethod: null });
});

function rules(params: Partial<MergeRules>): MergeRules {
    return { allowedMergeMethods: null, requiresLinearHistory: false, ...params };
}
