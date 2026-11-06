import type { PatchStatus } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import type { DiffLayout } from '../diff/buildDiffRows.js';

/** One line of a file still on its way: where its code would start and how long it would be, in characters. */
export interface PlaceholderBar {
    /** Indent levels of two characters, 0–4. */
    readonly indent: number;
    /** 3–72. */
    readonly length: number;
}

/** A split row of a placeholder: the bar on each side, `null` for a blank line or a side the line isn't on. */
export interface PlaceholderSplitRow {
    readonly before: PlaceholderBar | null;
    readonly after: PlaceholderBar | null;
}

/** Which file, how many rows, in which layout. */
export interface PlaceholderParams {
    /** Seeds the lines: a file always shows the same ones. */
    readonly path: string;
    readonly changeType: PatchStatus;
    readonly rows: number;
}

/** A placeholder in a layout. */
export interface PlaceholderMaskParams extends PlaceholderParams {
    readonly layout: DiffLayout;
}

type LineKind = 'context' | 'deleted' | 'added';

interface PlaceholderLine {
    readonly kind: LineKind;
    readonly bar: PlaceholderBar | null;
}

/** Code is JetBrains Mono at 12 px: 0.6 em a character. */
const CHAR_WIDTH = 7.2;
const INDENT_CHARS = 2;
const LINE_HEIGHT = 20;
const BAR_HEIGHT = 8;
/** Where code starts: unified after both line numbers and the sign, split after the number in each half. */
const UNIFIED_CODE_X = 108;
const SPLIT_CODE_X = 48;
/** The right half's code is after the 1 px divider too. */
const SPLIT_AFTER_CODE_X = SPLIT_CODE_X + 1;

const BLANK_CHANCE = 0.1;
const LENGTH_MEAN = 26;
const LENGTH_DEVIATION = 12;
const LENGTH_MIN = 3;
const LENGTH_MAX = 72;
const INDENT_MAX = 4;

const MASK_CACHE_SIZE = 64;
const maskCache = new Map<string, string>();

/**
 * The bars of a file still on its way (D38), as a CSS `url()` of an SVG to use as a mask: one bar per line where its code
 * will start, in the layout being read, as wide as the element and `rows` lines tall. Drawn from the file's path, so the
 * same lines show every time and in either layout.
 */
export function getPlaceholderMask(params: PlaceholderMaskParams): string {
    const key = [params.path, getSides(params.changeType), params.layout, params.rows].join('\u0000');
    const cached = maskCache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    const svg =
        params.layout === 'split'
            ? drawSplit(buildSplitPlaceholder(params))
            : drawUnified(buildUnifiedPlaceholder(params));
    const mask = `url("data:image/svg+xml,${svg.replace(/[<>%#]/g, encodeURIComponent)}")`;

    for (const oldest of maskCache.keys()) {
        if (maskCache.size < MASK_CACHE_SIZE) {
            break;
        }
        maskCache.delete(oldest);
    }
    maskCache.set(key, mask);
    return mask;
}

