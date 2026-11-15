# githq as an iPhone and Android app

githq is a fast, keyboard-first client for GitHub Issues, pull requests and Projects across all your repositories
([the app's own design](../githq/README.md)). It already runs in a browser and as a desktop app, and it is getting a
layout for a phone ([the phone layout](../mobile/README.md)). This design is the app you install from the App Store,
and later from Google Play, that shows the same phone layout.

## Why

The owner wants to reach all of their GitHub work from a phone as comfortably as from the computer. The phone layout
makes githq usable in a phone's browser, but a browser tab still costs: Safari's own bar takes about 80 px of a list's
height on a 390 × 844 phone, githq is one tab among many rather than an icon on the home screen, and a link to
github.com opens in GitHub's world instead of githq's. An installed app removes that.

It is meant for anyone, not only the owner: published on the App Store, passing its review, and then on Google
Play. iOS comes first, so the owner can live with it on their own iPhone.

## What is different once it exists

You install githq from the App Store, sign in with GitHub once, and from then on tapping the icon shows My work at
once, even on the train with no signal, from the copy githq keeps on the phone. The screens are the phone layout you
know from the browser, with the whole height of the screen for the list.

## The app carries its own code

The app could have been a thin window onto githq.dev, picking up every change the moment the website deploys. It is
not: like the desktop app, it ships the built web app inside the bundle
([why the code ships inside](DECISIONS.md#d1)). A thin window cannot start with no network, the code that holds a
GitHub token with access to your repositories would be whatever the website serves that minute, and Apple turns down
apps that are a website repackaged.

The price is updates. The desktop app updates itself from GitHub Releases, but an iPhone app may not download new
code that changes what it does, so every change reaches the phone only with a new build through Apple's review. The
app on the phone will trail the website by days, and that is accepted.

The app is built with Tauri, the same as the desktop app, as one more target of the same project
([why Tauri](DECISIONS.md#d2)).

## What is still open

- Signing in. The desktop app signs in with GitHub's Device Flow — a code you type on github.com — so the token never
  passes through our server. On a phone that means leaving the app for the browser and typing a code; whether that
  is good enough, and whether Apple's review asks for anything around it, is the next question.
- Where the token is kept on a phone (the iOS Keychain has no official Tauri plugin).
- What the desktop-only parts become: the self-updater and the macOS window controls have no place on a phone.
- How a build reaches TestFlight and the App Store, and how its version relates to the desktop app's.
- Android, after iOS.
