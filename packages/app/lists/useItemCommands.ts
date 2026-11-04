import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { injectContext } from '@nzyme/vue-utils/context.js';
import {
    CircleCheckBig,
    CircleSlash,
    FileDiff,
    GitBranch,
    GitPullRequestClosed,
    Github,
    Hash,
    Link,
    Maximize2,
    MessageSquare,
    PanelRight,
    RotateCcw,
    SquareKanban,
} from 'lucide-vue-next';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { AuthStore } from '@/auth/AuthStore.js';
import type { Command, CommandOption } from '@/commands/CommandTypes.js';
import type { EditCommandsParams, StateOption } from '@/commands/useEditCommands.js';
import { EDIT_KEYS, useEditCommands } from '@/commands/useEditCommands.js';
import type { EditRequest } from '@/edits/EditTypes.js';
import { ItemEditor } from '@/edits/ItemEditor.js';
import { ItemNavigation } from '@/item/ItemNavigation.js';
import { formatShortReference, getItemPagePath, getItemReference } from '@/item/itemRoutes.js';
import { MergeContext } from '@/merge/MergeContext.js';
import { RepositoryStore } from '@/repos/RepositoryStore.js';
import { Browser } from '@/services/Browser.js';
import { Clock } from '@/services/Clock.js';
import type { ItemDetailProject } from '@/store/ItemDetailTypes.js';
import { ItemStore } from '@/store/ItemStore.js';
import { isPendingItem } from '@/store/isPendingItem.js';

import * as l from './useItemCommands.loc.js';

/** What {@link useItemCommands} builds the actions of. */
export interface ItemCommandsParams {
    /** The items they act on; read every time they are built. */
    readonly ids: () => readonly string[];
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
export function useItemCommands({ ids, section, open, merge }: ItemCommandsParams) {
    const t = useTranslate();
    const auth = useService(AuthStore);
    const items = useService(ItemStore);
    const repositories = useService(RepositoryStore);
    const editor = useService(ItemEditor);
    const navigation = useService(ItemNavigation);
    const clock = useService(Clock);
    const browser = useService(Browser);
    const router = useRouter();
    const merging = injectContext(MergeContext, { optional: true });
    const editCommands = useEditCommands();

    const selected = computed(() => ids().flatMap(id => items.get(id) ?? []));
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

    function getEditCommands(): Command[] {
        return editCommands({
            section: section(),
            items: selected.value,
            metadata: metadata.value,
            loading: metadata.value.length < repositoryNames.value.length,
            viewerLogin: auth.viewer?.login ?? '',
            getPermissions: item => editor.getPermissions(item),
            places: places.value,
            now: clock.now(),
            stateOptions: getStateOptions(),
            stateTitle: getStateTitle(),
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
    function getOwnCommands(): Command[] {
        const item = one.value;
        const own = section();
        const commands: Command[] = [
            {
                id: 'menu.openOnGitHub',
                title: t(l.openOnGitHub),
                section: own,
                key: 'O',
                icon: Github,
                detail: item ? undefined : t(l.tabs, { count: selected.value.length }),
                run: () => {
                    for (const candidate of selected.value) {
                        browser.openInNewTab(candidate.url);
                    }
                },
            },
            {
                id: 'menu.copyLink',
                title: item ? t(l.copyLink) : t(l.copyLinks),
                section: own,
                icon: Link,
                run: () => copy(selected.value.map(candidate => candidate.url).join('\n')),
            },
        ];
        if (selected.value.some(candidate => editor.getPermissions(candidate).addToProject)) {
            commands.push({
                id: 'menu.addToProject',
                title: t(l.addToProject),
                section: own,
                icon: SquareKanban,
                prepare: () => void repositories.ensureViewerProjects(),
                options: () => ({ loading: repositories.viewerProjects === null, options: getProjectOptions() }),
            });
        }

        if (!item || isPendingItem(item)) {
            return commands;
        }

        commands.push(
            { id: 'menu.open', title: t(l.open), section: own, key: 'Enter', icon: PanelRight, run: open },
            {
                id: 'menu.openPage',
                title: t(l.openPage),
                section: own,
                icon: Maximize2,
                run: () => void router.push(getItemPagePath(getItemReference(item), item.kind)),
            },
        );
        if (editor.getPermissions(item).comment) {
            commands.push({
                id: 'menu.comment',
                title: t(l.comment),
                section: own,
                key: EDIT_KEYS.comment,
                icon: MessageSquare,
                run: () => {
                    navigation.requestComment(item.id);
                    open();
                },
            });
        }

        if (item.kind === 'issue') {
            commands.push({
                id: 'menu.copyReference',
                title: t(l.copyReference),
                section: own,
                icon: Hash,
                detail: formatShortReference(item),
                run: () => copy(`${item.repository.nameWithOwner}#${item.number}`),
            });
        } else {
            commands.push(
                {
                    id: 'menu.openFiles',
                    title: t(l.openFiles),
                    section: own,
                    key: 'Shift+O',
                    icon: FileDiff,
                    run: () => browser.openInNewTab(`${item.url}/files`),
                },
                {
                    id: 'menu.copyBranch',
                    title: t(l.copyBranch),
                    section: own,
                    icon: GitBranch,
                    detail: item.headRefName,
                    run: () => copy(item.headRefName),
                },
            );
        }

        return commands;
    }

    /** What the submenu offers, and what the user may do there, read for every repository of the items as it opens. */
    function readingMetadata(command: Command): Command {
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

    /** Close the open ones — a pull request alone without a reason — or reopen them when all are closed. */
    function getStateOptions(): StateOption[] {
        const closable = selected.value.filter(item => editor.getPermissions(item).state);
        if (closable.length === 0) {
            return [];
        }

        if (closable.every(item => item.state !== 'OPEN')) {
            return [{ key: 'reopen', text: t(l.reopen), icon: RotateCcw, request: { kind: 'reopen' } }];
        }

        if (one.value?.kind === 'pullRequest') {
            return [
                {
                    key: 'close',
                    text: t(l.closePullRequest),
                    icon: GitPullRequestClosed,
                    request: { kind: 'close', reason: 'COMPLETED' },
                },
            ];
        }

        return [
            {
                key: 'completed',
                text: t(l.closeCompleted),
                icon: CircleCheckBig,
                request: { kind: 'close', reason: 'COMPLETED' },
            },
            {
                key: 'notPlanned',
                text: t(l.closeNotPlanned),
                icon: CircleSlash,
                request: { kind: 'close', reason: 'NOT_PLANNED' },
            },
        ];
    }

    function getStateTitle() {
        const item = one.value;
        if (selected.value.every(candidate => candidate.state !== 'OPEN')) {
            return t(l.reopen);
        }

        if (!item) {
            return t(l.closeItems, { count: selected.value.length });
        }

        return item.kind === 'issue' ? t(l.closeIssue) : t(l.closePullRequest);
    }

    /** The projects not every one of the items is in already. */
    function getProjectOptions(): CommandOption[] {
        return (repositories.viewerProjects ?? [])
            .filter(
                project =>
                    !project.closed &&
                    !selected.value.every(item => item.projects.some(place => place.projectId === project.id)),
            )
            .map(project => ({
                value: project.id,
                label: project.title,
                detail: project.owner,
                pick: () => edit({ kind: 'addToProject', project }),
            }));
    }

    function edit(request: EditRequest) {
        void editor.edit(ids(), request);
    }

    function copy(text: string) {
        void navigator.clipboard.writeText(text);
    }
}
