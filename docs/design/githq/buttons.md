# Buttons

Which button goes where, at which size and in which variant. The code's side is `Button`, `SplitButton` and
`IconButton` in `packages/app/components/`; the design's side is the `Button / …` family in `githq.pen`, App ·
Components, with the `Buttons — guideline` sheet beside it. Decided in D45 (`DECISIONS.md`).

## Sizes

Four heights. The rule is what a place is for: a mouse aims at an action, so a place whose purpose is an action gets
`md`; chrome that is mostly read and driven by keys keeps `sm`.

|Size|Height|Label|Icon|Where|
|-|-|-|-|-|
|`sm`|24|12 px|14 px|Dense chrome a mouse rarely aims at: a list's, review's or log's toolbar; a section's or group's header inside an item ("Request" reviewers); a row's inline controls; a diff file's header; a bar inside a pane (pending review, lost viewed); the new issue's field pickers; toasts.|
|`md`|32|13 px|16 px|Every place whose purpose is an action: a card's actions (the pull request's merge card, a failed comment, a missing thread); an editor's or composer's footer (Comment, Reopen, Close, Cancel, Discard); a thread's Resolve and Reply; the merge panel's footer; a dialog's footer; the actions of an empty or error state ("Nothing to diff"); a settings block and the account page; a form. The default.|
|`lg`|40|14 px|16 px|The single call to action of a page with little else (sign in, choose what to track, desktop hand-off) and, on a phone, the actions a screen is for.|
|`xl`|48|16 px|18 px|The landing page only.|

- **The default is `md`.** A button in dense chrome names `sm`; one that names nothing is an action.
- **One row, one size.** All buttons of one action bar share a size. A toolbar never holds an `md` button; a card's
  actions never hold an `sm` one.
- **A split button** (an action with its other ways in a joined menu: Close issue ▾) is `md`, `lg` in a phone's docked
  composer; all of them sit in footers.
- **Icon-only buttons are on the same scale:** `sm` 24 × 24 beside `sm` buttons and in headers, `md` 32 × 32 beside
  `md` ones. The sidebar's rail has its own `rail`, 38 × 34.
- **On a phone** the actions a screen is for are `lg`: the merge card's, the docked composer's, a page's call to
  action. Chrome a phone enlarges for a finger (a toast's actions, a toolbar control, a settings field) is `md`, and an
  empty state's actions stay `md`. Phone-only components (the top bar, the command line, pills) and icon buttons that
  a phone's bars enlarge keep their own 44–48 px targets.
- Rows don't grow for a button: a list's rows and toolbars keep their heights.

## Variants

Each variant means one thing.

|Variant|Look|Means|
|-|-|-|
|`primary`|accent fill|The one main action of a surface: a card, a composer, a dialog, a panel, a page ("Merge pull request", "Comment", "Submit review", "Create issue"). At most one per surface.|
|`secondary`|raised fill, outline|Every other action beside it, and the actions of a surface without a main one ("Delete branch", "Open on GitHub", "Review files").|
|`ghost`|no fill until hovered|A toolbar's tools and a menu's trigger ("Filter"). Never mixed into a bar of `secondary` actions.|
|`outline`|outline only|A toolbar control that shows a current value ("Group: Reason", a new issue's field picker).|
|`link`|text only|Inside a sentence or a row's meta line ("Why?", "Show 4 more commits"). Never in an action bar. Outside the size scale: it takes the font of the text it sits in.|
|`danger`|red outline|An action that deletes ("Sign out and clear", "Delete comment").|
|`destructive`|red fill|The answer to a question that throws something away ("Discard").|
|`light`|light fill|The main action of a sign-in page ("Sign in with GitHub", "Copy and open"). Everywhere else the main action is `primary`.|
|`field`|a text field|A button that opens the field it looks like ("Search… ⌘K", "Reply…").|

- **One row, one variant:** an action bar is `secondary` throughout, apart from its single `primary` (or `destructive`)
  one.
- **A bar that wears a state's colour** lends it to its main action: the pending review's toolbar is amber and its
  Submit review amber, red once a submission is refused (code review D28). The button stays `primary` in meaning.
- `tone="accent"` colours a `link` or `ghost` label in the accent, for a text action that does something ("Request").

## Icons and keys

- **A leading icon goes through the `icon` prop**, never as a child of the label: the button sizes it (14 px at `sm`,
  16 px at `md` and `lg`, 18 px at `xl`). An icon in the label is sized the same way, but only trailing marks belong
  there: a menu's chevron, the external-link mark.
- **A key hint** (`kbd`) is drawn at the button's size and sits as far from the end as from the top and bottom. Where
  key hints are hidden, or a layout is narrow, the button drops it and keeps its height.

## Out of this guideline

Elements that act on a click but are not drawn as buttons: rows, tabs, toggles, segmented controls, disclosure rows,
swipe tiles, pills, the diff's line numbers and comment affordances; the landing page's navigation.
