/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { EditFailureReason } from '@/edits/EditTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { samplePullRequest } from '@/testing/sampleItems.js';

import { getMergeEnd } from './getMergeEnd.js';
import type { MergeOptions, MergeRecord, SentMerge } from './MergeTypes.js';

const PR: PullRequestItem = { ...samplePullRequest('PR_1'), headRefOid: 'head-oid' };
const SENT: SentMerge = { request: { method: 'MERGE' }, edited: null, head: 'head-oid' };
const REASON: EditFailureReason = { kind: 'refused', message: 'No.' };
const REFUSED: MergeRecord = { kind: 'refused', sent: SENT, reason: REASON, at: 1 };
const UNKNOWN: MergeRecord = { kind: 'unknown', sent: SENT, at: 1, accepted: true };
const OPTIONS: MergeOptions = {
    status: PR,
    proposedTexts: { MERGE: { title: 'Merge', body: '' }, SQUASH: { title: 'Squash', body: '' } },
    allowedMergeMethods: null,
    requiresLinearHistory: false,
    viewerCanMergeAsAdmin: false,
    viewerCanEnableAutoMerge: false,
    isMergeQueueEnabled: false,
    checks: [],
    headCommit: { oid: 'new-head', headline: 'Handle an empty answer', author: 'dkim' },
};

test('nothing to say without a record, or once the pull request reads merged, closed or being merged again', () => {
    expect(getMergeEnd(null, PR, null)).toBeNull();
    expect(getMergeEnd(REFUSED, { ...PR, state: 'MERGED', merged: true }, null)).toBeNull();
    expect(getMergeEnd(UNKNOWN, { ...PR, state: 'CLOSED' }, null)).toBeNull();
    expect(getMergeEnd(REFUSED, { ...PR, merging: 'MERGE' }, null)).toBeNull();
});

test('PM25: refused with the head where the merge named it and the method allowed — GitHub’s reason', () => {
    expect(getMergeEnd(REFUSED, PR, OPTIONS)).toEqual({ kind: 'refused', sent: SENT, reason: REASON });
    expect(getMergeEnd(REFUSED, PR, null)).toEqual({ kind: 'refused', sent: SENT, reason: REASON });
});

test('PM27: refused with the head moved since — a new commit first, whatever GitHub said; its author when the read brought it', () => {
    const moved = { ...PR, headRefOid: 'new-head' };
    const rules = { ...OPTIONS, allowedMergeMethods: ['SQUASH' as const] };

    expect(getMergeEnd(REFUSED, moved, rules)).toEqual({
        kind: 'headMoved',
        sent: SENT,
        head: 'new-head',
        commit: OPTIONS.headCommit,
    });
    expect(getMergeEnd(REFUSED, moved, null)).toEqual({
        kind: 'headMoved',
        sent: SENT,
        head: 'new-head',
        commit: null,
    });
    // A read of another head names no commit of this one.
    expect(getMergeEnd(REFUSED, { ...PR, headRefOid: 'newer-head' }, OPTIONS)).toMatchObject({ commit: null });
});

test('PM37: with no read of its own — a row, the opened item — the commit noted on the refusal names it, while it is the head', () => {
    const noted: MergeRecord = { ...REFUSED, headCommit: { oid: 'new-head', headline: 'Handle it', author: 'dkim' } };

    expect(getMergeEnd(noted, { ...PR, headRefOid: 'new-head' }, null)).toMatchObject({
        kind: 'headMoved',
        commit: { oid: 'new-head', author: 'dkim' },
    });
    expect(getMergeEnd(noted, { ...PR, headRefOid: 'newer-head' }, null)).toMatchObject({ commit: null });
});

test('PM28: refused for a method the base branch’s rules, once read, don’t allow', () => {
    expect(getMergeEnd(REFUSED, PR, { ...OPTIONS, allowedMergeMethods: ['SQUASH'] })).toEqual({
        kind: 'methodNotAllowed',
        sent: SENT,
    });
    expect(getMergeEnd(REFUSED, PR, { ...OPTIONS, requiresLinearHistory: true })).toEqual({
        kind: 'methodNotAllowed',
        sent: SENT,
    });
});

test('PM29: no answer stays not known — the merge may still land on the head it named', () => {
    expect(getMergeEnd(UNKNOWN, { ...PR, headRefOid: 'new-head' }, OPTIONS)).toEqual({
        kind: 'unknown',
        sent: SENT,
        accepted: true,
    });
});

test("D11: a stack's refusal before the stack is read again is not known, with GitHub's words, whatever the head", () => {
    const reading: MergeRecord = { kind: 'unknown', sent: SENT, at: 1, accepted: false, refusal: REASON };

    expect(getMergeEnd(reading, { ...PR, headRefOid: 'new-head' }, OPTIONS)).toEqual({
        kind: 'unknown',
        sent: SENT,
        accepted: false,
        refusal: REASON,
    });
});
