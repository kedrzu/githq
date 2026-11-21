import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';
import type { Font } from 'opentype.js';
import { parse } from 'opentype.js';

// Writes every app icon of githq from the sygnet "/hq" of the brandbook ("Logo — git/hq" in `githq.pen`,
// section "App icon"): Geist 700 on the app's black tile, violet on the slash alone. The letters are outlines,
// not text, because wherever an icon is shown as an image there is no Geist. Run by hand when the logo
// changes (`bun --cwd packages/app icons`); the files it writes are committed.
//
// One guideline sizes "/hq" on every icon (`docs/design/githq/app-icons.md`): the smaller the icon is shown, the
// larger the letters on its tile (`getTileShape()`). What counts is the size it is shown at, not its pixels: a
// Retina file has twice the pixels of the same icon.
//
// - `public/favicon.svg`: the browser tab, and the project icon Paseo finds in `packages/*/public`; 32 px.
// - `public/apple-touch-icon.png`: 180 px, square — iOS rounds it itself.
// - `public/icon-192.png`, `public/icon-512.png`: the installed app (`manifest.webmanifest`).
// - `public/icon-maskable-512.png`: the 512 px one, square, for launchers that cut their own shape; "/hq" stays
//   inside the safe circle (40 % of the side from the centre).
// - `packages/desktop/src-tauri/icons`: the desktop app's icons, the files `tauri.conf.json` lists. `icon.icns`
//   and `icon.ico` hold one image per size, each drawn for its size rather than scaled from one.
// - `docs/assets/app-icons`: the reference set, SVG and PNG at every size the guideline lists.
//
// It also writes the README's logo, `docs/assets/readme/wordmark.svg`: the wordmark "git/hq" (section "Logo")
// on the app's black tile, its clear space (the height of the "h") on every side. One image that reads on any
// page, because GitHub's light/dark `<picture>` follows the system, not GitHub's theme, whenever a content
// blocker stops GitHub's script that switches it.

const PUBLIC = path.join(import.meta.dirname, '../public');
const DOCS_ASSETS = path.join(import.meta.dirname, '../../../docs/assets');
const README_ASSETS = path.join(DOCS_ASSETS, 'readme');
const REFERENCE = path.join(DOCS_ASSETS, 'app-icons');
const DESKTOP_ICONS = path.join(import.meta.dirname, '../../desktop/src-tauri/icons');
const FONT = path.join(import.meta.dirname, '../node_modules/@fontsource/geist/files/geist-latin-700-normal.woff');

const TILE = '#0e1013';
const SLASH = '#7b87f7';
const LETTERS = '#e4e6ea';
/** The README's wordmark: the brandbook's −3.5 % tracking (the app's `Wordmark.vue` sets its own). */
const WORDMARK = { fontSize: 64, letterSpacing: -0.035 };

/** A tile of the brandbook without its type, as fractions of its side. */
interface TileStyle {
    letterSpacing: number;
    cornerRadius: number;
    /** The edge, if any, and its width. */
    stroke: { color: string; width: number } | null;
}

/** A tile with "/hq" on it, as fractions of its side. */
interface TileShape extends TileStyle {
    fontSize: number;
}

/** "32 · 20 · 16": 7.36 px corners on 32 px, a 1 px #2E333B edge, tighter tracking. Up to 32 px. */
const SMALL_TILE: TileStyle = {
    letterSpacing: -0.05,
    cornerRadius: 7.36 / 32,
    stroke: { color: '#2e333b', width: 1 / 32 },
};

/** "Black tile": 27.6 px corners on 120 px, a 1 px faint white edge. Above 32 px. */
const LARGE_TILE: TileStyle = {
    letterSpacing: -0.035,
    cornerRadius: 27.6 / 120,
    stroke: { color: '#ffffff14', width: 1 / 120 },
};

/** The sizes of the reference set, as shown. */
const REFERENCE_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];

/** `icon.icns`: each entry's type, the size macOS shows it at and its pixels. */
const ICNS_ENTRIES: [string, number, number][] = [
    ['icp4', 16, 16],
    ['ic11', 16, 32],
    ['icp5', 32, 32],
    ['ic12', 32, 64],
    ['ic07', 128, 128],
    ['ic13', 128, 256],
    ['ic08', 256, 256],
    ['ic14', 256, 512],
    ['ic09', 512, 512],
    ['ic10', 512, 1024],
];

/** `icon.ico`: the sizes Windows picks from. */
const ICO_SIZES = [16, 24, 32, 48, 64, 256];

