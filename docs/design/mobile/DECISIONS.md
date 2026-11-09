# Decisions

The decisions in force: grepped and re-entered, never read front to back. A heading is the decision's ID alone, so
`DECISIONS.md#d3` keeps resolving after the wording is sharpened. Retired decisions, the journal and notes from
reviews live in [history/](history/). Navigation ideas not yet chosen are in [variants.md](variants.md), waiting to be
drawn.

**Before proposing a change in an area, read the Rejected lines of its decisions and the history they link to.**
Reopening a rejected option is right when its premise changed; repeating it without knowing it was rejected is not.

## D1

**The navigation is classic mobile navigation and makes good use of the top-left and top-right corners; its exact
shape is picked from drawn variants, not argued.** (2026-11-06, owner)

**Why.** The owner cannot judge the bottom bar or the menus without seeing them, so every idea goes to the design
agent to be drawn side by side ([variants.md](variants.md)), and the design agent is free to propose shapes nobody
listed.

## D2

**No menu opens by swiping from a screen edge — every menu opens from a button.** (2026-11-06, owner)

**Why.** A swipe from the edge is risky, the iPhone above all, where the browser takes edge swipes for its own
gestures; the owner rules it out for now.

**Rejected.**

- Swiping from the left edge to open the left menu — clashes with the browser's own edge gestures.

## D3

**On a phone, an address githq does not show there is handed off to github.com, the same way as every address
githq does not show at all.** (2026-11-06, owner)

**Why.** It is the rule the app already lives by, so nothing new is invented for mobile: the set of addresses githq
shows is simply smaller on a phone. Commits and a pull request's review (`/pull/:n/files`) are the first such
addresses.

> **Checked 2026-11-06:** the hand-off replaces the githq entry in history with the same path, query and fragment on
> github.com, so going back does not land on it again; the desktop app opens github.com in the system browser and
> goes back instead — `packages/app/shell/GitHubHandOffPage.vue:1`.

**Rejected.**

- A "not on mobile yet" screen with a link to GitHub — a dead end, and a second way of saying what the hand-off
  already says.
