import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'bun:test';

const TEXT = 4.5;
const GRAPHICS = 3;
const SURFACES = ['bg', 'bg-item', 'bg-2', 'bg-3', 'sel'];
const GRAPH_SURFACES = ['bg', 'row-stripe', 'sel'];
/** What the code sits on: every surface, and the lines of a diff over the window. */
const CODE_SURFACES = [...SURFACES, 'diff-bg-added', 'diff-bg-deleted'];
/** What a failure's message sits on: every surface, and a danger band over the window. */
const DANGER_SURFACES = [...SURFACES, 'bg-danger'];
const SYNTAX = ['comment', 'keyword', 'string', 'constant', 'title', 'tag', 'builtin'].map(name => `syntax-${name}`);

/** Every token against the surfaces it sits on (D30). Axe checks text, not icons, outlines and lines. */
const PAIRS: readonly (readonly [string, readonly string[], number])[] = [
    ['fg', [...CODE_SURFACES, 'bg-danger'], TEXT],
    ['fg-2', SURFACES, TEXT],
    ['fg-dim', SURFACES, TEXT],
    ['accent', SURFACES, TEXT],
    ['green', SURFACES, TEXT],
    ['red', DANGER_SURFACES, TEXT],
    ['amber', SURFACES, TEXT],
    ['purple', SURFACES, TEXT],
    ['diff-added', SURFACES, TEXT],
    ['diff-removed', SURFACES, TEXT],
    ['on-light', ['accent', 'button-light', 'button-light-hover'], TEXT],
    ['on-emphasis', ['red-emphasis'], TEXT],
    ['fg-3', SURFACES, GRAPHICS],
    ['control-border', SURFACES, GRAPHICS],
    ['focus', SURFACES, GRAPHICS],
    ['red-quiet', SURFACES, GRAPHICS],
    ['graph-line', GRAPH_SURFACES, GRAPHICS],
    ['graph-line-main', GRAPH_SURFACES, GRAPHICS],
    ...SYNTAX.map(token => [token, CODE_SURFACES, TEXT] as const),
];

/** The Primer dark value (a `#rrggbb`, or `<hex>/<alpha>` composited over the window) each colour is taken from. */
const TAKEN_FROM: Readonly<Record<string, string>> = {
    bg: '#0d1117', // bgColor-default
    'bg-2': '#151b23', // bgColor-muted
    border: '#2f353d', // borderColor-muted (#3D444DB3) over bg
    'border-2': '#3d444d', // borderColor-default
    'scrollbar-thumb': '#2f353d',
    'scrollbar-thumb-hover': '#3d444d',
    fg: '#f0f6fc', // fgColor-default
    'fg-2': '#9198a1', // fgColor-muted
    'fg-3': '#656c76', // fgColor-disabled
    'on-light': '#0d1117',
    green: '#3fb950', // fgColor-success
    red: '#f85149', // fgColor-danger
    amber: '#d29922', // fgColor-attention
    'red-emphasis': '#da3633', // bgColor-danger-emphasis
    'on-emphasis': '#ffffff', // fgColor-onEmphasis
    purple: '#ab7df8', // fgColor-done
    'diff-added': '#7ee787',
    'diff-removed': '#ffa198',
    'diff-bg-added': '#2ea043/0.15', // bgColor-success-muted
    'bg-danger': '#f85149/0.1', // bgColor-danger-muted
    'diff-bg-deleted': '#f85149/0.1', // bgColor-danger-muted
    'syntax-comment': '#9198a1', // prettylights-syntax-comment
    'syntax-keyword': '#ff7b72',
    'syntax-string': '#a5d6ff',
    'syntax-constant': '#79c0ff',
    'syntax-title': '#d2a8ff', // prettylights-syntax-entity
    'syntax-tag': '#7ee787', // prettylights-syntax-entity-tag
    'syntax-builtin': '#ffa657', // prettylights-syntax-variable
};

