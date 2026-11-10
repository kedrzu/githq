# Links in GitHub-rendered content open in githq

## Status

Accepted (2026-11-10).

## Context

An issue's description, a comment and a review come from GitHub as `bodyHTML`: HTML GitHub rendered and sanitized on its
server. Its links point at github.com, so a click on a reference to another issue took the user out of githq, to a page
githq shows itself. A link must open in githq when githq shows that address, and stay GitHub's when it does not.

Which addresses githq shows is already declared on the routes (`meta.gitHubScreen`), with one more rule: a workflow is
githq's only when it is tracked (`isTrackedOnlyRoute`). The settings pages of a repository or a project are not
githq's.

## Options Considered

### Render the markdown `body` ourselves

- Pros: every link is ours to build as a component.
- Cons: it loses what GitHub does on its server: references (`#123`, across repositories), mentions, emoji, task lists
  and the camo-proxied images of private repositories, which would not show. Sanitizing becomes ours, and a mistake is
  an XSS in an app that holds the user's token.

### Convert `bodyHTML` into VNodes to put a Vue component on each link

- Pros: each link can have its own menu and behaviour.
- Cons: an HTML to VNode converter for nothing that one delegated menu on the container does not already give.

### Keep `bodyHTML`, re-point only the links, handle the events by delegation

GitHub's sanitized HTML stays as it is. `GitHubHtml` changes only `<a>` attributes: `href` becomes the app path and
`data-githq-link` holds the github.com address. `GitHubLinks` handles click and right-click on the container.

- Pros: GitHub's work is kept, nothing of ours is sanitized, one listener serves any number of links.
- Cons: a link keeps GitHub's text and the behaviour is decided in one place, not per link.

## Decision

The third option. The context menu of a githq link has "Open" and "Open on GitHub". Which addresses are githq's comes
from the routes and `isTrackedOnlyRoute`, never from a second list of paths.

## Consequences

- Links keep GitHub's text.
- On the web, a ⌘ or middle click opens githq's address in a new tab.
- The desktop treats every click as Open.
- A long press on touch opens the menu only on a link.
- Inside an opened item, a link to another item opens in the item's arrangement: on its page it goes to the other
  item's page, over a list it opens the other item over the same list. It drops a comment fragment
  (`#issuecomment-…`); this is accepted.
