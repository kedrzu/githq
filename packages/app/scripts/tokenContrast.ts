/**
 * The WCAG contrast of every text/background and UI-component/background pair `styles/tokens.scss` is used in, with the
 * changes #119 proposes. Which pairs really render comes from the audit of the stories (`packages/e2e/src/audit/`).
 *
 * `bun packages/app/scripts/tokenContrast.ts`
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

type Rgb = readonly [number, number, number];

const TEXT = 4.5;
const UI = 3;

/** The proposal: token → its new value. A token that doesn't exist yet is added. */
const PROPOSED: Record<string, string> = {
    // The value of `$color-fg-3`, which already reaches 3:1 on every surface: no new color for the eye.
    'control-border': '#646b75',
    'graph-line': '#646b75',
    'red-quiet': '#ac4d52',
};

const tokens = readTokens();

const SURFACES = ['bg', 'bg-2', 'bg-3', 'sel'];
const PAIRS: { fg: string; on: string[]; need: number; what: string }[] = [
    { fg: 'fg', on: SURFACES, need: TEXT, what: 'main text' },
    { fg: 'fg-2', on: SURFACES, need: TEXT, what: 'secondary text, idle navigation' },
    { fg: 'fg-dim', on: SURFACES, need: TEXT, what: 'counts, headers, status bar' },
    { fg: 'accent', on: SURFACES, need: TEXT, what: 'links, accent text' },
    { fg: 'green', on: SURFACES, need: TEXT, what: 'status text' },
    { fg: 'red', on: SURFACES, need: TEXT, what: 'status text' },
    { fg: 'amber', on: SURFACES, need: TEXT, what: 'status text' },
    { fg: 'purple', on: SURFACES, need: TEXT, what: 'status text' },
    { fg: 'diff-added', on: SURFACES, need: TEXT, what: 'pull request size' },
    { fg: 'diff-removed', on: SURFACES, need: TEXT, what: 'pull request size' },
    {
        fg: 'on-light',
        on: ['accent', 'button-light', 'button-light-hover'],
        need: TEXT,
        what: 'text on a filled button',
    },
    { fg: 'fg-3', on: SURFACES, need: UI, what: 'dim icons, decoration' },
    { fg: 'focus', on: SURFACES, need: UI, what: 'the focus ring' },
    { fg: 'red-quiet', on: SURFACES, need: UI, what: 'a quiet failure mark' },
    { fg: 'graph-line', on: ['bg', 'row-stripe', 'sel'], need: UI, what: 'a commit graph line' },
    { fg: 'graph-line-main', on: ['bg', 'row-stripe', 'sel'], need: UI, what: 'the default branch’s graph line' },
    { fg: 'border-2', on: SURFACES, need: UI, what: 'outline of a field or checkbox (today)' },
    { fg: 'control-border', on: SURFACES, need: UI, what: 'outline of a field or checkbox (proposed)' },
    { fg: 'bg-3', on: ['bg', 'bg-2'], need: UI, what: 'a current tab or sidebar row, by its fill alone' },
    { fg: 'accent', on: ['bg-3'], need: UI, what: 'a current tab, by a bar of the accent (proposed)' },
];

console.log('| Pair | For | Need | Today | Proposed |');
console.log('|-|-|-|-|-|');
for (const pair of PAIRS) {
    for (const on of pair.on) {
        const today = ratio(tokens.get(pair.fg), tokens.get(on));
        const after = ratio(valueOf(pair.fg), valueOf(on));
        const changed = PROPOSED[pair.fg] || PROPOSED[on];
        console.log(
            `| ${pair.fg} on ${on} | ${pair.what} | ${pair.need} | ${format(today, pair.need)} | ${changed ? format(after, pair.need) : ''} |`,
        );
    }
}

/** A value reached by lightening: the least step from `from` passing `need` on every surface given. */
console.log('\nThe least lightening that passes:');
for (const [token, on, need] of [
    ['border-2', SURFACES, UI],
    ['graph-line', ['bg', 'row-stripe', 'sel'], UI],
    ['red-quiet', SURFACES, UI],
    ['fg-3', SURFACES, UI],
] as const) {
    console.log(`${token} ${tokens.get(token)} → ${lighten(token, on, need)} on ${on.join(', ')}`);
}

function lighten(token: string, on: readonly string[], need: number) {
    const start = parse(tokens.get(token)!);
    for (let step = 0; step <= 255; step++) {
        const candidate = start.map(part => Math.min(255, part + step)) as unknown as Rgb;
        if (on.every(surface => contrast(candidate, parse(tokens.get(surface)!)) >= need)) {
            return toHex(candidate);
        }
    }
    return 'none';
}

function valueOf(token: string) {
    return PROPOSED[token] ?? tokens.get(token);
}

function ratio(fg: string | undefined, bg: string | undefined) {
    return fg && bg ? contrast(parse(fg), parse(bg)) : null;
}

function format(value: number | null, need: number) {
    if (value === null) {
        return '–';
    }
    return `${value.toFixed(2)}${value < need ? ' ✗' : ''}`;
}

function contrast(a: Rgb, b: Rgb) {
    const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
}

function luminance(color: Rgb) {
    const [r, g, b] = color.map(part => {
        const c = part / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parse(hex: string): Rgb {
    return [
        Number.parseInt(hex.slice(1, 3), 16),
        Number.parseInt(hex.slice(3, 5), 16),
        Number.parseInt(hex.slice(5, 7), 16),
    ];
}

function toHex(color: Rgb) {
    return `#${color.map(part => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
}

function readTokens() {
    const source = readFileSync(path.join(import.meta.dirname, '../styles/tokens.scss'), 'utf8');
    const found = new Map<string, string>();
    for (const match of source.matchAll(
        /^\$color-([\w-]+):\s*(#[0-9a-f]{6}|\$color-[\w-]+|rgb\(255 255 255 \/ 2%\));/gim,
    )) {
        found.set(match[1]!, match[2]!);
    }
    for (const [name, value] of found) {
        if (value.startsWith('$color-')) {
            found.set(name, found.get(value.slice('$color-'.length))!);
        }
    }
    // The stripe over the window, as it paints.
    found.set('row-stripe', '#131518');
    return found;
}
