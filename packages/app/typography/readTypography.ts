import { deepEquals } from '@nzyme/utils/deepEquals.js';
import { isPlainObject } from '@nzyme/utils/isPlainObject.js';

import type { SettingsDocument } from '@/settings/sync/SettingsDocument.js';

import {
    CODE_FONTS,
    INTERFACE_FONTS,
    READING_FONTS,
    TYPOGRAPHY_PRESETS,
    TYPOGRAPHY_RANGES,
} from './typographyCatalog.js';
import type {
    CodeFontId,
    InterfaceFontId,
    ReadingFontId,
    SizedTypographyRole,
    TypographyFont,
    TypographyFonts,
    TypographyMetrics,
    TypographyPreset,
    TypographyRange,
} from './typographyCatalog.js';

/** A sized role's font, size and line height. */
export interface TypographyRoleValues<Id extends string> extends TypographyMetrics {
    readonly font: TypographyFont<Id>;
}

/** The font, size and line height of each role, as the app draws them. */
export interface TypographyValues {
    readonly reading: TypographyRoleValues<ReadingFontId>;
    readonly code: TypographyRoleValues<CodeFontId>;
    readonly interface: { readonly font: TypographyFont<InterfaceFontId> };
}

/** The typography the settings choose: each role's values — the preset's with the hand-made ones on top — and the preset. */
export interface TypographySettings extends TypographyValues {
    /** `'custom'` once any size or line height is hand-made. */
    readonly preset: TypographyPreset | 'custom';
}

/** A hand-made change of one role; a size or line height is snapped to the role's range and step. */
export type TypographyRoleChange =
    | {
          readonly role: 'reading';
          readonly font?: ReadingFontId;
          readonly size?: number;
          readonly lineHeight?: number;
      }
    | {
          readonly role: 'code';
          readonly font?: CodeFontId;
          readonly size?: number;
          readonly lineHeight?: number;
      }
    | { readonly role: 'interface'; readonly font: InterfaceFontId };

/** What {@link writeTypography} changes: a role by hand, or the preset, which drops every hand-made size and line height. */
export type TypographyChange = TypographyRoleChange | { readonly preset: TypographyPreset };

const METRICS = ['size', 'lineHeight'] as const;

/**
 * The typography the document chooses. Each field is read on its own: one absent or not understood (a newer build's
 * preset or font, a size out of range) reads as its default — the preset's value, the role's first font — and stays in
 * the file until the user changes that field.
 * @__NO_SIDE_EFFECTS__
 */
export function readTypography(document: SettingsDocument): TypographySettings {
    const written = asObject(document.typography);
    const preset = readPreset(written.preset);
    const reading = readSizedRole({ written, role: 'reading', preset, fonts: READING_FONTS });
    const code = readSizedRole({ written, role: 'code', preset, fonts: CODE_FONTS });
    return {
        preset: reading.custom || code.custom ? 'custom' : preset,
        reading: reading.values,
        code: code.values,
        interface: { font: readFont(INTERFACE_FONTS, asObject(written.interface).font) },
    };
}

/**
 * The document with the typography changed — over every other field of `typography` and the keys a newer build added
 * at any level, which stay (settings-sync D13). A field set to its default (the default preset, a role's first font, a
 * preset's size) is removed, and an object left empty with it. `null` when every field changed reads as that value
 * already, so a value not understood stays until the user picks another.
 * @__NO_SIDE_EFFECTS__
 */
export function writeTypography(document: SettingsDocument, change: TypographyChange): SettingsDocument | null {
    const current = readTypography(document);
    const written = asObject(document.typography);
    const next =
        'preset' in change ? writePreset(current, written, change.preset) : writeRole(current, written, change);
    if (deepEquals(next, written)) {
        return null;
    }

    if (Object.keys(next).length > 0) {
        return { ...document, typography: next };
    }

    const { typography: _removed, ...rest } = document;
    return rest;
}

interface ReadSizedRoleParams<Id extends string> {
    readonly written: Readonly<Record<string, unknown>>;
    readonly role: SizedTypographyRole;
    readonly preset: TypographyPreset;
    readonly fonts: TypographyFonts<Id>;
}