- Redirecting to the nearest screen githq has (a pull request's files → the pull request) — the link would not show
  what it promised.

## D4

**The first mobile version is the daily loop: My work, a repository's issues and pull requests, a project as a
list, an item read and edited (comment, assignees, labels, project fields, open or closed), a new issue, the
command menu from a button, the first sign-in ([D7](#d7)) and Settings, tracking included ([D30](#d30)). Commits, code
review, Actions and merging come later.** (2026-11-06, proposal of the design agent; the owner confirmed merging as
later and raised no objection to the rest; 2026-11-08, the owner moved tracking settings in)

**Why.** The owner asked for the basic functionality first, naming commits and code review as later, and put
merging later too. The rest of the list is inferred from the desktop's first version, not from the owner.

**Rejected.**

- Merging a green pull request from the phone in the first version — the owner put it later; on the desktop it is a
  whole panel of conditions, checks and stacks.
- Tracking settings later — the owner: the technical settings must be the same on a phone, and a phone's settings are
  not necessarily synced from the computer ([D30](#d30)).

## D5

**"On a phone" means a narrow window: below one width the app takes its mobile layout and the hand-offs of
[D3](#d3), whatever the device. Resizing never navigates — whether an address is handed off is decided when it is
navigated to, and a screen already open stays and is squeezed.** (2026-11-06, owner, on the design agent's proposal)

**Why.** A narrow window needs the mobile layout anyway: the desktop's side-by-side panes do not fit below about
650 px. If the feature set followed the device instead, a narrow window on a computer would need mobile versions of
commits and code review, which are not designed. The width is not fixed here.

> **Checked 2026-11-06:** the shell's screen has a minimum width of 400 px and the sidebar of 180 px —
> `packages/app/shell/AppShell.vue:85`, `:88`. The landing page already switches to its mobile layout below 720 px
> of its container — `packages/app/styles/tokens.scss:241`.

**Rejected.**

- Deciding by device (a touch screen and a narrow screen) — a narrow window on a computer would be a third state,
  mobile layout with desktop features, that nobody designs. It would win if someone regularly works in a narrow
  window on a computer and needs commits there; no such case is known.
- Handing off on resize — narrowing a window during a code review would throw the user out to github.com.

## D6

**The desktop app never takes the mobile layout: its window has a minimum width above the mobile width.**
(2026-11-06, proposal of the design agent; confirmed by the owner 2026-11-08)

**Why.** Nobody runs the desktop app on a phone, and a narrow desktop window handing commits off to the browser
would take away what the desktop app is for.

## D7

**The first sign-in works on a phone: signing in, and choosing what to track.** (2026-11-06, owner, on the design
agent's proposal)

**Why.** GitHub has no such screens, so the hand-off of [D3](#d3) cannot cover them, and someone signing in for the
first time from a phone would otherwise be stuck.

> **Checked 2026-11-08:** the first download's screen no longer exists; after choosing what to track the app lands on
> My work at once, and each screen says itself what is still arriving —
> [the first-run design](../../first-run-and-loading/README.md). The choice is a route of its own outside the shell
> (`firstSignIn: 'choose'`, `packages/app/app/router.options.ts:103`).

**Rejected.**

- Accepting the default choice (your own repositories) without asking on a phone — a member of an organization,
  whose repositories are not "theirs", would land in an empty My work with no way to fix it from the phone.

## D8

**The mobile layout is also what a future hybrid mobile app will show, the way the desktop app bundles the same
app; building that app is not part of this design.** (2026-11-06, owner said a hybrid phone app comes later; that it reuses this layout was the design agent's proposal,
confirmed by the owner 2026-11-08)

**Why.** The owner's aim is access to all of their GitHub work from the phone as comfortable as from the computer,
and a hybrid app is where that ends. Designing the phone layout once, for the browser, and reusing it there avoids a
second phone UI.

## D9

**No board on a phone at all: lists only, with no switch between list and board. A project view saved on GitHub as a
board shows on a phone as a list grouped by the board's column field, in the columns' order.** (2026-11-06, owner left
the board for later; 2026-11-09, owner: lists have grouping too, so boards go from the phone entirely)

**Why.** A board's columns are the values of the field it groups by, so a list grouped by that field holds the same
items in the same groups. The desktop reads a view's layout from GitHub, so a board view does reach the phone.

> **Checked 2026-11-09:** a board view's columns become its grouping — `packages/app/projects/projectViewOptions.ts:62-66`
> (`getColumnGrouping`).

**Rejected.**

- A board view's layout never reaching the phone, so nothing to turn into a list ([history](history/RETIRED.md#d41)) —
  rested on the belief that a view's layout is not read from GitHub; it is.
- A board on the phone — the owner dropped it: a grouped list holds the same.

## D11

**A link that leaves githq for github.com on a phone says so before it is tapped, with a ↗.** Only links the phone
does not show carry the mark. (2026-11-06, owner, picked from the drawings: `MB49`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: a phone has no hover to tell you where a link
goes, and the hand-off of [D3](#d3) is otherwise a surprise.

**Rejected.**

- Plain links (MB50) — the first you know of the hand-off is github.com filling the screen.

## D12

**A phone shows that the copy is not fresh in three places: a strip under the top bar that appears only when
something is off, a toast above the dock for an edit that failed, and the freshness and API allowance always in the
places panel.** (2026-11-06, owner, picked from the drawings: `MB51`, `MB52`, `MB53`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: a phone has no room for the desktop's status
bar, while "your edit did not go through" and "githq cannot reach GitHub" must still be seen.

**Rejected.**

- Only a dot on the menu button (MB54) — easy to miss, and stale data is what you should not miss before acting.
- A strip above the dock (MB55) — it makes the bottom heavier while you read.

## D13

**The command menu's button is ⌘.** (2026-11-06, owner, picked from the drawings: `MB57`; it sits in the command line,
[D17](#d17))

**Why.** The owner gave no reason beyond the pick. It names the same thing as ⌘K on the computer.

> **Not settled by this:** ⌘ is a key from Apple keyboards. Someone on Android, or who only knows githq from Windows,
> has no ⌘ to recognize; no one has tested how they read it.

**Rejected.**

- The violet slash of git/hq (MB56) — the design agent's recommendation; the owner chose otherwise.
- A magnifying glass (MB58) — it undersells the menu: nobody looks under search for closing an issue.
- A labelled pill (MB59) — it does not fit beside My work's five tabs.

## D14

**The top-right corner holds two buttons for the screen you are on: the list's options (filter, sort, group) and New
issue on a list, previous and next on an item.** (2026-11-06, owner, picking both drawn options because two icons fit:
`MB32`, `MB33`, `MB34`)

**Why.** The owner: both options, since two icons fit. Filter, sort and group stay in the command menu too, as on the
computer; the rule against holding things twice is about a separate menu of an item's actions, and this is not one.

**Rejected.**

- Choosing between New issue and the options menu — two icons fit in the corner beside any title.

## D15

**In a browser tab the command line floats above Safari's own bar and takes the height that costs.**
(2026-11-06, owner: there is no way around it, githq has no control over the browser's interface; `MB83`)

**Why.** About 670 px are left for a list on a 390 × 844 phone, against about 750 in an installed app, by the drawing's
own measures. The hybrid app of [D8](#d8) gets the difference back.

**Rejected.**

- Moving a place's parts to the top in a browser tab (MB20) — a second layout for one case, and the owner accepts the
  cost.

## D16

**The open command menu rises from below, with its input at the bottom and no keyboard until the input is tapped; the
first results are the nearest to the thumb.** (2026-11-06, owner, picked from the drawings: `MB38`–`MB40`; `MB41`,
typing, belongs to the same variant)

**Why.** The owner gave no reason beyond the pick. The drawing's case: most uses on a phone are tapping an action, not
typing, and the keyboard would take half the screen.

**Rejected.**

- A half sheet with the input on top (MB42–MB43) — the first action is furthest from the thumb, and the input jumps to
  the far side of the results when the keyboard comes.
- Full screen with the keyboard up (MB44–MB45) — about four actions fit above the keyboard.

## D17

**There is no bottom tab bar. A command line floats over the bottom of every screen: on a list one wide button with ⌘
and a chip saying which part this is and how many; on an item the comment box and ⌘, two floating buttons side by
side. Tapping it opens the command menu in place, with the place's parts nearest the thumb.**
(2026-11-06, the owner's idea, picked from the drawings: `MB78`, `MB80`–`MB83`, `MB39`)

**Why.** The owner wanted everything from the bottom bar under the command line. It fits [D16](#d16), whose input is
already at the bottom, and the list scrolls out from under the line, which matters most above Safari's bar. A project's
saved views have room in a menu, where tabs had to scroll sideways.

> **The known cost:** moving between a place's parts is two taps instead of one, and the other parts' counts are out of
> sight. Accepted knowingly, not yet tried on a phone.

**Rejected.**

- The bottom bar holding a place's parts, with the button at its end (MB1–MB3, MB14–MB16, MB88) — one tap between parts
  with every count in view, for a bar's height on every list.
- Fixed global tabs (MB17–MB19), parts as tabs at the top (MB20), the title switching the part (MB21–MB22).
- The same line on every screen, the comment box behind it (MB84–MB86) — removes the open box that invites a reply.
- The line shrinking to a bubble while scrolling (MB87) — a moving target for the thumb.
- The button elsewhere: the title as the button (MB4–MB5), the top-right corner (MB6–MB7), a bar that stays on the item
  (MB8–MB9), floating alone (MB10–MB11), one box at the bottom (MB12–MB13).

## D18

**The ⌘ button belongs to a screen at rest. Inside a task — writing a reply, picking a value, creating an issue — it
leaves and the task gets its room; it comes back as soon as the screen is at rest again, with a draft kept in the
comment box.** (2026-11-07, the owner's idea, picked from the drawings: `MB70`–`MB74`)

**Why.** The owner: the button should disappear once the comment input is expanded, and in other drill-downs alike.
The drawing's case: inside a task you have already answered "what can I do here?", the box gains the button's width,
and Send no longer sits beside a button that opens something else.

> **The known cost:** assigning someone in the middle of a reply takes one tap more, putting the keyboard away first.

**Rejected.**

- The button staying while you write and in the new issue form (MB76–MB77) — one tap away mid-reply, but the box is
  narrower and a wrong tap beside Send opens the menu.

## D19

**The top-left corner on a list opens the places as a panel from the left, by a tap: flat, as the desktop sidebar is,
with where you are marked, and the freshness and the account at its foot.** (2026-11-07, owner, picked from the
drawings: `MB26`, `MB27`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: a place's parts are already under the command
line ([D17](#d17)), so nothing needs to drill, and a panel needs no address of its own, so it takes no step in history.

**Rejected.**

- One menu that drills from the places into a repository's parts (MB28–MB29) — the parts would be in two menus.
- The places as a screen of their own, the top-left always back (MB30–MB31) — the screen needs an address GitHub does
  not have, and it is one more step in history between every two places.

## D20

**On an item's screen the top-left corner is a back arrow with the name of the list it returns to. Opened from a link,
with no list behind it, the arrow goes up to the repository and says so.** (2026-11-08, owner, picked from the
drawings: `MB35`, with `MB62`; 2026-11-09, owner: the computer follows the same rule)

**Why.** The owner gave no reason beyond the pick. The drawing's case: it says what you return to, and the places are
two taps away when wanted, back and the panel, or the command menu's Go to.

**Rejected.**

- Back with the menu beside it (MB36) — two controls fight for the corner, and the wrong tap throws you out of the
  item.
- The menu only, back left to the browser (MB37) — an installed hybrid app has no browser back.
- Going to My work when there is no list behind, as the computer did (`packages/app/item/OpenedItem.vue:259`) — the
  owner chose the repository for both; the computer changes.

## D21

**A repository's Commits and Actions, which a phone does not show, are offered in the command menu marked ↗ as leaving
for github.com, and nowhere else.** (2026-11-08, owner, picked from the drawings: `MB46`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: they stay findable, so nobody concludes githq
does not know about them, and the mark says before the tap that they leave ([D11](#d11)).

**Rejected.**

- Hidden everywhere (MB48) — you could no longer tell they are a tap away, on github.com.

## D23

**My work's filters — the computer's three, All, Needs me and Waiting on others, in that order, All by default, each
with its count — sit in a strip under the top bar. A row at
a phone's width keeps the type, the title on up to two lines, the repository without its owner when it is tracked
(with it when not), the project's row field with +N, labels as colour dots, one avatar, and for a pull request its
checks and review state, or Draft.** (2026-11-08, owner, picked from the drawings: `MB89`; the order and default
set to the computer's 2026-11-09)

**Why.** The owner gave no reason beyond the pick. The drawing's case: the filter is the first choice on every visit,
and behind the corner menu nobody would see which one is on; the desktop row's labels, milestone and assignee names
do not fit in about 350 px, and they are one tap away in the item.

> **Checked 2026-11-09:** the computer has the same three filters on keys 1–3, All first and by default —
> `packages/app/myWork/MyWorkView.vue:133`.

## D24

**A pull request of mine nested under the issue it closes shows as one line indented to the issue's title: an arrow,
its number, as much of its title as fits, and its checks. It is not counted.** (2026-11-08, owner, picked from the
drawings: `MB100`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: it reads as part of the issue and costs about
28 px.

**Rejected.**

- A chip on the issue's row (MB101) — a small target, and the pull request's title is gone.
- The full row, indented (MB102) — two near-identical rows read as two items.

## D25

**An item's properties are split: what needs its name stays a row under the title — assignees and the first project's
row field on an issue; reviewers, checks and the row field on a pull request, under "where it stands" — and what reads
on its own follows as one block of chips without names: labels, the milestone, sub-issues, another project's field;
on a pull request the branch, its size and the issues it closes. A chevron at the right of the chips unfolds every
property as rows in place, the chips giving way to them — every project with all its fields, the empty ones too, and
Add to a project — and Fewer folds it back.** (2026-11-08, owner: rows first with only the important ones, the rest
unfolding inline, not hidden; then chips after the rows (`MB128`) with a chevron beside them, not a small "All" chip,
and the chips gone once unfolded; drawn in `MB125`, `MB126`, `MB128`)

**Why.** The owner preferred the desktop's rows to a line of chips alone, but not every row before the conversation.
The drawing's case: the activity starts under 570 px down instead of under the fold, labels and the milestone read at
a glance without a key, and nothing slides over the item to see the rest.

**Rejected.**

- A summary line of chips with a sheet for every property (MB103–MB105) — the design agent's recommendation; the owner
  preferred rows.
- The properties after the body (MB107) — the newest comment is as far as with all rows at the top, and a long body
  hides the properties.
- A More row naming what else there is (MB124) — superseded by the chips, which show the values themselves.
- The chips under the title, beside the state (MB127, MB130–MB132) — the owner picked them after the rows; a small
  "… All" chip as the way to every property was too small a target.
- The chips after the body (MB129) — on a long body the labels and milestone are out of sight.

## D27

**Swiping a list row to the left reveals Status, Assign and Close; each opens that property's menu at the bottom, the
same as tapping it on the item ([D45](#d45)). Everything stays reachable by opening the item.** (2026-11-08, owner,
picked from the drawings: `MB114`; the menu it opens changed 2026-11-09)

**Why.** The owner: a great idea. Swiping a row is not an edge swipe ([D2](#d2)), and it makes triage from the list
fast. The three are a subset of the desktop's right-click menu on a row (`packages/app/item/getItemMenuSections.ts`).

> **Not settled by this:** which three actions a pull request's row reveals; the drawing shows an issue's.

**Rejected.**

- A long press opening the command menu at the row (MB113) — the design agent's recommendation.
- Nothing, open the item first (MB115).
- Each action opening the command menu's step — the command menu stands for the desktop's ⌘K, not its dropdowns
  ([D45](#d45)).

## D28

**Several items can be selected on a phone in the first version. Select, in the list's options in the top-right
corner, turns the rows into checkboxes; the top bar says how many are selected and × leaves. The command line's chip
becomes the selection, so ⌘ acts on all of them and offers only what applies to every one, with mixed values said as
such, as on the computer. When some of them fail, the toast names which and why, and the selection stays.**
(2026-11-08, owner, picked from the drawings: `MB117`–`MB119`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: triage of My work often touches several items
at once, and the selection reuses the command menu instead of a toolbar of its own.

**Rejected.**

- Not in the first version (MB116) — the design agent's recommendation.

## D29

**A stacked pull request shows its place in the stack in a strip under the top bar: the stack's icon, "Stack · 2 of
4", the pips coloured by state, and ← and → to the previous member (towards the base) and the next.**
(2026-11-08, owner: variant B, with the arrows pointing left and right instead of down and up; drawn in `MB122`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: always in view and quick to step through, the
desktop's stack bar shrunk to a phone. Left and right read as moving along the stack, the way its pips run.

**Rejected.**

- A row in the properties that opens the stack in a sheet (MB120–MB121) — the design agent's recommendation.
- A section of its own after the properties (MB123).

## D30

**Settings on a phone has the same sections as on the computer, tracking included — which repositories and projects
are tracked, and each tracked one's own settings. Left out are only the settings about the computer's layout: the
repository layout (sections as tabs, or a column beside the sidebar). Code review's comment setting stays, though code
review itself is not on a phone.** (2026-11-08, owner: the same options, minus those about layout; which exactly is the
design agent's proposal)

**Why.** The owner: the technical settings must be the same on a phone, and the user will not necessarily configure
the phone through settings synced from the computer. A phone that cannot change what it tracks is stuck with its
first sign-in's choice. The repository layout chooses between two desktop arrangements a phone does not have. Code
review's setting is kept because it is the user's choice about GitHub, synced with the rest, and hiding it would make
the phone's Settings a different list to learn.

> **Checked 2026-11-08:** the sections are repositories, projects, display (repository layout, animations), code
> review (comments sent at once or into a draft review), saving of settings (sync) and account; the desktop app adds
> updates and changelog — `packages/app/settings/settingsRoutes.ts:30`, `packages/app/settings/DisplayView.loc.yaml`,
> `packages/app/settings/CodeReviewView.loc.yaml`. A tracked repository and a tracked project each have a settings
> screen of their own. There are no notification settings: githq has no notifications.

**Rejected.**

- Settings without the tracking sections ([history](history/RETIRED.md#d22)) — a phone could not change what it
  tracks, and its settings are not necessarily synced from the computer.
- No Settings on a phone, `/settings` showing "open it on a computer" — an exception to the hand-off rule, to save
  fitting a simple page.

## D31

**While anything downloads, the places panel's foot says what the desktop status bar's left segment says — the turning
icon, items so far of all counted and the time left — in place of the API allowance. No screen gets a download strip of
its own; each says only what it itself waits for.** (2026-11-08, owner, on variant A, drawn in `MB141`)

**Why.** The owner: the status should be the same as on the computer, the one in the opened panel, and a screen of
details has no reason to show that four repositories are downloading. The panel's foot is already the phone's left end
of the status bar ([D12](#d12)), so the order of offline, paused, downloading and the allowance carries over.

**Rejected.**

- A strip under the top bar on every list while the download lasts (MB142) — progress of everything does not belong
  to one screen, and the strip is kept for when something is off.

## D32

**The account tile at the places panel's foot opens a menu, as the user menu on the computer: who you are signed in as,
Settings, and Sign out as a separate item. The tile no longer carries Sign out itself.** (2026-11-08, owner; drawn in
`MB171`)

**Why.** The owner: the bottom tile should open a dropdown like the desktop's, with Settings and Sign out as separate
options. One place to look on both, and a stray tap at the panel's foot only opens a menu.

**Rejected.**

- The whole account row opening Settings, Sign out moved into Account (MB143) — the design agent's recommendation.
- A Settings row above the account, Sign out kept on the tile (MB144).

## D33

**Settings on a phone opens on the list of its sections; each section is a screen of its own with back to Settings, at
its own address (`/settings?tab=…`, the first section included).** (2026-11-08, owner, picked from the drawings:
`MB146`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: the way every phone's settings work, each section
says its state on the list, and a new section is one more row.

**Rejected.**

- The first section open with the others as segments along its top (MB147) — six do not fit, Account falls off the edge.
- One long screen with every section (MB148–MB149) — long, with Account at its very end.
- The sections as the command line's part (MB150) — hidden until tapped, and they are not parts of a place.

## D34

**Choosing what to track with the keyboard up: the search pinned at the top, Track these on a bar above the keyboard with
the running count. The search also asks GitHub, so a repository outside the user's lists is found and ticked in the
same list, under On GitHub — on the phone (`MB163`, `MB164`) and on the computer (`G18`, `G19`).** (2026-11-08, owner:
variant A, and the computer gets the same search)

**Why.** The owner picked A and asked whether the computer can find repositories beyond the user's own; it could only
through Search repositories… in the command menu (githq D34) and G10's input for a name, so the chooser takes the same
search: from two typed characters once typing pauses, results after the user's own matches, one calm line while GitHub
answers. Settings' chooser (T18, MB168) is the same component, so it searches GitHub too.

**Rejected.**

- The search at the bottom, Track in the top-right corner (MB165–MB166).
- Picked ones in a line, Track these only after the keyboard is down (MB167).

## D35

**Tracking on a phone keeps the computer's two parts: Settings › Repositories (and Projects) lists only what is tracked,
each row drilling into that repository's or project's own settings; adding is a separate step, the first sign-in's
choosing screen opened as a screen of its own.** (2026-11-08, owner: the same split as on the desktop, the sign-in
screen reused for adding; drawn in `MB151`–`MB155`, `MB168`, `MB172`)

**Why.** The owner: the two parts must be as on the computer — tracking apart from showing what is tracked with a drill
down — and adding may use the sign-in's screen. One choosing screen to learn, with room for picking many.

**Rejected.**

- A picker rising from below for adding (MB169–MB170) — a second way of choosing, without owners' groups or Select
  all.

## D36

**A list's options button opens one sheet rising from below with the list's grouping and sort, each a row of chips
changed in place while the list behind follows. A repository offers GitHub's own groupings (milestone first), a project
its fields, My work reason, repository, status and author. The sheet's filter row is drawn but not built in the first
version ([D46](#d46)).** (2026-11-08, owner, picked from the drawings: `MB173`–`MB176`; the filter set aside 2026-11-09)

**Why.** The owner gave no reason beyond the pick. The drawing's case: one tap per change, every setting in view, and
the sheet opens the same way as the command menu. The groupings are the desktop's
(`packages/app/repository/repositoryViewOptions.ts:13`, `packages/app/myWork/myWorkViewOptions.ts:23`,
`packages/app/projects/projectViewOptions.ts:132`).

**Rejected.**

- The command menu opened at a View step (MB177–MB178) — every change two taps, one setting in view at a time.
- A screen of its own (MB179) — the list it changes is out of sight.

## D37

**A view changed on a phone stays this device's own: it is not saved in the synced settings, it carries no mark, and
there is no way back to GitHub's version to offer.** (2026-11-08, owner: view preferences are not in synced settings, so
there is no need for "back to GitHub"; the question `MB180`–`MB184` was dropped)

**Why.** The owner did not see what the mark and the reset were for: nothing about a view's shape leaves the device.

> **Not settled by this:** the computer's project brief still asks for a locally modified tab with a reset
> (`docs/design/githq/ui/project.md`); whether the computer drops it too is the owner's call there.

**Rejected.**

- A dot on the command line's chip with Back to GitHub's view in the options (MB180–MB182), a strip under the top bar
  (MB183), the reset only inside the options (MB184).

## D39

**A repository's issue templates rise as a step once the repository is chosen: a markdown template fills the body, an
issue form fills in only where the user can push and otherwise opens GitHub's own form ↗, and turned-off blank issues
stay listed, dimmed.** (2026-11-08, owner, picked from the drawings: `MB200`, with `MB213`)

**Why.** The owner gave no reason beyond the pick. It is the computer's H7, and someone contributing to a project that
asks for a template does not miss it.

**Rejected.**

- A Template row in the form (MB201) — easy to miss before sending a bare issue.

## D42

**A new issue's details are set as on an item: under the title the rows that need their name — Assignees with Assign
to me at its end, the project's field when there is one, the parent — then the rest as chips, empty ones saying what
they would hold; tapping any of them opens its menu at the bottom, as
on an item ([D45](#d45)).** (2026-11-08, owner, picked from the drawings:
`MB194`–`MB196`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: the form reads like the item it becomes
([D25](#d25)), changed the same way ([D45](#d45)), and assigning yourself is one tap.

**Rejected.**

- One Add details row (MB197), only through ⌘ (MB198), icons above the keyboard (MB199, what MB67 showed until now).

## D43

**A new issue starts in the repository of the place: in a repository, or on an item, that repository, shown in the
form and changed from it. Started from outside any repository — My work, a project, anywhere else — it opens on choosing
the repository first.** (2026-11-09, owner: as on the desktop, with the exception that outside a repository the
repository is chosen)

**Why.** The owner wants the desktop's behaviour, which fills the repository in from the place.

> **Checked 2026-11-09:** the desktop fills in the screen's repository, and elsewhere the last draft's or the last used
> one; the chooser opens first only when there is none — `packages/app/newIssue/NewIssueComposer.ts:193-215`,
> `packages/app/newIssue/NewIssueDialog.vue:141`. So "outside a repository, choose first" is not yet what the desktop
> code does from My work: it offers the last used repository.

**Rejected.**

- The repository always chosen first ([history](history/RETIRED.md#d38)) — chosen as "as on the desktop", which it is
  not.

## D44

**Creating an issue closes the form and a toast follows, on the phone and on the computer alike: a title saying what was
created, a detail line, a countdown, and real buttons — Create another, which opens the form again with the same
repository, project and labels, and Open. On the computer its buttons carry no keyboard shortcuts; on a phone they are
larger, for a finger, though the drawn ones may be too large.** (2026-11-09, owner)

**Why.** The owner wanted the toast on the phone, with an action that reads as a button; the desktop had none (it keeps
the form open on ⌘Enter instead, `packages/app/newIssue/NewIssueDialog.vue:1`), so rather than a second solution the
toast becomes the desktop's too. This changes the desktop design: it needs drawing in the desktop's new issue frames and
building there.

**Rejected.**

- The toast on the phone only ([history](history/RETIRED.md#d40)) — it claimed to be the computer's toast, which did
  not exist.
- A Create another switch in the form (MB202–MB203).
- A one-line toast with a bold word as its action — not visibly a button.

## D45

**What is a dropdown on the computer is a menu pinned to the bottom of the screen on a phone, with the same entries and
the same search: a property's picker (tapping it on an item, in the new issue form, or a row's swipe action), the item's
menu, a row's right-click menu. The command menu on a phone stands only where the computer has ⌘K.** (2026-11-09, owner)

**Why.** The owner: opening the command menu for what is a dropdown on the computer mixes two things and makes for odd
UX. The desktop item edits a property in a picker dropping from it, with type-to-filter
(`packages/app/item/ItemProperties.vue:91-151`, `packages/app/components/Picker.vue`); a menu at the bottom is that
picker within a thumb's reach. ⌘ on the item still reaches every property through the command menu, as ⌘K does.

**Rejected.**

- Tapping a property opening the command menu at its step ([history](history/RETIRED.md#d26)) — two different things
  in one sheet; its reason called the desktop's picker a menu without search, which it is not.
- A picker dropping from the property (MB111) — covers the item, out of the thumb's reach.

## D46

**The first phone version builds no filtering the computer does not have. What the desktop has comes along: a
repository's open / closed / both, My work's filters, a project view's filter from GitHub and clearing it on this
device. Filtering a list by field values (labels, assignee, a project's field) in the options sheet stays drawn, for
later, on both.** (2026-11-09, owner: no filters on a phone for now, keep the designs and write it down)

**Why.** The desktop has no editor for filters by field values; building it on the phone first would make the phone a
second solution.

> **Checked 2026-11-09:** the desktop's filters — `packages/app/repository/RepositoryView.vue:242` (state),
> `packages/app/myWork/MyWorkView.vue:133` (All, Needs me, Waiting on others), the project view's GitHub filter, cleared
> here (`packages/app/projects/ProjectView.loc.yaml`).

## D47

**My work on a phone shows what it shows on the computer at `/`: every group at once, grouped by reason, not one group
at a time.** (2026-11-09, owner: show everything as on the desktop)

**Why.** One group at a time was never decided; it came out of the command line's chip naming "the part you are in".
The desktop's default is all four groups (`packages/app/myWork/MyWorkView.vue`).

## D48

**The phone carries the desktop's capabilities that its screens had left out: choosing a project's row field, the
edits still being sent ("Sending 2 changes"), unfolding a stack to all its pull requests with what stops it, and
selecting only the failed items after a bulk edit partly failed.** (2026-11-09, owner)

**Why.** Each exists on the desktop (`packages/app/projects/ProjectView.loc.yaml` row field,
`packages/app/shell/SegmentEdits.ts:3`, `packages/app/item/StackMap.vue`, `packages/app/edits/EditToasts.vue`); leaving
them out made the phone poorer without a decision.
