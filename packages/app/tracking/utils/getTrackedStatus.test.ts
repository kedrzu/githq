/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { ProjectSyncState, RepositorySyncState, TrackingProgress } from '../TrackingTypes.js';

import { getTrackedStatus } from './getTrackedStatus.js';

const REPOSITORY: RepositorySyncState = {
    kind: 'repository',
    nameWithOwner: 'acme/web',
    phase: 'done',
    cursor: null,
    counts: {},
    since: null,
    etag: null,
    hidden: false,
    refused: null,
    lastSuccessAt: 1_000,
};

const PROJECT: ProjectSyncState = {
    kind: 'project',
    id: 'PVT_1',
    downloaded: true,
    cursor: null,
    count: { done: 34, total: 34 },
    etag: null,
    readAt: null,
    hidden: false,
    refused: null,
    updatedAt: null,
    lastSuccessAt: 2_000,
};

const DONE: TrackingProgress = { state: 'done', done: 34, total: 34 };
const REFUSAL = { status: 403, at: 500 };

test('hidden from the user, whatever its state', () => {
    expect(getTrackedStatus({ state: 'hidden', done: 0, total: null }, REPOSITORY)).toEqual({ kind: 'hidden' });
});

test('downloading until its open items arrived, or before its download started', () => {
    const progress: TrackingProgress = { state: 'downloading', done: 40, total: 312 };
    expect(getTrackedStatus(progress, { ...REPOSITORY, phase: 'openPullRequests' })).toEqual({
        kind: 'downloading',
        done: 40,
        total: 312,
    });
    expect(getTrackedStatus(progress, undefined)).toEqual({ kind: 'downloading', done: 40, total: 312 });
    expect(getTrackedStatus(progress, { ...PROJECT, downloaded: false })).toEqual({
        kind: 'downloading',
        done: 40,
        total: 312,
    });
});

test("read when last synced; a repository's refused changes say so, a project's are read less often", () => {
    expect(getTrackedStatus(DONE, { ...REPOSITORY, phase: 'closedIssues' })).toEqual({
        kind: 'read',
        at: 1_000,
        slower: false,
    });
    expect(getTrackedStatus(DONE, { ...REPOSITORY, refused: REFUSAL })).toEqual({ kind: 'refused' });
    expect(getTrackedStatus(DONE, PROJECT)).toEqual({ kind: 'read', at: 2_000, slower: false });
    expect(getTrackedStatus(DONE, { ...PROJECT, refused: REFUSAL })).toEqual({ kind: 'read', at: 2_000, slower: true });
});
