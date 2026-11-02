import type { MergeStateStatus } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
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
    LoaderCircle,
} from 'lucide-vue-next';
import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

import type { MergeCheckCounts } from '@/merge/countMergeChecks.js';
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
     * GitHub would merge it now. With the checks counted by whether they are required: none required failing or
     * running, and GitHub's status says the requirements are met. Before that, as the row holds it, so it shows
     * before anything is read: approved as "my work" says, or with no review required.
     */
    readonly mergeable: ComputedRef<boolean>;
}

/**
 * The verdict on a pull request — the opened item's merge standing and the merge panel say the same (PM38). From the
 * row's status summary (`getPullRequestStanding`, the same as "my work") until `checks` are read; then by which checks
 * are required (merging D13): one that isn't required, failing or running, does not stop the merge.
 */
export function usePullRequestVerdict(
    pr: MaybeRefOrGetter<PullRequestItem>,
    checks: MaybeRefOrGetter<MergeCheckCounts | null> = null,
): PullRequestVerdictViewModel {
    const t = useTranslate();
    /** The checks counted, while they decide: open, not a draft, and no conflicts (which hold it whatever they say). */
    const counted = computed(() => {
        const current = toValue(pr);
        const counts = toValue(checks);
        const open = current.state === 'OPEN' && !current.isDraft;
        return counts && open && !getPullRequestStanding(current).conflicts ? counts : null;
    });
    // Counted, the checks speak through the counts alone: the row's summary counts the ones not required too.
    const standing = computed(() => {
        const current = toValue(pr);
        return getPullRequestStanding(counted.value ? { ...current, checks: null } : current);
    });
    const mergeable = computed(() => {
        const current = toValue(pr);
        const counts = counted.value;
        if (counts) {
            return counts.requiredFailing + counts.requiredPending === 0 && isReadyState(current.mergeStateStatus);
        }

        const clean = current.mergeStateStatus === 'CLEAN' || current.mergeStateStatus === 'HAS_HOOKS';
        return (
            current.state === 'OPEN' &&
            (standing.value.readyToMerge ||
                (clean && !current.isDraft && current.reviewDecision === null && !standing.value.needsAuthor))
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

        const counts = counted.value;
        if (counts && counts.requiredFailing > 0) {
            const aside = t(l.requiredFailed, { count: counts.requiredFailing });
            return { tone: 'danger', icon: CircleX, text: t(l.cannotMerge), aside };
        }

        if (counts && counts.requiredPending > 0) {
            const running = t(l.requiredRunning, { count: counts.requiredPending });
            const aside = current.reviewDecision === 'APPROVED' ? `${running} · ${t(l.approved)}` : running;
            return { tone: 'warning', icon: LoaderCircle, text: t(l.cannotMerge), aside };
        }

        if (counts && mergeable.value) {
            return { tone: 'success', icon: CircleCheck, text: t(l.ready), aside: readyAside(current, counts) };
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

    /** Why it is ready, with the checks counted. */
    function readyAside(current: PullRequestItem, counts: MergeCheckCounts) {
        if (current.reviewDecision === 'APPROVED') {
            const allPassed = counts.otherFailing + counts.otherPending === 0;
            return allPassed ? t(l.readyDetail) : t(l.readyRequiredPassed);
        }

        return current.reviewDecision === null ? t(l.readyNoReview) : t(l.readyNoConflicts);
    }
}

/** What GitHub's status says when it would merge now: requirements met (an optional check may still fail). */
function isReadyState(status: MergeStateStatus) {
    switch (status) {
        case 'CLEAN':
        case 'HAS_HOOKS':
        case 'UNSTABLE':
            return true;
        case 'BEHIND':
        case 'BLOCKED':
        case 'DIRTY':
        case 'DRAFT':
        case 'UNKNOWN':
            return false;
        default:
            return assertNever(status);
    }
}
