# Privacy and permissions

githq talks to GitHub from your device, with your own token. It has no server that stores your work, and it never
sees your issues, pull requests, code or who you are. It does count sign-ins, token renewals, sign-outs, downloads and
visits to its public pages anonymously, and you can turn that off: see [Usage statistics](#usage-statistics).

## What githq asks GitHub for

githq is a GitHub [OAuth App](https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/authorizing-oauth-apps). When
you sign in, it asks for three [scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
and needs all of them:

|Scope|What githq uses it for|
|-|-|
|`repo`|Read and edit issues and pull requests, and read the code they change, in private repositories too.|
|`project`|Read and edit your GitHub Projects and their fields.|
|`read:org`|List your organisations, to filter by owner and to tell which ones hide their private data from githq.|

GitHub has no narrower scope for issues and pull requests in private repositories, so its consent screen reads as full
access to your repositories. githq only touches issues, pull requests and the code they change, projects, and, if you
turn on saving your settings, its own `githq-settings` repository.

If you grant less than all three, githq says it didn't get the access it needs and doesn't sign you in.

::: info Why not a GitHub App
A GitHub App only reaches repositories where someone has installed it, can't see projects you own personally, and can't
comment in other people's open-source repositories. My work would have holes you'd only find after signing in. An
OAuth App sees what you see on GitHub.
:::

## Where your token is kept

- **In the browser**, the token is kept in the browser's `localStorage` for githq.dev. It is shared by every githq tab
  in that browser.
- **In the desktop app**, the token is kept in your system's credential store: Keychain on macOS, Credential Manager on
  Windows, the Secret Service on Linux. If the app can't reach it, the token stays in memory and you sign in again at
  the next launch.

Once you are signed in, the token goes only to GitHub, apart from its renewal and the moment you sign out (see below). githq.dev also sets a cookie,
`githq_signed_in=1`, while you are signed in, so that githq.dev opens the app rather than the landing page. It holds no
token and nothing that identifies you.

## The one server: sign-in and tokens

GitHub's sign-in in a browser needs a secret that a web page can't keep. So githq runs one small, stateless service on
githq.dev, next to the app's files, that does only this:

- sends you to GitHub's consent screen when you choose **Sign in with GitHub**;
- trades the one-time code GitHub sends back for your token, and hands it to your browser;
- renews your token: GitHub's tokens expire after 8 hours, so githq trades the refresh token GitHub issued with it for
  new ones;
- revokes your token at GitHub when you sign out;
- opens GitHub's page where you request an organisation's approval of githq.

It has no database and keeps no record of you. It handles the code and the token in memory and logs neither: its logs
carry only statuses and error codes. Cloudflare's own request logs still record that a request happened. It never sees
your issues, pull requests or projects. When a sign-in, a renewal of your token or a sign-out goes through it, it adds
one to an anonymous count, unless you turned [usage statistics](#usage-statistics) off.

The desktop app signs in with a device code instead, directly with GitHub, so this service takes no part in its sign-in.
It is asked only to renew the token every 8 hours and to revoke it when you sign out of the desktop app.

## Where your data goes

Your issues, pull requests, projects and code travel between your device and GitHub only:

- `api.github.com`, for reading your data and for every change you make, with your token;
- GitHub's image hosts, such as `avatars.githubusercontent.com`, for avatars and images in issues;
- in the desktop app, `github.com` for signing in and for checking for and downloading updates from githq's
  [GitHub Releases](https://github.com/kedrzu/githq/releases).

What GitHub does with these requests is covered by the
[GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## What stays on your device

- The copy of your GitHub data that screens open from, described in
  [GitHub is the source of truth](./github-is-the-source-of-truth.md).
- The contents of the files of pull requests you reviewed, until you sign out.
- What you track, and how your views look: layout, sort, filter.

If you turn on **Save my settings to my GitHub account**, what you track and a few display choices are also written to
a private `githq-settings` repository in your own GitHub account, so another computer can load them. None of it goes
to githq. See [Save what you track to GitHub](../getting-started/choose-what-to-track.md#save-what-you-track-to-github).

## Usage statistics

githq never collects your GitHub login, your IP address, your browser or device, your country, your token, or anything
about your repositories, issues, pull requests or projects. It sets no cookie for statistics and keeps no profile of
anyone.

What it does count, so we know how many people use githq: the sign-in service adds one to a count in
[Cloudflare Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) for each of these,
and Cloudflare keeps the counts for three months.

|Event|When|What it holds|
|-|-|-|
|`token_created`|You sign in on githq.dev.|The event, and that it came from the web app.|
|`token_refreshed`|githq renews your token, which GitHub makes expire after 8 hours, on githq.dev or in the desktop app.|The event, and whether it came from the web or the desktop app.|
|`token_revoked`|You sign out, and githq asks GitHub to revoke your token.|The event, and whether it came from the web or the desktop app.|
|`installer_download`|Someone downloads the desktop app from githq.dev.|The event, and which installer, such as `macos-silicon` or `windows`.|

A count can't be traced back to a person: two sign-ins by you and one each by two other people look the same. Signing
in to the desktop app goes straight to GitHub, so it is never counted.

On githq.dev's landing page and on these docs, githq also loads
[Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/), which counts page visits without cookies
and stores nothing in your browser. It is never loaded in the app, whose addresses name your repositories, nor in the
desktop app.

### Turning it off

Open **Settings → Privacy** and turn off **Share usage statistics**; it is on until you do. Then githq stops counting
your sign-ins, token renewals and sign-outs, and stops loading Web Analytics on that browser.

The choice is kept with your other settings, so with **Save my settings to my GitHub account** on, it follows you to
your other computers. Your browser also remembers it on githq.dev, so the landing page, these docs and your next sign-in
honour it after you sign out. If you never chose but this browser has it off, githq takes the browser's choice.

One limit: on a new computer or browser, githq can't know your choice before it has loaded your saved settings, so the
first sign-in there is counted. Downloads of the desktop app are always counted, since nobody is signed in to say no;
they carry nothing more than Cloudflare's own request logs would.

## Organisations that restrict apps

An organisation can let only the OAuth Apps it has approved see its private data. This is
[GitHub's OAuth App access restriction](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions),
on by default for new organisations. Until an owner approves githq:

- the organisation's private repositories and projects are hidden from githq;
- githq can read its public repositories, but can't change anything there.

Nothing is broken, and nothing is missing on GitHub. To fix it, open **Settings → Account**: under **Organisations**,
each one that hides its data has **Request approval**, which opens GitHub's page for it. Once an owner approves githq,
its repositories appear with the next refresh.

## Signing out and revoking access

Signing out deletes the copy kept on your device, including the contents of reviewed files, and removes the token: from
the browser's storage, or from the credential store in the desktop app. githq also asks GitHub to revoke the token, so
it can't be used again. Nothing changes on GitHub.

You can also revoke githq's access yourself at any time, on GitHub under **Settings → Applications → Authorized OAuth
Apps** ([GitHub's guide](https://docs.github.com/en/apps/oauth-apps/using-oauth-apps/reviewing-your-authorized-oauth-apps)).
The next time githq asks GitHub for anything, GitHub refuses the token, and githq signs you out and says so.
