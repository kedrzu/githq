import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'bun:test';

const TEXT = 4.5;
const GRAPHICS = 3;
const SURFACES = ['bg', 'bg-2', 'bg-3', 'sel'];
const GRAPH_SURFACES = ['bg', 'row-stripe', 'sel'];

/** Every token against the surfaces it sits on (D30). Axe checks text, not icons, outlines and lines. */
const PAIRS: readonly (readonly [string, readonly string[], number])[] = [
    ['fg', SURFACES, TEXT],
    ['fg-2', SURFACES, TEXT],
    ['fg-dim', SURFACES, TEXT],
    ['accent', SURFACES, TEXT],
    ['green', SURFACES, TEXT],
    ['red', SURFACES, TEXT],
    ['amber', SURFACES, TEXT],
    ['purple', SURFACES, TEXT],
    ['diff-added', SURFACES, TEXT],
    ['diff-removed', SURFACES, TEXT],
    ['on-light', ['accent', 'button-light', 'button-light-hover'], TEXT],
    ['fg-3', SURFACES, GRAPHICS],
    ['control-border', SURFACES, GRAPHICS],
    ['focus', SURFACES, GRAPHICS],
    ['red-quiet', SURFACES, GRAPHICS],
    ['graph-line', GRAPH_SURFACES, GRAPHICS],
    ['graph-line-main', GRAPH_SURFACES, GRAPHICS],
];

const tokens = readTokens();

test.each(PAIRS)('%s reaches its contrast on every surface it sits on', (token, surfaces, required) => {
    const failing = surfaces.filter(surface => contrast(token, surface) < required);
    expect(failing).toEqual([]);
});

function contrast(a: string, b: string) {
    const [lighter, darker] = [luminance(a), luminance(b)].toSorted((x, y) => y - x) as [number, number];
    return (lighter + 0.05) / (darker + 0.05);
}

function luminance(token: string) {
    const hex = tokens.get(token);
    if (!hex) {
        throw new Error(`No such token: ${token}`);
    }
    const [r, g, b] = [1, 3, 5].map(start => {
        const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function readTokens() {
    const source = readFileSync(path.join(import.meta.dirname, 'tokens.scss'), 'utf8');
    const found = new Map<string, string>();
    for (const match of source.matchAll(/^\$color-([\w-]+):\s*(#[0-9a-f]{6}|\$color-[\w-]+);/gim)) {
        const value = match[2]!;
        found.set(match[1]!, found.get(value.slice('$color-'.length)) ?? value);
    }
    // `$color-row-stripe` is white at 2%: as it paints over the window.
    found.set('row-stripe', '#131518');
    return found;
}
