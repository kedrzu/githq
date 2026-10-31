import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';
import type { Font } from 'opentype.js';
import { parse } from 'opentype.js';

// Writes githq's icons into `public/` from the sygnet "/hq" of the brandbook ("Logo — git/hq" in `githq.pen`,
// section "App icon"): Geist 700 on the app's black tile, violet on the slash alone. The letters are outlines,
// not text, because wherever an icon is shown as an image there is no Geist. Run by hand when the logo
// changes (`bun --cwd packages/app icons`); the files it writes are committed.
//
// - `favicon.svg`: the browser tab, and the project icon Paseo finds in `packages/*/public`. In the
//   proportions of the 32 px tile, because it is shown at 32 px and below, where the letters grow.
// - `apple-touch-icon.png`: 180 px, in the proportions of the 120 px tile, square — iOS rounds it itself.
// - `icon-192.png`, `icon-512.png`: the installed app (`manifest.webmanifest`), the 120 px tile as drawn.
// - `icon-maskable-512.png`: the same, square, for launchers that cut their own shape; "/hq" stays inside
//   the safe circle (40 % of the side from the centre).
//
// It also writes the logo of the README from the wordmark "git/hq" (section "Logo"), into `docs/assets/readme/`:
// `wordmark-dark.svg` with light letters for GitHub's dark theme, `wordmark-light.svg` with dark letters for
// its light theme.

const PUBLIC = path.join(import.meta.dirname, '../public');
const README_ASSETS = path.join(import.meta.dirname, '../../../docs/assets/readme');
const FONT = path.join(import.meta.dirname, '../node_modules/@fontsource/geist/files/geist-latin-700-normal.woff');

const TILE = '#0e1013';
const SLASH = '#7b87f7';
const LETTERS = '#e4e6ea';
/** The wordmark's letters on a light page. */
const LETTERS_ON_LIGHT = TILE;

/** The README's wordmark: the brandbook's −3.5 % tracking (the app's `Wordmark.vue` sets its own). */
const WORDMARK = { fontSize: 64, letterSpacing: -0.035 };

/** One tile of the brandbook, as fractions of its side. */
interface TileShape {
    fontSize: number;
    letterSpacing: number;
    cornerRadius: number;
    /** The edge, if any, and its width. */
    stroke: { color: string; width: number } | null;
}

// The smaller the icon, the larger "/hq" on its tile, so it stays legible: the brandbook's 16 px type on a
// 32 px tile is raised to 54 %, and the 120 px tile's 38 % to 44 % for the icons seen at home-screen size
// (180, 192 px). The 512 px ones keep 38 % — the maskable one needs it to stay inside the safe circle.

/** "32 · 20 · 16": 7.36 px corners on 32 px, a 1 px #2E333B edge; the type raised from 16 px. */
const SMALL_TILE: TileShape = {
    fontSize: 0.54,
    letterSpacing: -0.05,
    cornerRadius: 7.36 / 32,
    stroke: { color: '#2e333b', width: 1 / 32 },
};

/** "Black tile": 46 px type and 27.6 px corners on 120 px, a 1 px faint white edge. */
const LARGE_TILE: TileShape = {
    fontSize: 46 / 120,
    letterSpacing: -0.035,
    cornerRadius: 27.6 / 120,
    stroke: { color: '#ffffff14', width: 1 / 120 },
};

/** The black tile full-bleed, for whoever rounds or masks it: no corners and no edge. */
const SQUARE_TILE: TileShape = { ...LARGE_TILE, cornerRadius: 0, stroke: null };

/** Home-screen size: the large tile with the type raised. */
const MEDIUM_FONT_SIZE = 0.44;

async function generateIcons() {
    const font = parse(toArrayBuffer(await readFile(FONT)));

    await writeFile(path.join(PUBLIC, 'favicon.svg'), drawIcon(font, 32, SMALL_TILE));

    const pngs: [string, number, TileShape][] = [
        ['apple-touch-icon.png', 180, { ...SQUARE_TILE, fontSize: MEDIUM_FONT_SIZE }],
        ['icon-192.png', 192, { ...LARGE_TILE, fontSize: MEDIUM_FONT_SIZE }],
        ['icon-512.png', 512, LARGE_TILE],
        ['icon-maskable-512.png', 512, SQUARE_TILE],
    ];
    for (const [file, size, shape] of pngs) {
        await writeFile(path.join(PUBLIC, file), new Resvg(drawIcon(font, size, shape)).render().asPng());
    }

    await writeFile(path.join(README_ASSETS, 'wordmark-dark.svg'), drawWordmark(font, LETTERS));
    await writeFile(path.join(README_ASSETS, 'wordmark-light.svg'), drawWordmark(font, LETTERS_ON_LIGHT));

    console.info(`Icons written to ${PUBLIC}, the README's wordmark to ${README_ASSETS}.`);
}

/** The sygnet on a `size`-px tile, as an SVG document. */
function drawIcon(font: Font, size: number, shape: TileShape): string {
    const fontSize = shape.fontSize * size;
    const tracking = shape.letterSpacing * fontSize;
    const scale = fontSize / font.unitsPerEm;

    // As the design lays it out: one line box as tall as the type (line height 1), the font's ascender and
    // descender centred in it, and the run — every glyph followed by the tracking — centred on the tile.
    const glyphs = font.stringToGlyphs('/hq');
    const width = glyphs.reduce((sum, glyph) => sum + (glyph.advanceWidth ?? 0) * scale + tracking, 0);
    const ascender = font.ascender * scale;
    const descender = font.descender * scale;
    const baseline = (size - fontSize) / 2 + (fontSize - (ascender - descender)) / 2 + ascender;

    let x = (size - width) / 2;
    const paths = glyphs.map((glyph, index) => {
        const outline = glyph.getPath(x, baseline, fontSize).toPathData(2);
        x += (glyph.advanceWidth ?? 0) * scale + tracking;
        return `<path fill="${index === 0 ? SLASH : LETTERS}" d="${outline}"/>`;
    });

    // The edge is drawn inside the tile, so nothing is cut off at its border.
    const edge = shape.stroke ? shape.stroke.width * size : 0;
    const stroke = shape.stroke ? ` stroke="${shape.stroke.color}" stroke-width="${round(edge)}"` : '';
    const tile = `<rect x="${round(edge / 2)}" y="${round(edge / 2)}" width="${round(size - edge)}" height="${round(size - edge)}" rx="${round(shape.cornerRadius * size)}" fill="${TILE}"${stroke}/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${tile}${paths.join('')}</svg>\n`;
}

/** The wordmark "git/hq" with `letters` in the given colour, on no background, as an SVG document. */
function drawWordmark(font: Font, letters: string): string {
    const { fontSize } = WORDMARK;
    const tracking = WORDMARK.letterSpacing * fontSize;
    const scale = fontSize / font.unitsPerEm;
    const ascender = font.ascender * scale;
    const height = ascender - font.descender * scale;

    // The line box from ascender to descender, as wide as the run without the tracking after its last glyph.
    const glyphs = font.stringToGlyphs('git/hq');
    let x = 0;
    const paths = glyphs.map((glyph, index) => {
        const outline = glyph.getPath(x, ascender, fontSize).toPathData(2);
        x += (glyph.advanceWidth ?? 0) * scale + (index < glyphs.length - 1 ? tracking : 0);
        return `<path fill="${index === 3 ? SLASH : letters}" d="${outline}"/>`;
    });
    const width = round(x);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${round(height)}" viewBox="0 0 ${width} ${round(height)}">${paths.join('')}</svg>\n`;
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

if (import.meta.main) {
    await generateIcons();
}
