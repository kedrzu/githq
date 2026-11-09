# GitHub is the source of truth

githq has no server or database of its own for your work. It keeps a copy of your GitHub data on your device, refreshes
it in the background, and sends every change you make straight to GitHub.

## The copy on your device

Every screen in githq opens from a copy kept in your browser's database (IndexedDB), or in the desktop app's data
folder. When githq starts, it reads that copy into memory, so lists, counts, filters and project views are worked out
from data already there. That is why switching screens doesn't wait for GitHub.

The copy holds:

- what concerns you and what you track (see [Choose what to track](../getting-started/choose-what-to-track.md));
- the fields lists need for every item, and a pull request's overall status;
- an issue's text and comments, or a pull request's checks and reviews, once you open it. For everything in My work
  they are fetched ahead of time;
- the contents of the files a pull request changes, once you review it, so it reopens at once;
- the pages of an untracked repository you browse, for a short while after you leave it.

The copy is a cache. Anything in it can be read again from GitHub, and nothing in it exists only on your device.
Signing out deletes it, and signing in again downloads everything anew. **Settings → Account** shows how many
repositories, projects and items are kept on this device.

## How the copy stays fresh

GitHub can't tell githq that something changed: that would need a server to receive GitHub's webhooks. So githq asks,
regularly, and keeps the question cheap.

|What|How often, while githq is in view|While its tab is hidden|
|-|-|-|
|My work|About every 30 seconds|About every 2 minutes|
|Tracked repositories and projects|About every minute|About every 5 minutes|
|Checks and reviews of pull requests|About every minute|About every 5 minutes|
|Workflows of tracked repositories|About every 3 minutes|About every 10 minutes|

For a tracked repository, githq asks GitHub "has anything changed since I last asked?" as a
[conditional request](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests-if-appropriate).
When nothing changed, GitHub answers "not modified", and that answer doesn't count against your API allowance. Only
when something did change does githq read the changed items.

Projects need their own question. Moving an issue from Todo to In Progress changes the project, not the issue, so the
repository's answer never shows it. githq asks each tracked project the same "anything changed?" question, and reads it
again only when it says yes. If GitHub refuses the free question for a project, githq checks it every 5 minutes
instead, and the project's row in **Settings → Projects** says so.

My work comes from GitHub's search, which has its own small allowance per minute and no free "not modified" answer.
githq reads again only the items whose last change moved.

A change someone makes on github.com shows up in githq with the next refresh.

### Several tabs

If you open githq in several tabs of the same browser, only one of them asks GitHub for changes. The others receive
what it reads. When that tab closes, another takes over. So three tabs don't use up your API allowance three times as
fast.

## Your edits

When you change something in githq, such as an assignee, a label, a project field or a comment, the change shows at
once. githq sends it to GitHub in the background, and it is on github.com as soon as GitHub takes it.

If GitHub doesn't take an edit, githq undoes it on screen and says why, in a toast and in the status bar. For example,
your role in the repository doesn't allow the change, or what it names no longer exists. githq doesn't merge your edit
with someone else's change to the same thing: whichever reaches GitHub last stays.

## Still arriving

Right after you sign in or start tracking something, githq downloads it in the background. Until a part has arrived,
its screen shows faded placeholder rows where the items will be, and the status bar says what is on its way, for
example `Downloading open issues · 120 of 400` or `Still arriving · review requests`. What is already there is usable:
you can open items and edit them while the rest comes.

A repository's open issues and pull requests come first, its closed ones after. **Settings → Repositories** shows each
repository's progress.

## Rate limits

GitHub gives every account an hourly API allowance, shared by every app you use with that account, and a smaller
allowance per minute for search. **Settings → Account** shows how much is left this hour and when it resets.

githq keeps part of the allowance for you. When background refresh has used up all but what is kept for your edits, it
pauses until GitHub resets the allowance, and the status bar says `Paused until` with the time. While it is paused:

- everything on your device still works;
- your edits still go through;
- changes other people make show up after the reset, when refresh resumes by itself.

If the allowance is used up completely, by githq and other apps together, you can still read everything, but GitHub may
refuse edits until the reset. An edit GitHub refuses is undone and says so. If GitHub asks githq to slow down, githq
waits the time GitHub asks for.

GitHub's own page explains [its rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Offline, or GitHub is slow

githq keeps working from the copy on your device.

- **Offline.** The status bar says `Offline`, and githq refreshes again by itself once you are back online. An edit made
  while githq can't reach GitHub is undone, with a note to try again once you're online.
- **GitHub isn't answering.** The status bar says the time of the last refresh and that githq is retrying.
- **GitHub hides something.** If GitHub stops showing you a repository or a project, for example after you lose access,
  its screen says so.

Nothing is lost while you wait: what is on your device stays, and the next refresh brings in what changed meanwhile.
