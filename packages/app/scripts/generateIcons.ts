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

const PUBLIC = path.join(import.meta.dirname, '../public');
const FONT = path.join(import.meta.dirname, '../node_modules/@fontsource/geist/files/geist-latin-700-normal.woff');

const TILE = '#0e1013';
const SLASH = '#7b87f7';
const LETTERS = '#e4e6ea';

/** One tile of the brandbook, as fractions of its side. */
interface TileShape {
    fontSize: number;
    letterSpacing: number;
    cornerRadius: number;
    stroke: string | null;
}

/** "32 · 20 · 16": 16 px type and 7.36 px corners on 32 px, a 1 px #2E333B edge. */
const SMALL_TILE: TileShape = { fontSize: 16 / 32, letterSpacing: -0.05, cornerRadius: 7.36 / 32, stroke: '#2e333b' };

/** "Black tile": 46 px type on 120 px; full-bleed, so no corners and no edge. */
const LARGE_TILE: TileShape = { fontSize: 46 / 120, letterSpacing: -0.035, cornerRadius: 0, stroke: null };

async function generateIcons() {
    const font = parse(toArrayBuffer(await readFile(FONT)));

    await writeFile(path.join(PUBLIC, 'favicon.svg'), drawIcon(font, 32, SMALL_TILE));

    const png = new Resvg(drawIcon(font, 180, LARGE_TILE)).render().asPng();
    await writeFile(path.join(PUBLIC, 'apple-touch-icon.png'), png);

    console.info(`Icons written to ${PUBLIC}.`);
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

    const radius = round(shape.cornerRadius * size);
    const tile = shape.stroke
        ? `<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${radius}" fill="${TILE}" stroke="${shape.stroke}"/>`
        : `<rect width="${size}" height="${size}" fill="${TILE}"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${tile}${paths.join('')}</svg>\n`;
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
