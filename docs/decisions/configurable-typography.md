# Configurable typography through custom properties behind the type tokens

## Status

Accepted (2026-11-26).

## Context

Comments read small, and people differ in what they read best. The owner asked for presets (Compact, Default,
Spaced), each size and line height adjustable, and a choice of fonts, including a monospace like Monaspace, for a few
type roles rather than per screen (design D49). Until now every size and family was an SCSS constant compiled into
about 700 declarations.

Facts the decision rests on (checked 2026-11-26):

- No SCSS arithmetic, `math.*`, media query, `@if` or `:export` uses the type tokens; the interpolations of
  `$font-size-*` all sit inside custom properties or `calc()`. A token can become a `var()` without touching a caller.
- Interface rows have fixed heights in px across the app (a commit row 52 px, a list header 48 px, the status bar
  26 px), so interface sizes cannot scale without redrawing those.
- The diff and the job log compute row heights in code (`review/buildReviewRows.ts`, `workflows/WorkflowJobLog.vue`),
  so CSS alone cannot carry the Code role.
- Look settings already apply this way: Animations sets `data-motion` on `<html>` from the settings store in the shell.

## Options Considered

- **Custom properties behind role tokens.** Three roles (Reading, Code, Interface). The shell sets
  `--font-family-*`, `--font-size-reading`, `--line-height-reading`, `--font-size-code`, `--line-height-code` on
  `<html>` from `TypographyStore`; each token is `var(--…, <the old value>)` or a `calc()` of one. Code measuring text
  reads the same store. Trade-off: role tokens beside the interface's, and components had to move to them.
- **A class per subtree redefining the shared tokens.** Scale `$font-size-xs` and kin inside a comment or a diff.
  Trade-off: the same token means different sizes by where it sits, and interface text inside those subtrees (an
  author line) scales with them.
- **Scale the whole interface** (one base size, every token a ratio). Trade-off: every fixed row height would follow,
  a redesign of the app's density.
- **A setting per screen.** Trade-off: dozens of knobs, the opposite of calm.

## Decision

Custom properties behind role tokens. Interface sizes stay fixed; Interface takes only a font, and monospace in the
interface follows the Code font at its own size. Reading's line height is a ratio, Code's whole pixels, so virtualized
rows never drift. The settings live in `settings.json` (`typography`), each field read on its own so a value a build
does not understand stays. The phone layout sets no property: its styles fall back to the old values, and
`PHONE_TYPOGRAPHY` gives code the same. Fonts are self-hosted (`latin` and `latin-ext` only); a browser fetches a face
only once text uses it.

## Consequences

- A new surface showing what people wrote uses `$font-size-reading`, `$line-height-reading` and
  `$font-family-reading`; code uses `$font-size-code`, `$line-height-code` and `$font-family-mono`. Any code that
  measures code text reads `TypographyStore.applied.code`, never a constant.
- Storybook and the landing render with the fallbacks, which are the phone's values, not the desktop's Default.
- Monaspace and Commit Mono ship only Latin; other letters in code fall back to the next font.
