import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { bindCommand } from './bindCommand.js';
import type { CommandBinding } from './bindCommand.js';
import type { AppCommand, CommandPlaces } from './defineAppCommand.js';
import { useCommands } from './useCommands.js';

/**
 * Offers a defined command while the component is shown, saying what it does here (commands D12). The binding is read
 * reactively, as `useCommands` reads its commands. A family is bound with `bindCommand` inside `useCommands`.
 */
export function useCommand<const TPlaces extends CommandPlaces>(
    definition: AppCommand<TPlaces>,
    binding: () => CommandBinding<TPlaces>,
): void {
    const t = useTranslate();
    useCommands(() => [bindCommand(definition, binding(), t)]);
}
