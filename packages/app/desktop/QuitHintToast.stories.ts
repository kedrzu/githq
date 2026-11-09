import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, onMounted } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import { QuitHint } from './QuitHint.js';
import QuitHintToast from './QuitHintToast.vue';

/** ⌘W pressed once the screen is up. */
const withPress: Decorator = story =>
    defineComponent({
        setup() {
            const container = createContainer();
            container.set(LanguageContext, () => APP_LANGUAGE);
            provideContainer(container);
            onMounted(() => container.resolve(QuitHint).press());
            return () => h(story());
        },
    });

const meta = {
    component: QuitHintToast,
    // In the shell's toaster, as the app shows it.
    render: () => ({
        components: { QuitHintToast, Toaster },
        template: '<Toaster><QuitHintToast /></Toaster>',
    }),
    decorators: [withPress],
    parameters: {
        a11y: {
            context: {
                // reka-ui's toast viewport puts an empty, focusable focus guard on each side of it (as in Toast's
                // stories): axe flags them; they hide nothing, and every rule still runs on the rest.
                exclude: ['[role="region"] > span[aria-hidden="true"][tabindex="0"]'],
            },
        },
    },
} satisfies Meta<typeof QuitHintToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** ⌘W pressed: ⌘Q quits. */
export const Pressed: Story = {};
