import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { RepositoryTracker } from './RepositoryTracker.js';
import TrackFailedToast from './TrackFailedToast.vue';

const meta = {
    component: TrackFailedToast,
    // In the shell's toaster, as the app shows it.
    render: () => ({
        components: { TrackFailedToast, Toaster },
        template: '<Toaster><TrackFailedToast /></Toaster>',
    }),
    parameters: {
        a11y: {
            context: {
                // reka-ui's toast viewport puts an empty, focusable focus guard on each side of it (as in Toast's
                // stories): axe flags them; they hide nothing, and every rule still runs on the rest.
                exclude: ['[role="region"] > span[aria-hidden="true"][tabindex="0"]'],
            },
        },
    },
} satisfies Meta<typeof TrackFailedToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** D33: the look-up of `vitejs/vite` found nothing. */
export const LookUpFailed: Story = {
    decorators: [
        story =>
            defineComponent({
                setup() {
                    const container = createContainer();
                    container.set(LanguageContext, () => APP_LANGUAGE);
                    container.set(RepositoryTracker, {
                        failedName: 'vitejs/vite',
                        track: () => Promise.resolve(),
                        dismissFailure: () => undefined,
                    });
                    provideContainer(container);
                    return () => h(story());
                },
            }),
    ],
};
