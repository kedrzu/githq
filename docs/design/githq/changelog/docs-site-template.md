Document: /Users/kedrzu/.paseo/worktrees/3kktpz0d/aloof-dingo/githq.pen

A template for githq's documentation site on VitePress: the shell every page shares and one page of each kind, with
placeholder text in the right shape. Build the mechanism (theme, sidebar config, search, git-driven metadata) from it;
the content comes later.

- [ ] Docs · githq.dev/docs — template (`I5wWZ`): new top-level aspect frame, screen codes `DOC`.
- [ ] Components · Docs (`NMMjb`): new components.
  - [ ] `Docs / Sidebar item` (`oqnBx`), `· current` (`rFhjH`), `Docs / Sidebar group title` (`lqgas`).
  - [ ] `Docs / Outline item` (`s3ur9i`), `· current` (`LsjFs`, accent left rule), `· nested` (`n1mplp`, an H3).
  - [ ] `Docs / Search field` (`SsMmZ`): search icon, placeholder, ⌘K as one `Kbd / icon + key` (command icon and K
    in one frame).
  - [ ] `Docs / Callout · note` (`QDRPv`), `· tip` (`I413v`, green), `· warning` (`Sn9aO`, amber): VitePress's
    `::: info / tip / warning` containers.
  - [ ] `Docs / Code block` (`FZekU`): file name and copy button in a head, highlighted lines in `$syntax-*` colours.
  - [ ] `Docs / Inline code` (`fGRvc`).
  - [ ] `Docs / Shortcut table head` (`d9f90`), `Docs / Shortcut row` (`CAswD`): action and its keys as `Kbd`.
  - [ ] `Docs / Page link · previous` (`e8xAe`), `· next` (`boV8n`).
  - [ ] `Docs / Top bar` (`n004gp`): wordmark + "docs", top links (Guide, Configuration, How it works,
    Reference; the current section in `$fg`), version picker, GitHub, "Open githq".
  - [ ] `Docs / Top bar · phone` (`cVMbl`): wordmark + "docs", search and menu buttons.
  - [ ] `Docs / Sidebar` (`svo93`): the search field at the top, then six groups (Getting started, Using githq, Configuration, How it works, Reference,
    Contributing) and their pages.
  - [ ] `Docs / Outline` (`jEMtk`): "On this page" with the page's H2/H3, then Edit this page on GitHub, Report a
    problem, Back to top.
  - [ ] `Docs / Page footer` (`GHmBD`): Edit this page on GitHub, "Updated … · commit" from git, previous and next
    pages in the sidebar's order.
  - [ ] `Docs / Search result` (`GnzDy`), `· selected` (`VKmuf`): heading icon, page › section, excerpt with the match
    in accent.
- [ ] No home page: `/docs` opens the first page in the sidebar (Introduction). DOC1 is retired.
- [ ] DOC2 · An article (`QfYGH`): three columns (sidebar 296, article 720, outline 220); breadcrumb, H1, lead, meta
  (updated, reading time, version), H2/H3, a figure built from app components, tip, code, warning, page footer.
- [ ] DOC3 · A reference page (`m726S`): keyboard shortcuts as tables per context, macOS / Windows and Linux switch,
  generated from the app's list of shortcuts.
- [ ] DOC4 · Searching (`hecic`): local search over a page, results grouped by section, ↑↓ ↵ Esc hints.
- [ ] DOC5 · An article on a phone (`uwjlO`): one column, a bar with the section and "On this page".
- [ ] DOC6 · The menu on a phone (`kBJ1P`): the sidebar over the page (its search field at the top), the current page
  marked.
