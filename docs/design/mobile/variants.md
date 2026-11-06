# Variants to draw

The owner decides the mobile navigation by seeing it, not by arguing it (2026-11-06). So every idea about the
shape of navigation that comes up is written here as something for the design agent to draw, in variants side by
side, instead of being settled in conversation. An entry leaves this list when the owner has picked from the
drawings; the pick becomes a decision.

What the owner did set as a direction, not a variant: classic mobile navigation, comfortable to use, that makes
good use of the top-left and top-right corners ([D1](DECISIONS.md#d1)), and no menu opened by a swipe from the
screen's edge ([D2](DECISIONS.md#d2)).

These are starting points, not the boundary. The design agent is expected to be creative and to propose shapes
nobody listed here, above all for the command menu button.

## The bottom bar

A bar of tabs along the bottom of the screen. The owner likes it as a way to move between the important parts of
a place — a repository's issues, pull requests and so on — but it gets in the way when something else needs the
bottom of the screen, above all an input such as the comment box, and it costs height.

- **What it holds.**
  - (a) Changes with the screen: a repository's sections in a repository, My work's groups in My work, a
    project's views in a project.
  - (b) Fixed and global: My work, repositories, projects; a repository's sections become tabs at the top of its
    screen.
- **Where it shows.** Only on list screens (a repository's section, My work, a project view), and not on an
  item's screen, where the comment box takes the bottom — against everywhere.
- **Whether it carries the command menu button** in its middle, if the button is not in a top corner.

## The hamburger menu and the two top corners

- **One nested menu on the left.** Opens from the top-left corner and drills down: the first level is today's
  sidebar (My work and its groups, projects, repositories, settings); choosing a repository goes one level down
  to its sections (issues, pull requests, actions), with a way back up. Open from inside a repository, it starts
  at that repository's level.
- **Left for places, right for this screen.** The left menu is the wide one — where you can go. The top-right
  corner is about the screen you are on. Candidates for the right corner:
  - the command menu button — the command menu already starts from the screen's subject (the opened item) and
    its actions, so it is the screen's contextual menu already;
  - a second, right-hand menu with the screen's own options (filters, grouping, list or board).
- **The top-left corner on a screen you went into** (an item opened from a list): a back arrow in place of the
  hamburger, the hamburger next to it, or the hamburger only.

## The command menu button

The command menu is opened by ⌘K on a computer; a phone needs a button for it. The top-right corner is the natural
place, but the owner wants the design agent to look for something smarter (2026-11-06). Known options: top-right
corner, middle of the bottom bar, a floating button.

Two couplings any drawing has to respect:

- The command menu already starts from the screen's subject (the opened item) and its actions, then the
  repository's and the app's. A separate contextual menu with the item's actions would hold the same things
  twice.
- A button that lives on the bottom bar disappears wherever the bar does. If the bar shows on list screens only,
  the button is gone from an item's screen — where its actions on the item are needed most.
