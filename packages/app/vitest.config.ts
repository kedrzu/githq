import path from 'node:path';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import type { Page } from '@playwright/test';
import { playwright } from '@vitest/browser-playwright';
import type { PlaywrightBrowserProvider } from '@vitest/browser-playwright';
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

/**
 * Vitest's Playwright provider, with the tester frame found in the page's live DOM. Vitest looks it up by name
 * (`page.frame('vitest-iframe')`) in Playwright's frame tree, which can still hold the previous test file's frame
 * for a moment after a new one is added: a `userEvent.keyboard` then focuses that frame and fails with "Frame was
 * detached" (or "Cannot find vitest-iframe"), in a random spec once in a few full runs. The same diagnosis and fix:
 * https://github.com/WordPress/gutenberg/pull/83495. Drop this once Vitest resolves the frame from the DOM itself.
 */
function playwrightWithLiveFrame() {
    const provider = playwright({});
    return {
        ...provider,
        providerFactory: (project: Parameters<typeof provider.providerFactory>[0]) => {
            const instance = provider.providerFactory(project) as PlaywrightBrowserProvider;
            const getCommandsContext = instance.getCommandsContext.bind(instance);
            instance.getCommandsContext = sessionId => {
                const context = getCommandsContext(sessionId);
                return { ...context, frame: () => findTesterFrame(context.page) };
            };
            return instance;
        },
    };
}

/** The frame of the tester iframe the page shows now: the last one added. */
async function findTesterFrame(page: Page) {
    const iframe = await page.locator('iframe[data-vitest="true"]').last().elementHandle();
    try {
        const frame = await iframe?.contentFrame();
        if (!frame) {
            throw new Error('The page has no tester iframe');
        }
        return frame;
    } finally {
        await iframe?.dispose();
    }
}

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
                        provider: playwrightWithLiveFrame(),
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
