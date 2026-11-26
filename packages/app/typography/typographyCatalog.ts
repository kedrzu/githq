/** A set of sizes and line heights for the Reading and Code roles, picked as one. */
export type TypographyPreset = 'compact' | 'default' | 'spaced';

/** The roles with a size and a line height of their own; Interface has only a font. */
export type SizedTypographyRole = 'reading' | 'code';

/** The fonts the Reading role offers (prose: descriptions, comments). */
export type ReadingFontId =
    | 'inter'
    | 'system'
    | 'ibm-plex-sans'
    | 'atkinson-hyperlegible-next'
    | 'source-sans-3'
    | 'literata';

/** The fonts the Interface role offers: Reading's without the serif. */
export type InterfaceFontId = Exclude<ReadingFontId, 'literata'>;

/** The fonts the Code role offers (diffs, job logs, code blocks). */
export type CodeFontId =
    | 'jetbrains-mono'
    | 'system'
    | 'monaspace-neon'
    | 'monaspace-argon'
    | 'monaspace-xenon'
    | 'ibm-plex-mono'
    | 'fira-code'
    | 'geist-mono'
    | 'commit-mono';

/** A font a role can take: its id as written in `settings.json`, its name and its CSS `font-family` stack. */
export interface TypographyFont<Id extends string = string> {
    readonly id: Id;
    /** The font's name, a proper noun shown as it is; `null` for the system font, whose name is translated. */
    readonly label: string | null;
    readonly stack: string;
}

/** The fonts of a role in the order they are offered; the first is the default. */
export type TypographyFonts<Id extends string> = readonly [TypographyFont<Id>, ...TypographyFont<Id>[]];

/** A role's size in pixels and its line height: a ratio for Reading, whole pixels for Code. */
export interface TypographyMetrics {
    readonly size: number;
    readonly lineHeight: number;
}

/** The smallest and largest value a hand-made size or line height takes, and the step between them. */
export interface TypographyRange {
    readonly min: number;
    readonly max: number;
    readonly step: number;
}

/** The ranges of a role's hand-made size and line height. */
export interface TypographyRanges {
    readonly size: TypographyRange;
    readonly lineHeight: TypographyRange;
}

/** The sizes and line heights each preset gives the Reading and Code roles. */
export const TYPOGRAPHY_PRESETS: Readonly<
    Record<TypographyPreset, Readonly<Record<SizedTypographyRole, TypographyMetrics>>>
> = {
    compact: { reading: { size: 13, lineHeight: 1.5 }, code: { size: 12, lineHeight: 18 } },
    default: { reading: { size: 14, lineHeight: 1.5 }, code: { size: 12, lineHeight: 20 } },
    spaced: { reading: { size: 15, lineHeight: 1.65 }, code: { size: 13, lineHeight: 22 } },
};

/** Where a hand-made size or line height of each role may go; a value is snapped to them as it is written. */
export const TYPOGRAPHY_RANGES: Readonly<Record<SizedTypographyRole, TypographyRanges>> = {
    reading: { size: { min: 12, max: 20, step: 0.5 }, lineHeight: { min: 1.3, max: 2, step: 0.05 } },
    code: { size: { min: 11, max: 16, step: 0.5 }, lineHeight: { min: 15, max: 28, step: 1 } },
};

/** The Interface role's fonts, Inter first: its stack is the one the styles fall back to. */
export const INTERFACE_FONTS: TypographyFonts<InterfaceFontId> = [
    { id: 'inter', label: 'Inter', stack: "'Inter', 'Inter Fallback', system-ui, sans-serif" },
    { id: 'system', label: null, stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
    { id: 'ibm-plex-sans', label: 'IBM Plex Sans', stack: "'IBM Plex Sans', system-ui, sans-serif" },
    {
        id: 'atkinson-hyperlegible-next',
        label: 'Atkinson Hyperlegible Next',
        stack: "'Atkinson Hyperlegible Next', system-ui, sans-serif",
    },
    { id: 'source-sans-3', label: 'Source Sans 3', stack: "'Source Sans 3', system-ui, sans-serif" },
];

/** The Reading role's fonts: the Interface ones and a serif. */
export const READING_FONTS: TypographyFonts<ReadingFontId> = [
    ...INTERFACE_FONTS,
    { id: 'literata', label: 'Literata', stack: "'Literata', Georgia, serif" },
];

/** The Code role's fonts, JetBrains Mono first: its stack is the one the styles fall back to. */
export const CODE_FONTS: TypographyFonts<CodeFontId> = [
    {
        id: 'jetbrains-mono',
        label: 'JetBrains Mono',
        stack: "'JetBrains Mono', 'JetBrains Mono Fallback', ui-monospace, monospace",
    },
    { id: 'system', label: null, stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
    { id: 'monaspace-neon', label: 'Monaspace Neon', stack: "'Monaspace Neon', ui-monospace, monospace" },
    { id: 'monaspace-argon', label: 'Monaspace Argon', stack: "'Monaspace Argon', ui-monospace, monospace" },
    { id: 'monaspace-xenon', label: 'Monaspace Xenon', stack: "'Monaspace Xenon', ui-monospace, monospace" },
    { id: 'ibm-plex-mono', label: 'IBM Plex Mono', stack: "'IBM Plex Mono', ui-monospace, monospace" },
    { id: 'fira-code', label: 'Fira Code', stack: "'Fira Code', ui-monospace, monospace" },
    { id: 'geist-mono', label: 'Geist Mono', stack: "'Geist Mono', ui-monospace, monospace" },
    { id: 'commit-mono', label: 'Commit Mono', stack: "'Commit Mono', ui-monospace, monospace" },
];
