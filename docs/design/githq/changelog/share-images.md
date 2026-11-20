# Share images

The share images in `OpenGraph images` (`PiKGF`) showed githq's old sidebar and My work list, hand-drawn. They are
what people see when githq.dev or the GitHub repository is shared, so they are rebuilt on the current components, the
way the landing's hero picture is (`ykYxo`), and follow the app from now on. Base: `f3a3ed4f`.

Exports: `OG / Default` → `packages/app/public/og.png` (1200 × 630, `og:image` and `twitter:image`);
`OG / Repo social preview` → `docs/assets/github-social-preview.png` (1280 × 640, uploaded by hand in the repository's
Settings → Social preview; GitHub has no API for it). `OG / Centered` is for launch posts and has no file in the repo.
Export with `bun githq pen render githq.pen AjdEy dCg9Z --scale 1`.

## Round 1 · agent brief

Asked: all three images onto the current design, built from instances, in the landing's current voice.
Changed: the app pictures, A's subhead, C's whole composition.

- [x] `OG / Default` (`AjdEy`): hand-drawn `App screenshot` (`vpsIO`) → `App screenshot` (`xluhs`) built from
  `Sidebar / expanded`, `List pane / My work` and `Status bar / sidebar, list`, as the hero picture; window moved
  left, copy column 560 → 480 px.
- [x] `OG / Default` subhead (`nJW5q`): "The keyboard-first command center for every repository you have on GitHub." →
  "Issues, Projects, pull requests and Actions from every repository, on one fast screen."
- [x] `OG / Centered` (`wPgsD`): hand-drawn `App screenshot` (`Rtffe`) → `App screenshot` (`f5cUC`), the sidebar, My
  work and the pull request panel as in F1; tighter top spacing.
- [x] `OG / Repo social preview` (`dCg9Z`): the big wordmark, tagline, chips ("GitHub is the backend") and URL → a
  1280 × 640 sibling of A (`bvYHD` copy, `c38PJ` app, `O3gXC9` glow, `L2zhAI` left fade), headline 70 px.
- [x] Slot C (`r1aeXU`, label `UcU9G`): "C · Brand — GitHub repo social preview" → "C · GitHub repository social
  preview (1280 × 640)".
- [x] Header note (`HCSxJ`): adds that the app pictures are built from the components.

## Round 2 · agent brief

Asked: a hard vertical seam in A's and C's background, where the left fade started at full strength over the glow.

- [x] `Left fade` (`KKjRt`): x 520 → 340, starts transparent and builds up to the same strength at the window.
- [x] `Left fade` (`L2zhAI`): x 564 → 380, the same.
