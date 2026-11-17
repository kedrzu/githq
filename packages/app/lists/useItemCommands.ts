import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import { PanelRight } from 'lucide-vue-next';
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { comment, open as openItem, openFullScreen, openOnGitHub } from '@/commands/definitions/index.js';
import type { EditCommandsParams } from '@/commands/useEditCommands.js';
import { useEditCommands } from '@/commands/useEditCommands.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { IssueRoutes, formatItemReference, getItemPagePath, getItemReference } from '@/item/itemRoutes.js';
import { useItemActionCommands } from '@/item/useItemActionCommands.js';
import { MergeContext } from '@/merge/MergeContext.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import type { ItemDetailProject } from '@/store/ItemDetailTypes.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { isPendingItem } from '@/store/isPendingItem.js';
import type { Item } from '@/store/ItemTypes.js';

import * as l from './useItemCommands.loc.js';

/** What {@link useItemCommands} builds the actions of. */
export interface ItemCommandsParams {
    /** The items they act on; read every time they are built. */
    readonly ids: () => readonly string[];
    /**
     * Where their edits are offered: `item` for a list's row or items (the row stands for its item, its actions yield to
     * the list's own), or the review of the one pull request.
     */
    readonly place: 'item' | 'review';
    /** Where they belong: the command menu offers `item` and `selection` only for a subject of that kind. */
    readonly section: () => EditCommandsParams['section'];
    /** Opens the one item they act on, as Enter opens it. */
    readonly open: () => void;
    /** Opens the merge panel for the one pull request; without it merging is left to the caller. */
    readonly merge?: EditCommandsParams['merge'];
}

/**
 * The actions of a list's items, the one right-clicked or under the cursor, or those taken together: going to them,
 * writing about them, copying them, adding them to a project, and their edits. A repository's metadata is read only as a
 * submenu opens, so building them asks nothing of GitHub.
 */
export function useItemCommands({ ids, place: editPlace, section, open, merge }: ItemCommandsParams) {
    const t = useTranslate();
    const auth = useService(AuthStore);
    const details = useService(ItemDetailStore);
    const repositories = useService(RepositoryStore);
    const editor = useService(ItemEditor);
    const navigation = useService(ItemNavigation);
    const clock = useService(Clock);
    const browser = useService(Browser);
    const router = useRouter();
    const merging = injectContext(MergeContext, { optional: true });
    const editCommands = useEditCommands();
    const actions = useItemActionCommands();

    // Through the detail too: a pull request opened by its address (its review) need not be in any list.
    const selected = computed(() => ids().flatMap(id => details.getItem(id) ?? []));
    const one = computed(() => (selected.value.length === 1 ? (selected.value[0] ?? null) : null));
    /** The repositories of the items, each once (`owner/name`). */
    const repositoryNames = computed(() => [...new Set(selected.value.map(item => item.repository.nameWithOwner))]);
    const metadata = computed(() => repositoryNames.value.flatMap(name => repositories.get(name) ?? []));
    /** The projects of the items the user may write to, each once. */
    const places = computed(() => {
        const byProject = new Map<string, ItemDetailProject>();
        for (const item of selected.value) {
            for (const place of editor.getPlaces(item)) {
                if (place.viewerCanUpdate && !byProject.has(place.projectId)) {
                    byProject.set(place.projectId, place);
                }
            }
        }

        return [...byProject.values()];
    });

    return { selected, one, repositoryNames, getOwnCommands, getEditCommands };

    function getEditCommands(): BoundCommand[] {
        return editCommands({
            place: editPlace,
            section: section(),
            items: selected.value,
            metadata: metadata.value,
            loading: metadata.value.length < repositoryNames.value.length,
            viewerLogin: auth.viewer?.login ?? '',
            getPermissions: item => editor.getPermissions(item),
            places: places.value,
            now: clock.now(),
            edit,
            merge,
            pullRequestCommands: merging,
            setField: (place, field, value) =>
                one.value
                    ? edit({ kind: 'projectField', projectItemId: place.itemId, fieldId: field.id, value })
                    : edit({ kind: 'projectFieldInProject', projectId: place.projectId, fieldId: field.id, value }),
        }).map(readingMetadata);
    }

    /** Going to the items, writing about them, copying them, adding them to a project. */
    function getOwnCommands(): BoundCommand[] {
        const item = one.value;
        const own = section();
        const commands: BoundCommand[] = [
            bindCommand(
                openOnGitHub,
                {
                    place: 'item',
                    section: own,
                    detail: item ? undefined : t(l.tabs, { count: selected.value.length }),
                    run: () => {
                        for (const candidate of selected.value) {
                            browser.openInNewTab(candidate.url);
                        }
                    },
                },
                t,
            ),
            actions.copyLink(selected.value, own),
        ];
        if (selected.value.some(candidate => editor.getPermissions(candidate).addToProject)) {
            commands.push(
                actions.addToProject({
                    section: own,
                    items: selected.value,
                    projects: () => repositories.viewerProjects,
                    prepare: () => void repositories.ensureViewerProjects(),
                    add: project => edit({ kind: 'addToProject', project }),
                }),
            );
        }

        if (!item || isPendingItem(item)) {
            return commands;
        }

        commands.push(
            bindCommand(openItem, { place: 'item', section: own, icon: PanelRight, run: open }, t),
            bindCommand(
                openFullScreen,
                { place: 'item', section: own, run: () => void router.push(getPageLocation(item)) },
                t,
            ),
        );
        if (editor.getPermissions(item).comment) {
            commands.push(
                bindCommand(
                    comment,
                    {
                        place: 'item',
                        section: own,
                        run: () => {
                            navigation.requestComment(item.id);
                            open();
                        },
                    },
                    t,
                ),
            );
        }

        commands.push(...actions.kindCommands(item, own));
        return commands;
    }

    /** What the submenu offers, and what the user may do there, read for every repository of the items as it opens. */
    function readingMetadata(command: BoundCommand): BoundCommand {
        if (!command.options) {
            return command;
        }

        return {
            ...command,
            prepare: () => {
                for (const name of repositoryNames.value) {
                    void repositories.ensure(name);
                }

                command.prepare?.();
            },
        };
    }

    /** Its page; the one open in the panel expanded from it, as the header's "Open full screen" does, so Escape comes back. */
    function getPageLocation(item: Item): RouteLocationRaw {
        const reference = getItemReference(item);
        const opened = IssueRoutes.getOpened(router.currentRoute.value);
        const inPanel =
            opened !== null &&
            !opened.onPage &&
            formatItemReference(opened.reference) === formatItemReference(reference);
        const path = getItemPagePath(reference, item.kind);
        return inPanel ? IssueRoutes.getExpandedLocation({ reference, path }) : path;
    }

    function edit(request: EditRequest) {
        void editor.edit(ids(), request);
    }
}