async function generateIcons() {
    const font = parse(toArrayBuffer(await readFile(FONT)));

    await writeFile(path.join(PUBLIC, 'favicon.svg'), drawIcon(font, 32, getTileShape(32)));
    await writeFile(path.join(PUBLIC, 'apple-touch-icon.png'), renderPng(font, 180, 180, { square: true }));
    await writeFile(path.join(PUBLIC, 'icon-192.png'), renderPng(font, 192));
    await writeFile(path.join(PUBLIC, 'icon-512.png'), renderPng(font, 512));
    await writeFile(path.join(PUBLIC, 'icon-maskable-512.png'), renderPng(font, 512, 512, { square: true }));

    await writeFile(path.join(DESKTOP_ICONS, '32x32.png'), renderPng(font, 32));
    await writeFile(path.join(DESKTOP_ICONS, '128x128.png'), renderPng(font, 128));
    await writeFile(path.join(DESKTOP_ICONS, '128x128@2x.png'), renderPng(font, 128, 256));
    await writeFile(path.join(DESKTOP_ICONS, 'icon.png'), renderPng(font, 512));
    await writeFile(
        path.join(DESKTOP_ICONS, 'icon.icns'),
        packIcns(ICNS_ENTRIES.map(([type, shownAt, pixels]) => [type, renderPng(font, shownAt, pixels)])),
    );
    await writeFile(
        path.join(DESKTOP_ICONS, 'icon.ico'),
        packIco(ICO_SIZES.map(size => [size, renderPng(font, size)])),
    );

    await mkdir(REFERENCE, { recursive: true });
    for (const size of REFERENCE_SIZES) {
        await writeFile(path.join(REFERENCE, `app-icon-${size}.svg`), drawIcon(font, size, getTileShape(size)));
        await writeFile(path.join(REFERENCE, `app-icon-${size}.png`), renderPng(font, size));
    }

    await writeFile(path.join(README_ASSETS, 'wordmark.svg'), drawWordmark(font));

    console.info(
        `Icons written to ${PUBLIC}, ${DESKTOP_ICONS} and ${REFERENCE}, the README's wordmark to ${README_ASSETS}.`,
    );
}

/**
 * The guideline's tile for an icon shown at `shownAt` px: "/hq" set at 54 % of the side up to 32 px, where it
 * already spans 85 % of the tile's width, then 4 points less with every doubling (128 px 46 %, 512 px 38 %).
 * @__NO_SIDE_EFFECTS__
 */
function getTileShape(shownAt: number): TileShape {
    const fontSize = round(0.54 - 0.04 * Math.log2(Math.max(shownAt, 32) / 32));
    return { ...(shownAt <= 32 ? SMALL_TILE : LARGE_TILE), fontSize };
}

/** Options of `renderPng()`. */
interface RenderPngOptions {
    /** No corners and no edge, for whoever rounds or masks the icon. */
    square: boolean;
}

/**
 * The icon shown at `shownAt` px, rendered at `pixels` px.
 * @__NO_SIDE_EFFECTS__
 */
function renderPng(font: Font, shownAt: number, pixels = shownAt, options?: RenderPngOptions): Buffer {
    const tile = getTileShape(shownAt);
    const shape = options?.square ? { ...tile, cornerRadius: 0, stroke: null } : tile;
    return new Resvg(drawIcon(font, pixels, shape)).render().asPng();
}

/**
 * An Apple icon file (`.icns`) of PNG entries: the magic, the file's length, then each entry's type and length.
 * @__NO_SIDE_EFFECTS__
 */
function packIcns(entries: [string, Buffer][]): Buffer {
    const chunks = [];
    for (const [type, png] of entries) {
        const header = Buffer.alloc(8);
        header.write(type, 0, 'ascii');
        header.writeUInt32BE(png.length + 8, 4);
        chunks.push(header, png);
    }
    const body = Buffer.concat(chunks);
    const header = Buffer.alloc(8);
    header.write('icns', 0, 'ascii');
    header.writeUInt32BE(header.length + body.length, 4);
    return Buffer.concat([header, body]);
}

/**
 * A Windows icon file (`.ico`) of PNG images: a header, one directory entry per image, then the images.
 * @__NO_SIDE_EFFECTS__
 */
function packIco(images: [number, Buffer][]): Buffer {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(images.length, 4);

    const entries = [];
    let offset = header.length + 16 * images.length;
    for (const [size, png] of images) {
        const entry = Buffer.alloc(16);
        // 0 stands for 256: the byte holds no more than 255.
        entry.writeUInt8(size % 256, 0);
        entry.writeUInt8(size % 256, 1);
        entry.writeUInt16LE(1, 4);
        entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(png.length, 8);
        entry.writeUInt32LE(offset, 12);
        entries.push(entry);
        offset += png.length;
    }
    return Buffer.concat([header, ...entries, ...images.map(([, png]) => png)]);
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

/** The wordmark "git/hq" on the black tile, as an SVG document. */
function drawWordmark(font: Font): string {
    const { fontSize } = WORDMARK;
    const tracking = WORDMARK.letterSpacing * fontSize;
    const scale = fontSize / font.unitsPerEm;
    const ascender = font.ascender * scale;

    // The run on the line box, then measured by its ink, so the clear space starts at the letters themselves.
    const glyphs = font.stringToGlyphs('git/hq');
    let x = 0;
    const outlines = glyphs.map(glyph => {
        const outline = glyph.getPath(x, ascender, fontSize);
        x += (glyph.advanceWidth ?? 0) * scale + tracking;
        return outline;
    });
    const boxes = outlines.map(outline => outline.getBoundingBox());
    const left = Math.min(...boxes.map(box => box.x1));
    const top = Math.min(...boxes.map(box => box.y1));
    const right = Math.max(...boxes.map(box => box.x2));
    const bottom = Math.max(...boxes.map(box => box.y2));

    const h = boxes[4]!;
    const space = h.y2 - h.y1;
    const width = round(right - left + 2 * space);
    const height = round(bottom - top + 2 * space);
    const edge = LARGE_TILE.stroke!;

    const tile = `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="${round(LARGE_TILE.cornerRadius * height)}" fill="${TILE}" stroke="${edge.color}"/>`;
    const paths = outlines.map(
        (outline, index) => `<path fill="${index === 3 ? SLASH : LETTERS}" d="${outline.toPathData(2)}"/>`,
    );

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${tile}<g transform="translate(${round(space - left)} ${round(space - top)})">${paths.join('')}</g></svg>\n`;
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
