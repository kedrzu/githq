import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { provideContainer } from '@nzyme/vue-ioc/provideContainer.js';
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';

import Toaster from '@/components/Toaster.vue';
import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { Browser } from '@/services/Browser.js';
import { createSignedInBrowser } from '@/testing/createSignedInBrowser.js';

import { ReviewViewedFailures } from './ReviewViewedFailures.js';
import ReviewViewedToast from './ReviewViewedToast.vue';

const meta = {
    component: ReviewViewedToast,
    parameters: {
        a11y: {
            context: {
                // reka-ui's toast viewport's focus guards, as in `Toast.stories.tsx`.
                exclude: ['[role="region"] > span[aria-hidden="true"][tabindex="0"]'],
            },
        },
    },
} satisfies Meta<typeof ReviewViewedToast>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One file's mark went back. */
export const OneFile: Story = { render: () => renderToast(['src/sync/engine.ts']) };

/** A selection's marks went back. */
export const SeveralFiles: Story = { render: () => renderToast(['a.ts', 'b.ts', 'c.ts']) };

function renderToast(paths: readonly string[]) {
    return defineComponent({
        setup() {
            const container = createContainer();
            container.set(LanguageContext, () => APP_LANGUAGE);
            container.set(Browser, createSignedInBrowser());
            container.resolve(ReviewViewedFailures).report(paths, 'GitHub answered 502');
            provideContainer(container);
            return () => h(Toaster, () => h(ReviewViewedToast));
        },
    });
}
