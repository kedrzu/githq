import type { AppCommand, CommandPlaces } from './defineAppCommand.js';

/**
 * The key a command is shown with and run by — every hint (`:kbd="keyOf(definition)"`), the registry and the help
 * sheet read it here, so none shows a key that does not run it. For now the definition's default; the user's own key
 * comes in here once keys can be rebound (commands D10).
 *
 * @__NO_SIDE_EFFECTS__
 */
export function keyOf(definition: AppCommand<CommandPlaces, string>): string;
/**
 * The key of a command that may have none: `undefined` for one offered in menus only.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function keyOf(definition: AppCommand): string | undefined;
/** @__NO_SIDE_EFFECTS__ */
export function keyOf(definition: AppCommand): string | undefined {
    return definition.key;
}
