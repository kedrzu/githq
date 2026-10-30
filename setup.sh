#!/usr/bin/env zsh
# Prepares a checkout or Paseo worktree. Grows into the full Cookery-style setup
# (bun install, nzyme build, codegen, typecheck) in the first build step.
set -euo pipefail
cd "${0:A:h}"
git submodule update --init --recursive --checkout
