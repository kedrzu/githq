/// <reference types="bun" />
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { injectionKey } from '@nzyme/vue-ioc/injectionKey.js';
import { expect, mock, test } from 'bun:test';
import { createApp, effectScope, nextTick, shallowRef } from 'vue';

import { Clock } from '@/services/Clock.js';
import { createTestSession } from '@/testing/createTestSession.js';

import { buildFileLineRows, buildReviewRows, getReviewHeaderKey } from './buildReviewRows.js';
import type { ReviewFileContent, ReviewPosition, ReviewRow } from './buildReviewRows.js';
import { computeFileDiff } from './diff/computeFileDiff.js';
import type { ReviewFile, ReviewFileCollapse, ReviewFileListEnd } from './ReviewFiles.js';
import { useReviewPosition } from './useReviewPosition.js';
import type { ReviewArrival, ReviewPositionFiles } from './useReviewPosition.js';

const A = sampleFile('a.ts');
const B = sampleFile('b.ts');
const C = sampleFile('c.ts');
const LINE: ReviewPosition = { place: { kind: 'line', path: 'b.ts', side: 'after', line: 2 }, offset: -5 };
const DIFF = computeFileDiff({ before: 'one\ntwo\nthree\n', after: 'one\ntwo\nfour\n', ignoreWhitespace: false });

test('a file not arrived holds its header, the line taking over when it comes; nothing else moves the view after that', async () => {
    const view = open({ position: LINE });

    view.setRows({ 'b.ts': { kind: 'placeholder' } });
    await nextTick();
    expect(view.jumps.at(-1)).toEqual([getReviewHeaderKey('b.ts'), 0]);
    expect(view.prioritized).toEqual(['b.ts']);
    expect(view.landing.value).toBe(true);

    view.setRows({ 'b.ts': lines() });
    await nextTick();
    const [key, offset] = view.jumps.at(-1) ?? [];
    expect(key).toContain('b.ts');
    expect(key).not.toBe(getReviewHeaderKey('b.ts'));
    expect(offset).toBe(-5);
    expect(view.landing.value).toBe(false);

    const jumps = view.jumps.length;
    view.setRows({ 'a.ts': lines(), 'b.ts': lines() });
    await nextTick();
    expect(view.jumps).toHaveLength(jumps);
    view.stop();
});

test('once the reader scrolls, a restore on its way is off: the file arriving moves nothing, and the place they scrolled to is what is kept', async () => {
    const view = open({ position: LINE });
    view.setRows({ 'b.ts': { kind: 'placeholder' } });
    await nextTick();
    const jumps = view.jumps.length;

    view.landing.value = false;
    view.setAnchor({ key: getReviewHeaderKey('a.ts'), offset: -10 });
    view.setRows({ 'b.ts': lines() });
    await nextTick();
    expect(view.jumps).toHaveLength(jumps);

    view.stop();
    expect(view.saved.at(-1)).toEqual({ place: { kind: 'row', key: getReviewHeaderKey('a.ts') }, offset: -10 });
});

test('leaving while still on its way keeps the place it was going to, not the header standing in', async () => {
    const view = open({ position: LINE });
    view.setRows({ 'b.ts': { kind: 'placeholder' } });
    await nextTick();
    view.setAnchor({ key: getReviewHeaderKey('b.ts'), offset: 0 });

    view.stop();

    expect(view.saved).toEqual([]);
});

test('scrolling writes twice a second at most, whatever the frames, and leaving writes where it ended', async () => {
    const view = open({ position: null });
    view.setRows({ 'a.ts': lines() });
    await nextTick();
    const [, firstLine] = view.rows.value;
    if (!firstLine) {
        throw new Error('The file has lines');
    }

    for (let frame = 0; frame < 60; frame++) {
        view.setAnchor({ key: firstLine.key, offset: -frame });
        await nextTick();
        await view.advance(16);
    }

    expect(view.saved.length).toBeLessThanOrEqual(2);
    expect(view.saved.length).toBeGreaterThan(0);

    view.setAnchor({ key: firstLine.key, offset: -100 });
    await nextTick();
    view.stop();
    expect(view.saved.at(-1)?.offset).toBe(-100);
});

test('a file that may turn out generated is landed on but not settled for: known generated, the next one takes over', async () => {
    const view = open({ position: null, files: [A, B], collapses: { 'a.ts': 'undecided', 'b.ts': 'undecided' } });
    view.setRows({ 'a.ts': { kind: 'collapsed' }, 'b.ts': { kind: 'collapsed' } });
    await nextTick();
    expect(view.jumps.at(-1)).toEqual([getReviewHeaderKey('a.ts'), 0]);
    expect(view.landing.value).toBe(true);

    view.setCollapses({ 'a.ts': 'generated', 'b.ts': null });
    view.setRows({ 'a.ts': { kind: 'collapsed' }, 'b.ts': lines() });
    await nextTick();

    expect(view.jumps.at(-1)).toEqual([getReviewHeaderKey('b.ts'), 0]);
    expect(view.landing.value).toBe(false);
    view.stop();
});

test('every file viewed, it lands at the top, once the list is known to hold no other', async () => {
    const view = open({
        position: null,
        files: [{ ...A, viewed: 'VIEWED' }],
        collapses: { 'a.ts': 'viewed' },
        listEnd: 'growing',
    });
    view.setRows({ 'a.ts': { kind: 'collapsed' } });
    await nextTick();
    expect(view.landing.value).toBe(true);

    view.setListEnd('certain');
    view.setRows({ 'a.ts': { kind: 'collapsed' } });
    await nextTick();

    expect(view.jumps.at(-1)).toEqual([getReviewHeaderKey('a.ts'), 0]);
    expect(view.landing.value).toBe(false);
    view.stop();
});

