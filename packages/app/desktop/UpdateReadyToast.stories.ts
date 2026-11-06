import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h, shallowRef } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { AppUpdate } from '@/services/AppUpdate.js';
import type { UpdateOffer } from '@/services/AppUpdate.js';

import UpdateReadyToast from './UpdateReadyToast.vue';

/** The toast over a screen of the desktop app on 1.3.0, offering `offer` until dismissed. */
function withOffer(offer: UpdateOffer): Decorator {
    return story =>
        defineComponent({
            setup() {
                const offered = shallowRef<UpdateOffer | null>(offer);
                const container = createContainer();
                container.set(LanguageContext, () => APP_LANGUAGE);
                container.set(AppUpdate, {
                    state: {
                        version: '1.3.0',
                        commit: null,
                        stream: 'stable',
                        canChoose: true,
                        manual: false,
                        checkedAt: null,
                        activity: offer,
                    },
                    notice: null,
                    get offer() {
                        return offered.value;
                    },
                    previousVersion: null,
                    untoldChange: null,
                    markUpdateTold: () => undefined,
                    check: () => undefined,
                    setStream: () => undefined,
                    restart: () => undefined,
                    later: () => {
                        offered.value = null;
                    },
                    dismiss: () => undefined,
                });
                provideContainer(container);
                return () => h(story());
            },
        });
}

const meta = {
    component: UpdateReadyToast,
    // In the shell's toaster, as the app shows it.
    render: () => ({
        components: { UpdateReadyToast, Toaster },
        template: '<Toaster><UpdateReadyToast /></Toaster>',
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
} satisfies Meta<typeof UpdateReadyToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** U49: an update downloaded and waiting, pinned, with Restart (⌥R). */
export const Ready: Story = { decorators: [withOffer({ kind: 'ready', version: '1.4.0' })] };

/** U51: its install on Restart failed (Linux, Windows), with Try again (⌥R). */
export const InstallFailed: Story = { decorators: [withOffer({ kind: 'installFailed', version: '1.4.0' })] };
