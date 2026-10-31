import { useService } from '@nzyme/vue-ioc/useService.js';
import { computed, onScopeDispose } from 'vue';

import { CommandRegistry } from './CommandRegistry.js';
import type { CommandSource } from './CommandRegistry.js';
import type { Command, CommandSubject } from './CommandTypes.js';

/**
 * Offers the component's actions in the command menu, runs them by their keys and lists them in the help sheet
 * while the component is shown; `subject` names what they act on (the opened item, the selection), for the
 * menu's chip.
 */
export function useCommands(commands: () => readonly Command[], subject?: () => CommandSubject | null): void {
    const registry = useService(CommandRegistry);
    const registered = computed(commands);
    const named = computed(() => subject?.() ?? null);

    const source: CommandSource = {
        get commands() {
            return registered.value;
        },
        get subject() {
            return named.value;
        },
    };
    onScopeDispose(registry.register(source));
}
