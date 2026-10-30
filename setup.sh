#!/bin/zsh
# Workspace setup for a fresh clone or worktree: catches a Paseo worktree up with origin/main, copies
# local-only files from the main checkout, and checks out the pinned nzyme submodule. The build steps
# (bun floor, install, nzyme build, codegen, typecheck) are added with the first package, mirroring
# Cookery's setup.sh / setup.build.sh.
set -e

cd "$(dirname "$0")"

# --- Worktree: catch up with origin/main, copy local files ---
#
# Paseo runs this for every new worktree (paseo.json). Worktrees only: in the main checkout the branch
# you are on is a deliberate choice, and setup has no business merging into it. Done before the
# submodule checkout and the build, so both match the commit the task's PR will sit on.
repo_root=$(git rev-parse --path-format=absolute --git-common-dir | sed 's|/\.git\(/.*\)*$||')

if [ "$CI" != "true" ] && [ "$repo_root" != "$(pwd -P)" ]; then
    branch=$(git branch --show-current)

    # Only a branch based on `main` catches up with it: merging `main` into a stacked node drags it into
    # a PR that does not target `main`. The base, most authoritative first: the open PR's, then the one
    # Paseo recorded when it cut the worktree. No answer means no merge.
    base=$(gh pr view --json baseRefName --jq .baseRefName 2> /dev/null || true)
    paseo_metadata="$(git rev-parse --git-dir)/paseo/worktree.json"
    if [ -z "$base" ] && [ -f "$paseo_metadata" ]; then
        base=$(sed -n 's/.*"baseRefName": *"\([^"]*\)".*/\1/p' "$paseo_metadata")
    fi

    if [ "$base" != main ]; then
        echo ""
        echo "⏭️  Not catching up: ${branch:-detached HEAD} is based on ${base:-an unknown branch}, not main."
    elif ! git fetch --quiet origin main; then
        echo ""
        echo "⚠️  Could not fetch origin/main (offline?): the build reflects this branch as it is."
    else
        echo ""
        echo "🔄 Catching up with origin/main..."
        echo ""

        # Fast-forward the local `main` too, so the NEXT worktree is not cut from a stale one. Git
        # refuses to move a branch another worktree holds, so ask that worktree, and only when clean.
        main_worktree=$(git worktree list --porcelain \
            | awk '/^worktree /{wt=substr($0, 10)} $0 == "branch refs/heads/main" {print wt; exit}')

        if [ -z "$main_worktree" ]; then
            git fetch --quiet origin main:main \
                || echo "⚠️  Local main not fast-forwarded (diverged from origin/main)."
        elif [ -n "$(git -C "$main_worktree" status --porcelain)" ]; then
            echo "⚠️  Local main left as it is: $main_worktree has uncommitted changes."
        else
            git -C "$main_worktree" merge --ff-only --quiet origin/main \
                || echo "⚠️  Local main not fast-forwarded (diverged from origin/main)."
        fi

        # A fresh worktree fast-forwards. A rerun on a branch carrying real work may not merge cleanly;
        # a conflict under `set -e` would leave a half-merged tree, so an unclean merge is rolled back
        # and reported instead.
        if git merge --quiet --no-edit origin/main; then
            echo "✅ Up to date with origin/main"
        else
            git merge --abort 2> /dev/null || true
            echo "⚠️  Could not merge origin/main into $branch: merge it by hand (git-workflow → Sync)."
        fi
    fi

    # Gitignored files that live only in the main checkout: personal instructions (CLAUDE.local.md),
    # personal Claude settings, env files and the Workers' local secrets (`.dev.vars`). Templates
    # (`*.example`) are committed and stay as they are; a file already in the worktree is not
    # overwritten. `(N)` is zsh's nullglob: a pattern matching nothing is skipped, not fatal.
    echo ""
    echo "📋 Copying local files from the main checkout..."
    echo ""
    for src in "$repo_root"/CLAUDE.local.md "$repo_root"/.claude/settings.local.json \
        "$repo_root"/.env(N) "$repo_root"/.env.*(N) "$repo_root"/packages/*/.dev.vars(N) \
        "$repo_root"/packages/*/.dev.vars.*(N); do
        rel=${src#$repo_root/}
        case "$rel" in
            *.example) continue ;;
        esac
        if [ -f "$src" ] && [ ! -e "$rel" ]; then
            mkdir -p "$(dirname "$rel")"
            cp "$src" "$rel"
            echo "   $rel"
        fi
    done
fi

# --- Git submodules ---
#
# Every checkout builds exactly the submodule commit this repo pins (the gitlink), never a submodule
# branch tip. Moving the pin is a commit in this repo, reviewed like any other. Done before anything
# is installed: the workspace globs point into `nzyme/`. CI checks submodules out itself
# (`actions/checkout` with `submodules: recursive`).
if [ "$CI" != "true" ]; then
    echo ""
    echo "📦 Checking out the pinned submodule commits..."
    echo ""
    git submodule update --init --recursive --checkout
fi
