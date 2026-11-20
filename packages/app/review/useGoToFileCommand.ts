import { assert } from '@nzyme/utils/assert.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { computed, h, ref } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { bindCommand } from '@/commands/bindCommand.js';
import { SUBMENU_LIMIT } from '@/commands/CommandMenu.vue';
import type { BoundCommand, CommandOption, CommandOptions } from '@/commands/CommandTypes.js';
import { goToFile } from '@/commands/definitions/index.js';

import ReviewChange from './ReviewChange.vue';
import type { ReviewFile } from './ReviewFiles.js';
import * as l from './useGoToFileCommand.loc.js';
import { findFilePaths } from './utils/findFilePaths.js';
import type { FoundFilePath } from './utils/findFilePaths.js';
import { getFileFolder } from './utils/getFileFolder.js';
import { getFileName } from './utils/getFileName.js';

/** Options of `useGoToFileCommand()`. */
export interface UseGoToFileCommandOptions {
    /** Every file of the file list in its order, those gone from the diff too, whatever a filter holds back. */
    readonly files: MaybeRefOrGetter<readonly ReviewFile[]>;
    /** The cursor's file: checked in the list. */
    readonly currentPath: MaybeRefOrGetter<string | null>;
    /** Whether `files` is all GitHub lists; until then what has arrived is listed, and the footer says so. */
    readonly listComplete: MaybeRefOrGetter<boolean>;
    /** How many files the pull request has, `null` until known. */
    readonly total: MaybeRefOrGetter<number | null>;
    /** Shows the file picked, as a click in the file list does. */
    readonly reveal: (path: string) => void;
}

/**
 * "Go to file" (⌘P) of a review: its level of the command menu finds the pull request's files by scattered letters of
 * their paths, the name ahead of the folders (`findFilePaths`), and picking one reveals it. Nothing is asked of GitHub:
 * the files are the ones the review lists.
 */
export function useGoToFileCommand(options: UseGoToFileCommandOptions): () => BoundCommand {
    const t = useTranslate();
    const files = makeRef(options.files);
    const currentPath = makeRef(options.currentPath);
    const listComplete = makeRef(options.listComplete);
    const total = makeRef(options.total);
    const typed = ref('');
    const paths = computed(() => files.value.map(file => file.path));
    const byPath = computed(() => new Map(files.value.map(file => [file.path, file])));
    const found = computed(() => findFilePaths(typed.value, paths.value));

    return () =>
        bindCommand(
            goToFile,
            {
                section: 'view',
                options: getOptions,
                search: text => {
                    typed.value = text;
                },
            },
            t,
        );

    function getOptions(): CommandOptions {
        const text = typed.value.trim();
        return {
            options: found.value.slice(0, SUBMENU_LIMIT).map(toOption),
            loading: !listComplete.value,
            placeholder: t(l.placeholder),
            message: text === '' ? undefined : t(l.nothing, { text }),
            hint: getHint(text),
        };
    }

    function getHint(text: string) {
        if (!listComplete.value) {
            const count = files.value.length;
            return total.value == null
                ? t(l.readingSoFar, { count })
                : t(l.reading, { count, total: Math.max(count, total.value) });
        }

        const count = found.value.length;
        if (count === 0) {
            return undefined;
        }

        return text === '' && count > SUBMENU_LIMIT ? t(l.typeToFind, { count }) : t(l.files, { count });
    }

    function toOption({ path, part, ranges }: FoundFilePath): CommandOption {
        const file = byPath.value.get(path);
        assert(file);
        return {
            value: path,
            label: getFileName(path),
            detail: getFileFolder(path) ?? undefined,
            aside: file.viewed === 'VIEWED' ? t(l.viewed) : undefined,
            // As the file list draws it; a file gone from the diff has no change of its own there either.
            lead: file.gone ? undefined : () => h(ReviewChange, { change: file.changeType }),
            chosen: path === currentPath.value,
            match:
                part === null || ranges === null ? undefined : { field: part === 'name' ? 'label' : 'detail', ranges },
            pick: () => options.reveal(path),
        };
    }
}
