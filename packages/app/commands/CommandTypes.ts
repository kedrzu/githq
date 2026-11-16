import type { LucideIcon } from 'lucide-vue-next';

import type { NavigationPlace } from './searchNavigation.js';

/**
 * Where an action belongs: its heading in the command menu and the help sheet, and — when two actions take the
 * same key — which one runs: `selection` before `item` before `view` before `repository` before `app` (the items
 * edited together win over the item opened beside them, as their toolbar always did). `repository` holds the actions
 * of the repository the screen belongs to; the menu offers them only while it has that repository as its context.
 */
export type CommandSection = 'selection' | 'item' | 'view' | 'repository' | 'app';

/** The sections from the one whose key wins to the one whose key yields. */
export const COMMAND_SECTIONS: readonly CommandSection[] = ['selection', 'item', 'view', 'repository', 'app'];

/**
 * Where a defined command can be offered (commands D13): the whole app, or one kind of screen or panel — a list, an
 * opened item, a commit, workflow or workflow run opened as one, a repository's Workflows section, a review, the
 * changelog, a screen GitHub won't show (`CantBeRead`), a repository or a project as their menus offer them. Places
 * only tell which keys collide and which command takes a key while two places are on screen; more are added as
 * commands move onto definitions.
 */
export type CommandPlace =
    | 'app'
    | 'list'
    | 'item'
    | 'commit'
    | 'workflow'
    | 'workflowRun'
    | 'workflows'
    | 'review'
    | 'changelog'
    | 'cantBeRead'
    | 'repository'
    | 'project';

/**
 * The places that can be on screen together, each pair's first keeping the keyboard: a list with an item open beside
 * it (the list's `J`, `K` and `O` act on its row, `ListView.vue`); an item opened over a review, or beside a screen
 * GitHub won't show; a workflow's run beside its repository's Workflows section, whose keys are then the run's.
 * Hand-kept, acyclic: no place keeps it over one that keeps it over the first. `app` is never in it: it is with every
 * place, and every place keeps the keyboard over it.
 */
