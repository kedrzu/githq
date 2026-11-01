# githq — a fast task manager on top of GitHub

githq is a web app that turns GitHub Issues, Pull Requests and GitHub Projects into a task manager that is
pleasant to use every day: one place to see everything you are working on across all your repositories,
fast enough that navigation never shows a spinner, and fully usable from the keyboard. It is a client for
GitHub, not a new tracker. Everything it shows lives on GitHub, and every change it makes is an ordinary
GitHub change, visible on github.com straight away.

## Why

People who run open-source projects, and small teams who already work on GitHub, usually track their work
in GitHub Issues and Projects too. It is free, it sits next to the code, and contributors already know it.
As a task manager, though, github.com is uncomfortable. Your current issues and pull requests are spread
across repositories. The views that pull them together exist, as saved filters and custom project views,
but they are slow and fiddly to use day to day. So people who can afford it move their planning to a
dedicated tool. Linear is the usual example, and the author uses it at work for exactly this reason: it is
fast and comfortable in a way GitHub isn't. The price is a second tool to pay for and keep in sync with
GitHub, which an open-source project rarely wants.

## What is different once it exists

You open githq and land on a dashboard with everything that is currently yours, from every repository you
work in: issues assigned to you, your pull requests and their state (CI checks, review state, draft, whether they can be merged),
pull requests waiting for your review, and the projects you track. It is there immediately, because it is
read from a copy kept in your browser and refreshed in the background. You move through it with the
keyboard, open a pull request in one keystroke, change an assignee or a project field, and the change
appears at once — githq writes it to GitHub behind the scenes.

It does not invent its own way of working. If a GitHub Project defines a Status field, githq shows and
edits that Status. If a repository has no project, an issue is simply open or closed with its labels and
assignees, the way GitHub has it. The feel is borrowed from Linear; the data model is GitHub's.

## What the first version does

The first version is the daily loop and nothing around it:

- signing in and choosing which repositories and projects to track;
- a view of your own work across every repository: what's assigned to you, your pull requests with their
  status, and the reviews waiting on you;
- opening any issue or pull request, editing it (assignees, labels, open or closed, a comment, its fields in
  any project it belongs to), and coming straight back;
- creating an issue, quickly, from wherever you are;
- working inside a tracked project, with whatever fields that project defines;
- a command palette, and the keyboard for everything.

Code review stays on github.com for now: githq opens a pull request there with one key. Merging happens here, as
[its own design](../pr-merge/README.md) describes, because the aim is one place to run all your GitHub projects and
repositories day to day, as fast as Linear, repository settings aside; review is meant to follow. Creating pull requests and a notifications inbox
are not in the first version either. When an edit fails, or someone changed the same thing on github.com,
the first version keeps it simple: the failed edit is undone with an error, and otherwise the last write
wins.

The screens follow one chosen design direction: a sidebar that can collapse to a narrow rail, every list
viewable as a list or a board, and any item opening in a side panel, a modal or a full page. In "my work", a
pull request that closes one of your assigned issues sits under that issue rather than next to it, so the
same piece of work never appears twice.
[The brief for the screen designs](ui/README.md).

## What githq keeps in your browser

githq has no server holding your data, so everything fast about it comes from a copy of GitHub data kept in
the browser and refreshed in the background. The question is what goes into that copy, and "everything you
can see" is the wrong answer. A member of an organization with three hundred repositories would wait for
tens of thousands of issues they never look at. And the pull request you opened against someone else's
open-source project would still be missing, because that repository is not yours in any sense GitHub can
list.

