import type { Translation } from '@nzyme/i18n-core/Translation.js';
import type { LucideIcon } from 'lucide-vue-next';

import type { CommandPlace } from './CommandTypes.js';

/** The places a definition can be offered in: at least one. */
export type CommandPlaces = readonly [CommandPlace, ...CommandPlace[]];

/** What every definition has, a single command's or a numbered family's. */
interface AppCommandBase<TPlaces extends CommandPlaces> {
    /** Unique across the definitions (tested); the user's keys will be stored under it (commands D10). */
    readonly id: string;
    /** A translation key from the `.loc.yaml` beside the definition, translated where it is shown. */
    readonly title: Translation;
    readonly icon?: LucideIcon;
    /** Other words it is found by in the command menu, translation keys like `title`. */
    readonly keywords?: readonly Translation[];
    /** Where it can be offered (commands D13); a binding names one of them when there are several. */
    readonly places: TPlaces;
    /** How much it matters in the command menu, higher first (commands D14). */
    readonly priority: number;
}

/** A command (commands D1): what it is, whatever place offers it. */
export interface AppCommand<TPlaces extends CommandPlaces = CommandPlaces> extends AppCommandBase<TPlaces> {
    readonly kind: 'command';
    /**
     * Its default key, in the notation of `Command.key` (`O`, `Shift+Enter`, `Mod+K`). App-wide commands take no bare
     * letter (commands D8, tested). Shown and run through `keyOf`, never read directly.
     */
    readonly key?: string;
    /** Fixed keys doing the same (`ArrowDown` beside `J`), never rebound. */
    readonly otherKeys?: readonly string[];
    /** `false` for a key a user can't change (commands D9, D11): `J`/`K`, the Escape closing a panel. */
    readonly configurable: boolean;
}

/**
 * A numbered family (commands D9): one definition for the keys that pick the n-th of what a screen shows ("Go to view
 * 1–9"). Its keys are fixed; the binding gets each number and may name what it picks.
 */
export interface AppCommandFamily<TPlaces extends CommandPlaces = CommandPlaces> extends AppCommandBase<TPlaces> {
    readonly kind: 'family';
    /** The numbers it takes, both ends included (`1`–`9`): each is its own key. */
    readonly numbers: CommandNumbers;
    readonly configurable: false;
}

/** The range of number keys of an {@link AppCommandFamily}. */
export interface CommandNumbers {
    readonly first: number;
    readonly last: number;
}

/** Any definition. */
export type AnyAppCommand = AppCommand | AppCommandFamily;

/** What {@link defineAppCommand} takes for a single command. */
export interface AppCommandOptions<TPlaces extends CommandPlaces> {
    readonly id: string;
    readonly title: Translation;
    readonly icon?: LucideIcon;
    readonly key?: string;
    readonly otherKeys?: readonly string[];
    readonly keywords?: readonly Translation[];
    readonly places: TPlaces;
    /** Default `0`. */
    readonly priority?: number;
    /** Default `true`. */
    readonly configurable?: boolean;
}

/** What {@link defineAppCommand} takes for a numbered family: `numbers` in place of a key; never configurable. */
export interface AppCommandFamilyOptions<TPlaces extends CommandPlaces> {
    readonly id: string;
    readonly title: Translation;
    readonly icon?: LucideIcon;
    readonly numbers: CommandNumbers;
    readonly keywords?: readonly Translation[];
    readonly places: TPlaces;
    /** Default `0`. */
    readonly priority?: number;
}

/**
 * Defines a command once (commands D12), in `commands/definitions/<area>.ts`, exported from its index: a place offers
 * it by binding it (`bindCommand`, `useCommand`). Not `defineCommand`, `@nzyme/ioc`'s (D5).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function defineAppCommand<const TPlaces extends CommandPlaces>(
    options: AppCommandOptions<TPlaces>,
): AppCommand<TPlaces>;
/**
 * Defines a numbered family (commands D9): one definition for the keys `numbers.first`–`numbers.last`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function defineAppCommand<const TPlaces extends CommandPlaces>(
    options: AppCommandFamilyOptions<TPlaces>,
): AppCommandFamily<TPlaces>;
/** @__NO_SIDE_EFFECTS__ */
export function defineAppCommand<const TPlaces extends CommandPlaces>(
    options: AppCommandOptions<TPlaces> | AppCommandFamilyOptions<TPlaces>,
): AppCommand<TPlaces> | AppCommandFamily<TPlaces> {
    if ('numbers' in options) {
        return { ...options, kind: 'family', priority: options.priority ?? 0, configurable: false };
    }

    return { ...options, kind: 'command', priority: options.priority ?? 0, configurable: options.configurable ?? true };
}
