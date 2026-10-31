import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowRight, CircleDot, EyeOff, GitPullRequest, Github, Link, SquarePen } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { getRepositoryPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import * as l from './useRepositoryCommands.loc.js';

/** A repository's actions, by the name after `repository.`. */
export interface RepositoryCommands {
    readonly open: Command;
    readonly issues: Command;
    readonly pullRequests: Command;
    readonly newIssue: Command;
    readonly openOnGitHub: Command;
    readonly copyLink: Command;
    readonly untrack: Command;
}

/**
 * The actions of a repository (`owner/name`): going to its view or one kind of its items, a new issue in it, its
 * page on GitHub and the link to it, and no longer tracking it (only while it is tracked). The sidebar's menu of a
 * repository offers them all; the repository's view offers its page on GitHub in the command menu.
 */
export function useRepositoryCommands(): (nameWithOwner: string) => RepositoryCommands {
    const t = useTranslate();
    const router = useRouter();
    const tracking = useService(TrackingStore);
    const composer = useService(NewIssueComposer);

    return nameWithOwner => {
        const url = `${GITHUB_ORIGIN}/${nameWithOwner}`;
        return {
            open: {
                id: 'repository.open',
                title: t(l.open),
                section: 'view',
                icon: ArrowRight,
                run: () => void router.push(getRepositoryPath(nameWithOwner)),
            },
            issues: {
                id: 'repository.issues',
                title: t(l.issues),
                section: 'view',
                icon: CircleDot,
                run: () => void router.push(getRepositoryPath(nameWithOwner, 'issues')),
            },
            pullRequests: {
                id: 'repository.pullRequests',
                title: t(l.pullRequests),
                section: 'view',
                icon: GitPullRequest,
                run: () => void router.push(getRepositoryPath(nameWithOwner, 'pullRequests')),
            },
            newIssue: {
                id: 'repository.newIssue',
                title: t(l.newIssue),
                section: 'view',
                icon: SquarePen,
                run: () => composer.start({ repository: nameWithOwner, project: null, parent: null }),
            },
            openOnGitHub: {
                id: 'repository.openOnGitHub',
                title: t(l.openOnGitHub),
                section: 'view',
                icon: Github,
                keywords: [nameWithOwner],
                run: () => void window.open(url, '_blank', 'noopener,noreferrer'),
            },
            copyLink: {
                id: 'repository.copyLink',
                title: t(l.copyLink),
                section: 'view',
                icon: Link,
                run: () => void navigator.clipboard.writeText(url),
            },
            untrack: {
                id: 'repository.untrack',
                title: t(l.untrack),
                section: 'view',
                icon: EyeOff,
                when: () => tracking.isTracked({ kind: 'repository', nameWithOwner }),
                run: () => tracking.untrack({ kind: 'repository', nameWithOwner }),
            },
        };
    };
}
