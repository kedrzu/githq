import type { RouteLocationNormalized, RouterScrollBehavior } from 'vue-router';
import { START_LOCATION } from 'vue-router';

/**
 * The router's scroll for the screens: the shell never scrolls, its screens do inside containers of their own, which
 * the scroll of the window (vue-router's, Nuxt's) never reaches. A container says what it shows in
 * `data-route-scroll` (`item-main:<arrangement>:<id>`): a navigation that changes what it shows opens it at the top, Back and
 * Forward bring back where it was in that entry of the history, and a container still showing the same thing stays
 * where it is — a list under an item opened over it. A fragment (`#issuecomment-1`) names an element inside a container,
 * which the navigation scrolls into sight there once it is on screen, unless Back or Forward return the containers to
 * where they were — and keeps there while what is above it is still coming (`holdAnchor`). The window keeps Nuxt's behaviour, for the pages that scroll it (the landing page, `/download`):
 * its fragment counts only for an element outside every container.
 */
export async function scrollToRoute(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    savedPosition: SavedPosition,
) {
    const popped = savedPosition != null;
    const navigation = navigations;
    if (getPath(to) !== getPath(from) && from !== START_LOCATION && !pageShown) {
        await new Promise<void>(resolve => {
            pageWaiters.push(resolve);
        });
    }

    await new Promise(requestAnimationFrame);
    // A navigation begun in the meantime has a fragment of its own, or none.
    restoreContainers(popped, navigation === navigations ? to.hash : '');
    return getWindowPosition(to, from, savedPosition);
}

/** Where a container is scrolled to. */
interface RouteScrollPosition {
    top: number;
    left: number;
}

/** The containers on screen, by what they show (`data-route-scroll`). */
type RouteScrollSnapshot = ReadonlyMap<string, RouteScrollPosition>;

/** Keeps what the containers show and where, before a navigation changes them (`routeScrollPlugin`). */
export function saveRouteScroll() {
    pageShown = false;
    navigations++;
    stopAwaiting();
    before = readContainers();
    // Not `history.state`: Back and Forward have already moved it to the entry they go to.
    if (currentEntry != null) {
        saved.set(currentEntry, before);
    }
}

/** The screen the navigation went to is shown, so its containers can be scrolled (`routeScrollPlugin`). */
export function onRoutePageShown() {
    pageShown = true;
    const waiters = pageWaiters;
    pageWaiters = [];
    for (const resolve of waiters) {
        resolve();
    }
}

const ATTRIBUTE = 'data-route-scroll';
/** How long the element a fragment names is held with nothing above it moving, nor anything busy, before it is let go. */
const HOLD_SETTLED_MS = 500;
/** How long it is held at most, whatever is still coming. */
const HOLD_MAX_MS = 10_000;
/** What the user does to move the content themselves: the element is let go at once. */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/** Where Back or Forward found the window; vue-router does not export its type. */
type SavedPosition = Parameters<RouterScrollBehavior>[2];

/** What the containers showed and where, by the entry of the history (vue-router's `history.state.position`). */
const saved = new Map<number, RouteScrollSnapshot>();
let before: RouteScrollSnapshot = new Map();
/** The entry of the history on screen, which a navigation leaves. */
let currentEntry: number | null = null;
let pageWaiters: (() => void)[] = [];
/** Whether the screen showed since the navigation began: then there is nothing to wait for. */
let pageShown = false;
/** The navigations begun so far, so that one finishing late knows another has begun. */
let navigations = 0;
/**
 * Where Back or Forward returns the containers not on screen yet when the screen showed (a page whose content is a
 * chunk of its own, as "my work" is, `home/HomePage.vue`): each is put there once it comes, until the next navigation.
 */
const awaited = new Map<string, RouteScrollPosition>();
/**
 * The `id` the fragment of the navigation names, while no element has it yet (a comment still being read): it is
 * scrolled to once it comes, until the next navigation.
 */
let anchor: string | null = null;
/** Lets go of the element a fragment named, held where it was brought (`holdAnchor`); `null` when none is held. */
let releaseHeld: (() => void) | null = null;
const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(restoreAwaited);

function restoreContainers(popped: boolean, hash: string) {
    const entry = getHistoryEntry();
    const returnedTo = popped && entry != null ? saved.get(entry) : undefined;
    currentEntry = entry;
    const containers = getContainers();
    // Only what shows something else than before: a container still showing the same thing stays where it is.
    for (const [id, element] of containers) {
        if (!before.has(id)) {
            scrollTo(element, returnedTo?.get(id));
        }
    }

    for (const [id, position] of returnedTo ?? []) {
        if (!containers.has(id)) {
            awaited.set(id, position);
        }
    }

    // A fragment of a vue-router location is decoded already.
    if (hash && returnedTo === undefined) {
        anchor = hash.slice(1);
        scrollToAnchor();
    }

    if (awaited.size > 0 || anchor != null) {
        observer?.observe(document.body, { childList: true, subtree: true, attributeFilter: [ATTRIBUTE, 'id'] });
    }

    before = new Map();
}

/**
 * Runs as a microtask of the render that added the container, so before what that render scheduled for after it
 * (`nextTick`): a list bringing its selected row into sight finds it where it was.
 */
