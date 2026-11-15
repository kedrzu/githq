import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { LucideIcon } from 'lucide-vue-next';
import { Github, Maximize2, Minimize2 } from 'lucide-vue-next';
import { computed, onScopeDispose, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';
import { useRoute, useRouter } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import { matchesCommandKey } from '@/commands/matchesCommandKey.js';
import { PhoneLayout } from '@/shell/PhoneLayout.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenKey } from '@/utils/isScreenKey.js';

import type { GetExpandedLocationParams, OpenedItemKindRoutes } from './defineOpenedItemKind.js';
import { ItemNavigation } from './ItemNavigation.js';
import { getHistoryBack } from './itemRoutes.js';
import type { ItemArrangement } from './itemRoutes.js';
import * as l from './useItemArrangement.loc.js';
import { useItemWalk } from './useItemWalk.js';
import type { ItemWalkViewModel } from './useItemWalk.js';

/** The keys of an opened item's moves, every kind's; the steps' are {@link ItemStepKeys}. */
export const ITEM_ARRANGEMENT_KEYS = {
    openOnGitHub: 'O',
    arrange: 'Shift+Enter',
    close: 'Escape',
} as const;

/** The keys stepping through the list an item was opened from, in the app's key notation (`J`, `Shift+J`). */
export interface ItemStepKeys {
    readonly previous: string;
    readonly next: string;
}

/** Options of {@link useItemKeys}. */
export interface UseItemKeysOptions {
    arrangement: MaybeRefOrGetter<ItemArrangement>;
    /** Left out, `K`/`J`. */
    stepKeys?: ItemStepKeys;
    /**
     * Escape for the view's own layers, before it closes the item (an open picker or menu takes it already): `true`
     * when it took the key.
     */
    onEscape?: () => boolean;
    close(): void;
    arrange(arrangement: ItemArrangement): void;
    openOnGitHub(): void;
    previous(): void;
    next(): void;
}

/** The arrangement the header's button and `⇧Enter` move the item to. */
export interface OtherArrangement {
    readonly arrangement: ItemArrangement;
    readonly title: string;
    readonly icon: LucideIcon;
}

/** The commands of an opened item's moves, for the view to list among its own in its order. */
export interface ItemKeyCommands {
    readonly next: Command;
    readonly previous: Command;
    readonly close: Command;
    readonly openOnGitHub: Command;
    /** `null` where there is no other arrangement to offer. */
    readonly arrange: Command | null;
}

/** What {@link useItemKeys} gives the view. */
export interface ItemKeysViewModel {
    /** The other arrangement; `null` on a page where the window has no room for the panel. */
    readonly otherArrangement: OtherArrangement | null;
    readonly stepKeys: ItemStepKeys;
    readonly commands: ItemKeyCommands;
}

const DEFAULT_STEP_KEYS: ItemStepKeys = { previous: 'K', next: 'J' };

/** Options of {@link useItemArrangement}. */
export interface UseItemArrangementOptions<TReference> {
    /** The routes of the opened item's kind. */
    routes: OpenedItemKindRoutes<TReference>;
    reference: MaybeRefOrGetter<TReference>;
    arrangement: MaybeRefOrGetter<ItemArrangement>;
    /** The item's page, when it is not the kind's own address of it (a pull request's `/pull/15`). */
    pagePath?: MaybeRefOrGetter<string | undefined>;
    /** The item's id among the list's steps (`ItemNavigation.list`); `null` until found. */
    id: MaybeRefOrGetter<string | null>;
    /** Where closing goes when no list is behind the item (mobile D20): its repository's section of its kind. */
    parent: MaybeRefOrGetter<ItemParent>;
    /** Where a step of the list opens, by its id: `K`/`J` and {@link ItemArrangementViewModel.openInPlace}. */
    resolveStep(id: string): GetExpandedLocationParams<TReference> | null;
    /** The item may not move to its page yet when the panel stops fitting (an open edit the move would lose). */
    holdsPanel?: () => boolean;
    /** Leaving the item asks first: unsaved changes. */
    guard?: ItemLeaveGuard;
}

/** Where an item opened with no list behind it goes up to, and what back on a phone calls it. */
export interface ItemParent {
    readonly path: string;
    /** What back on a phone says it returns to (mobile D20): the repository's name. */
    readonly title: string;
}

/** What stops the user leaving an opened item. */
export interface ItemLeaveGuard {
    /**
     * Before the item is left: `true` when it asks first, and the item stays; `go` then leaves as the user was going.
     */
    askToLeave(go: () => void): boolean;
    /** The item stayed where a navigation would have left it. */
    onStay?(): void;
}

/** How an opened item moves between its arrangements and through the list it was opened from. */
export interface ItemArrangementViewModel<TReference> {
    /** The walk through the list the item was opened from. */
    readonly walk: ItemWalkViewModel;
    /** What back on a phone says it returns to (mobile D20): the list's name, or with no list the parent's. */
    readonly backTitle: string;
    /** "Open full screen" and "Back to the panel". */
    arrange(arrangement: ItemArrangement): void;
    /** Escape, the close button, and back on a phone. */
    close(): void;
    /** `K`/`J`: a step through the list, in the item's place. */
    step(delta: 1 | -1): void;
    /** Opens a step of the list in the item's place, replacing the address. */
    openInPlace(id: string): void;
    /** Opens another item of the kind in this arrangement, added to the history; `hash` names a part of it. */
    open(reference: TReference, hash?: string): void;
    /** Goes somewhere else, added to the history (a review); an unsaved edit stopping it goes on the same way. */
    navigate(to: RouteLocationRaw): void;
}

/**
 * How an opened item of any kind moves (D9), the same for every kind: full screen adds the page to the history,
 * marked as expanded from the panel (`getExpandedLocation`, kept through a reload); on a page so marked "Back to the
 * panel", `⇧Enter` and Escape go Back to the panel, scrolled where it was — showing the item on screen in place of the
 * one expanded when `K`/`J` moved on — while on a page opened any other way "Back to the panel" replaces it with the
 * panel over the last list and Escape closes it, as Escape does wherever the panel doesn't fit; in the panel, a window
 * narrowed until the panel no longer fits beside the screen (`ItemNavigation.panelFits`) moves it to its page — once
 * {@link UseItemArrangementOptions.holdsPanel} lets it — and widening never brings it back; closing goes back to the
 * list, or with no list behind the item (opened by its address or a link) up to its parent (mobile D20, the computer
 * too). On a phone the page's back goes there too, by the history's Back when the entry behind is that list, so it
 * comes back scrolled and selected. Moving to another item of the list replaces the address; opening another item or
 * closing adds one, so Back returns. With a {@link ItemLeaveGuard}, leaving the item may ask first, and its Discard goes on where the user was
 * going.
 */
export function useItemArrangement<TReference>(
    options: UseItemArrangementOptions<TReference>,
): ItemArrangementViewModel<TReference> {
    const navigation = useService(ItemNavigation);
    const phone = useService(PhoneLayout);
    const route = useRoute();
    const router = useRouter();
    const { routes, guard } = options;

    const reference = makeRef(options.reference);
    const arrangement = makeRef(options.arrangement);
    const pagePath = makeRef(options.pagePath);
    const id = makeRef(options.id);
    const parent = makeRef(options.parent);
    // How the item's own navigation on its way goes — adding to the history or replacing the address (`moveTo`).
    let movingBy: HistoryMove | null = null;
    // In the panel the list's cursor moves with `K`/`J`, and what they reach is the cursor's neighbours. The page has no list,
    // the last one's cursor stale: it walks the steps.
    const walk = useItemWalk({
        kind: routes.kind,
        id,
        followsCursor: () => arrangement.value === 'panel',
    });
    /**
     * The list the item was opened from: the last one shown, while the item is in it. An item opened from a link after a
     * list was shown, or one not found (yet, or at all), has no list behind it (mobile D20) — an item opened from a list
     * is always found, as the list holds it.
     */
    const ownList = computed(() => {
        const { list } = navigation;
        const current = id.value;
        return list?.kind === routes.kind &&
            current !== null &&
            (list.steps.includes(current) || list.stepOf.has(current))
            ? list
            : null;
    });
    const backTitle = computed(() => ownList.value?.title ?? parent.value.title);

    // In the panel, a window narrowed until the panel no longer fits beside the screen moves the item to its page, in place
    // of the address — but not while `holdsPanel` says so: it moves once that lets go. Widening never brings it back. The
    // guard below lets the move through: the item stays.
    watch(
        () => arrangement.value === 'panel' && !navigation.panelFits && !(options.holdsPanel?.() ?? false),
        move => {
            if (move) {
                moveTo(locate(reference.value, 'page', pagePath.value), 'replace');
            }
        },
        { immediate: true },
    );

    if (guard) {
        guardLeaving(guard);
    }

    return reactive<ItemArrangementViewModel<TReference>>({
        walk,
        backTitle,
        arrange,
        close,
        step,
        openInPlace,
        open,
        navigate,
    });

    /**
     * Leaving the item — `K`/`J`, another item opened, closing it, anywhere else — while the guard asks first: the item
     * stays, and the guard's go-ahead goes on where the user was going.
     */
    function guardLeaving(leaveGuard: ItemLeaveGuard) {
        // Back and Forward move through the history before the guard below runs, and the router moves back when it stops
        // them: how far they went, for Discard to go there again.
        let poppedBy: number | null = null;
        const removeHistoryListener = router.options.history.listen((_to, _from, info) => {
            poppedBy = info.delta;
        });

        const removeLeaveGuard = router.beforeEach(to => {
            const popped = poppedBy;
            const by = movingBy;
            poppedBy = null;
            movingBy = null;
            const next = routes.getOpened(to);
            const staying =
                next !== null &&
                routes.formatKey(next.reference).toLowerCase() === routes.formatKey(reference.value).toLowerCase();
            if (staying || !leaveGuard.askToLeave(() => goAgain({ to, popped, by }))) {
                return true;
            }

            // The list's cursor moved ahead of the step (its own `j`/`k`): it comes back.
            leaveGuard.onStay?.();
            return false;
        });

        onScopeDispose(() => {
            removeLeaveGuard();
            removeHistoryListener();
        });
    }

    /**
     * The navigation the guard stopped, once it lets it go, made again as it was: Back or Forward as far; the item's own
     * as it went (`moveTo`); from elsewhere, another item over the same list — the list's `J`/`K` — replacing the
     * address, the rest adding to the history.
     */
    function goAgain({ to, popped, by }: GoAgainOptions) {
        if (popped !== null && popped !== 0) {
            router.go(popped);
            return;
        }

        const next = routes.getOpened(to);
        const listStep = next !== null && !next.onPage && arrangement.value !== 'page' && to.path === route.path;
        const how = by ?? (listStep ? 'replace' : 'push');
        void (how === 'replace' ? router.replace(to.fullPath) : router.push(to.fullPath));
    }

    function step(delta: 1 | -1) {
        const side = delta === 1 ? 'next' : 'previous';
        // The cursor's neighbour can be the opened item's own row, which a button has nothing to open on: on past it.
        const target = walk.neighbours[side] === id.value ? walk.stepNeighbours[side] : walk.neighbours[side];
        if (target !== null) {
            openInPlace(target);
        }
    }

    function openInPlace(stepId: string) {
        const resolved = options.resolveStep(stepId);
        if (resolved) {
            moveTo(locate(resolved.reference, arrangement.value, resolved.path), 'replace');
        }
    }

    /**
     * Full screen adds the page to the history, marked as expanded from the panel, so Back returns to the panel where it
     * was. Back to the panel goes back to it when the page carries the mark, else replaces the page with the panel over
     * the last list.
     */
    function arrange(to: ItemArrangement) {
        if (to === arrangement.value) {
            return;
        }

        if (to === 'page') {
            moveTo(routes.getExpandedLocation({ reference: reference.value, path: pagePath.value }), 'push');
        } else if (expandedFrom() === null) {
            moveTo(locate(reference.value, 'panel'), 'replace');
        } else {
            backToPanel();
        }
    }

    /**
     * Back to the panel the page was expanded from, scrolled where it was; when the page has since moved on to another
     * item (`K`/`J`, a stack's row), the panel then shows that one in place of the one expanded.
     */
    function backToPanel() {
        const shown = routes.formatKey(reference.value).toLowerCase();
        if (expandedFrom()?.toLowerCase() !== shown) {
            const current = reference.value;
            // The page is gone once Back lands, and this instance with it: the router finishes the step.
            const removeAfterEach = router.afterEach((to, _from, failure) => {
                removeAfterEach();
                const next = routes.getOpened(to);
                if (!failure && next && !next.onPage) {
                    void router.replace({ path: to.path, query: routes.getQuery(to.query, current) });
                }
            });
        }

        router.back();
    }

    /** What the page on screen was expanded from the panel for (`getExpandedLocation`); `null` off a page or unmarked. */
    function expandedFrom() {
        return arrangement.value === 'page' ? routes.getExpandedFrom(router.options.history.state) : null;
    }

    function open(other: TReference, hash = '') {
        const to = locate(other, arrangement.value);
        if (!hash) {
            moveTo(to, 'push');
            return;
        }

        moveTo(typeof to === 'string' ? `${to}${hash}` : { ...to, hash }, 'push');
    }

    function navigate(to: RouteLocationRaw) {
        moveTo(to, 'push');
    }

    /** Navigates as `by` says, remembered for the guard: a stop let go goes on the same way (`goAgain`). */
    function moveTo(to: RouteLocationRaw, by: HistoryMove) {
        movingBy = by;
        void (by === 'replace' ? router.replace(to) : router.push(to)).finally(() => {
            movingBy = null;
        });
    }

    /**
     * Escape and the close button: a page expanded from the panel goes back to it while the panel fits; else to the list,
     * or with none up to the parent. On a phone the page's back.
     */
    function close() {
        if (phone.active && arrangement.value === 'page') {
            goBack();
            return;
        }

        if (expandedFrom() !== null && navigation.panelFits) {
            backToPanel();
            return;
        }

        moveTo(
            arrangement.value === 'page' ? listPath() : { path: route.path, query: routes.getQuery(route.query, null) },
            'push',
        );
    }

    /**
     * Back on a phone (mobile D20): to the list the item was opened from — by the history's Back when the entry behind is
     * that list, so it comes back scrolled and selected as it was, else to its address; with no list, up to the parent.
     */
    function goBack() {
        const list = ownList.value;
        const behind = getHistoryBack(router.options.history.state);
        if (list && behind !== null && router.resolve(behind).fullPath === router.resolve(list.path).fullPath) {
            router.back();
            return;
        }

        moveTo(listPath(), 'push');
    }

    /** Where `target` opens in `to`: its page (`path`, else the kind's address of it), or the list with it opened over it. */
    function locate(target: TReference, to: ItemArrangement, path?: string): RouteLocationRaw {
        if (to === 'page') {
            return path ?? routes.getPagePath(target);
        }

        // From the item's page, back over the list shown last — My work before any (closing and back go to the item's own
        // list or its parent instead, mobile D20).
        const list = arrangement.value === 'page' ? router.resolve(navigation.list?.path ?? '/') : route;
        return { path: list.path, query: routes.getQuery(list.query, target) };
    }

    /** The list the item was opened from; with none, its parent (mobile D20). */
    function listPath() {
        return ownList.value?.path ?? parent.value.path;
    }
}

/** The navigation the guard stopped, for `goAgain`. */
interface GoAgainOptions {
    readonly to: RouteLocationNormalized;
    /** How far Back or Forward went; `null` for a navigation of the app's own. */
    readonly popped: number | null;
    /** How the item's own navigation went; `null` for one from elsewhere. */
    readonly by: HistoryMove | null;
}

type HistoryMove = 'push' | 'replace';

/**
 * The keys of an opened item, every kind's: Escape closes it — after an open picker or menu (`isLayerOpen`), the view's
 * own layers (`onEscape`), and a focused field, which gives the key up first — and the step keys step through the list
 * it was opened from (in a panel the list's own `j`/`k`, run first, move its selection instead, which the opened item
 * follows). The commands — listed in the help sheet, `⇧Enter` and `O` run by their keys — are for the view to
 * register among its own; `⇧Enter` is not offered on a page where the window has no room for the panel.
 */
export function useItemKeys(options: UseItemKeysOptions): ItemKeysViewModel {
    const t = useTranslate();
    const navigation = useService(ItemNavigation);
    const arrangement = makeRef(options.arrangement);
    const stepKeys = options.stepKeys ?? DEFAULT_STEP_KEYS;

    const otherArrangement = computed((): OtherArrangement | null => {
        if (arrangement.value === 'panel') {
            return { arrangement: 'page', title: t(l.openFullScreen), icon: Maximize2 };
        }

        return navigation.panelFits ? { arrangement: 'panel', title: t(l.backToPanel), icon: Minimize2 } : null;
    });
    const commands = computed((): ItemKeyCommands => {
        const other = otherArrangement.value;
        return {
            // Run by the listener below, listed in the help sheet.
            next: { id: 'item.next', title: t(l.next), section: 'item', key: stepKeys.next, menu: false },
            previous: {
                id: 'item.previous',
                title: t(l.previous),
                section: 'item',
                key: stepKeys.previous,
                menu: false,
            },
            close: {
                id: 'item.close',
                title: t(l.close),
                section: 'item',
                key: ITEM_ARRANGEMENT_KEYS.close,
                menu: false,
            },
            openOnGitHub: {
                id: 'item.openOnGitHub',
                title: t(l.openOnGitHub),
                section: 'item',
                key: ITEM_ARRANGEMENT_KEYS.openOnGitHub,
                icon: Github,
                run: () => options.openOnGitHub(),
            },
            arrange: other && {
                id: `item.arrange.${other.arrangement}`,
                title: other.title,
                section: 'item',
                key: ITEM_ARRANGEMENT_KEYS.arrange,
                icon: other.icon,
                run: () => options.arrange(other.arrangement),
            },
        };
    });

    onWindowEvent('keydown', event => {
        // An open picker or menu takes Escape for itself.
        if (event.key === 'Escape' && !event.defaultPrevented && !isLayerOpen()) {
            // Here rather than in listeners of the layers' own, which would run after this one.
            if (options.onEscape?.()) {
                event.preventDefault();
                return;
            }

            // A field gives the key up first: Escape in the comment box leaves it.
            const { target } = event;
            if (target instanceof HTMLElement && isEditableTarget(target)) {
                target.blur();
                return;
            }

            event.preventDefault();
            options.close();
            return;
        }

        if (!isScreenKey(event)) {
            return;
        }

        if (matchesCommandKey(event, stepKeys.next)) {
            event.preventDefault();
            options.next();
        } else if (matchesCommandKey(event, stepKeys.previous)) {
            event.preventDefault();
            options.previous();
        }
    });

    return reactive<ItemKeysViewModel>({ otherArrangement, stepKeys, commands });
}
