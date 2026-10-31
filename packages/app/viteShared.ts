import { fileURLToPath } from 'node:url';

import type { CSSOptions } from 'vite';

// Vite settings the Nuxt build (`nuxt.config.ts`) and Storybook (`.storybook/main.ts`) must share, so a
// component compiles the same way in both.

// Every package of this repo lives under `packages/`; SCSS from anywhere else (the nzyme submodule,
// node_modules) is compiled as is.
const packagesPath = fileURLToPath(new URL('..', import.meta.url));
const tokensPath = fileURLToPath(new URL('./styles/tokens.scss', import.meta.url));

/** The app's root folder, which Nuxt aliases as `@` (`srcDir: '.'`). */
export const appPath = import.meta.dirname;

/** CSS handling for both builds. */
export const cssOptions: CSSOptions = {
    devSourcemap: true,
    preprocessorOptions: {
        scss: {
            // The design tokens partial is available in every SCSS block of this repo's packages.
            additionalData: (source: string, filename: string) => {
                if (filename.startsWith(packagesPath) && !filename.includes('/node_modules/')) {
                    return `@use '${tokensPath}' as *;\n${source}`;
                }

                return source;
            },
        },
    },
};
