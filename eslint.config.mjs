import { vue } from '@nzyme/eslint';
import { globalIgnores } from 'eslint/config';

// ESLint covers Vue rules only; everything else is oxlint's (see `.oxlintrc.json`).
export default [
    globalIgnores([
        '**/dist/**',
        '**/.output/**',
        '**/.nuxt/**',
        '**/storybook-static/**',
        '**/playwright-report/**',
        '**/*.loc.ts',
        '**/*.loc.js',
        // The nzyme submodule is linted by its own config (`lint:nzyme`); without this a directory
        // run would descend into it and pick up `nzyme/eslint.config.mjs`.
        'nzyme/**',
    ]),
    ...vue(),
    {
        // The one place HTML is rendered: GitHub sanitizes `bodyHTML`, and this component renders only that.
        files: ['packages/app/item/GitHubHtml.vue'],
        rules: { 'vue/no-v-html': 'off' },
    },
];