export const PLACES_TOGETHER: readonly (readonly [keeper: CommandPlace, other: CommandPlace])[] = [
    ['list', 'item'],
    ['item', 'review'],
    ['item', 'cantBeRead'],
    ['workflowRun', 'workflows'],
];

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
 * What a part of a place (mobile D17) shows on its line in the command menu, beyond its title: what the screen showing
 * the place knows of it. Set on the rows of {@link CommandParts}; of the rest, only `external`, on an action that
 * leaves for github.com on a phone (an item's "Merge…" and "Review files", mobile D11), also marked in the item menu.
 */
export interface CommandMarks {
    /** How many it holds ("142"), at the line's end; `null` while that is still arriving. */
    readonly count?: number | null;
    /** Changed on this device (a project view's grouping, sort or shown properties, mobile D49): a dot after the title. */
    readonly changed?: boolean;
    /** It is the part shown: a check at the line's end. */
    readonly current?: boolean;
    /**
     * Running it leaves for github.com (on a phone: a repository's Commits and Actions, mobile D21; an item's "Merge…"
     * and "Review files", D11): ↗ at the line's end.
     */
    readonly external?: boolean;
}

/**
 * The parts of the place a list screen shows (mobile D17) — a repository's sections, a project's saved views, My work and
 * its groups —, first in the command menu the phone's command line opens, under their own heading. Each is a row the menu
 * has anyway (the same action or place, so there is one way to switch), with its {@link CommandMarks}; the menu then
 * leaves it out of its usual group.
 */
export interface CommandParts {
    /** The place, as the heading names it ("Platform Q4 · views", "fitloop/webapp", "My work"). */
    readonly heading: string;
    readonly rows: readonly CommandPart[];
}

/** One of {@link CommandParts}: an action (`repository.section.issues`, a saved view's `view:<id>`) or a place (`myWork:assigned`). */
export type CommandPart =
    | { readonly kind: 'command'; readonly command: Command }
    | { readonly kind: 'place'; readonly place: NavigationPlace };

/**
 * An action of the app (D9's command menu): offered in ⌘K, run by its key, listed in the help sheet — one
 * definition for all three, so the key the menu shows is the key that runs it.
 */
export interface Command extends CommandMarks {
    /** Unique among the actions registered at a time (`item.assign`). */
    readonly id: string;
    readonly title: string;
    readonly section: CommandSection;
    /**
     * Where it is offered, set on a command bound from a definition (`bindCommand`): of two on one key, the one whose
     * place keeps the keyboard runs (`orderByKeyPrecedence`). Without it the section alone decides.
     */
    readonly place?: CommandPlace;
    /** How much it matters (commands D14): higher first in its group of the command menu, a tie-break while typing. Default `0`. */
    readonly priority?: number;
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
     * Why it can't run here ("CLA has no workflow_dispatch trigger", W48): the menu shows it dimmed with this reason and
     * "can't run", and nothing runs or opens from it — its key neither.
     */
    readonly unavailable?: string;
    /**
     * The id of one of its `children` to go straight into (the repository a screen is in, W36): Enter, Tab or → open that
     * child's level, and a step back from there shows the others.
     */
    readonly start?: string;
    /**
     * It acts on what a list's keys are on (its selected row, the commit opened from it) though its section says `view`:
     * as the `selection` and `item` sections' actions, it doesn't run from what Tab focused outside the list.
     */
    readonly actsOnRow?: boolean;
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
    /** Called as its submenu or level is shown, coming back to it too: what it offers may still have to be read. */
    readonly prepare?: () => void;
    /**
     * Receives what is typed in its submenu, `''` as the submenu opens and once it is left, and maybe the same text
     * twice: `options` is then what it answered. They are not filtered again, and the menu's top level does not look
     * through them, so nothing is asked of anyone until the submenu is open.
     */
    readonly search?: (text: string) => void;
    /**
     * The rows under it, a level the menu walks into. They do not go through the registry: no keys, not in the help
     * sheet. `options` is the other kind of submenu, a picker, which ends the path.
     */
    readonly children?: () => readonly Command[];
    /** What its level says while it lists nothing, in place of "Nothing matches" ("Reading the workflow files…"). */
    readonly message?: string;
    /** The field's text while its level is open, in place of "Type a command or search…" ("Pick a repository…"). */
    readonly placeholder?: string;
    /** Quiet text at the footer's end while its level is open ("Run workflow · step 1 of 3"). */
    readonly levelHint?: string;
    /**
     * Quiet text at the footer's end while it is highlighted, over its level's ("Enter opens Deploy's form", W47). One that
     * can't run is never highlighted: its hint shows while it is listed and the highlighted line has none ("Enter picks
     * another workflow", W48).
     */
    readonly hint?: string;
    /**
     * The heading it sits under in a level (W46's "Tracked repositories"); rows of one heading are shown together. The
     * menu's top level heads its rows by `section` and ignores it, as it does for a row found deeper than the level shown.
     */
    readonly group?: string;
    /** The rows found when the text does not name it; leaving it out means `children`. */
    readonly foundAlone?: () => readonly Command[];
    /**
     * Its last step, a form in place of the list (W37): Enter, Tab or → open it. Asked again with what has been entered as
     * that changes, so the fields may follow it (a ref decides a workflow's inputs). What was entered stays with the
     * menu's step while it is open — a field taken away and given back, or the form left and opened again, keeps it.
     */
    readonly form?: (values: CommandFormValues) => CommandForm;
}

/** A value of a {@link CommandFormField}: `null` is a number field left empty. */
export type CommandFormValue = string | number | boolean | null;

/** What was entered in a form, by field name; a field not touched yet is not there (its default stands). */
export type CommandFormValues = Readonly<Record<string, CommandFormValue>>;

/** A form an action asks to be filled before it runs ("Run workflow", W37). */
export interface CommandForm {
    /** The heading over the fields ("Ref and inputs"). */
    readonly heading?: string;
    readonly fields: readonly CommandFormField[];
    /**
     * Why it can't run as it is ("This ref has no workflow_dispatch trigger"), under the fields — in place of those it
     * can't offer, the ones left to change it (the ref). It can't be submitted.
     */
    readonly message?: string;
    /** Dim text after the action's title in its crumb (the repository it runs in). */
    readonly context?: string;
    /** What submitting does, the key's label ("Run"). */
    readonly submitLabel: string;
    /** Quiet text at the footer's end ("Runs on GitHub as mlaine"). */
    readonly hint?: string;
    /** Every field shown, with its value or its default; the menu closes. */
    submit(values: CommandFormValues): void;
}

/** What every {@link CommandFormField} has. */
interface CommandFormFieldBase {
    /** Its key in the values, and its label unless it has one. */
    readonly name: string;
    /** Its label in place of its name (drawn monospaced: a workflow input's name), where the name is a key it can't clash on. */
    readonly label?: string;
    /** Under the name: its type, or what it takes ("branch or tag"). */
    readonly detail?: string;
    /** Quiet text after the control ("the default branch", "default: staging", "optional"). */
    readonly hint?: string;
    /** The form can't be submitted while it is empty. */
    readonly required?: boolean;
}

/** A one-line text field. */
export interface CommandFormTextField extends CommandFormFieldBase {
    readonly kind: 'text';
    readonly default?: string;
}

/** A number field; empty is `null`. */
export interface CommandFormNumberField extends CommandFormFieldBase {
    readonly kind: 'number';
    readonly default?: number;
}

/** One of a list of values, picked in a select; without a default, the first. */
export interface CommandFormChoiceField extends CommandFormFieldBase {
    readonly kind: 'choice';
    readonly options: readonly string[];
    readonly default?: string;
}

/** A switch; without a default, off. */
export interface CommandFormBooleanField extends CommandFormFieldBase {
    readonly kind: 'boolean';
    readonly default?: boolean;
}

/** A field of a {@link CommandForm}. */
export type CommandFormField =
    | CommandFormTextField
    | CommandFormNumberField
    | CommandFormChoiceField
    | CommandFormBooleanField;

/** A row of a {@link CommandKeySheet}. */
export interface CommandKeyRow {
    /** The keys it is about, each as {@link Command.key} writes it. */
    readonly keys: readonly string[];
    readonly label: string;
}

/**
 * What the help sheet (`?`) shows in place of the actions that can run now, on a screen with more keys than a list holds (CR29):
 * written out by the screen, so that every row shows in every state and one row can speak of two keys.
 */
export interface CommandKeySheet {
    readonly title: string;
    readonly columns: readonly { readonly title: string; readonly rows: readonly CommandKeyRow[] }[];
    /** The keys that fit no column, along the bottom. */
    readonly footer: readonly CommandKeyRow[];
}

/** A submenu: what an action offers to pick. */
export interface CommandOptions {
    readonly options: readonly CommandOption[];
    /** Still being read: says so instead of "nothing matches". */
    readonly loading?: boolean;
    /** A quiet line under the options ("mobile#91 is in skyline-labs/mobile, where you can't edit labels"). */
    readonly note?: string;
    /** Picking one leaves the submenu open, to pick several one after another (items added to a project). */
    readonly several?: boolean;
    /** The field's text while empty, in place of "Filter options…". */
    readonly placeholder?: string;
    /** The heading over the options, there too while none is listed. */
    readonly heading?: string;
    /** The line said while no option is listed, in place of "Nothing matches". */
    readonly message?: string;
    /** Quiet text at the footer's end: where the options come from. */
    readonly hint?: string;
}

/** One thing a submenu offers. */
export interface CommandOption {
    /** Unique within the submenu. */
    readonly value: string;
    readonly label: string;
    readonly detail?: string;
    /** Dim text at the line's end (a repository's visibility). */
    readonly aside?: string;
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
