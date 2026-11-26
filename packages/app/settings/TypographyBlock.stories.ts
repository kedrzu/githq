import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { computed, ref } from 'vue';

import { withPhoneLayout } from '@/testing/withPhoneLayout.js';
import { readTypography, writeTypography } from '@/typography/readTypography.js';
import type { TypographyChange } from '@/typography/readTypography.js';

import { EMPTY_SETTINGS_DOCUMENT } from './sync/SettingsDocument.js';
import type { SettingsDocument } from './sync/SettingsDocument.js';
import TypographyBlock from './TypographyBlock.vue';

/** T29: hand-made sizes and other fonts in every role. */
const CUSTOM_DOCUMENT: SettingsDocument = {
    ...EMPTY_SETTINGS_DOCUMENT,
    typography: {
        reading: { font: 'literata', size: 15.5, lineHeight: 1.7 },
        code: { font: 'ibm-plex-mono', size: 13 },
        interface: { font: 'ibm-plex-sans' },
    },
};

const meta = {
    component: TypographyBlock,
    args: { typography: readTypography(EMPTY_SETTINGS_DOCUMENT) },
    // The story frame is narrower than a phone's: the computer's menus.
    decorators: [
        withPhoneLayout(false),
        () => ({ template: '<div style="max-width: 720px; padding: 24px"><story /></div>' }),
    ],
} satisfies Meta<typeof TypographyBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * T28: the Default preset, the default fonts. Changes are kept in a settings document read back as the store does, so
 * choosing a preset or a hand-made value shows what the settings then hold.
 */
export const Default: Story = {
    render: () => ({
        components: { TypographyBlock },
        setup() {
            const document = ref<SettingsDocument>(EMPTY_SETTINGS_DOCUMENT);
            const typography = computed(() => readTypography(document.value));

            function write(change: TypographyChange) {
                document.value = writeTypography(document.value, change) ?? document.value;
            }

            return { typography, write };
        },
        template:
            '<TypographyBlock :typography="typography" @preset="write({ preset: $event })" @change="write($event)" />',
    }),
};

/** T29: Custom chosen, as hand-made sizes and line heights make it, other fonts in each role and each sample. */
export const CustomOtherFonts: Story = { args: { typography: readTypography(CUSTOM_DOCUMENT) } };

/** The Spaced preset, its sizes and line heights in the samples. */
export const Spaced: Story = {
    args: { typography: readTypography({ ...EMPTY_SETTINGS_DOCUMENT, typography: { preset: 'spaced' } }) },
};

/** At the ends of the ranges: the steppers' − and + there are unavailable. */
export const RangeEnds: Story = {
    args: {
        typography: readTypography({
            ...EMPTY_SETTINGS_DOCUMENT,
            typography: { reading: { size: 20, lineHeight: 1.3 }, code: { size: 11, lineHeight: 28 } },
        }),
    },
};
