#!/usr/bin/env bash
# Everything needed to compile and test the repo, and nothing else: dependencies, the nzyme CLI,
# generated code (per-package tsconfigs, `.loc.ts` translations), TypeScript, the test browser.
#
# Called by setup.sh and meant to be the CI build step too, so what CI proves is exactly what a local
# build does. Anything needing local infrastructure (a database, secrets) belongs in setup.sh, never
# here.
#
# bash rather than zsh: the GitHub-hosted runners have bash, and nothing here needs zsh.
set -e

step() {
    echo ""
    echo "$1"
    echo ""
}

step "📦 Installing dependencies..."
if [ "$CI" = "true" ]; then
    bun install --frozen-lockfile
else
    bun install
fi

# The CLI generates the per-package tsconfigs and translations everything else compiles against, so
# it has to exist before any of that runs.
step "🔨 Building nzyme cli..."
bun nx run @nzyme/cli:build

step "🛠️ Generating tsconfigs and translations..."
bun run monorepo
bun run localise

step "📝 Building typescript..."
bun x tsgo --build

# `nuxt prepare` writes `.nuxt/tsconfig.json`, which the app's own tsconfig extends — typecheck and
# type-aware lint of the app have nothing to resolve against without it.
step "🔧 Preparing Nuxt apps..."
bun run prep

# Component tests (`test:stories`) run in a real Chromium driven by Playwright. Already installed
# browsers are skipped, so this is quick on every run after the first.
# Only where the app exists: a checkout of the bottom of a PR stack may hold just the packages below it.
if [ -d packages/app ]; then
    step "🌐 Installing Chromium for Playwright..."
    bun --cwd packages/app playwright:install
fi
