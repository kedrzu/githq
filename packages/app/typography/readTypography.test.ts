/// <reference types="bun" />
import { expect, test } from 'bun:test';

import type { SettingsDocument } from '@/settings/sync/SettingsDocument.js';

import { readTypography, writeTypography } from './readTypography.js';
import type { TypographySettings } from './readTypography.js';
import { CODE_FONTS, INTERFACE_FONTS, READING_FONTS } from './typographyCatalog.js';

const EMPTY: SettingsDocument = { version: 1, repositories: [], projects: [] };

/** Every field holding something this build does not understand, beside keys a newer build added at each level. */
const NOT_UNDERSTOOD = {
    preset: 'roomy',
    reading: { font: 'comic-sans', size: 50, lineHeight: '1.5', weight: 450 },
    code: { font: 42, size: 10, ligatures: false },
    interface: { font: 'future-sans', tracking: 0.1 },
    contrast: 'high',
};

test('absent typography reads as the default preset with the first font of each role', () => {
    const expected: TypographySettings = {
        preset: 'default',
        reading: { font: READING_FONTS[0], size: 14, lineHeight: 1.5 },
        code: { font: CODE_FONTS[0], size: 12, lineHeight: 20 },
        interface: { font: INTERFACE_FONTS[0] },
    };
    expect(readTypography(EMPTY)).toEqual(expected);
    expect(readTypography({ ...EMPTY, typography: 'large' })).toEqual(expected);
    expect(readTypography({ ...EMPTY, typography: NOT_UNDERSTOOD })).toEqual(expected);
});

test("each field reads on its own: the preset's values with valid hand-made ones on top make it custom", () => {
    const document: SettingsDocument = {
        ...EMPTY,
        typography: {
            preset: 'spaced',
            reading: { font: 'literata', size: 16.5, lineHeight: 2.5 },
            code: { font: 'nope', lineHeight: 24 },
            interface: { font: 'literata' },
        },
    };

    const expected: TypographySettings = {
        preset: 'custom',
        reading: { font: READING_FONTS[5]!, size: 16.5, lineHeight: 1.65 },
        code: { font: CODE_FONTS[0], size: 13, lineHeight: 24 },
        // Literata is not an Interface font.
        interface: { font: INTERFACE_FONTS[0] },
    };
    expect(readTypography(document)).toEqual(expected);
    expect(readTypography({ ...EMPTY, typography: { preset: 'compact', reading: { font: 'system' } } })).toMatchObject({
        preset: 'compact',
        reading: { size: 13, lineHeight: 1.5 },
    });
});

test('changing one field keeps every field not understood and the unknown keys at every level', () => {
    const document: SettingsDocument = { ...EMPTY, typography: NOT_UNDERSTOOD, other: 1 };

    const written = writeTypography(document, { role: 'code', lineHeight: 22 });

    const expected: SettingsDocument = {
        ...document,
        typography: { ...NOT_UNDERSTOOD, code: { ...NOT_UNDERSTOOD.code, lineHeight: 22 } },
    };
    expect(written).toEqual(expected);
    expect(writeTypography(document, { role: 'interface', font: 'system' })).toEqual({
        ...document,
        typography: { ...NOT_UNDERSTOOD, interface: { ...NOT_UNDERSTOOD.interface, font: 'system' } },
    });
});

test('choosing a preset drops every hand-made size and line height in both roles but keeps fonts and unknown keys', () => {
    const document: SettingsDocument = {
        ...EMPTY,
        typography: {
            preset: 'compact',
            reading: { font: 'literata', size: 16, lineHeight: 1.8, weight: 450 },
            code: { size: 14, lineHeight: 'x' },
            future: true,
        },
    };

    const spaced = writeTypography(document, { preset: 'spaced' });
    const expected: SettingsDocument = {
        ...EMPTY,
        typography: { preset: 'spaced', reading: { font: 'literata', weight: 450 }, future: true },
    };
    expect(spaced).toEqual(expected);
    expect(spaced && readTypography(spaced).preset).toBe('spaced');

    // From custom back to the preset under it: the default is written as no key.
    const custom: SettingsDocument = { ...EMPTY, typography: { reading: { size: 16 } } };
    expect(writeTypography(custom, { preset: 'default' })).toEqual(EMPTY);
});

test('a value that reads as it already writes nothing, so a value not understood stays until the user picks another', () => {
    const document: SettingsDocument = { ...EMPTY, typography: NOT_UNDERSTOOD };

    expect(writeTypography(document, { preset: 'default' })).toBeNull();
    expect(writeTypography(document, { role: 'reading', font: 'inter', size: 14, lineHeight: 1.5 })).toBeNull();
    expect(writeTypography(document, { role: 'code', font: 'jetbrains-mono', size: 12 })).toBeNull();
    expect(writeTypography(document, { role: 'interface', font: 'inter' })).toBeNull();
    // Snapped to what it reads as already.
    expect(writeTypography(document, { role: 'reading', size: 14.2 })).toBeNull();
    expect(writeTypography(EMPTY, { preset: 'default' })).toBeNull();
});

test('a hand-made value is snapped to the range and step; the preset value or the first font removes the key and empty objects', () => {
    const reading = writeTypography(EMPTY, { role: 'reading', size: 12.3, lineHeight: 1.62 });
    expect(reading).toEqual({ ...EMPTY, typography: { reading: { size: 12.5, lineHeight: 1.6 } } });

    const code = writeTypography(EMPTY, { role: 'code', size: 40, lineHeight: 3 });
    expect(code).toEqual({ ...EMPTY, typography: { code: { size: 16, lineHeight: 15 } } });

    const fonted = writeTypography(EMPTY, { role: 'code', font: 'fira-code' });
    expect(fonted).toEqual({ ...EMPTY, typography: { code: { font: 'fira-code' } } });

    // Back to the preset's values and the default font: the file is as if never chosen, the preset no longer custom.
    expect(reading && writeTypography(reading, { role: 'reading', size: 14, lineHeight: 1.5 })).toEqual(EMPTY);
    expect(fonted && writeTypography(fonted, { role: 'code', font: 'jetbrains-mono' })).toEqual(EMPTY);
});
