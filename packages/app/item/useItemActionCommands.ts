import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';

import { bindCommand } from '@/commands/bindCommand.js';
import type { BoundCommand } from '@/commands/CommandTypes.js';
import { addToProject, copyBranch, copyLink, copyReference, openFiles } from '@/commands/definitions/index.js';
import type { ViewerProject } from '@/repos/RepositoryTypes.js';
import { Browser } from '@/services/Browser.js';
import type { Item } from '@/store/ItemTypes.js';

import { getAddableProjects } from './getAddableProjects.js';
import { formatShortReference } from './itemRoutes.js';
import * as l from './useItemActionCommands.loc.js';

/** Where the actions sit: the opened item's own, or a list's row or items. */
type ItemActionSection = 'item' | 'selection';

/** What {@link ItemActionCommands.addToProject} offers and does. */
export interface AddToProjectParams {
    readonly section: ItemActionSection;
    /** The items added. */
    readonly items: readonly Item[];
    /** The viewer's projects, read as the submenu shows them; `null` while being read. */
    projects(): readonly ViewerProject[] | null;
    /** Asks for the viewer's projects as the submenu opens. */
    prepare(): void;
    /** Adds every one of the items to the project. */
    add(project: ViewerProject): void;
}

/** The actions built by {@link useItemActionCommands}. */
export interface ItemActionCommands {
    /** "Copy link" of one item, "Copy links" of several, one address per line. */
    copyLink(items: readonly Item[], section: ItemActionSection): BoundCommand;
    /** "Add to project…": a submenu of the viewer's open projects not every one of the items is in already. */
    addToProject(params: AddToProjectParams): BoundCommand;
    /**
     * "Copy reference" (`owner/name#123`), and of a pull request its changed files on GitHub and "Copy branch name". The
     * item menus' layout decides which of them a menu shows (`getItemMenuSections`): a pull request's has no reference.
     */
    kindCommands(item: Item, section: ItemActionSection): BoundCommand[];
}

/**
 * The actions an opened item (its item menu) and a list's row (its context menu) offer alike, built once so the two
 * never say or do them differently.
 */
export function useItemActionCommands(): ItemActionCommands {
    const t = useTranslate();
    const browser = useService(Browser);

    return { copyLink: copyLinkCommand, addToProject: addToProjectCommand, kindCommands };

    function copyLinkCommand(items: readonly Item[], section: ItemActionSection) {
        return bindCommand(
            copyLink,
            {
                place: 'item',
                section,
                title: items.length > 1 ? t(l.copyLinks) : undefined,
                run: () => copy(items.map(item => item.url).join('\n')),
            },
            t,
        );
    }

    function addToProjectCommand(params: AddToProjectParams) {
        return bindCommand(
            addToProject,
            {
                section: params.section,
                prepare: () => params.prepare(),
                options: () => {
                    const projects = params.projects();
                    return {
                        loading: projects === null,
                        options: getAddableProjects(
                            projects ?? [],
                            params.items.map(item => item.projects),
                        ).map(project => ({
                            value: project.id,
                            label: project.title,
                            detail: project.owner,
                            pick: () => params.add(project),
                        })),
                    };
                },
            },
            t,
        );
    }

    function kindCommands(item: Item, section: ItemActionSection): BoundCommand[] {
        const reference = bindCommand(
            copyReference,
            {
                section,
                detail: formatShortReference(item),
                run: () => copy(`${item.repository.nameWithOwner}#${item.number}`),
            },
            t,
        );
        if (item.kind === 'issue') {
            return [reference];
        }

        return [
            reference,
            bindCommand(openFiles, { section, run: () => browser.openInNewTab(`${item.url}/files`) }, t),
            bindCommand(copyBranch, { section, detail: item.headRefName, run: () => copy(item.headRefName) }, t),
        ];
    }

    function copy(text: string) {
        void navigator.clipboard.writeText(text);
    }
}
