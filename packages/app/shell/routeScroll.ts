import type { RouteLocationNormalized, RouterScrollBehavior } from 'vue-router';
import { START_LOCATION } from 'vue-router';

/**
 * The router's scroll for the screens: the shell never scrolls, its screens do inside containers of their own, which
 * the scroll of the window (vue-router's, Nuxt's) never reaches. A container says what it shows in
 * `data-route-scroll` (`item-main:<id>`): a navigation that changes what it shows opens it at the top, Back and
 * Forward bring back where it was in that entry of the history, and a container still showing the same thing stays
 * where it is — a list under an item opened over it. The window keeps Nuxt's behaviour, for the pages that scroll it
 * (the landing page, `/download`).
 */
export async function scrollToRoute(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    savedPosition: SavedPosition,
) {
    const popped = savedPosition != null;
    if (getPath(to) !== getPath(from) && from !== START_LOCATION && !pageShown) {
        await new Promise<void>(resolve => {
            pageWaiters.push(resolve);
        });
    }

    await new Promise(requestAnimationFrame);
    restoreContainers(popped);
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
/**
 * Where Back or Forward returns the containers not on screen yet when the screen showed (a page whose content is a
 * chunk of its own, as "my work" is, `home/HomePage.vue`): each is put there once it comes, until the next navigation.
 */
const awaited = new Map<string, RouteScrollPosition>();
const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(restoreAwaited);

function restoreContainers(popped: boolean) {
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

    if (awaited.size > 0) {
        observer?.observe(document.body, { childList: true, subtree: true, attributeFilter: [ATTRIBUTE] });
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

    if (awaited.size === 0) {
        stopAwaiting();
    }
}

function stopAwaiting() {
    awaited.clear();
    observer?.disconnect();
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

/** Nuxt's scroll of the window: the top of a new page, or where Back returns, or the fragment. */
function getWindowPosition(to: RouteLocationNormalized, from: RouteLocationNormalized, savedPosition: SavedPosition) {
    if (getPath(to) === getPath(from)) {
        if (to.hash) {
            return { el: to.hash };
        }

        return from.hash ? { left: 0, top: 0 } : false;
    }

    return savedPosition ?? (to.hash ? { el: to.hash } : { left: 0, top: 0 });
}

function getPath(route: RouteLocationNormalized) {
    return route.path.replace(/\/$/, '');
}
