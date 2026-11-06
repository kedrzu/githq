import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';

import { NewVersion } from './NewVersion.js';
import NewVersionToast from './NewVersionToast.vue';

const meta = {
    component: NewVersionToast,
    // In the shell's toaster, as the app shows it, a newer version out; Reload reloads nothing here.
    decorators: [
        story =>
            defineComponent({
                setup() {
                    const container = createContainer();
                    container.set(LanguageContext, () => APP_LANGUAGE);
                    container.set(Browser, { ...createContainer().resolve(Browser), reload: () => undefined });
                    container.resolve(NewVersion).announce();
                    provideContainer(container);
                    return () => h(story());
                },
            }),
    ],
    render: () => ({
        components: { NewVersionToast, Toaster },
        template: '<Toaster><NewVersionToast /></Toaster>',
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
} satisfies Meta<typeof NewVersionToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A newer githq was deployed while the page ran: pinned, with Reload (⌥R). */
export const NewVersionOut: Story = {};
