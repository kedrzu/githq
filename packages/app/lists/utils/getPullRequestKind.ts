import { GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

import type { StatePillTone } from '@/components/StatePill.vue';
import type { PullRequestItem } from '@/store/ItemTypes.js';

/** A pull request's kind and state as its icon, in GitHub's colour: merged, closed unmerged, draft or open. */
export interface PullRequestKind {
    readonly icon: LucideIcon;
    /** `done` merged, `closed` closed unmerged, `draft`, `open`. */
    readonly tone: StatePillTone;
}

/**
 * The icon a pull request is drawn with — a list's row, the opened item's state, the merge panel's header.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getPullRequestKind(pr: Pick<PullRequestItem, 'isDraft' | 'merged' | 'state'>): PullRequestKind {
    if (pr.merged) {
        return { icon: GitMerge, tone: 'done' };
    }

    if (pr.state !== 'OPEN') {
        return { icon: GitPullRequestClosed, tone: 'closed' };
    }

    return pr.isDraft ? { icon: GitPullRequestDraft, tone: 'draft' } : { icon: GitPullRequest, tone: 'open' };
}
