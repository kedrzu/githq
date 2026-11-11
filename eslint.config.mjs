import { markdown, packageJson, vue } from '@nzyme/eslint';
import { globalIgnores } from 'eslint/config';

// ESLint covers Vue rules, package.json checks and Markdown formatting only; everything else is oxlint's (see `.oxlintrc.json`).
export default [
    globalIgnores([
        '**/dist/**',
        '**/.output/**',
        '**/.nuxt/**',
        // The local build's (`build:local`), the server-rendered landing page's chunks included.
        '**/.output-local/**',
        '**/.nuxt-local/**',
        // The desktop build's (`build:desktop`).
        '**/.output-desktop/**',
        '**/.nuxt-desktop/**',
        '**/storybook-static/**',
        // VitePress's dev server's prebundled dependencies (`packages/docs`, gitignored).
        '**/.vitepress/cache/**',
        '**/playwright-report/**',
        // Playwright's results, `error-context.md` of a failed test included.
        '**/test-results/**',
        '**/*.loc.ts',
        '**/*.loc.js',
        // Cargo's build of the desktop app, which holds the bundled app's files compressed under `.js` names.
        '**/target/**',
        // The nzyme submodule is linted by its own config (`lint:nzyme`); without this a directory
        // run would descend into it and pick up `nzyme/eslint.config.mjs`.
        'nzyme/**',
        // Agent scratch space and handoffs, not formatted.
        '.context/**',
    ]),
    ...markdown(),
    ...packageJson(),
    ...vue(),
    {
        // The one place HTML is rendered: GitHub sanitizes `bodyHTML`, and this component renders only that.
        files: ['packages/app/item/GitHubHtml.vue'],
        rules: { 'vue/no-v-html': 'off' },
    },
];