test('a first open does not settle while a later page may put an unread file above it, and a scroll meanwhile stays', async () => {
    const view = open({ position: null, files: [B, C], listEnd: 'growing' });
    view.setRows({ 'b.ts': lines(), 'c.ts': lines() });
    await nextTick();
    expect(view.jumps.at(-1)).toEqual([getReviewHeaderKey('b.ts'), 0]);
    expect(view.landing.value).toBe(true);

    view.setFiles([A, B, C]);
    view.setRows({ 'a.ts': lines(), 'b.ts': lines(), 'c.ts': lines() });
    await nextTick();
    expect(view.jumps.at(-1)).toEqual([getReviewHeaderKey('a.ts'), 0]);
    expect(view.landing.value).toBe(true);

    // The last page brought no rows.
    view.setListEnd('certain');
    await nextTick();
    expect(view.jumps.at(-1)).toEqual([getReviewHeaderKey('a.ts'), 0]);
    expect(view.landing.value).toBe(false);
    view.stop();

    const scrolled = open({ position: null, files: [B, C], listEnd: 'growing' });
    scrolled.setRows({ 'b.ts': lines(), 'c.ts': lines() });
    await nextTick();
    const jumps = scrolled.jumps.length;
    scrolled.landing.value = false;
    scrolled.setFiles([A, B, C]);
    scrolled.setRows({ 'a.ts': lines(), 'b.ts': lines(), 'c.ts': lines() });
    await nextTick();
    expect(scrolled.jumps).toHaveLength(jumps);
    scrolled.stop();
});

test('it says why it opened where it did: the first file not viewed, the place left, or nothing for only the top', async () => {
    const first = open({ position: null, files: [A, B], collapses: {} });
    first.setRows({ 'a.ts': lines(), 'b.ts': lines() });
    await nextTick();
    expect(first.arrival.value).toEqual({ kind: 'firstFile' });
    first.stop();

    const back = open({ position: LINE });
    back.setRows({ 'b.ts': lines() });
    await nextTick();
    expect(back.landing.value).toBe(false);
    expect(back.arrival.value).toEqual({ kind: 'left', place: LINE.place });
    back.stop();

    const viewed = open({ position: null, files: [{ ...A, viewed: 'VIEWED' }], collapses: { 'a.ts': 'viewed' } });
    viewed.setRows({ 'a.ts': { kind: 'collapsed' } });
    await nextTick();
    expect(viewed.arrival.value).toBeNull();
    viewed.stop();

    const gone = open({ position: LINE, files: [A] });
    gone.setRows({ 'a.ts': lines() });
    await nextTick();
    expect(gone.arrival.value).toBeNull();
    gone.stop();
});

interface OpenOptions {
    position: ReviewPosition | null;
    files?: readonly ReviewFile[];
    collapses?: Record<string, ReviewFileCollapse | null>;
    listEnd?: ReviewFileListEnd;
}

function open({ position, files = [A, B, C], collapses = {}, listEnd = 'certain' }: OpenOptions) {
    const session = createTestSession({ login: 'octocat', answer: () => undefined });
    const landing = shallowRef(true);
    const arrival = shallowRef<ReviewArrival | null>(null);
    const rows = shallowRef<readonly ReviewRow[]>([]);
    const ordered = shallowRef(files);
    const anchor = shallowRef<{ key: string; offset: number } | null>(null);
    const jumps: [string, number][] = [];
    const saved: ReviewPosition[] = [];
    const prioritized: string[] = [];
    let currentCollapses = collapses;
    const currentListEnd = shallowRef(listEnd);
    const setPosition = mock((next: ReviewPosition) => {
        saved.push(next);
    });
    const model: ReviewPositionFiles = {
        position,
        setPosition,
        prioritize: path => {
            prioritized.push(path);
        },
        getCollapse: path => currentCollapses[path] ?? null,
        get listEnd() {
            return currentListEnd.value;
        },
    };
    const list = {
        get anchor() {
            return anchor.value;
        },
        jumpTo(key: string, offset = 0) {
            jumps.push([key, offset]);
        },
    };

    const app = createApp({});
    const container = createContainer();
    container.set(Clock, session.clock);
    app.provide(injectionKey, container);
    const scope = effectScope();
    app.runWithContext(() =>
        scope.run(() =>
            useReviewPosition({
                files: model,
                rows,
                ordered,
                order: () => ordered.value.map(file => file.path),
                list,
                landing,
                arrival,
            }),
        ),
    );

    return {
        landing,
        arrival,
        rows,
        jumps,
        saved,
        prioritized,
        stop: () => scope.stop(),
        advance: (ms: number) => session.clock.advance(ms),
        setAnchor(next: { key: string; offset: number }) {
            anchor.value = next;
        },
        setFiles(next: readonly ReviewFile[]) {
            ordered.value = next;
        },
        setCollapses(next: Record<string, ReviewFileCollapse | null>) {
            currentCollapses = next;
        },
        setListEnd(next: ReviewFileListEnd) {
            currentListEnd.value = next;
        },
        setRows(contents: Record<string, ReviewFileContent>) {
            rows.value = buildReviewRows({
                files: ordered.value,
                getContent: file => contents[file.path] ?? { kind: 'placeholder' },
            });
        },
    };
}

function lines(): ReviewFileContent {
    return { kind: 'lines', rows: buildFileLineRows({ path: 'b.ts', diff: DIFF, layout: 'split' }) };
}

function sampleFile(path: string): ReviewFile {
    return { path, previousPath: null, changeType: 'MODIFIED', additions: 1, deletions: 1, viewed: 'UNVIEWED' };
}