/**
 * A unified placeholder: one bar per row, `null` for a blank line. Context, then deleted, then added lines, in one column.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildUnifiedPlaceholder(params: PlaceholderParams): (PlaceholderBar | null)[] {
    const result: (PlaceholderBar | null)[] = [];
    for (const line of createLines(params)) {
        if (result.length >= params.rows) {
            break;
        }

        result.push(line.bar);
    }

    return result;
}

/**
 * A split placeholder from the same lines as the unified one: context on both sides, deleted lines left paired with
 * added lines right, the shorter run's rows empty on its side.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildSplitPlaceholder(params: PlaceholderParams): PlaceholderSplitRow[] {
    const { rows } = params;
    const result: PlaceholderSplitRow[] = [];
    let deleted: (PlaceholderBar | null)[] = [];
    let added: (PlaceholderBar | null)[] = [];

    for (const line of createLines(params)) {
        if (result.length >= rows) {
            break;
        }

        switch (line.kind) {
            case 'context':
                flush();
                result.push({ before: line.bar, after: line.bar });
                break;
            case 'deleted':
                if (added.length > 0) {
                    flush();
                }
                deleted.push(line.bar);
                break;
            case 'added':
                added.push(line.bar);
                break;
            default:
                assertNever(line.kind);
        }

        if (result.length + Math.max(deleted.length, added.length) >= rows) {
            flush();
        }
    }

    return result.slice(0, rows);

    function flush() {
        const count = Math.max(deleted.length, added.length);
        for (let i = 0; i < count; i++) {
            result.push({ before: deleted[i] ?? null, after: added[i] ?? null });
        }
        deleted = [];
        added = [];
    }
}

/** The file's lines in the order a unified diff lists them, endless: callers take as many as they draw. */
function* createLines({ path, changeType }: PlaceholderParams): Generator<PlaceholderLine> {
    const random = createRandom(hashPath(path));
    let indent = 0;
    let blankBefore = false;

    const sides = getSides(changeType);
    while (true) {
        if (sides !== 'both') {
            yield { kind: sides === 'after' ? 'added' : 'deleted', bar: nextBar() };
            continue;
        }

        const context = 2 + Math.floor(random() * 5);
        let deleted = Math.floor(random() * 5);
        let added = Math.floor(random() * 5);
        if (deleted + added === 0) {
            if (random() < 0.5) {
                deleted = 1;
            } else {
                added = 1;
            }
        }

        for (let i = 0; i < context; i++) {
            yield { kind: 'context', bar: nextBar() };
        }
        for (let i = 0; i < deleted; i++) {
            yield { kind: 'deleted', bar: nextBar() };
        }
        for (let i = 0; i < added; i++) {
            yield { kind: 'added', bar: nextBar() };
        }
    }

    function nextBar(): PlaceholderBar | null {
        if (!blankBefore && random() < BLANK_CHANCE) {
            blankBefore = true;
            indent = Math.min(indent, 1);
            return null;
        }

        blankBefore = false;
        const step = random();
        indent = clamp(indent + (step < 0.2 ? -1 : step < 0.8 ? 0 : 1), 0, INDENT_MAX);
        const length = clamp(Math.round(LENGTH_MEAN + LENGTH_DEVIATION * nextNormal()), LENGTH_MIN, LENGTH_MAX);
        return { indent, length };
    }

    /** Box–Muller. */
    function nextNormal() {
        const u = 1 - random();
        const v = random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
}

function drawUnified(bars: readonly (PlaceholderBar | null)[]) {
    return wrapSvg(drawBars(bars, UNIFIED_CODE_X));
}

/** Each half its own viewport, so a long bar ends at its column's edge. */
function drawSplit(rows: readonly PlaceholderSplitRow[]) {
    const before = drawBars(
        rows.map(row => row.before),
        SPLIT_CODE_X,
    );
    const after = drawBars(
        rows.map(row => row.after),
        SPLIT_AFTER_CODE_X,
    );
    return wrapSvg(
        `<svg width='50%' height='100%'>${before}</svg><svg x='50%' width='50%' height='100%'>${after}</svg>`,
    );
}

function drawBars(bars: readonly (PlaceholderBar | null)[], codeX: number) {
    let result = '';
    const top = (LINE_HEIGHT - BAR_HEIGHT) / 2;
    for (const [index, bar] of bars.entries()) {
        if (bar) {
            const x = codeX + bar.indent * INDENT_CHARS * CHAR_WIDTH;
            result += `<rect x='${round(x)}' y='${index * LINE_HEIGHT + top}' width='${round(bar.length * CHAR_WIDTH)}' height='${BAR_HEIGHT}' rx='2'/>`;
        }
    }
    return result;
}

function wrapSvg(content: string) {
    return `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>${content}</svg>`;
}

function getSides(changeType: PatchStatus) {
    switch (changeType) {
        case 'ADDED':
            return 'after';
        case 'DELETED':
            return 'before';
        case 'CHANGED':
        case 'COPIED':
        case 'MODIFIED':
        case 'RENAMED':
            return 'both';
        default:
            return assertNever(changeType);
    }
}

/** FNV-1a, 32 bits. */
function hashPath(path: string) {
    let hash = 0x811c9dc5;
    for (const char of path) {
        hash ^= char.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

/** mulberry32: [0, 1). */
function createRandom(seed: number) {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function round(value: number) {
    return Math.round(value * 10) / 10;
}
