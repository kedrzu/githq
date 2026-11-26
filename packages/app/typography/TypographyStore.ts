import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed } from 'vue';

import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import type { TypographyValues } from './readTypography.js';
import { CODE_FONTS, INTERFACE_FONTS, READING_FONTS } from './typographyCatalog.js';

/**
 * The typography of the phone layout, which the settings do not change: the values the styles fall back to (Inter,
 * Reading 13.5px / 1.6, JetBrains Mono, Code 12px / 20px).
 */
export const PHONE_TYPOGRAPHY: TypographyValues = {
    reading: { font: READING_FONTS[0], size: 13.5, lineHeight: 1.6 },
    code: { font: CODE_FONTS[0], size: 12, lineHeight: 20 },
    interface: { font: INTERFACE_FONTS[0] },
};

/**
 * The typography the app draws with — the one source for the styles and for code measuring text: the settings' choice
 * in the desktop layout, {@link PHONE_TYPOGRAPHY} in the phone layout.
 */
export type TypographyStore = Resolved<typeof TypographyStore>;
export const TypographyStore = defineService({
    name: 'TypographyStore',
    deps: { tracking: TrackingStore, phoneLayout: PhoneLayout },
    setup({ tracking, phoneLayout }) {
        const appliedRef = computed<TypographyValues>(() =>
            phoneLayout.active ? PHONE_TYPOGRAPHY : tracking.typography,
        );

        return {
            /** Each role's font, size and line height as drawn now; reactive. */
            get applied() {
                return appliedRef.value;
            },
        };
    },
});
