import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { ArrowRight, CloudDownload, EyeOff, Github, Link, Settings, SquarePen } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import type { Command } from '@/commands/CommandTypes.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { Browser } from '@/services/Browser.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { RepositoryTracker } from '@/tracking/RepositoryTracker.js';
import { getRepositoryPath, getRepositorySettingsPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { LastRepositoryTab } from './LastRepositoryTab.js';
import { REPOSITORY_SECTION_ICONS } from './RepositorySection.js';
import * as l from './useRepositoryCommands.loc.js';

/** A repository's actions, by the name after `repository.`. */
export interface RepositoryCommands {
    readonly open: Command;
    readonly issues: Command;
    readonly pullRequests: Command;
    readonly commits: Command;
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
 * its commits — tracked or not, git-client D11 — and its workflows only while it is tracked, actions D4), a new issue in
 * it, its page on GitHub and the link to it, its settings (T16) and no longer tracking it (both only while it is
 * tracked and not on its way out; untracking offers Undo, `PendingUntracks`), and tracking it (only while it is not). All are of the `repository` section. The sidebar's menu of a
 * repository offers them by name, all but tracking it. In the command menu `AppCommands` makes of them the group of the
 * repository the screen belongs to and the level under any repository (D36), both with tracking it last (D34) and without
 * no longer tracking it (D32); the group, unlike the level, has no new issue (`C` starts one there).
 */
export function useRepositoryCommands(): (nameWithOwner: string) => RepositoryCommands {
    const t = useTranslate();
    const router = useRouter();
    const tracking = useService(TrackingStore);
    const pending = useService(PendingUntracks);
    const tracker = useService(RepositoryTracker);
    const composer = useService(NewIssueComposer);
    const browser = useService(Browser);
    const tabs = useService(LastRepositoryTab);

    return nameWithOwner => {
        const url = `${GITHUB_ORIGIN}/${nameWithOwner}`;
        const target = { kind: 'repository', nameWithOwner } as const;
        const isListed = () => tracking.isTracked(target) && !pending.isPending(target);
        return {
            open: {
                id: 'repository.open',
                title: t(l.open),
                section: 'repository',
                icon: ArrowRight,
                run: () => void router.push(tabs.getPath(nameWithOwner)),
            },
            issues: {
                id: 'repository.issues',
                title: t(l.issues),
                section: 'repository',
                icon: REPOSITORY_SECTION_ICONS.issues,
                run: () => void router.push(getRepositoryPath(nameWithOwner, 'issues')),
            },
            pullRequests: {
                id: 'repository.pullRequests',
                title: t(l.pullRequests),
                section: 'repository',
                icon: REPOSITORY_SECTION_ICONS.pullRequests,
                run: () => void router.push(getRepositoryPath(nameWithOwner, 'pullRequests')),
            },
            commits: {
                id: 'repository.commits',
                title: t(l.commits),
                section: 'repository',
                icon: REPOSITORY_SECTION_ICONS.commits,
                run: () => void router.push(getRepositoryPath(nameWithOwner, 'commits')),
            },
            workflows: {
                id: 'repository.workflows',
                title: t(l.workflows),
                section: 'repository',
                icon: REPOSITORY_SECTION_ICONS.workflows,
                when: () => tracking.isTracked({ kind: 'repository', nameWithOwner }),
                run: () => void router.push(getRepositoryPath(nameWithOwner, 'workflows')),
            },
            newIssue: {
                id: 'repository.newIssue',
                title: t(l.newIssue),
                section: 'repository',
                icon: SquarePen,
                run: () => composer.start({ repository: nameWithOwner, project: null, parent: null }),
            },
            openOnGitHub: {
                id: 'repository.openOnGitHub',
                title: t(l.openOnGitHub),
                section: 'repository',
                icon: Github,
                keywords: [nameWithOwner],
                run: () => browser.openInNewTab(url),
            },
            copyLink: {
                id: 'repository.copyLink',
                title: t(l.copyLink),
                section: 'repository',
                icon: Link,
                run: () => void navigator.clipboard.writeText(url),
            },
            settings: {
                id: 'repository.settings',
                title: t(l.settings),
                section: 'repository',
                icon: Settings,
                when: isListed,
                run: () => void router.push(getRepositorySettingsPath(nameWithOwner)),
            },
            track: {
                id: 'repository.track',
                title: t(l.track),
                detail: t(l.trackDetail),
                section: 'repository',
                icon: CloudDownload,
                when: () => !tracking.isTracked({ kind: 'repository', nameWithOwner }),
                run: () => void tracker.track(nameWithOwner),
            },
            untrack: {
                id: 'repository.untrack',
                title: t(l.untrack),
                section: 'repository',
                icon: EyeOff,
                when: isListed,
                run: () => pending.untrack(target, nameWithOwner),
            },
        };
    };
}
