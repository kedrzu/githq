import path from 'node:path';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const dirname = import.meta.dirname;

/**
 * Adds the component specs (`*.spec.ts`, which drive stories through `composeStories`) to the storybook
 * project. `storybookTest` clears any `test.include` given in this file, so a plugin placed after it adds
 * them. Storybook's own way in, the `STORYBOOK_COMPONENT_PATHS` variable, is not used: it also turns on
 * Storybook's "ghost stories" mode, in which addon-a11y skips its check for every story.
 */
const componentSpecs: Plugin = {
    name: 'githq:component-specs',
    config: () => ({
        test: {
            include: ['**/*.spec.ts'],
        },
    }),
};

export default defineConfig({
    test: {
        projects: [
            {
                extends: true,
                // The Vue plugins and aliases come from `.storybook/main.ts` (`viteFinal`), which `storybookTest`
                // applies — adding them here again would compile every component twice.
                plugins: [
                    storybookTest({
                        configDir: path.join(dirname, '.storybook'),
                    }),
                    componentSpecs,
                ],
                test: {
                    name: 'storybook',
                    exclude: ['**/node_modules/**', '**/.git/**', '**/.nuxt/**', '**/.output/**'],
                    browser: {
                        enabled: true,
                        provider: playwright({}),
                        headless: true,
                        instances: [{ browser: 'chromium' }],
                        locators: {
                            testIdAttribute: 'tid',
                        },
                    },
                },
            },
        ],
    },
});
