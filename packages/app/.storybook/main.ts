import type { StorybookConfig } from '@storybook/vue3-vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { mergeConfig } from 'vite';

import { appPath, cssOptions } from '../viteShared.js';

const config: StorybookConfig = {
    // Components and screens live anywhere in the app. Storybook skips `node_modules` and dot-folders
    // (`.nuxt`, `.output`) on its own.
    stories: ['../**/*.stories.@(ts|tsx)'],
    addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-vitest'],
    framework: {
        name: '@storybook/vue3-vite',
        options: {
            docgen: false,
        },
    },
    // Storybook builds the app's components without Nuxt, so this repeats what Nuxt's Vite setup gives them:
    // the Vue and Vue JSX plugins, the shared CSS options, the build-time constants and the `@` alias. The Vitest
    // plugin (`vitest.config.ts`) takes its Vite config from here too.
    viteFinal: viteConfig =>
        mergeConfig(viteConfig, {
            plugins: [vue(), vueJsx()],
            css: cssOptions,
            // `shims.d.ts`: the stories show the web app.
            define: {
                __LOCAL_BUILD__: 'false',
                __DESKTOP__: 'false',
                __GITHUB_CLIENT_ID__: 'null',
            },
            resolve: {
                alias: {
                    '@': appPath,
                },
            },
        }),
};

export default config;
