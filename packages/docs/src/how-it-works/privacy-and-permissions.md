# Privacy and permissions

githq talks to GitHub from your device, with your own token. It has no server that stores your work, and it collects
no analytics or telemetry.

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

It has no database and stores nothing. It handles the code and the token in memory and logs neither: its logs carry only
statuses and error codes. Cloudflare's own request logs still record that a request happened. It never sees your issues, pull
requests or projects.

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
a private `githq-settings` repository in your own GitHub account, so another computer can load them. Nothing goes to
githq. See [Save what you track to GitHub](../getting-started/choose-what-to-track.md#save-what-you-track-to-github).

githq has no analytics, no telemetry and no tracking scripts.

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
