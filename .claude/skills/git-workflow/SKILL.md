---
name: git-workflow
description: >-
    How a change moves in githq — one task, one Paseo worktree, one branch, one PR; kept up to date
    with main by merging, squash-merged on the owner's word; GitHub Issues as the tracker, stacked PRs
    through GitHub's native stacks — all through git and `gh`. The dev pipeline (/dev:*) relies on it;
    reach for it whenever you open a branch, commit, push, catch up with main, resolve a merge
    conflict, open or describe a PR, comment on an issue, build a PR stack or merge.
---

# git-workflow — githq

Fulfils the `git-workflow` contract of the `dev` plugin (`skills/pipeline/references/contracts.md`).

Several tasks run at once, each in its own Paseo worktree on its own branch with its own PR. The
standing authorization to commit, push and open PRs without asking is in `AGENTS.md` → "Worktrees and
pull requests"; this skill holds the commands.

Facts this rests on (checked 2026-10-30):

- Remote `origin` = `https://github.com/kedrzu/githq.git` (private, no branch protection on this
  plan), main line `main`; `gh` is logged in as `kedrzu`. The repo deletes a PR's branch on merge.
- Agents never push to `main`: `.claude/git.json` lists it in `protectedBranches`, and the `git`
  plugin's hook blocks such a push.
- Tracker: GitHub Issues in the same repository. A task may have no issue.
- Commit messages and PR titles: English, imperative, no prefix, e.g.
  `Show review requests first in My work`. PRs are squash-merged, so **the PR title
  becomes the commit on `main`** (with ` (#<PR>)`).
- PR descriptions and issue comments are in Polish (`AGENTS.md`).
- Branch names: `<type>/<slug>`, with an issue `<type>/<N>-<slug>`; types `feat`, `fix`, `chore`,
  `design`, `docs` (`feat/12-my-work-list`).
- `nzyme` is a git submodule (`https://github.com/kedrzu/nzyme.git`, no `branch =`); the gitlink is
  the pin.

## Start

Paseo cuts the worktree's branch from `origin/main`, and its setup (`paseo.json` → `setup.sh`) has
already merged `origin/main` into it, copied the local files from the main checkout and checked out
the pinned nzyme (and, once the workspace exists, built everything).

1. As soon as the task is known, rename the generated branch (`somber-rabbit`) before its first push:
   `git branch -m <type>/<N>-<slug>`. Find or create the issue first, when the task has one:
   ```bash
   gh issue view <N>
   gh issue create --title "<tytuł>" --body "<opis>"   # prints the URL with the number
   ```
2. Rename the workspace too: `mcp__paseo__list_workspaces` (match `cwd` with the working directory)
   shows its title; `mcp__paseo__rename_workspace` without `workspaceId` renames the current one. A few
   Polish words the owner recognises the task by („Lista My work”). Rename a generated name
   (`somber-rabbit`, `null`, `githq`); leave a meaningful one. No Paseo tools → skip.
3. No draft PR at start: the PR opens at the first push (Publish).

Outside a worktree (the main checkout `~/Dev/githq` on `main`): `git fetch origin main` and
`git switch -c <type>/<N>-<slug> origin/main`. Other sessions may share that directory, so ask
once before switching branches there.

## Sync

Other worktrees land on `main` while you work, and the later you notice, the bigger the conflict.
At least **before every push and before Land**:

```bash
git fetch origin main
git log --oneline HEAD..origin/main     # anything listed → merge
git merge --no-edit origin/main
```

Merge, never rebase or force-push: review comments keep their anchors, and the merge commits vanish
in the squash. In a stack only the bottom node merges `main` (Stack).

After a merge that moved the `nzyme` gitlink, `bun.lock` or a `package.json`, rerun `zsh setup.sh`.

