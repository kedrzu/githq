# Review of the phone screens against the desktop — 2026-11-08

The owner asked for a review of every phone screen in `githq.pen` (`App · Mobile`), looking for defects and above all
for mechanisms that differ from the desktop without a reason: not built on the desktop, or working differently there.
Two read-only reviewers: one walked the 105 MB screens, one checked D1–D42 against the code in `packages/app/` and the
desktop design. The main code claims below were re-checked by hand.

## Phone decisions resting on a wrong belief about the desktop

- **D37, D41 (and D9 struck by D41).** The desktop reads each GitHub saved view's filter, grouping, sort and layout,
  board included (`packages/app/projects/projectViewOptions.ts:62-66`). Changes made in githq are kept per device and
  never synced (`lists/useListViewOptions.ts:48`, `lists/ListViewOptionsStore.ts:9`), and a changed tab is marked
  "modified locally" with Reset to GitHub's version (`projects/ProjectView.vue:1`, `:356-373`). So a board saved on
  GitHub does reach a phone, and the reset has something to go back to. D9's original rule was the real case.
- **D38.** "Repository first, as on the desktop": the desktop fills the repository from the place or the last one used
  and opens the chooser first only when there is none (`newIssue/NewIssueDialog.vue:141`, `ui/new-issue.md:24`) — the
  variant D38 rejected (MB191–MB192).
- **D40.** "The computer's toast" with Create another and Open does not exist: the desktop shows no toast after
  creating, and Create another is ⌘Enter keeping the form open (`newIssue/NewIssueDialog.vue`).
- **D26.** Rejects a picker at the property as "a second kind of menu, without search"; that picker is how the desktop
  item edits a property, with search (`item/ItemProperties.vue:91-151`, `components/Picker.vue`). Opening the command
  menu at a step also exists on the desktop (`commands/CommandRegistry.ts:115`).
- **D20.** Opened from a link with no list behind, desktop close goes to My work (`item/OpenedItem.vue:259`), not up to
  the repository.

## Phone mechanisms the desktop does not have

- Filtering a list by field values (D36): the desktop has only a repository's state, My work's three filters, and a
  project view's GitHub filter, read-only, clearable here.
- Candidates seen on screens only (not confirmed absent in desktop components): "N new since you looked" and folding
  earlier events (MB97), an Empty groups switch (MB173), "number on its way" (MB215), Copy as Markdown on a rejected
  create (MB214), + on a project's group header (MB210).

## Desktop capabilities the phone lacks without a decision

- My work with all four groups at once (the desktop's `/`); the phone's chip shows one group at a time.
- My work's filters: desktop order All, Needs me, Waiting, default All (`myWork/MyWorkView.vue:133`); D23 leads with
  Needs me.
- Choosing a project's row field; the status bar's "Sending N changes" (`shell/SegmentEdits.ts:3`); unfolding a stack
  and its "what stops the stack" line; selecting only the failed items after a partly failed bulk edit.
- `/settings` without `?tab=` is Repositories on the desktop, the list of sections on a phone (D33).

## Defects on the screens

About 30, listed by the screen reviewer: MB34 still draws the dropdown D36 rejected; ⌘ left in task steps (MB200,
MB40, MB109, MB176); captions against decisions (MB66 says tracking is computer-only, MB52/MB53 titles, MB174
grouping, MB205 and MB63 board and pinned-header captions); the old My work pane without the filter strip on eight
screens; data that disagrees between screens (MB98 failing vs 9/9 passed, MB61 wrong numbers, #1209 used twice, #1190
vs #1204, counts on chips vs strips, MB217 lost row data); two kinds of toast and hand-drawn sheets; MB211 chips off the
edge; MB137 over the home indicator; "Variant A ·" left in caption titles of the last section; MB67, MB68 and MB194
identical.
