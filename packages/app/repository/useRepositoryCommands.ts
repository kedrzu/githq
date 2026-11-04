import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import {
    ArrowRight,
    CircleDot,
    CloudDownload,
    EyeOff,
    GitPullRequest,
    Github,
    Link,
    Settings,
    SquarePen,
    Workflow,
} from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { Browser } from '@/services/Browser.js';
import { RepositoryTracker } from '@/tracking/RepositoryTracker.js';
import { getRepositoryPath, getRepositorySettingsPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { LastRepositoryTab } from './LastRepositoryTab.js';
import * as l from './useRepositoryCommands.loc.js';

/** A repository's actions, by the name after `repository.`. */
export interface RepositoryCommands {
    readonly open: Command;
    readonly issues: Command;
    readonly pullRequests: Command;
    readonly workflows: Command;
    readonly newIssue: Command;
    readonly openOnGitHub: Command;
    readonly copyLink: Command;
    readonly settings: Command;
    readonly track: Command;
    readonly untrack: Command;
}

/**
 * The actions of a repository (`owner/name`): going to its view or one of its sections (its issues, its pull requests,
 * and its workflows only while it is tracked, actions D4), a new issue in it, its page on GitHub and the link to it, its
 * settings (T16) and no longer tracking it (both only while it is tracked), and tracking it (only while it is not). The
 * sidebar's menu of a repository offers them all but tracking it; the repository's view offers its page on GitHub and
 * tracking it or no longer tracking it in the command menu (D32).
 */
export function useRepositoryCommands(): (nameWithOwner: string) => RepositoryCommands {
    const t = useTranslate();
    const router = useRouter();
    const tracking = useService(TrackingStore);
    const tracker = useService(RepositoryTracker);
    const composer = useService(NewIssueComposer);
    const browser = useService(Browser);
    const tabs = useService(LastRepositoryTab);

    return nameWithOwner => {
        const url = `${GITHUB_ORIGIN}/${nameWithOwner}`;
        return {
            open: {
                id: 'repository.open',
                title: t(l.open),
                section: 'view',
                icon: ArrowRight,
                run: () => void router.push(tabs.getPath(nameWithOwner)),
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
            workflows: {
                id: 'repository.workflows',
                title: t(l.workflows),
                section: 'view',
                icon: Workflow,
                when: () => tracking.isTracked({ kind: 'repository', nameWithOwner }),
                run: () => void router.push(getRepositoryPath(nameWithOwner, 'workflows')),
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
                run: () => browser.openInNewTab(url),
            },
            copyLink: {
                id: 'repository.copyLink',
                title: t(l.copyLink),
                section: 'view',
                icon: Link,
                run: () => void navigator.clipboard.writeText(url),
            },
            settings: {
                id: 'repository.settings',
                title: t(l.settings),
                section: 'view',
                icon: Settings,
                when: () => tracking.isTracked({ kind: 'repository', nameWithOwner }),
                run: () => void router.push(getRepositorySettingsPath(nameWithOwner)),
            },
            track: {
                id: 'repository.track',
                title: t(l.track),
                detail: t(l.trackDetail),
                section: 'view',
                icon: CloudDownload,
                when: () => !tracking.isTracked({ kind: 'repository', nameWithOwner }),
                run: () => void tracker.track(nameWithOwner),
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
