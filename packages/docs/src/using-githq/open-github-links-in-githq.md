# Open GitHub links in githq

On a Mac, a link to a GitHub pull request or issue can open in the githq desktop app instead of your browser, wherever
you click it: in Slack, in an email, in a terminal, in another app. Every other link still opens in your browser, and
**Open on GitHub** in githq still takes you to github.com.

macOS lets one app at a time be the default browser, and it hands every link to that app. A link router is an app that
takes that place and passes each link on to the app you choose. This page sets one up with
[Finicky](https://github.com/johnste/finicky), a free, open-source link router for macOS.

## What you need

- **macOS.** Finicky runs only on macOS. Windows and Linux have no equivalent this page covers.
- **The githq desktop app, newer than 0.3.0.** Until the next Stable version is out, that means a build from the
  Development stream (see [Updates](../getting-started/sign-in-and-install.md#updates)). In 0.3.0 and older, **Open on
  GitHub** comes back to githq instead of opening github.com.
- **Finicky 4.** The configuration below uses the format of Finicky 4. It doesn't work in Finicky 3.

## Set it up

1. Install Finicky with [Homebrew](https://brew.sh):

   ```sh
   brew install --cask finicky
   ```

   Or download it from [Finicky's releases](https://github.com/johnste/finicky/releases) and move it to Applications.

2. Open Finicky and let it become the default browser. You can check or change this later in **System Settings →
   Desktop & Dock → Default web browser**.

3. Create the file `~/.finicky.js` in your home folder with this content, and change `"Safari"` to the browser that
   should open every other link, such as `"Google Chrome"`, `"Arc"` or `"Firefox"`:

   ```js
   // @ts-check
   // Finicky: opens GitHub pull request and issue links in githq (githq://), everything else in your browser.

   const GITHQ = "dev.githq.desktop";

   /** `/<owner>/<repo>/(pull|issues)/<number>`, with an optional tail such as `/files`. */
   const GITHUB_ITEM = /^\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)(?:\/.*)?$/;

   /** @param {URL} url */
   const isGithubItem = (url) =>
       (url.host === "github.com" || url.host === "www.github.com") && GITHUB_ITEM.test(url.pathname);

   /** @type {import("/Applications/Finicky.app/Contents/Resources/finicky.d.ts").FinickyConfig} */
   export default {
       defaultBrowser: "Safari",
       rewrite: [
           {
               // githq's own "Open on GitHub" must still reach github.com, or the link would bounce back into githq.
               match: (url, { opener }) => isGithubItem(url) && opener?.bundleId !== GITHQ,
               url: (url) => {
                   const [, owner, repo, kind, number] = GITHUB_ITEM.exec(url.pathname) ?? [];
                   return `githq://${owner}/${repo}/${kind}/${number}`;
               },
           },
       ],
       handlers: [
           {
               match: (url) => url.protocol === "githq:",
               browser: GITHQ,
           },
       ],
   };
   ```

4. Try it from Terminal:

   ```sh
   open https://github.com/kedrzu/githq/pull/1
   ```

   githq comes to the front with that pull request open. A link to anything else, such as
   `open https://github.com/kedrzu/githq`, opens in your browser.

Finicky also reads its configuration from `~/.config/finicky.js` or `~/.config/finicky/finicky.js`, and from a `.ts`
file in any of these places, if you keep your dotfiles there.

## How it works

The configuration has three parts:

- **`defaultBrowser`** gets every link that no rule picks up. It takes the app's name as it shows in Applications.
- **`rewrite`** turns a link to a pull request or an issue on github.com into a githq link:
  `https://github.com/acme/portal/pull/1187` becomes `githq://acme/portal/pull/1187`. githq's addresses are GitHub's, so
  the same path opens the same pull request in githq.
- **`handlers`** send every `githq://` link to the githq app, named by its bundle identifier, `dev.githq.desktop`.

The rewrite skips links that githq itself opened (`opener?.bundleId !== GITHQ`). **Open on GitHub** and every other
GitHub link in githq go through Finicky too, since it is your default browser, and without this check they would come
straight back to githq.

The rewrite keeps the owner, the repository, the kind and the number, and drops the rest of the address. A link to a
pull request's files, `…/pull/1187/files`, or to a comment, `…/issues/42#issuecomment-…`, opens the pull request or
the issue itself.

## If you use githq in the browser

Without the desktop app, send the links to githq's website instead. Leave out `handlers`, and make the rewrite return
the same path on githq.dev:

```js
return `https://githq.dev/${owner}/${repo}/${kind}/${number}`;
```

The link then opens githq in a new tab of your default browser. A link you click inside the browser doesn't go through
Finicky, so **Open on GitHub** reaches github.com anyway.

## When something goes wrong

- **The link opens in the browser, not in githq.** Finicky isn't the default browser, or its configuration has an error.
  Open Finicky from Applications: its window shows its log, with any error in the configuration.
- **Open on GitHub comes back to githq.** Your githq is 0.3.0 or older. Update it, or switch to the Development stream
  until the next Stable version (**Settings → Updates**).
