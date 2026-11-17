import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed, shallowRef } from 'vue';

import { isActivatableTarget } from '@/utils/isActivatableTarget.js';
import { isEditableTarget } from '@/utils/isEditableTarget.js';
import { isLayerOpen } from '@/utils/isLayerOpen.js';
import { isScreenCovered } from '@/utils/isScreenCovered.js';

import type { Command, CommandKeySheet, CommandParts, CommandSubject } from './CommandTypes.js';
import { getRunKeys } from './getRunKeys.js';
import { matchesCommandKey } from './matchesCommandKey.js';
import { orderByKeyPrecedence } from './orderByKeyPrecedence.js';

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
export const APP_KEYS = { commandMenu: 'Mod+K', help: '?', settings: ',', sidebar: 'Mod+B' } as const;

/** Where writing happens: ⌘K there is the field's (a markdown editor's "insert link"), never the menu's. */
const WRITING = 'textarea, [contenteditable]:not([contenteditable="false"])';

/**
 * The app's actions (D9): every component registers the ones it offers while it is shown (`useCommands`), and
 * this one registry feeds the command menu (⌘K), the keys and the help sheet (`?`). It runs an action's key
 * itself: outside fields for a single key, also in a one-line field for a `Mod` key; never while the menu or the help
 * is open, except that the menu's own key closes it. Two actions on one key: the first by
 * {@link orderByKeyPrecedence} runs — the one whose place has the keyboard, else whose section comes first.
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
        const byPrecedence = computed(() => orderByKeyPrecedence(commands.value));
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
            findById,
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
         * The action registered under `id` (`project.newIssueInProject`) if it can run now, for a button that runs it
         * (the phone's New issue, My work's).
         */
        function findById(id: string) {
            return findCommand(command => command.id === id);
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

            const command = findCommand(candidate =>
                getRunKeys(candidate).some(
                    key => matchesCommandKey(event, key) && isFreeTarget(event.target, candidate, key),
                ),
            );
            if (command) {
                event.preventDefault();
                // ⌘K held down opens or closes the menu once, rather than flickering it.
                if (!event.repeat || command.key !== APP_KEYS.commandMenu) {
                    run(command);
                }
            }
        }

        /** The first action, by {@link orderByKeyPrecedence}, that can run and `matches`. */
        function findCommand(matches: (command: Command) => boolean) {
            return (
                byPrecedence.value.find(
                    command =>
                        command.unavailable === undefined &&
                        (command.run !== undefined || command.options !== undefined) &&
                        matches(command) &&
                        isEnabled(command),
                ) ?? null
            );
        }
    },
});

/**
 * A single key is a field's own; a `Mod` key is a field's only where the user writes. Nothing runs from inside a layer
 * that keeps the keys to itself (`data-no-commands`: the new issue's capture, over a list whose keys would act on
 * the items behind it), nor from an open menu, which would stay open over wherever the key went. Enter and Space are a
 * focused button's, link's or summary's own (commands D4). A single key acting on a subject doesn't run from what Tab
 * focused outside the list (`data-tab-focus`): the keyboard isn't on the subject. A screen's key (one with a place but
 * `app`) doesn't run while a layer covers the screen (`isScreenCovered`), and its Escape not while a picker, menu or
 * tooltip is open (`isLayerOpen`): that Escape closes it.
 */
function isFreeTarget(target: EventTarget | null, command: Command, key: string) {
    if (target instanceof Element && target.closest('[data-no-commands], [role="menu"]') !== null) {
        return false;
    }

    const screen = command.place !== undefined && command.place !== 'app';
    if (screen && (isScreenCovered() || (key === 'Escape' && isLayerOpen()))) {
        return false;
    }

    if ((key === 'Enter' || key === 'Space') && isActivatableTarget(target)) {
        return false;
    }

    if (key.includes('Mod+')) {
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
