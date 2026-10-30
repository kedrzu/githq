# Prompt for the design agent: round 3

Copy everything below the line into the design agent.

---

We're continuing work on **githq** in `/Users/kedrzu/Dev/githq/design.pen`, Direction D (frame `I7akNj`). The
brief in `/Users/kedrzu/Dev/githq/docs/design/githq/ui/` has been updated. Re-read `README.md` there,
especially "Where the data comes from": it has two new points, **how fresh is what I see** and
**permissions are known up front**.

Round 2 covered everything we asked for. This round has two parts: corrections where the screens promise
something GitHub doesn't do, and one new element to explore.

## 1. Corrections

These come from checking GitHub's API documentation. Each is a fact, not a taste.

1. **H8 · issue form in someone else's repository.**
   - When someone without write access creates an issue through the API, GitHub silently drops labels,
     assignees, milestone and type. So "pending triage" from vite's form would never be applied.
   - GitHub also does not check a form's required fields for issues created through the API.

   So:
   - **In a repository where the user can't push and that uses issue forms**, githq hands off to GitHub's
     own form on github.com, with the title (and any text fields) already filled in through the URL. Design
     this hand-off in the template picker (H7): what the row says, and what happens when chosen.
   - **H8's pre-filled body stays,** but only for a repository where the user has write access. Change its
     example and remove "GitHub checks them again".
2. **K1 · rejected label in vitejs/vite.** githq knows the user's role in each repository up front, and E4
   already uses that ("2 of 3 editable"). A contributor shouldn't be offered label editing in vite at all.
   - Show in the issue view how edits the user can't make look: not offered, with a quiet reason.
   - Change K1's example to a failure githq can't predict, e.g. the label was deleted on GitHub a moment ago,
     or the issue was locked or transferred meanwhile.
3. **"1 of 2 approvals"** (F1, F3). A PR tells us who approved and the overall review verdict, but not how
   many approvals are required. Show approvals without "of 2".
4. **Organisation owners and the approval request** (G5, G8, G9).
   - We can't rely on knowing who the owners are ("ewa-k or mbrandt"), or whether a request is pending. Remove
     both, along with "Remind owners".
   - What we can show: the organisation hides private data from githq; a link to GitHub's page where the
     user requests approval; and, if they clicked it, "you requested approval on Oct 28" as githq's own
     memory.

## 2. New: how fresh is what I see

githq shows almost everything from a copy kept in the browser and refreshes it in the background. The owner
wants to see at a glance whether what's on screen is current. This applies to **large surfaces**:
- a whole list: my work, a project view, a repository;
- an opened item: panel, modal or full page.

It does not apply to every row.

The states a surface can be in (details in the brief's README):
- **fresh**: checked in the last ~30 seconds. By far the most common state.
- **checking** right now.
- **stale**: the last check is older than expected, because the browser is offline, requests are failing,
  or refresh is paused by the API allowance (K3).
- **partial**: still downloading (first download, a newly tracked repository).
- **answered by GitHub**: a saved view githq can't evaluate locally (K6), refreshed more slowly.
- **own edits on the way**: changes made here and shown already, but not yet confirmed by GitHub; or one
  that failed.

An opened item may be fresher or older than the list it came from, because parts of it, such as comments or
the list of checks, may be fetched when it's opened.

**Draw three distinct directions** for this, side by side, in a new group "Freshness" inside `I7akNj`. Label
them so the owner can pick one. In each direction, show:
- the list (use D1 "My work") and an opened item (use the panel from D1, or F1);
- in at least the fresh, stale (offline) and own-edits-on-the-way states;
- plus one screen where the list and the opened item differ (the list is fresh, the item's comments are
  still loading).

Constraints:
- **Quiet when fresh.** Noticeable only when something is off.
- **It must not compete with the sidebar's existing sync line** ("Synced 14s ago · 4,812 left"). Decide in
  each direction whether that line stays, moves or is replaced.
- **It must stay consistent with K3 (refresh paused) and K6 (answered by GitHub).** If a direction changes
  how those look, redraw them in that direction.

When you're done, list what you changed and anything you decided on your own.