function readSizedRole<Id extends string>({ written, role, preset, fonts }: ReadSizedRoleParams<Id>) {
    const object = asObject(written[role]);
    const ranges = TYPOGRAPHY_RANGES[role];
    const size = readMetric(object.size, ranges.size);
    const lineHeight = readMetric(object.lineHeight, ranges.lineHeight);
    const values: TypographyRoleValues<Id> = {
        font: readFont(fonts, object.font),
        size: size ?? TYPOGRAPHY_PRESETS[preset][role].size,
        lineHeight: lineHeight ?? TYPOGRAPHY_PRESETS[preset][role].lineHeight,
    };
    return { values, custom: size != null || lineHeight != null };
}

function writePreset(
    current: TypographySettings,
    written: Readonly<Record<string, unknown>>,
    preset: TypographyPreset,
): Readonly<Record<string, unknown>> {
    if (current.preset === preset) {
        return written;
    }

    const dropped = { size: undefined, lineHeight: undefined };
    const next = assignFields(written, { preset: preset === 'default' ? undefined : preset });
    return writeRoleFields(writeRoleFields(next, 'reading', dropped), 'code', dropped);
}

function writeRole(
    current: TypographySettings,
    written: Readonly<Record<string, unknown>>,
    change: TypographyRoleChange,
): Readonly<Record<string, unknown>> {
    if (change.role === 'interface') {
        if (change.font === current.interface.font.id) {
            return written;
        }

        return writeRoleFields(written, 'interface', {
            font: change.font === INTERFACE_FONTS[0].id ? undefined : change.font,
        });
    }

    const { role } = change;
    const fields: Record<string, unknown> = {};
    const defaultFont = role === 'reading' ? READING_FONTS[0] : CODE_FONTS[0];
    if (change.font !== undefined && change.font !== current[role].font.id) {
        fields.font = change.font === defaultFont.id ? undefined : change.font;
    }

    const preset = readPreset(written.preset);
    for (const metric of METRICS) {
        const value = change[metric];
        if (value === undefined) {
            continue;
        }

        const snapped = snap(value, TYPOGRAPHY_RANGES[role][metric]);
        if (snapped !== current[role][metric]) {
            fields[metric] = snapped === TYPOGRAPHY_PRESETS[preset][role][metric] ? undefined : snapped;
        }
    }

    return Object.keys(fields).length > 0 ? writeRoleFields(written, role, fields) : written;
}

/**
 * `written` with the role's object given `fields` (`undefined` removes a key), the role's object removed once empty. A
 * role written as something other than an object is left as it is when every field is a removal: there is nothing of
 * this build's in it to remove.
 */
function writeRoleFields(
    written: Readonly<Record<string, unknown>>,
    role: string,
    fields: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
    const previous = written[role];
    if (!isPlainObject(previous) && Object.values(fields).every(value => value === undefined)) {
        return written;
    }

    const next = assignFields(isPlainObject(previous) ? previous : {}, fields);
    return assignFields(written, { [role]: Object.keys(next).length > 0 ? next : undefined });
}

/** `target` with `fields` set over it, a field of `undefined` removing its key. */
function assignFields(
    target: Readonly<Record<string, unknown>>,
    fields: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
    const result: Record<string, unknown> = { ...target, ...fields };
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) {
            delete result[key];
        }
    }

    return result;
}

function readPreset(value: unknown): TypographyPreset {
    switch (value) {
        case 'compact':
        case 'spaced':
            return value;
        default:
            return 'default';
    }
}

function readFont<Id extends string>(fonts: TypographyFonts<Id>, value: unknown): TypographyFont<Id> {
    return fonts.find(font => font.id === value) ?? fonts[0];
}

/** A hand-made value within the range, `null` for absent or not understood. Off-step values are taken as they are. */
function readMetric(value: unknown, range: TypographyRange): number | null {
    return typeof value === 'number' && value >= range.min && value <= range.max ? value : null;
}

/** `value` clamped to the range and rounded to its nearest step, without the float noise of the step's arithmetic. */
function snap(value: number, range: TypographyRange): number {
    const clamped = Math.min(range.max, Math.max(range.min, value));
    const steps = Math.round((clamped - range.min) / range.step);
    return Number((range.min + steps * range.step).toFixed(2));
}

function asObject(value: unknown): Readonly<Record<string, unknown>> {
    return isPlainObject(value) ? value : {};
}
