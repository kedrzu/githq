import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import type { StoppedReason } from './sync/SettingsSaving.js';
import { SettingsSync } from './sync/SettingsSync.js';
import SyncStoppedToast from './SyncStoppedToast.vue';

/** The toast over a screen whose syncing stopped for `reason`, not told yet. */
function withReason(reason: StoppedReason): Decorator {
    return story =>
        defineComponent({
            setup() {
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(SettingsSync, {
                    state: { state: 'stopped', reason },
                    inspect: () => Promise.reject(new Error('Not in a story.')),
                    turnOn: () => Promise.resolve(),
                    turnOff: () => undefined,
                    retry: () => Promise.resolve(null),
                    sync: () => Promise.resolve(),
                    markTold: () => undefined,
                });
                provideContainer(container);
                return () => h(story());
            },
        });
}

const meta = {
    component: SyncStoppedToast,
    args: { login: 'kedrzu' },
    // In the shell's toaster, as the app shows it.
    render: args => ({
        components: { SyncStoppedToast, Toaster },
        setup: () => ({ args }),
        template: '<Toaster><SyncStoppedToast v-bind="args" /></Toaster>',
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
} satisfies Meta<typeof SyncStoppedToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** T9: the settings repository is gone; pinned until dismissed, with Open settings (⌥S). */
export const Deleted: Story = { decorators: [withReason({ kind: 'deleted' })] };

/** T9: GitHub refused the write. */
export const Refused: Story = {
    decorators: [withReason({ kind: 'refused', message: 'Resource not accessible by integration' })],
};
