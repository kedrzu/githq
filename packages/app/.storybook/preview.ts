import { LanguageContext } from '@nzyme/i18n/LanguageContext.js';
import { createContainer } from '@nzyme/vue-ioc/createContainer.js';
import { IocPlugin } from '@nzyme/vue-ioc/IocPlugin.js';
import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import { ConfigProvider } from 'reka-ui';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';

import '@/styles/main.scss';

// What the app's `plugins/iocPlugin.ts` registers, and a router of its own for every story.
setup(app => {
    const container = createContainer();
    container.set(LanguageContext, () => APP_LANGUAGE);
    app.use(IocPlugin, { container });
    // Links (`RouterLink`) need a router. Any path renders nothing and stays inside the story's app.
    app.use(
        createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/:path(.*)*', component: defineComponent({ render: () => null }) }],
        }),
    );
});

const preview: Preview = {
    parameters: {
        a11y: {
            // An accessibility violation fails the story's test.
            test: 'error',
            options: {
                runOnly: ['wcag2a', 'wcag21a', 'wcag2aa', 'wcag21aa'],
            },
        },
        // The app is dark only; stories sit on its background.
        backgrounds: { disable: true },
        layout: 'fullscreen',
    },
    decorators: [
        story => {
            const Story = story();

            // Like `app.vue`: every screen sits inside reka-ui's `ConfigProvider`.
            return defineComponent({
                setup: () => () => h(ConfigProvider, { dir: 'ltr' }, { default: () => h(Story) }),
            });
        },
    ],
};

export default preview;
