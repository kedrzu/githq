import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { Eye, EyeOff, Github, Link, Settings, SquarePen } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { Browser } from '@/services/Browser.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import type { ProjectAddress } from '@/tracking/trackingRoutes.js';
import { getProjectPath, getProjectSettingsPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { ProjectStore } from './ProjectStore.js';
import * as l from './useProjectCommands.loc.js';

/** How many of a project's saved views have a key, `1` to `9`: a tenth and later have none. */
const SAVED_VIEW_KEYS = 9;

/** A project's actions, by the name after `project.`. */
export interface ProjectCommands {
    /**
     * Going to each of its saved views (`view:<id>`), as the command menu's level under the project lists them; the first
     * nine on `1`–`9`, which run only while the project is on screen — any other menu leaves them out.
     */
    readonly savedViews: readonly Command[];
    readonly newIssue: Command;
    readonly openOnGitHub: Command;
    readonly copyLink: Command;
    readonly settings: Command;
    readonly untrack: Command;
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
export function useProjectCommands(): (target: ProjectCommandsTarget) => ProjectCommands {
    const t = useTranslate();
    const router = useRouter();
    const tracking = useService(TrackingStore);
    const pending = useService(PendingUntracks);
    const projects = useService(ProjectStore);
    const composer = useService(NewIssueComposer);
    const browser = useService(Browser);

    return target => {
        const path = getProjectPath(target);
        const url = `${GITHUB_ORIGIN}${path}`;
        const project = () => (target.id === null ? undefined : projects.get(target.id));
        const isListed = () =>
            target.id !== null &&
            tracking.isTracked({ kind: 'project', id: target.id }) &&
            !pending.isPending({ kind: 'project', id: target.id });
        return {
            savedViews: (project()?.views ?? []).map((view, index) => ({
                id: `view:${view.id}`,
                title: view.name,
                detail: t(l.savedView),
                icon: Eye,
                section: 'view',
                key: index < SAVED_VIEW_KEYS ? String(index + 1) : undefined,
                run: () => void router.push(getProjectPath(target, view.number)),
            })),
            newIssue: {
                id: 'project.newIssueHere',
                title: t(l.newIssue),
                section: 'view',
                icon: SquarePen,
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
            openOnGitHub: {
                id: 'project.openOnGitHub',
                title: t(l.openOnGitHub),
                section: 'view',
                icon: Github,
                run: () => browser.openInNewTab(url),
            },
            copyLink: {
                id: 'project.copyLink',
                title: t(l.copyLink),
                section: 'view',
                icon: Link,
                run: () => void navigator.clipboard.writeText(url),
            },
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
    };
}
