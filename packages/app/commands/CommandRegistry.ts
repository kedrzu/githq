import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed, shallowRef } from 'vue';

import { isEditableTarget } from '@/utils/isEditableTarget.js';

import type { Command, CommandKeySheet, CommandParts, CommandSubject } from './CommandTypes.js';
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
    /**
     * The place's parts it lists first (the phone's command line on a list, mobile D17); read as the menu draws, so a
     * part's count is worked out only while it is open. `null` for ⌘K's own menu.
     */
    readonly parts: (() => CommandParts) | null;
}

/** What the command menu names in its chips and the user may take out of it (⌫). */
export type CommandContextPart = 'subject' | 'repository';

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
 * is open, except that the menu's own key closes it. Two actions on one key: the one whose section comes first
 * ({@link COMMAND_SECTIONS}) runs.
 */
export type CommandRegistry = Resolved<typeof CommandRegistry>;
export const CommandRegistry = defineService({
    name: 'CommandRegistry',
    setup() {
        const sourcesRef = shallowRef<readonly CommandSource[]>([]);
        const menuRef = shallowRef<CommandMenuRequest | null>(null);
        const helpRef = shallowRef(false);
        const keySheetRef = shallowRef<(() => CommandKeySheet) | null>(null);
        const removedRef = shallowRef<ReadonlySet<CommandContextPart>>(new Set());

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
            /**
             * The subject taken out of the command menu (⌫): the actions the menu runs then act on no subject. Back with
             * the next menu, and for a key or a button, which act on the screen; reactive.
             */
            get subjectRemoved() {
                return removedRef.value.has('subject');
            },
            /** The repository taken out of the command menu (⌫), as {@link subjectRemoved}; reactive. */
            get repositoryRemoved() {
                return removedRef.value.has('repository');
            },
            /** The command menu while it is open; reactive. */
            get menu() {
                return menuRef.value;
            },
            /** Whether the help sheet is open; reactive. */
            get helpOpen() {
                return helpRef.value;
            },
            /** The screen's own help sheet, `null` for the list of what can run now; reactive. */
            get keySheet(): CommandKeySheet | null {
                return keySheetRef.value?.() ?? null;
            },
            register,
            showKeySheet,
            isEnabled,
            findByKey,
            run,
            openMenu,
            openParts,
            closeMenu,
            setRemoved,
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

        /** Has the help sheet show this while the screen is shown; returns what takes it away again. */
        function showKeySheet(sheet: () => CommandKeySheet) {
            keySheetRef.value = sheet;
            return () => {
                if (keySheetRef.value === sheet) {
                    keySheetRef.value = null;
                }
            };
        }

        function isEnabled(command: Command) {
            return command.when?.() ?? true;
        }

        /**
         * The action a key runs now — what pressing it outside a field would run, the one whose section comes first —
         * for a button that does the same (the phone's New issue: a project's own in a project, else the app's).
         */
        function findByKey(key: string) {
            return findCommand(command => command.key === key);
        }

        /** Runs the action by its key — or, where it does not run itself, opens the menu at its submenu. */
        function run(command: Command) {
            if (command.unavailable !== undefined) {
                return;
            }

            // A key or a button acts on the screen, whatever the last menu took out.
            removedRef.value = new Set();
            const ran = command.run ? command.run() !== false : false;
            if (!ran && command.options) {
                openMenu(command.id);
            }
        }

        function openMenu(commandId: string | null = null) {
            helpRef.value = false;
            menuRef.value = { commandId, parts: null };
        }

        /** Opens the menu at the top with the place's parts first (mobile D17). */
        function openParts(parts: () => CommandParts) {
            helpRef.value = false;
            menuRef.value = { commandId: null, parts };
        }

        function closeMenu() {
            menuRef.value = null;
        }

        /** Takes a part of the menu's context out (⌫), or puts it back (the menu opening again). */
        function setRemoved(part: CommandContextPart, removed: boolean) {
            const parts = new Set(removedRef.value);
            if (removed) {
                parts.add(part);
            } else {
                parts.delete(part);
            }

            removedRef.value = parts;
        }

        function setHelpOpen(open: boolean) {
            helpRef.value = open;
        }

        function onKeydown(event: KeyboardEvent) {
            if (event.defaultPrevented) {
                return;
            }

            if (menuRef.value && matchesCommandKey(event, APP_KEYS.commandMenu)) {
                event.preventDefault();
                if (!event.repeat) {
                    closeMenu();
                }

                return;
            }

            if (menuRef.value || helpRef.value) {
                return;
            }

            const command = findCommand(
                candidate =>
                    candidate.key !== undefined &&
                    matchesCommandKey(event, candidate.key) &&
                    isFreeTarget(event.target, candidate),
            );
            if (command) {
                event.preventDefault();
                // ⌘K held down opens or closes the menu once, rather than flickering it.
                if (!event.repeat || command.key !== APP_KEYS.commandMenu) {
                    run(command);
                }
            }
        }

        /** The first action, by section, that can run and `matches`. */
        function findCommand(matches: (command: Command) => boolean) {
            for (const section of COMMAND_SECTIONS) {
                for (const command of commands.value) {
                    if (
                        command.section === section &&
                        command.unavailable === undefined &&
                        (command.run !== undefined || command.options !== undefined) &&
                        matches(command) &&
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
 * the items behind it), nor from an open menu, which would stay open over wherever the key went. A single key acting
 * on a subject doesn't run from what Tab focused outside the list (`data-tab-focus`): the keyboard isn't on the subject.
 */
function isFreeTarget(target: EventTarget | null, command: Command) {
    if (target instanceof Element && target.closest('[data-no-commands], [role="menu"]') !== null) {
        return false;
    }

    if (command.key?.includes('Mod+')) {
        return !(target instanceof Element && target.closest(WRITING) !== null);
    }

    if (target instanceof Element && target.closest('[data-tab-focus]') !== null && actsOnSubject(command)) {
        return false;
    }

    return !isEditableTarget(target);
}

/** On the selection, the opened item or a list's selected row; other actions of a view are about the view. */
function actsOnSubject(command: Command) {
    return command.section === 'selection' || command.section === 'item' || command.actsOnRow === true;
}