function restoreAwaited() {
    for (const [id, element] of getContainers()) {
        const position = awaited.get(id);
        if (position) {
            awaited.delete(id);
            scrollTo(element, position);
        }
    }

    scrollToAnchor();
    if (awaited.size === 0 && anchor == null) {
        observer?.disconnect();
    }
}

function stopAwaiting() {
    awaited.clear();
    anchor = null;
    observer?.disconnect();
    releaseHeld?.();
}

/** Not `scrollIntoView`: it scrolls every ancestor that can, the shell's own overflow included. */
function scrollToAnchor() {
    if (anchor == null) {
        return;
    }

    const element = findById(anchor);
    if (!element) {
        return;
    }

    // Outside every container the element is the window's, which Nuxt's scroll has brought into sight.
    const id = anchor;
    anchor = null;
    const container = element.closest<HTMLElement>(`[${ATTRIBUTE}]`);
    if (container) {
        scrollToElement(container, element);
        holdAnchor(id, container);
    }
}

/**
 * Keeps the element a fragment named where it was brought while what is above it still comes in and grows — a pull
 * request's review threads read after its comments, cards drawn once their data is in: each frame it is put back.
 * It is let go once nothing has moved it, and nothing in the container is busy (`aria-busy`, as a thread being read
 * says), for {@link HOLD_SETTLED_MS}; at {@link HOLD_MAX_MS} whatever is still coming; at once when the user scrolls,
 * types or clicks; and at the next navigation.
 */
function holdAnchor(id: string, container: HTMLElement) {
    releaseHeld?.();
    const startedAt = performance.now();
    let settledAt = startedAt;
    let frame = requestAnimationFrame(keep);
    for (const type of USER_SCROLL_EVENTS) {
        window.addEventListener(type, release, { capture: true, passive: true });
    }

    releaseHeld = release;

    function keep(now: number) {
        const element = findById(id);
        if (!element || !container.isConnected || now - startedAt > HOLD_MAX_MS) {
            release();
            return;
        }

        const top = container.scrollTop;
        scrollToElement(container, element);
        if (container.scrollTop !== top || container.querySelector('[aria-busy="true"]')) {
            settledAt = now;
        }

        if (now - settledAt > HOLD_SETTLED_MS) {
            release();
            return;
        }

        frame = requestAnimationFrame(keep);
    }

    function release() {
        cancelAnimationFrame(frame);
        for (const type of USER_SCROLL_EVENTS) {
            window.removeEventListener(type, release, { capture: true });
        }

        if (releaseHeld === release) {
            releaseHeld = null;
        }
    }
}

/**
 * Leaves above the element what CSS asks of a scroll into view: the container's `scroll-padding-top` and the element's
 * own `scroll-margin-top`, as `scrollIntoView` would.
 */
function scrollToElement(container: HTMLElement, element: Element) {
    const room =
        (Number.parseFloat(getComputedStyle(container).scrollPaddingTop) || 0) +
        (Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0);
    container.scrollTop += element.getBoundingClientRect().top - container.getBoundingClientRect().top - room;
}

function scrollTo(element: HTMLElement, position: RouteScrollPosition | undefined) {
    element.scrollTop = position?.top ?? 0;
    element.scrollLeft = position?.left ?? 0;
}

function readContainers() {
    const snapshot = new Map<string, RouteScrollPosition>();
    for (const [id, element] of getContainers()) {
        snapshot.set(id, { top: element.scrollTop, left: element.scrollLeft });
    }

    return snapshot;
}

function getContainers() {
    const elements = new Map<string, HTMLElement>();
    for (const element of document.querySelectorAll<HTMLElement>(`[${ATTRIBUTE}]`)) {
        const id = element.getAttribute(ATTRIBUTE);
        if (id) {
            elements.set(id, element);
        }
    }

    return elements;
}

function getHistoryEntry() {
    const state: unknown = window.history.state;
    if (typeof state === 'object' && state !== null && 'position' in state && typeof state.position === 'number') {
        return state.position;
    }

    return null;
}

/**
 * Nuxt's scroll of the window: the top of a new page, or where Back returns, or the fragment. A fragment naming no
 * element of the window's own leaves it where it is: a container scrolls to it (`scrollToAnchor`).
 */
function getWindowPosition(to: RouteLocationNormalized, from: RouteLocationNormalized, savedPosition: SavedPosition) {
    const fragment = to.hash && isInWindow(to.hash) ? { el: to.hash } : false;
    if (getPath(to) === getPath(from)) {
        if (to.hash) {
            return fragment;
        }

        return from.hash ? { left: 0, top: 0 } : false;
    }

    return savedPosition ?? (to.hash ? fragment : { left: 0, top: 0 });
}

/** Whether the element a fragment names is on screen outside every container (the landing page's own sections). */
function isInWindow(hash: string) {
    const element = findById(hash.slice(1));
    return element != null && element.closest(`[${ATTRIBUTE}]`) == null;
}

/** An `id` can hold what a selector does not, a fragment being any text: escaped. */
function findById(id: string) {
    return document.querySelector(`#${CSS.escape(id)}`);
}

function getPath(route: RouteLocationNormalized) {
    return route.path.replace(/\/$/, '');
}
