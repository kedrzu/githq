import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { watch } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import type { CommandKeySheet } from '@/commands/CommandTypes.js';
import * as definitions from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';

import * as l from './useItemKeySheet.loc.js';

/**
 * Has `?` on an item's page show the thread's keys first (F30): the reading cursor's and what they do where it is, every
 * row whatever can run at the moment, then the item's other keys and the app's as the plain sheet lists them. Only
 * while `active` (the page, not on a phone): in the panel the sheet stays the list of what can run.
 */
export function useItemKeySheet(active: () => boolean): void {
    const registry = useService(CommandRegistry);
    const t = useTranslate();

    watch(
        active,
        (on, _, onCleanup) => {
            if (on) {
                onCleanup(registry.showKeySheet(getSheet));
            }
        },
        { immediate: true },
    );

    function getSheet(): CommandKeySheet {
        return {
            title: t(l.title),
            columns: [
                {
                    title: t(l.thread),
                    rows: [
                        {
                            keys: [keyOf(definitions.previousTab), keyOf(definitions.nextTab)],
                            label: t(l.comments),
                        },
                        { keys: [keyOf(definitions.lineDown), keyOf(definitions.lineUp)], label: t(l.cursor) },
                        { keys: [keyOf(definitions.pageDown), keyOf(definitions.pageUp)], label: t(l.pages) },
                        { keys: [keyOf(definitions.comment)], label: t(l.reply) },
                        { keys: [keyOf(definitions.commentMenu)], label: t(l.menu) },
                        { keys: [keyOf(definitions.quoteComment)], label: t(l.quote) },
                        { keys: [keyOf(definitions.resolveThread)], label: t(l.resolve) },
                        { keys: [keyOf(definitions.editComment)], label: t(l.edit) },
                    ],
                },
            ],
            footer: [],
            listed: true,
        };
    }
}