A conflict is yours to resolve (the `git` plugin's `fix-conflicts` skill). Read what each side changed
and why (`git log` and `git diff` from `git merge-base HEAD origin/main` to each side), then write what
one author doing both changes would have written — never keep one side blindly. Generated files are
regenerated, not hand-merged: `bun.lock` with `bun install`, `*.loc.ts` and tsconfigs with
`bun run codegen`. Bring it
to the owner only when the two sides made contradictory product or design decisions. Then the full
`verify`, and commit the merge.

## Checkpoint

Commit everything that belongs to the change and push:

```bash
git add -A
git status --short          # nothing unrelated (.env, .dev.vars, screenshots) staged
git commit -F - <<'EOF'
<Imperative summary>

<why, when the subject does not say it>

<attribution trailer the session gives, if any>
EOF
git push -u origin HEAD     # Paseo creates branches without upstream; later just `git push`
```

**Confirm it landed:** `git status --porcelain` prints nothing and `git rev-parse HEAD` equals
`git rev-parse @{u}`.

- **Only a given set of files:** `git restore --staged :/` (empty the index), then
  `git add -- <file1> <file2> …`, `git diff --cached --name-only` must list exactly that group,
  `git commit`. Repeat per group.
- **Push what is already committed:** `git push` (no commit), then confirm as above.
- **Push rejected** (the remote branch moved): `git pull --no-rebase`, then push again. Never
  `--force`.
- **Submodule (`nzyme`) moved:** the nzyme commit must be on `kedrzu/nzyme` before the githq
  commit that pins it is pushed — push the nzyme branch first (`git -C nzyme push -u origin HEAD`)
  and open its PR there (its own conventions: `nzyme/.claude/skills/git-workflow`). A githq PR may
  not land while its pin is reachable only from an nzyme feature branch: it must be on nzyme `main`
  (`nzyme/docs/consumers.md`).

## Publish

PRs open ready for review, not as drafts, at the first push of the branch. Publish means the PR exists
and its title and description are current. The pipeline supplies the texts.

- **No PR for the branch** (`gh pr view` fails):
  ```bash
  gh pr create --base main --title "<commit-style title>" --body-file - <<'EOF'
  <co się zmieniło i dlaczego, po polsku>

  Closes #<N>

  <attribution line the session gives, if any>
  EOF
  ```
  `Closes #<N>` only when the branch has an issue; keep that line whenever the body is rewritten.
- **PR exists:** read the body with `gh pr view --json body --jq .body`, write the new one with
  `gh pr edit --body-file - <<'EOF' … EOF`; `gh pr edit --title "…"` when the scope changed.
- **A draft exists anyway** (opened by hand): `gh pr ready`.
- **Issue:** the number in the branch name (`<type>/<N>-<slug>`) and in `Closes #<N>`;
  `gh issue comment <N> --body-file <file>` posts the summary. No issue → no comment, say so in the
  hand-off.
- End with the PR URL: `gh pr view --json url,isDraft --jq .url`.

## Stack

GitHub's native stacked pull requests, driven through `gh api` (no `gh` subcommand). One change,
several PRs, each based on the one below; every node lands as its own squash commit titled by its PR.
Node 1 is the task branch; node `k` is `<branch>-<k>` (`feat/30-my-work-list-2`).

- **Read the chain** (stack number, then nodes bottom to top):
  ```bash
  gh api "repos/kedrzu/githq/stacks?pull_request=<any node>" \
    --jq 'if length == 0 then "not stacked" else .[0] | .number, (.pull_requests[] | "\(.number) \(.head.ref) \(.state)") end'
  ```
- **Add a node** on top of node `k`, which must be committed and pushed:
  ```bash
  git switch -c <branch>-<k+1>
  # commit the node's changes (Checkpoint), then:
  git push -u origin HEAD
  gh pr create --base <branch of node k> --title "…" --body-file - <<'EOF'
  Część <k+1> z <n>; poprzednia: #<PR of node k>. Closes #<N> tylko w ostatniej części.
  EOF
  # the first extra node creates the stack, bottom first; later ones append:
  echo '{"pull_requests":[<pr 1>,<pr 2>]}' | gh api -X POST repos/kedrzu/githq/stacks --input -
  echo '{"pull_requests":[<new pr>]}' | gh api -X POST repos/kedrzu/githq/stacks/<stack>/add --input -
  ```
- **Check out the tip / node `k`:** `git switch <branch of that node> && git pull --no-rebase`. A
  branch another worktree holds cannot be switched to here: work on it in that worktree.
- **Propagate an edit to a lower node** without force-pushing: commit and push it on node `k`, then
  for each node above, in order: `git switch <node k+1> && git merge --no-edit <node k> && git push`.
  A conflict stops the walk on that node: resolve it there, commit, push, carry on upward.
- **Catching up with `main`:** Sync on the **bottom** node only, then propagate upward. Never merge
  `main` into a higher node.
- **GitHub rewrites upper branches itself** after a partial merge or its „Rebase stack” button. Keep
  every node pushed, so after `git fetch` a rewritten node is taken from the remote:
  `git switch -C <node> origin/<node>`.
- **Must stay in the bottom node:** a moved `nzyme` gitlink, `package.json` / `bun.lock` changes that later nodes
  depend on.
- **Landing a stack:** the whole chain at once — Land. Never merge a mid-stack PR in the GitHub UI.

## Land

Only on the owner's word („mergujemy”, „merge it”) — it is irreversible and lands on `main`.

1. Sync, the full `verify`, push; the PR must be out of draft.
2. Merge:
   - **One PR:** `gh pr merge <PR> --squash --match-head-commit "$(git rev-parse HEAD)"` — the PR
     title becomes the commit on `main`; the branch is deleted on merge.
   - **A stack:** `gh pr merge` cannot merge a stacked PR. Merge the **top** PR asynchronously; GitHub
     lands it and every node below, one squash commit each. The method must be explicit (the API
     defaults to a merge commit):
     ```bash
     uuid=$(echo '{"merge_method":"squash"}' \
       | gh api -X PUT repos/kedrzu/githq/pulls/<top PR>/merge-async --input - --jq .uuid)
     gh api repos/kedrzu/githq/pulls/<top PR>/merge-async/$uuid --jq .status   # poll until not pending
     ```
3. `gh pr view <PR> --json state,mergeCommit` confirms `MERGED`. A merged PR with `Closes #<N>`
   closes its issue.

Deploying to Cloudflare is not part of landing; it is the owner's call.
