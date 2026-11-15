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

## Signing in

Signing in is the first screen a new user meets, so it has to be one tap. You tap Sign in with GitHub, iOS's own
sign-in sheet slides up with GitHub's consent page — already signed in if you use GitHub in Safari — you tap
Authorize, and you are back in githq. It is the website's sign-in, through githq's small token service, not the
desktop app's code that you copy to github.com ([why not the desktop's way](DECISIONS.md#d3)). The token service
already sees every token when it renews it every eight hours, so keeping it out of the first sign-in would protect
nothing.

For the same reason the desktop app gives up its code-copying sign-in and does the same: the browser opens on
GitHub's consent page, you tap Authorize, and the browser hands you back to githq. One way to sign in, in every app
([why the desktop follows](DECISIONS.md#d4)).

## What is still open

- The account Apple's reviewers sign in with: App Review needs a working demo login, here a GitHub account with
  something in it.
- What the desktop-only parts become: the self-updater and the macOS window controls have no place on a phone.
- How a build reaches TestFlight and the App Store, and how its version relates to the desktop app's.
- Android, after iOS.
