import type { Translation } from '@nzyme/i18n-core';
import type { LucideIcon } from 'lucide-vue-next';
import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from 'lucide-vue-next';

import type { PullRequestItem } from '@/store/ItemTypes.js';

import * as l from './getPullRequestStateLook.loc.js';

/** How a pull request's state is drawn. */
export interface PullRequestStateLook {
    readonly icon: LucideIcon;
    /** `open` green, `done` purple (merged), `closed` red (closed unmerged), `draft` grey. */
    readonly tone: 'closed' | 'done' | 'draft' | 'open';
    /** The state's name, for whoever can't see the icon. */
    readonly label: Translation;
}

/**
 * A pull request's state as an icon, a tone and its name.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getPullRequestStateLook(pullRequest: PullRequestItem): PullRequestStateLook {
    if (pullRequest.merged) {
        return { icon: GitMerge, tone: 'done', label: l.merged };
    }

    if (pullRequest.state !== 'OPEN') {
        return { icon: GitPullRequestClosed, tone: 'closed', label: l.closed };
    }

    return pullRequest.isDraft
        ? { icon: GitPullRequestDraft, tone: 'draft', label: l.draft }
        : { icon: GitPullRequest, tone: 'open', label: l.open };
}