So the copy has two parts. The first is **what concerns you**: issues and pull requests anywhere on GitHub
that you wrote, are assigned to, are asked to review, or are mentioned in. It is found through GitHub's
search, stays small, and is what the dashboard shows. The second is **what you track**: repositories and
projects you add yourself, copied in full, so you can browse and triage everything in them, including
other people's issues. At first sign-in githq offers your own repositories as tracked, so for someone with a
handful of their own repositories the two parts mostly overlap.
[Why not simply copy everything](DECISIONS.md#d4).

## How the copy stays fresh

GitHub cannot tell a web page that something changed — that would need a server to receive its webhooks — so
githq asks, regularly, and the trick is making the question cheap. For issues and pull requests GitHub
can answer "has anything changed since I last asked?", and when the answer is no it doesn't count against
your hourly API allowance at all. So githq can ask often.

Projects are the awkward part. Moving an issue from Todo to In Progress in a project is a change to the
project, not to the issue, and the issue feeds never show it. A project can, however, answer the same
"anything changed?" question about itself, for free, and it says yes both when a field moves and when the
issue inside it is edited. So githq asks each tracked project separately and only reads it again when it
says yes, narrowing the re-read to items touched since yesterday. [What we tested on a live
project](DECISIONS.md#d7).

Your own edits never wait for any of this: they show up at once, and githq sends them to GitHub in the
background.

## How githq is built

githq is built the way the author's other app, Cookery, is: a Nuxt app compiled to static files, the
author's own framework nzyme for services and translations, and one Cloudflare Worker that serves the app.
The difference is that Cookery has a database and an API behind that Worker, and githq has neither. Its Worker
does one thing besides serving files: the sign-in exchange described below. So the repository holds just the
app, the Worker and the end-to-end tests. [What was carried over from Cookery and what was dropped](DECISIONS.md#d16).

Inside the app, everything you see is computed from memory. When githq starts, it reads its copy from the
browser's database (IndexedDB) into memory, and from then on every list, count, filter and project view is a
calculation over data that is already there. That is what makes switching views instant. The browser's
database only keeps the copy between visits: changes go into memory first and are written to disk behind the
scenes. [Why not query the database for each view](DECISIONS.md#d17).

The copy holds what lists need for every item: its fields, and a pull request's overall status. The heavier
parts, such as an issue's text and comments or a pull request's full list of checks and reviews, are fetched
when you first open the item and kept after that. For everything in your own work they are fetched ahead of
time. [Exactly what is kept](DECISIONS.md#d18).

githq talks to GitHub in two ways. Asking "has anything changed?" uses GitHub's REST API, because there an
unchanged answer costs nothing. Fetching and changing data uses GraphQL, where one request can bring an issue
together with its fields in every project. The GraphQL queries are written as separate files, and typed code
is generated from them against GitHub's published schema, the same way the author's Healed repository does it.
[The client setup](DECISIONS.md#d19).

If you open githq in several tabs, only one of them refreshes from GitHub and the others receive its changes,
so three tabs don't use up the API allowance three times as fast.

## Signing in

Signing in is the normal "Sign in with GitHub". GitHub insists that the last step — trading the one-time
code for an access token — is done with a secret the app cannot keep in a browser, and its sign-in endpoints
refuse requests coming straight from a web page. So githq runs one tiny service whose only job is that
exchange; it stores nothing and never sees an issue. Once you have a token, the browser talks to GitHub's API
directly. [What we checked, and why a pasted personal token was not good enough](DECISIONS.md#d1).

githq signs in as a GitHub OAuth App rather than a GitHub App. A GitHub App only reaches repositories where
someone has installed it, cannot see the projects you own personally, and can only read — not comment — in
other people's open-source repositories; the dashboard would have holes you discover after signing in. The
price of the OAuth App is a blunt permission: GitHub has no way to ask for "issues and pull requests" in
private repositories without also asking for write access to the code, so the consent screen says "full
access to repositories". And organizations that restrict OAuth apps — the default for new ones — keep their
private repositories hidden until an owner approves githq.
[The comparison in detail](DECISIONS.md#d3).

## Desktop app

githq also comes as a desktop app for macOS, Windows and Linux. It is the same app, but its files ship inside
the installer rather than being loaded from githq.dev, so it starts without a network and runs exactly the code
that was released. Signing in works differently: the app shows a short code, you type it on github.com in your
browser, and GitHub hands the token straight to the app. No service of ours takes part, so the one tiny service
described above isn't needed. The token is kept in your system's keychain, not in browser storage. The app talks
to GitHub and nothing else, and links to github.com open in your browser.

The app updates itself from the project's GitHub Releases. A new version downloads in the background and waits
quietly in the status bar until you choose to restart. [Why a bundled app and not a window onto
githq.dev](DECISIONS.md#d23). [The screens](ui/desktop.md).
