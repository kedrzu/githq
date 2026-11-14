/// <reference types="bun" />
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { injectionKey } from '@nzyme/vue-ioc/injectionKey.js';
import { expect, test } from 'bun:test';
import { createApp, effectScope, nextTick, shallowRef } from 'vue';

import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import { createTestSession } from '@/testing/createTestSession.js';
import { waitUntil } from '@/testing/waitUntil.js';

import { buildFileLineRows, buildReviewRows } from '../buildReviewRows.js';
import type { ReviewRow } from '../buildReviewRows.js';
import type { DiffLayout } from '../diff/buildDiffRows.js';
import { computeFileDiff } from '../diff/computeFileDiff.js';
import type { ReviewFile } from '../ReviewFiles.js';
import type { RowMarks } from './RowMarks.js';
import { useReviewFind } from './useReviewFind.js';

const A: ReviewFile = {
    path: 'src/a.ts',
    previousPath: null,
    changeType: 'MODIFIED',
    additions: 2,
    deletions: 2,
    viewed: 'UNVIEWED',
};
const BEFORE = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
const AFTER = BEFORE.replace('line 20\nline 21\n', 'needle 20\nneedle 21\n');
const DIFF = computeFileDiff({ before: BEFORE, after: AFTER, ignoreWhitespace: false });

test('a step goes to the next match and wraps; the match stepped to stays current through a layout switch', async () => {
    const view = open();
    view.query.value = 'needle';
    await view.searched();

    // Landing marks the first match without going anywhere: only a step gives a row.
    expect(view.find.total).toBe(2);
    expect(view.find.position).toBe(0);
    expect(view.find.previous()).toBe(rowWithAfter('split', 21));
    expect(view.find.next()).toBe(rowWithAfter('split', 20));
    expect(view.find.next()).toBe(rowWithAfter('split', 21));

    view.rows.value = rowsOf('unified');
    await view.searched(rowWithAfter('unified', 21));

    expect(view.find.position).toBe(1);
    const marks: RowMarks = { before: [], after: [{ start: 0, end: 6, current: true }] };
    expect(view.find.getRowMarks(rowWithAfter('unified', 21))).toEqual(marks);
    expect(view.find.getRowMarks(rowWithAfter('unified', 20))?.after[0]?.current).toBe(false);
    view.stop();
});

test('a new query lands from the cursor; closing find takes the marks away at once', async () => {
    const view = open();
    view.cursorKey.value = rowWithAfter('split', 21);
    view.query.value = 'needle';
    await view.searched();

    expect(view.find.position).toBe(1);

    view.active.value = false;
    await view.settle();
    expect(view.find.state.status).toBe('idle');
    expect(view.find.getRowMarks(rowWithAfter('split', 21))).toBeNull();
    view.stop();
});

test('a step asked for before the query is searched goes to its first match once it lands', async () => {
    const view = open();
    view.query.value = 'needle';
    // Typed, as the field's input event does, and Enter pressed before the typing delay is over.
    await nextTick();

    expect(view.find.next()).toBeNull();
    await waitUntil(() => view.went.length > 0);

    expect(view.went).toEqual([rowWithAfter('split', 20)]);
    expect(view.find.position).toBe(0);
    view.stop();
});

function open() {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const rows = shallowRef<readonly ReviewRow[]>(rowsOf('split'));
    const query = shallowRef('');
    const active = shallowRef(true);
    const cursorKey = shallowRef<string | null>(null);
    const went: string[] = [];

    const app = createApp({});
    const container = createContainer();
    container.set(Clock, session.clock);
    container.set(Browser, session.container.resolve(Browser));
    app.provide(injectionKey, container);
    const scope = effectScope();
    const find = app.runWithContext(() =>
        scope.run(() => useReviewFind({ rows, query, active, cursorKey, onGo: rowKey => went.push(rowKey) })),
    );
    if (!find) {
        throw new Error('The scope is active');
    }

    return {
        find,
        rows,
        query,
        active,
        cursorKey,
        /** The rows `onGo` was given. */
        went,
        stop: () => scope.stop(),
        settle: () => session.clock.advance(0),
        /** Past the typing delay, until the search is done and, if given, the row has marks. */
        async searched(markedRow?: string) {
            await session.clock.advance(150);
            await waitUntil(
                () => find.state.status === 'done' && (markedRow === undefined || find.getRowMarks(markedRow) !== null),
            );
        },
    };
}

function rowWithAfter(layout: DiffLayout, line: number) {
    const found = rowsOf(layout).find(
        row =>
            row.kind === 'line' &&
            (row.line.layout === 'split' ? row.line.right?.line === line : row.line.newLine === line),
    );
    if (!found) {
        throw new Error(`No row of line ${line}`);
    }

    return found.key;
}

function rowsOf(layout: DiffLayout): ReviewRow[] {
    return buildReviewRows({
        files: [A],
        getContent: () => ({ kind: 'lines', rows: buildFileLineRows({ path: A.path, diff: DIFF, layout }) }),
    });
}
