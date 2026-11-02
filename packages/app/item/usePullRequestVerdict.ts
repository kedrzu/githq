import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
    CircleCheck,
    CircleX,
    GitMerge,
    GitPullRequestClosed,
    GitPullRequestDraft,
    Hourglass,
    Loader,
} from 'lucide-vue-next';
import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import * as l from './usePullRequestVerdict.loc.js';

/** How a verdict on a pull request is coloured. */
export type PullRequestVerdictTone = 'danger' | 'done' | 'muted' | 'success' | 'warning';

/** Where a pull request stands, in one line: "Ready to merge", "Can't merge yet · 2 checks failing". */
export interface PullRequestVerdict {
    readonly tone: PullRequestVerdictTone;
    readonly icon: LucideIcon;
    readonly text: string;
    /** Quieter text after it: what holds it back, or why it is ready. */
    readonly aside: string | null;
}

/** A pull request's verdict, and whether it reads ready to merge. */
export interface PullRequestVerdictViewModel {
    readonly verdict: ComputedRef<PullRequestVerdict>;
    /**
     * Approved as "my work" says, or with no review required, and GitHub would merge it now — as the row holds it,
     * so it shows before anything is read.
     */
    readonly mergeable: ComputedRef<boolean>;
}

/**
 * The verdict on a pull request from its row's status summary (`getPullRequestStanding`, the same as "my work"):
 * what the opened item's merge standing heads with, and the merge panel until its own read says more.
 */
export function usePullRequestVerdict(pr: MaybeRefOrGetter<PullRequestItem>): PullRequestVerdictViewModel {
    const t = useTranslate();
    const standing = computed(() => getPullRequestStanding(toValue(pr)));
    const mergeable = computed(() => {
        const current = toValue(pr);
        const clean = current.mergeStateStatus === 'CLEAN' || current.mergeStateStatus === 'HAS_HOOKS';
        return (
            standing.value.readyToMerge ||
            (clean && !current.isDraft && current.reviewDecision === null && !standing.value.needsAuthor)
        );
    });

    const verdict = computed((): PullRequestVerdict => {
        const current = toValue(pr);
        const now = standing.value;
        if (current.merged) {
            return { tone: 'done', icon: GitMerge, text: t(l.merged), aside: null };
        }

        if (current.state !== 'OPEN') {
            return { tone: 'danger', icon: GitPullRequestClosed, text: t(l.closedUnmerged), aside: null };
        }

        // Never merged until GitHub says so (merging D3, PM33).
        if (current.merging) {
            return { tone: 'warning', icon: Loader, text: t(l.beingMerged), aside: t(l.beingMergedDetail) };
        }

        if (current.isDraft) {
            return { tone: 'muted', icon: GitPullRequestDraft, text: t(l.draft), aside: t(l.draftDetail) };
        }

        if (now.needsAuthor) {
            const parts: string[] = [];
            if (now.checksFailing) {
                parts.push(
                    now.failingChecks > 0
                        ? t(l.checksFailing, { count: now.failingChecks })
                        : t(l.checksFailingUncounted),
                );
            }

            if (now.changesRequested) {
                parts.push(t(l.changesRequested));
            }

            if (now.conflicts) {
                parts.push(t(l.conflicts));
            }

            return { tone: 'danger', icon: CircleX, text: t(l.cannotMerge), aside: parts.join(' · ') };
        }

        if (mergeable.value) {
            return {
                tone: 'success',
                icon: CircleCheck,
                text: t(l.ready),
                aside: now.readyToMerge ? t(l.readyDetail) : t(l.readyNoReview),
            };
        }

        const parts: string[] = [];
        if (now.checksRunning) {
            parts.push(t(l.checksRunning));
        }

        if (now.waitingForReview) {
            parts.push(t(l.waitingForReview));
        }

        if (parts.length === 0) {
            if (current.mergeStateStatus === 'BEHIND') {
                parts.push(t(l.behind, { base: current.baseRefName }));
            } else if (current.mergeStateStatus === 'BLOCKED') {
                parts.push(t(l.blocked));
            }
        }

        return { tone: 'warning', icon: Hourglass, text: t(l.notReady), aside: parts.join(' · ') || null };
    });

    return { verdict, mergeable };
}
