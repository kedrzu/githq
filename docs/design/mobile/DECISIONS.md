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
(2026-11-06, proposal of the design agent, not confirmed by the owner)

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
app; building that app is not part of this design.** (2026-11-06, owner said a hybrid phone app comes later; that
it reuses this layout is the design agent's proposal)

**Why.** The owner's aim is access to all of their GitHub work from the phone as comfortable as from the computer,
and a hybrid app is where that ends. Designing the phone layout once, for the browser, and reusing it there avoids a
second phone UI.

## D9

**No board on a phone in the first version: lists only, and the switch between list and board is not shown. A
project view saved as a board shows on a phone as a list grouped by the board's column field.**
(2026-11-06, owner said to leave the board for now; how a board view shows is the design agent's proposal)

**Why.** The owner set the board aside. A board's columns are the values of the field it groups by, so a list
grouped by that field holds the same items in the same order of groups, and the view stays usable.

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
drawings: `MB35`, with `MB62`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: it says what you return to, and the places are
two taps away when wanted, back and the panel, or the command menu's Go to.

**Rejected.**

- Back with the menu beside it (MB36) — two controls fight for the corner, and the wrong tap throws you out of the
  item.
- The menu only, back left to the browser (MB37) — an installed hybrid app has no browser back.

## D21

**A repository's Commits and Actions, which a phone does not show, are offered in the command menu marked ↗ as leaving
for github.com, and nowhere else.** (2026-11-08, owner, picked from the drawings: `MB46`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: they stay findable, so nobody concludes githq
does not know about them, and the mark says before the tap that they leave ([D11](#d11)).

**Rejected.**

- Hidden everywhere (MB48) — you could no longer tell they are a tap away, on github.com.

## D23

**My work's filters (Needs me, Waiting on others, All, each with its count) sit in a strip under the top bar. A row at
a phone's width keeps the type, the title on up to two lines, the repository without its owner when it is tracked
(with it when not), the project's row field with +N, labels as colour dots, one avatar, and for a pull request its
checks and review state, or Draft.** (2026-11-08, owner, picked from the drawings: `MB89`)

**Why.** The owner gave no reason beyond the pick. The drawing's case: the filter is the first choice on every visit,
and behind the corner menu nobody would see which one is on; the desktop row's labels, milestone and assignee names
do not fit in about 350 px, and they are one tap away in the item.

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

## D26

**A property is changed both by tapping it on the item, which opens the command menu straight at its step, and through
⌘ from the item. Every property row shows › to say it can be tapped; the state pill opens closing or reopening.**
(2026-11-08, owner, on the drawings `MB108`–`MB112`)

**Why.** The owner: for a good affordance a property should be changed where it is seen, and the command menu stays
the place where everything is. Both are the same sheet, so there is one mechanism to learn.

**Rejected.**

- A picker of its own dropping from the property (MB111) — a second kind of menu, covering the item, without search.
- Changing only through ⌘ (alone) — a value you can see but not touch.

## D27

**Swiping a list row to the left reveals Status, Assign and Close; each opens the same step of the command menu as on
the item. Everything stays reachable by opening the item.** (2026-11-08, owner, picked from the drawings: `MB114`)

**Why.** The owner: a great idea. Swiping a row is not an edge swipe ([D2](#d2)), and it makes triage from the list
fast.

> **Not settled by this:** which three actions a pull request's row reveals; the drawing shows an issue's.

**Rejected.**

- A long press opening the command menu at the row (MB113) — the design agent's recommendation.
- Nothing, open the item first (MB115).

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
