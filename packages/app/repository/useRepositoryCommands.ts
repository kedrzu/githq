import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { CloudDownload, EyeOff, Settings } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

import { bindCommand } from '@/commands/bindCommand.js';
import type { Command } from '@/commands/CommandTypes.js';
import { copyLink, goToSection, newIssue, openOnGitHub } from '@/commands/definitions/index.js';
import { NewIssueComposer } from '@/newIssue/NewIssueComposer.js';
import { Browser } from '@/services/Browser.js';
import { PendingUntracks } from '@/tracking/PendingUntracks.js';
import { RepositoryTracker } from '@/tracking/RepositoryTracker.js';
import { getRepositoryPath, getRepositorySettingsPath, GITHUB_ORIGIN } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { REPOSITORY_SECTION_ICONS, REPOSITORY_SECTIONS } from './RepositorySection.js';
import * as l from './useRepositoryCommands.loc.js';

/** A repository's actions, by the name after `repository.`. */
export interface RepositoryCommands {
    /** Going to each of its sections (`goToSection`), in the order of the tabs. */
    readonly sections: readonly Command[];
    readonly newIssue: Command;
    readonly openOnGitHub: Command;
    readonly copyLink: Command;
    readonly settings: Command;
    readonly track: Command;
    readonly untrack: Command;
}

/** How {@link useRepositoryCommands} offers a repository's actions. */
export interface RepositoryCommandsOptions {
    /** Its sections carry their keys `1`–`4`: the repository is on screen, where they run. Default `false`. */
    readonly keyed?: boolean;
}

/**
 * The actions of a repository (`owner/name`): going to one of its sections (its issues, its pull requests,
 * its commits — tracked or not, git-client D11 — and its workflows only while it is tracked, actions D4), a new issue in
 * it, its page on GitHub and the link to it, its settings (T16) and no longer tracking it (both only while it is
 * tracked and not on its way out; untracking offers Undo, `PendingUntracks`), and tracking it (only while it is not, or is
 * on its way out, when it is Undo). All are of the `repository` section. The sidebar's menu of a
 * repository offers them by name, all but tracking it. In the command menu `AppCommands` makes of them the group of the
 * repository the screen belongs to and the level under any repository (D36), both with tracking it last (D34) and without
 * no longer tracking it (D32); the group, unlike the level, has no new issue (the app's "New issue" starts one there).
 */
export function useRepositoryCommands(): (
    nameWithOwner: string,
    options?: RepositoryCommandsOptions,
) => RepositoryCommands {
    const t = useTranslate();
    const router = useRouter();
    const tracking = useService(TrackingStore);
    const pending = useService(PendingUntracks);
    const tracker = useService(RepositoryTracker);
    const composer = useService(NewIssueComposer);
    const browser = useService(Browser);

    return (nameWithOwner, options = {}) => {
        const url = `${GITHUB_ORIGIN}/${nameWithOwner}`;
        const target = { kind: 'repository', nameWithOwner } as const;
        const isListed = () => tracking.isTracked(target) && !pending.isPending(target);
        return {
            sections: bindCommand(
                goToSection,
                REPOSITORY_SECTIONS.map(section => ({
                    place: 'repository',
                    title: t(l[section]),
                    section: 'repository',
                    icon: REPOSITORY_SECTION_ICONS[section],
                    keyed: options.keyed ? undefined : false,
                    // An untracked repository's workflows are not read (actions D4).
                    when: section === 'workflows' ? isListed : undefined,
                    run: () => void router.push(getRepositoryPath(nameWithOwner, section)),
                })),
                t,
            ),
            newIssue: bindCommand(
                newIssue,
                {
                    place: 'repository',
                    section: 'repository',
                    run: () => composer.start({ repository: nameWithOwner, project: null, parent: null }),
                },
                t,
            ),
            // Offered in menus only: `O` is what the keyboard is on, a row or an opened item, not the repository.
            openOnGitHub: bindCommand(
                openOnGitHub,
                {
                    place: 'repository',
                    section: 'repository',
                    keyed: false,
                    keywords: [nameWithOwner],
                    run: () => browser.openInNewTab(url),
                },
                t,
            ),
            copyLink: bindCommand(
                copyLink,
                { place: 'repository', section: 'repository', run: () => void navigator.clipboard.writeText(url) },
                t,
            ),
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
                // On its way out it reads as not tracked already: tracking it again is Undo.
                when: () => !isListed(),
                run: () => {
                    if (pending.isPending(target)) {
                        pending.undo(target);
                    } else {
                        void tracker.track(nameWithOwner);
                    }
                },
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
