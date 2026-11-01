import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowRight, EyeOff, Github, LayoutList, Link, SquarePen } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import type { ProjectAddress } from '@/tracking/trackingRoutes.js';
import { getProjectPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { ProjectStore } from './ProjectStore.js';
import * as l from './useProjectCommands.loc.js';

/** A project's actions, by the name after `project.`. */
export interface ProjectCommands {
    readonly open: Command;
    readonly views: Command;
    readonly newIssue: Command;
    readonly openOnGitHub: Command;
    readonly copyLink: Command;
    readonly untrack: Command;
}

/** A project as its actions need it: its address, and its id once it is known (tracked). */
export interface ProjectCommandsTarget extends ProjectAddress {
    readonly id: string | null;
}

/**
 * The actions of a project: going to its view or one of its saved views, a new issue in it (where the user may add
 * one), its page on GitHub and the link to it, and no longer tracking it (only while it is tracked). The sidebar's
 * menu of a project offers them all; the project's view offers its page on GitHub in the command menu.
 */
export function useProjectCommands(): (target: ProjectCommandsTarget) => ProjectCommands {
    const t = useTranslate();
    const router = useRouter();
    const tracking = useService(TrackingStore);
    const projects = useService(ProjectStore);
    const composer = useService(NewIssueComposer);

    return target => {
        const path = getProjectPath(target);
        const url = `${GITHUB_ORIGIN}${path}`;
        const project = () => (target.id === null ? undefined : projects.get(target.id));
        return {
            open: {
                id: 'project.open',
                title: t(l.open),
                section: 'view',
                icon: ArrowRight,
                run: () => void router.push(path),
            },
            views: {
                id: 'project.views',
                title: t(l.views),
                section: 'view',
                icon: LayoutList,
                when: () => (project()?.views.length ?? 0) > 0,
                options: () => ({
                    options: (project()?.views ?? []).map(view => ({
                        value: view.id,
                        label: view.name,
                        pick: () => void router.push(getProjectPath(target, view.number)),
                    })),
                }),
            },
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
                run: () => void window.open(url, '_blank', 'noopener,noreferrer'),
            },
            copyLink: {
                id: 'project.copyLink',
                title: t(l.copyLink),
                section: 'view',
                icon: Link,
                run: () => void navigator.clipboard.writeText(url),
            },
            untrack: {
                id: 'project.untrack',
                title: t(l.untrack),
                section: 'view',
                icon: EyeOff,
                when: () => target.id !== null && tracking.isTracked({ kind: 'project', id: target.id }),
                run: () => {
                    if (target.id !== null) {
                        tracking.untrack({ kind: 'project', id: target.id });
                    }
                },
            },
        };
    };
}
