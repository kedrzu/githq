# Sign in and install

You can use githq in your browser or as a desktop app. Either way you sign in with your GitHub account, and nothing
else: there is no githq account to create.

## In your browser

1. Go to [githq.dev](https://githq.dev) and choose **Sign in with GitHub**.
2. GitHub shows its consent screen for githq. It asks for access to your repositories, your projects and your
   organisations. [Privacy and permissions](../how-it-works/privacy-and-permissions.md) explains each one.
3. Approve, and GitHub sends you back to githq, signed in.

The first time, githq asks which repositories and projects to track. See
[Choose what to track](./choose-what-to-track.md).

The browser keeps you signed in until you sign out. Every githq tab in that browser shares the same session, so signing
out in one tab signs out the others. githq works in a phone's browser too.

::: info
If you cancel on GitHub's screen, nothing is shared with githq. If GitHub grants less than githq asks for, githq says it
didn't get the access it needs and stays signed out. Sign in again and approve every permission.
:::

## The desktop app

The desktop app is githq in its own window. Its files ship inside the installer, so it starts without a network and
runs exactly the version that was released.

Download it from [githq.dev/download](https://githq.dev/download), or from
[the latest release](https://github.com/kedrzu/githq/releases/latest) on GitHub.

|System|What to download|Notes|
|-|-|-|
|macOS, Apple Silicon|The `.dmg` for Apple Silicon|Macs with an M chip. Signed and notarized by Apple.|
|macOS, Intel|The `.dmg` for Intel|Older Macs. Signed and notarized by Apple.|
|Windows x64|The `-setup.exe` installer|Not signed yet: see below.|
|Linux x64|The `.AppImage` or the `.deb`|The AppImage works on most distributions. The `.deb` asks for your password when an update installs.|

::: warning Windows
Windows builds are not signed yet, so SmartScreen warns about an unrecognised app. To continue, choose **More info**,
then **Run anyway**. With Smart App Control turned on, Windows 11 blocks unsigned apps outright, and the only way past it
is turning Smart App Control off.
:::

### Signing in to the desktop app

The desktop app signs in with a short code instead of a redirect:

1. Choose **Sign in with GitHub**. githq shows a code.
2. Choose **Copy code and open GitHub**. Your browser opens `github.com/login/device`.
3. Paste the code there and approve githq. The app's window carries on by itself.

The code works for a few minutes. If it expires, choose **Get a new code**. GitHub hands the token straight to the app,
and the app keeps it in your system's credential store: Keychain on macOS, Credential Manager on Windows, the Secret
Service (GNOME Keyring, KWallet) on Linux.

::: info
If githq can't reach your system's credential store, for example on a Linux desktop without a Secret Service, the
sign-in screen says so. You can still use githq, but you sign in again every time you open it.
:::

### Updates

The app updates itself from githq's GitHub Releases. A new version downloads in the background, and githq offers to
restart when it is ready. Until you restart, you stay on the version you have.

**Settings → Updates** shows the version you are on and has **Check for updates**. On macOS and Linux it also has the
**Update stream**, for this device only:

- **Stable**: official versions, released now and then.
- **Development**: a build of every push to `main`, minutes after it lands. You get what is new first, and a build may
  have bugs. The [Development release](https://github.com/kedrzu/githq/releases/tag/development) holds the newest one.

An app installed from a Stable version follows Stable until you change it; a Development build follows Development.
Windows follows Stable only.

### Uninstalling

Sign out first: that removes the token from your credential store and deletes the copy of your GitHub data on this
computer. Then:

- **macOS**: move githq from Applications to the Bin.
- **Windows**: Settings → Apps → Installed apps → githq → Uninstall.
- **Linux**: delete the AppImage, or remove the package (`sudo apt remove githq`).

If you uninstall without signing out, delete the `dev.githq.desktop` entry from your credential store yourself. The
copy stays in the app's data folder until you delete it.

## Signing out

Sign out from the menu on your account at the bottom of the sidebar, from **Settings → Account → Sign out and clear**,
or by typing "sign out" in the command menu. Signing out:

- deletes the copy of your GitHub data kept on this device;
- asks GitHub to revoke githq's token, so it can't be used again;
- changes nothing on GitHub.

Signing in again downloads everything anew.

## When an organisation hides its repositories

Some organisations let only the apps they have approved see their private data. Until an owner approves githq, GitHub
hides that organisation's private repositories and projects from githq; its public ones still show. githq marks such an
organisation, and **Settings → Account** lists your organisations, with **Request approval** next to each one that
hides its data. See [Privacy and permissions](../how-it-works/privacy-and-permissions.md#organisations-that-restrict-apps).
