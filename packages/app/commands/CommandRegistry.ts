import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed, shallowRef } from 'vue';

import { isEditableTarget } from '@/utils/isEditableTarget.js';

import type { Command, CommandSubject } from './CommandTypes.js';
import { COMMAND_SECTIONS } from './CommandTypes.js';
import { matchesCommandKey } from './matchesCommandKey.js';

/** What a component registers while it is shown: its actions, and what they act on. */
export interface CommandSource {
    readonly commands: readonly Command[];
    readonly subject: CommandSubject | null;
}

/** The command menu as asked to open: at the top, or in an action's submenu. */
export interface CommandMenuRequest {
    /** The action whose submenu it opens in. */
    readonly commandId: string | null;
}

/** The keys of the app's own actions, wherever the app draws them: the command menu, the help sheet, the sidebar. */
export const APP_KEYS = { commandMenu: 'Mod+K', help: '?', settings: ',', sidebar: '[' } as const;

/** The key of a new issue (H1): the app's, and a project's own where it starts in that project (H5). */
export const NEW_ISSUE_KEY = 'C';

/** Where writing happens: ⌘K there is the field's (a markdown editor's "insert link"), never the menu's. */
const WRITING = 'textarea, [contenteditable]:not([contenteditable="false"])';

/**
 * The app's actions (D9): every component registers the ones it offers while it is shown (`useCommands`), and
 * this one registry feeds the command menu (⌘K), the keys and the help sheet (`?`). It runs an action's key
 * itself: outside fields for a single key, also in a one-line field for a `Mod` key; never while the menu or the help
 * is open. Two actions on one key: the one whose section comes first ({@link COMMAND_SECTIONS}) runs.
 */
export type CommandRegistry = Resolved<typeof CommandRegistry>;
export const CommandRegistry = defineService({
    name: 'CommandRegistry',
    setup() {
        const sourcesRef = shallowRef<readonly CommandSource[]>([]);
        const menuRef = shallowRef<CommandMenuRequest | null>(null);
        const helpRef = shallowRef(false);

        const commands = computed(() => sourcesRef.value.flatMap(source => source.commands));
        const subject = computed(() => {
            const subjects = sourcesRef.value.flatMap(source => (source.subject ? [source.subject] : []));
            return subjects.find(candidate => candidate.kind === 'selection') ?? subjects[0] ?? null;
        });

        return {
            /** Every action registered now; reactive. */
            get commands(): readonly Command[] {
                return commands.value;
            },
            /** What the actions act on: the selection, else the opened item; reactive. */
            get subject(): CommandSubject | null {
                return subject.value;
            },
            /** The command menu while it is open; reactive. */
            get menu() {
                return menuRef.value;
            },
            /** Whether the help sheet is open; reactive. */
            get helpOpen() {
                return helpRef.value;
            },
            register,
            isEnabled,
            run,
            openMenu,
            closeMenu,
            setHelpOpen,
        };

        /** Registers a component's actions; returns what takes them away again. */
        function register(source: CommandSource) {
            // The keys are listened to while anything offers an action.
            if (sourcesRef.value.length === 0) {
                window.addEventListener('keydown', onKeydown);
            }

            sourcesRef.value = [...sourcesRef.value, source];
            return () => {
                sourcesRef.value = sourcesRef.value.filter(candidate => candidate !== source);
                if (sourcesRef.value.length === 0) {
                    window.removeEventListener('keydown', onKeydown);
                }
            };
        }

        function isEnabled(command: Command) {
            return command.when?.() ?? true;
        }

        /** Runs the action by its key — or, where it does not run itself, opens the menu at its submenu. */
        function run(command: Command) {
            const ran = command.run ? command.run() !== false : false;
            if (!ran && command.options) {
                openMenu(command.id);
            }
        }

        function openMenu(commandId: string | null = null) {
            helpRef.value = false;
            menuRef.value = { commandId };
        }

        function closeMenu() {
            menuRef.value = null;
        }

        function setHelpOpen(open: boolean) {
            helpRef.value = open;
        }

        function onKeydown(event: KeyboardEvent) {
            if (event.defaultPrevented || menuRef.value || helpRef.value) {
                return;
            }

            const command = findCommand(event);
            if (command) {
                event.preventDefault();
                run(command);
            }
        }

        function findCommand(event: KeyboardEvent) {
            for (const section of COMMAND_SECTIONS) {
                for (const command of commands.value) {
                    const { key } = command;
                    if (
                        command.section === section &&
                        key !== undefined &&
                        (command.run !== undefined || command.options !== undefined) &&
                        matchesCommandKey(event, key) &&
                        isFreeTarget(event.target, key) &&
                        isEnabled(command)
                    ) {
                        return command;
                    }
                }
            }

            return null;
        }
    },
});

/**
 * A single key is a field's own; a `Mod` key is a field's only where the user writes. Nothing runs from inside a layer
 * that keeps the keys to itself (`data-no-commands`: the new issue's capture, over a list whose keys would act on
 * the items behind it).
 */
function isFreeTarget(target: EventTarget | null, key: string) {
    if (target instanceof Element && target.closest('[data-no-commands]') !== null) {
        return false;
    }

    if (key.includes('Mod+')) {
        return !(target instanceof Element && target.closest(WRITING) !== null);
    }

    return !isEditableTarget(target);
}
