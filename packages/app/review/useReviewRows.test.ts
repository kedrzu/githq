/// <reference types="bun" />
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { injectionKey } from '@nzyme/vue-ioc/injectionKey.js';
import { expect, test } from 'bun:test';
import { createApp, effectScope, nextTick, shallowRef } from 'vue';

import { Clock } from '@/services/Clock.js';
import { createTestSession } from '@/testing/createTestSession.js';

import type { DiffLineRange } from './diff/buildDiffRows.js';
import type { PullRequestFiles, ReviewFile, ReviewFileCollapse, ReviewFileState } from './ReviewFiles.js';
import type { ReviewThread } from './threads/ReviewThread.js';
import { useReviewRows } from './useReviewRows.js';

const LINES = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`);
const BEFORE = LINES.join('\n');
const AFTER = LINES.map((line, index) => (index === 9 ? 'changed' : line)).join('\n');
const NO_LINES: readonly DiffLineRange[] = [];

test('a thread is placed by what its file shows now, moving as the file arrives and collapses', async () => {
    const view = open([fileRow('a.ts')], [threadOn('a.ts', 10)]);
    const placed = () => view.placements.value.byFile.get('a.ts')?.map(placement => placement.kind);

    expect(placed()).toEqual(['inCollapsed']);

    view.setState('a.ts', { kind: 'ready', before: BEFORE, after: AFTER });
    await view.settle();
    expect(placed()).toEqual(['onLine']);
    const onLine = view.placements.value;

    // Nothing about it changed: the same object, so nothing downstream rebuilds.
    view.bump();
    await view.settle();
    expect(view.placements.value).toBe(onLine);

    view.setCollapse('a.ts', 'byHand');
    await view.settle();
    expect(placed()).toEqual(['inCollapsed']);

    view.setCollapse('a.ts', null);
    await view.settle();
    expect(view.placements.value.byFile.get('a.ts')).toBe(onLine.byFile.get('a.ts'));
    view.stop();
});

test('a file not listed is gone only once the list stops growing, and its entry lasts until its threads are resolved', async () => {
    const view = open([fileRow('a.ts')], [threadOn('later.ts', 1)], { listComplete: false });
    expect(view.placements.value.byFile.size).toBe(0);

    view.setListComplete(true);
    await view.settle();
    expect(view.placements.value.byFile.get('later.ts')?.map(placement => placement.kind)).toEqual(['gone']);
    expect(view.placements.value.goneEntries).toEqual(['later.ts']);

    view.setThreads([{ ...threadOn('later.ts', 1), isResolved: true }]);
    await view.settle();
    expect(view.placements.value.goneEntries).toEqual([]);
    view.stop();
});

test('a file the list holds but the view filters out still has its threads placed', () => {
    const view = open([fileRow('a.ts'), fileRow('hidden.ts')], [threadOn('hidden.ts', 1)], {
        ordered: [fileRow('a.ts')],
    });
    expect(view.placements.value.byFile.get('hidden.ts')?.map(placement => placement.kind)).toEqual(['inCollapsed']);
    view.stop();
});

interface OpenOptions {
    readonly listComplete?: boolean;
    readonly ordered?: readonly ReviewFile[];
}

function open(listed: readonly ReviewFile[], threads: readonly ReviewThread[], options: OpenOptions = {}) {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const states = new Map<string, ReviewFileState>();
    const collapses = new Map<string, ReviewFileCollapse | null>();
    const version = shallowRef(0);
    const threadsRef = shallowRef(threads);
    const listComplete = shallowRef(options.listComplete ?? true);
    const files = createFiles();
    const ordered = options.ordered ?? listed;

    const app = createApp({});
    const container = createContainer();
    container.set(Clock, session.clock);
    app.provide(injectionKey, container);
    const scope = effectScope();
    const reviewRows = app.runWithContext(() =>
        scope.run(() => useReviewRows({ files, ordered, layout: 'split', hideWhitespace: false, currentPath: null })),
    );
    if (!reviewRows) {
        throw new Error('The scope is active');
    }

    return {
        placements: reviewRows.threadPlacements,
        stop: () => scope.stop(),
        bump: () => version.value++,
        setState(path: string, state: ReviewFileState) {
            states.set(path, state);
            version.value++;
        },
        setCollapse(path: string, collapse: ReviewFileCollapse | null) {
            collapses.set(path, collapse);
            version.value++;
        },
        setListComplete(complete: boolean) {
            listComplete.value = complete;
        },
        setThreads(next: readonly ReviewThread[]) {
            threadsRef.value = next;
        },
        async settle() {
            await nextTick();
            await session.clock.advance(0);
            await nextTick();
        },
    };

    function createFiles(): PullRequestFiles {
        return {
            list: { kind: 'ready' },
            files: listed,
            get threads() {
                return threadsRef.value;
            },
            threadsState: { kind: 'ready' },
            get listComplete() {
                return listComplete.value;
            },
            id: 'PR_7',
            headRefOid: 'head',
            changedFiles: listed.length,
            progress: { here: 0, total: 0 },
            fetchingFirst: null,
            pausedUntil: null,
            checkedAt: null,
            listFailing: false,
            lostViewed: new Set(),
            lostViewedNotice: false,
            dismissLostViewedNotice: () => {},
            get version() {
                return version.value;
            },
            getState: path => states.get(path) ?? { kind: 'waiting' },
            prioritize: () => {},
            retry: () => {},
            getCollapse: path => collapses.get(path) ?? null,
            getCollapseReason: () => null,
            setCollapsed: () => {},
            setViewed: () => {},
            hideViewed: false,
            setHideViewed: () => {},
            filter: { pattern: '', regex: false },
            setFilter: () => {},
            getExpandedLines: () => NO_LINES,
            isExpansionReset: () => false,
            expandLines: () => {},
        };
    }
}

function fileRow(path: string): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions: 1, deletions: 1, viewed: 'UNVIEWED' };
}

function threadOn(path: string, line: number): ReviewThread {
    return {
        id: `${path}:${line}`,
        path,
        line,
        startLine: null,
        originalLine: line,
        originalStartLine: null,
        diffSide: 'RIGHT',
        startDiffSide: null,
        isOutdated: false,
        isResolved: false,
        subjectType: 'LINE',
        comments: [],
    };
}
