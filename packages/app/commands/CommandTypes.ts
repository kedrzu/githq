import type { LucideIcon } from 'lucide-vue-next';

/**
 * Where an action belongs: its heading in the command menu and the help sheet, and — when two actions take the
 * same key — which one runs: `selection` before `item` before `view` before `app` (the items edited together win
 * over the item opened beside them, as their toolbar always did).
 */
export type CommandSection = 'selection' | 'item' | 'view' | 'app';

/** The sections from the one whose key wins to the one whose key yields. */
export const COMMAND_SECTIONS: readonly CommandSection[] = ['selection', 'item', 'view', 'app'];

/**
 * What the actions act on, as the command menu's chip names it: the items selected together, or the item opened
 * (E1, E4). The selection wins when both are there.
 */
export interface CommandSubject {
    readonly kind: 'item' | 'selection';
    /** The chip's text: `portal#1187`, `3 items`. */
    readonly label: string;
    /** The heading of its actions: the item's title, "3 items". */
    readonly title: string;
}

/**
 * An action of the app (D9's command menu): offered in ⌘K, run by its key, listed in the help sheet — one
 * definition for all three, so the key the menu shows is the key that runs it.
 */
export interface Command {
    /** Unique among the actions registered at a time (`item.assign`). */
    readonly id: string;
    readonly title: string;
    readonly section: CommandSection;
    /** Other words it is found by ("close" for "Done"). */
    readonly keywords?: readonly string[];
    /**
     * Its key, as `aria-keyshortcuts` writes it with `Mod` for the platform's primary modifier: `A`, `Shift+X`, `[`,
     * `?`, `Mod+K` (⌘ on a Mac, Ctrl elsewhere). A single key runs only outside fields; one with `Mod` also in a
     * one-line field.
     */
    readonly key?: string;
    /** Other keys that do the same (`ArrowDown` beside `J`), listed beside `key` in the help sheet. */
    readonly otherKeys?: readonly string[];
    /** Dim text after the title: the current value ("In progress · Platform Q4"), "2 of 3 editable". */
    readonly detail?: string;
    readonly icon?: LucideIcon;
    /** `false`: run by its key and listed in the help, never offered in the menu. */
    readonly menu?: boolean;
    /**
     * Whether it can run now; leaving it out means always. The screen and the item or selection are the registering
     * component's own (it registers its actions while it is shown), so it is asked nothing.
     */
    readonly when?: () => boolean;
    /**
     * Runs it — by its key; in the menu too unless it has a submenu, which the menu opens instead. Returning
     * `false` says it could not run here (the item view's picker is not shown): its key then opens the menu at its
     * submenu, as it does for an action with a submenu and no `run`. With neither `run` nor `options`, its key is the
     * registering component's own (a list's `j`, seen before an opened item's): it is only listed in the help sheet.
     */
    readonly run?: () => boolean | void;
    /** Its second step (a picker's options): the menu opens it on Enter, Tab or →; typing finds its options. */
    readonly options?: () => CommandOptions;
    /** Called as its submenu opens: what it offers may still have to be read. */
    readonly prepare?: () => void;
}

/** A submenu: what an action offers to pick. */
export interface CommandOptions {
    readonly options: readonly CommandOption[];
    /** Still being read: says so instead of "nothing matches". */
    readonly loading?: boolean;
    /** A quiet line under the options ("mobile#91 is in sigma-clinic/mobile, where you can't edit labels"). */
    readonly note?: string;
    /** Picking one leaves the submenu open, to pick several one after another (items added to a project). */
    readonly several?: boolean;
}

/** One thing a submenu offers. */
export interface CommandOption {
    /** Unique within the submenu. */
    readonly value: string;
    readonly label: string;
    readonly detail?: string;
    /** A colour dot, hex without `#`. */
    readonly color?: string;
    readonly avatarUrl?: string;
    /** The heading it sits under (a project's name); options of one group follow each other. */
    readonly group?: string;
    /** It is the value now (a check mark); picking a chosen value of several takes it away. */
    readonly chosen?: boolean;
    /** Only some of the items edited together have it (a dash); picking it gives it to all of them. */
    readonly mixed?: boolean;
    readonly icon?: LucideIcon;
    pick(): void;
}