/** Values that differ from Primer on purpose, and why. Anything else that is not `TAKEN_FROM` is an accident. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
    'bg-item': "an opened item's background, between Primer's bgColor-default and bgColor-muted",
    'bg-3': "Primer's control-bgColor-rest #212830 fails red (4.44) and fg-3 (2.81) on it",
    sel: 'accent at 10.2% over bg, as bgColor-accent-muted is over GitHub',
    'fg-dim': 'Primer has two levels of text, we have three',
    'graph-line-main': "the default branch's line stays brighter",
    accent: 'the brand',
    'red-quiet': "Primer's #B62324 reads 2.93 on bg",
    'border-danger': "red at 35%, a little weaker than Primer's borderColor-danger-muted (40%)",
    'border-danger-strong': "red at 50%, between Primer's borderColor-danger-muted and borderColor-danger-emphasis",
};

const tokens = readTokens();

test.each(PAIRS)('%s reaches its contrast on every surface it sits on', (token, surfaces, required) => {
    const failing = surfaces.filter(surface => contrast(token, surface) < required);
    expect(failing).toEqual([]);
});

test.each(Object.entries(TAKEN_FROM))('%s is the Primer value %s', (token, primer) => {
    const [hex, alpha] = primer.split('/') as [string, string | undefined];
    const color = tokens.get(token);
    expect(color).toBeDefined();
    expect(toHex(color!)).toBe(hex);
    expect(color!.a).toBeCloseTo(alpha === undefined ? 1 : Number(alpha), 5);
});

test('every other colour is a named exception, an alias, or outside the palette', () => {
    const unnamed = [...tokens.keys()].filter(
        token =>
            !(token in TAKEN_FROM) &&
            !(token in EXCEPTIONS) &&
            !(
                token.startsWith('landing-') ||
                token.startsWith('button-light') ||
                token.startsWith('row-stripe') ||
                token.startsWith('skeleton-')
            ) &&
            !['control-border', 'graph-line', 'focus'].includes(token),
    );
    expect(unnamed).toEqual([]);
});

interface Color {
    r: number;
    g: number;
    b: number;
    a: number;
}

function contrast(a: string, b: string) {
    const [lighter, darker] = [luminance(composite(a, b)), luminance(composite(b, 'bg'))].toSorted((x, y) => y - x) as [
        number,
        number,
    ];
    return (lighter + 0.05) / (darker + 0.05);
}

/** The token as it looks over a surface: a translucent colour painted over it (a surface itself over the window). */
function composite(token: string, surface: string): Color {
    const color = get(token);
    const under = color.a < 1 && surface !== token ? composite(surface, 'bg') : { r: 0, g: 0, b: 0, a: 1 };
    if (color.a === 1) {
        return color;
    }
    return {
        r: color.r * color.a + under.r * (1 - color.a),
        g: color.g * color.a + under.g * (1 - color.a),
        b: color.b * color.a + under.b * (1 - color.a),
        a: 1,
    };
}

function luminance(color: Color) {
    const [r, g, b] = [color.r, color.g, color.b].map(value => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toHex(color: Color) {
    return `#${[color.r, color.g, color.b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function get(token: string) {
    const color = tokens.get(token);
    if (!color) {
        throw new Error(`No such token: ${token}`);
    }
    return color;
}

function hexColor(hex: string, a = 1): Color {
    const [r, g, b] = [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16)) as [
        number,
        number,
        number,
    ];
    return { r, g, b, a };
}

/** Reads `$color-*` declarations: a hex, an alias, `rgba(<hex or alias>, a)` or `rgb(255 255 255 / 2%)`. */
function readTokens() {
    const source = readFileSync(path.join(import.meta.dirname, 'tokens.scss'), 'utf8');
    const found = new Map<string, Color>();
    const resolve = (value: string) =>
        value.startsWith('#') ? hexColor(value) : found.get(value.slice('$color-'.length));
    for (const match of source.matchAll(/^\$color-([\w-]+):\s*([^;]+);/gm)) {
        const [, name, value] = match as unknown as [string, string, string];
        const rgba = /^rgba\((#[0-9a-f]{6}|\$color-[\w-]+),\s*([\d.]+)\)$/i.exec(value);
        const rgb = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)%\)$/.exec(value);
        let color: Color | undefined;
        if (rgba) {
            const base = resolve(rgba[1]!);
            color = base && { ...base, a: Number(rgba[2]) };
        } else if (rgb) {
            color = { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: Number(rgb[4]) / 100 };
        } else if (/^(#[0-9a-f]{6}|\$color-[\w-]+)$/i.test(value)) {
            color = resolve(value);
        }
        if (color) {
            found.set(name, color);
        }
    }
    return found;
}
