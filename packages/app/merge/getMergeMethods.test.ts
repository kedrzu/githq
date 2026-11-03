/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { MergeMethods, MergeRules, MergeSettings } from './getMergeMethods.js';
import { getMergeMethods } from './getMergeMethods.js';

const ALL: MergeSettings = {
    viewerDefaultCommitEmail: null,
    viewerPossibleCommitEmails: [],
    mergeCommitAllowed: true,
    squashMergeAllowed: true,
    rebaseMergeAllowed: true,
    viewerDefaultMergeMethod: 'MERGE',
    autoMergeAllowed: false,
    deleteBranchOnMerge: false,
};

test('before the rules arrive, the settings alone, listed squash, merge commit, rebase', () => {
    expect(getMergeMethods({ settings: ALL, rules: null })).toEqual({
        methods: ['SQUASH', 'MERGE', 'REBASE'],
        defaultMethod: 'MERGE',
    });
    expect(
        getMergeMethods({ settings: { ...ALL, mergeCommitAllowed: false, rebaseMergeAllowed: false }, rules: null })
            .methods,
    ).toEqual(['SQUASH']);
});

test('a method the rulesets do not allow is never offered; no ruleset restricting them leaves the settings', () => {
    expect(
        getMergeMethods({ settings: ALL, rules: rules({ allowedMergeMethods: ['SQUASH', 'REBASE'] }) }).methods,
    ).toEqual(['SQUASH', 'REBASE']);
    // A ruleset allowing what the settings disable does not bring it back.
    expect(
        getMergeMethods({
            settings: { ...ALL, rebaseMergeAllowed: false },
            rules: rules({ allowedMergeMethods: ['REBASE', 'MERGE'] }),
        }).methods,
    ).toEqual(['MERGE']);
    expect(getMergeMethods({ settings: ALL, rules: rules({}) }).methods).toEqual(['SQUASH', 'MERGE', 'REBASE']);
});

test('linear history required: no merge commit, whatever the settings and rulesets allow', () => {
    expect(getMergeMethods({ settings: ALL, rules: rules({ requiresLinearHistory: true }) }).methods).toEqual([
        'SQUASH',
        'REBASE',
    ]);
    expect(
        getMergeMethods({
            settings: ALL,
            rules: rules({ allowedMergeMethods: ['MERGE', 'SQUASH'], requiresLinearHistory: true }),
        }).methods,
    ).toEqual(['SQUASH']);
});

test('the default is the viewer’s when offered, else the first offered; none when nothing is', () => {
    expect(getMergeMethods({ settings: ALL, rules: rules({ requiresLinearHistory: true }) }).defaultMethod).toBe(
        'SQUASH',
    );
    expect(
        getMergeMethods({ settings: { ...ALL, viewerDefaultMergeMethod: 'REBASE' }, rules: null }).defaultMethod,
    ).toBe('REBASE');
    expect(
        getMergeMethods({
            settings: { ...ALL, squashMergeAllowed: false, viewerDefaultMergeMethod: 'SQUASH' },
            rules: rules({ allowedMergeMethods: ['SQUASH', 'REBASE'] }),
        }),
    ).toEqual({ methods: ['REBASE'], defaultMethod: 'REBASE' });
    expect(
        getMergeMethods({
            settings: { ...ALL, mergeCommitAllowed: true, squashMergeAllowed: false, rebaseMergeAllowed: false },
            rules: rules({ requiresLinearHistory: true }),
        }),
    ).toEqual({ methods: [], defaultMethod: null });
});

test('a merge queue offers no choice: its own method, whatever the settings and rulesets allow', () => {
    expect(
        getMergeMethods({
            settings: { ...ALL, squashMergeAllowed: false },
            rules: rules({ allowedMergeMethods: ['MERGE'], mergeQueueMethod: 'SQUASH' }),
            isMergeQueueEnabled: true,
        }),
    ).toEqual({ methods: ['SQUASH'], defaultMethod: 'SQUASH' });
});

test('a merge queue before the read, or with no ruleset naming its method: one method still, the one it would start on', () => {
    const offered: MergeMethods = { methods: ['MERGE'], defaultMethod: 'MERGE' };
    expect(getMergeMethods({ settings: ALL, rules: null, isMergeQueueEnabled: true })).toEqual(offered);
    expect(getMergeMethods({ settings: ALL, rules: rules({}), isMergeQueueEnabled: true })).toEqual(offered);
});

function rules(params: Partial<MergeRules>): MergeRules {
    return { allowedMergeMethods: null, requiresLinearHistory: false, mergeQueueMethod: null, ...params };
}
