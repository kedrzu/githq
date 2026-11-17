import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { EyeOff, Settings } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { bindCommand } from '@/commands/bindCommand.js';
import type { Command } from '@/commands/CommandTypes.js';
import { copyLink, goToView, newIssue, openOnGitHub } from '@/commands/definitions/index.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { Browser } from '@/services/Browser.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import type { ProjectAddress } from '@/tracking/trackingRoutes.js';
import { getProjectPath, getProjectSettingsPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { ProjectStore } from './ProjectStore.js';
import * as l from './useProjectCommands.loc.js';

/** A project's actions, by the name after `project.`. */
export interface ProjectCommands {
    /**
     * Going to each of its saved views (`goToView`), in its order, as the command menu's level under the project lists
     * them; the first nine on `1`–`9` when `keyed` (they run only while the project is on screen).
     */
    readonly savedViews: readonly SavedViewCommand[];
    readonly newIssue: Command;
    readonly openOnGitHub: Command;
    readonly copyLink: Command;
    readonly settings: Command;
    readonly untrack: Command;
}

/** Going to a saved view, with the view it goes to: a view is picked by its id, not by where it stands. */
export interface SavedViewCommand {
    /** The view's node id. */
    readonly viewId: string;
    readonly command: Command;
}

/** How a project's actions are offered. */
export interface ProjectCommandsOptions {
    /** Its saved views carry their keys `1`–`9`: the project is on screen, where they run. Default `false`. */
    readonly keyed?: boolean;
}

/** A project as its actions need it: its address, and its id once it is known (tracked). */
export interface ProjectCommandsTarget extends ProjectAddress {
    readonly id: string | null;
}

/**
 * The actions of a project: going to one of its saved views, one action each, a new issue in it (where the user may add
 * one), its page on GitHub and the link to it, its settings (T17) and no longer tracking it (both only while it is tracked
 * and not on its way out; untracking offers Undo, `PendingUntracks`). The sidebar's
 * menu of a project offers them all; the project's view offers its page on GitHub in the command menu, and the menu's
 * level under a tracked project (D36) its saved views, a new issue, the page, the link and the settings; on a phone the
 * project's view offers its saved views first from the command line (mobile D17).
 */
export function useProjectCommands(): (
    target: ProjectCommandsTarget,
    options?: ProjectCommandsOptions,
) => ProjectCommands {
    const t = useTranslate();
    const router = useRouter();
    const tracking = useService(TrackingStore);
    const pending = useService(PendingUntracks);
    const projects = useService(ProjectStore);
    const composer = useService(NewIssueComposer);
    const browser = useService(Browser);

    return (target, options = {}) => {
        const path = getProjectPath(target);
        const url = `${GITHUB_ORIGIN}${path}`;
        const project = () => (target.id === null ? undefined : projects.get(target.id));
        const isListed = () =>
            target.id !== null &&
            tracking.isTracked({ kind: 'project', id: target.id }) &&
            !pending.isPending({ kind: 'project', id: target.id });
        return {
            savedViews: getSavedViews(),
            newIssue: bindCommand(
                newIssue,
                {
                    place: 'project',
                    section: 'view',
                    when: () => project()?.viewerCanUpdate ?? false,
                    run: () => {
                        const current = project();
                        if (current) {
                            composer.start({
                                repository: null,
                                project: { projectId: current.id, title: current.title, values: [] },
                                parent: null,
                            });
                        }
                    },
                },
                t,
            ),
            // Offered in menus only: `O` is what the keyboard is on, a row or an opened item, not the project.
            openOnGitHub: bindCommand(
                openOnGitHub,
                { place: 'project', section: 'view', keyed: false, run: () => browser.openInNewTab(url) },
                t,
            ),
            copyLink: bindCommand(
                copyLink,
                { place: 'project', section: 'view', run: () => void navigator.clipboard.writeText(url) },
                t,
            ),
            settings: {
                id: 'project.settings',
                title: t(l.settings),
                section: 'view',
                icon: Settings,
                when: isListed,
                run: () => void router.push(getProjectSettingsPath(target)),
            },
            untrack: {
                id: 'project.untrack',
                title: t(l.untrack),
                section: 'view',
                icon: EyeOff,
                when: isListed,
                run: () => {
                    const tracked = tracking.projects.find(candidate => candidate.id === target.id);
                    if (tracked) {
                        pending.untrack({ kind: 'project', id: tracked.id }, tracked.title);
                    }
                },
            },
        };

        function getSavedViews(): SavedViewCommand[] {
            const views = project()?.views ?? [];
            const commands = bindCommand(
                goToView,
                views.map(view => ({
                    title: view.name,
                    detail: t(l.savedView),
                    section: 'view',
                    keyed: options.keyed ? undefined : false,
                    run: () => void router.push(getProjectPath(target, view.number)),
                })),
                t,
            );
            // One command per view, in its order: no binding is null.
            return views.flatMap((view, index) => {
                const command = commands[index];
                return command ? [{ viewId: view.id, command }] : [];
            });
        }
    };
}
