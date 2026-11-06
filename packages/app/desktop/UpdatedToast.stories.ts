import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import type { VersionChange } from '@/services/AppUpdate.js';

import UpdatedToast from './UpdatedToast.vue';

/** The toast over a screen of an app just moved to another version. */
function withChange(change: VersionChange): Decorator {
    return story =>
        defineComponent({
            setup() {
                const untold = shallowRef<VersionChange | null>(change);
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(AppUpdate, {
                    state: null,
                    notice: null,
                    offer: null,
                    previousVersion: change.previousVersion,
                    get untoldChange() {
                        return untold.value;
                    },
                    markUpdateTold: () => {
                        untold.value = null;
                    },
                    check: () => undefined,
                    setStream: () => undefined,
                    restart: () => undefined,
                    later: () => undefined,
                    dismiss: () => undefined,
                });
                provideContainer(container);
                return () => h(story());
            },
        });
}

const meta = {
    component: UpdatedToast,
    // In the shell's toaster, as the app shows it.
    render: () => ({
        components: { UpdatedToast, Toaster },
        template: '<Toaster><UpdatedToast /></Toaster>',
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
} satisfies Meta<typeof UpdatedToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** U23: updated, brief, with What changed (⌥W). */
export const Updated: Story = { decorators: [withChange({ version: '0.3.0', previousVersion: '0.2.0' })] };

/** U25: back to an older version: which one runs, nothing to read. */
export const Older: Story = { decorators: [withChange({ version: '0.2.0', previousVersion: '0.3.0-dev.214' })] };
