import type { MergeStateStatus } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { LucideIcon } from 'lucide-vue-next';
import {
    CircleCheck,
    CircleDashed,
    CircleX,
    GitBranch,
    GitMerge,
    GitPullRequestClosed,
    GitPullRequestDraft,
    Hourglass,
    Loader,
    LoaderCircle,
} from 'lucide-vue-next';
import { computed, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import type { MergeCheckCounts } from '@/merge/countMergeChecks.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestStanding } from '@/store/getPullRequestStanding.js';
import { isMergeabilityUnknown } from '@/store/isMergeabilityUnknown.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { capitalize } from '@/utils/capitalize.js';

import * as l from './usePullRequestVerdict.loc.js';

/** How a verdict on a pull request is coloured. */
export type PullRequestVerdictTone = 'danger' | 'done' | 'muted' | 'success' | 'warning';

/**
 * The way forward of where a pull request stands (merging D12): what `⌘↵` does in the merge panel, and what the
 * standing's "Merge…" says it leads to (PM38) — merge it, mark it ready for review, bring the base branch in, or
 * resolve its conflicts in GitHub's editor. Never anything costlier.
 */
export type PullRequestWayForward = 'markReady' | 'merge' | 'resolveConflicts' | 'updateBranch';

/** Where a pull request stands, in one line: "Ready to merge", "Can't merge yet · 2 checks failing". */
export interface PullRequestVerdict {
    readonly tone: PullRequestVerdictTone;
    readonly icon: LucideIcon;
    readonly text: string;
    /** Quieter text after it: what holds it back, or why it is ready. */
    readonly aside: string | null;
}

/** A pull request's verdict, whether it reads ready to merge, and the way forward from there. */
export interface PullRequestVerdictViewModel {
    readonly verdict: PullRequestVerdict;
    /**
     * GitHub would merge it now. With the checks counted by whether they are required: none required failing or
     * running, and GitHub's status says the requirements are met. Before that, as the row holds it, so it shows
     * before anything is read: approved as "my work" says, or with no review required.
     */
    readonly mergeable: boolean;
    /**
     * The way forward; `null` when there is none — merged, closed, being merged, or held by what only others or the
     * author can change (PM13). Merging is the way forward while GitHub is still working out whether it merges
     * (PM22): GitHub enforces it, and refuses what it would not merge.
     */
    readonly forward: PullRequestWayForward | null;
    /**
     * What `⇧M` says it leads to, wherever it is offered: "Merge…", "Mark ready…", "Update branch", "Resolve on
     * GitHub" — "Merge…" with no way forward too, as it opens the panel all the same.
     */
    readonly forwardTitle: string;
}

interface Standing {
    readonly verdict: PullRequestVerdict;
    readonly forward: PullRequestWayForward | null;
}

/**
 * The verdict on a pull request and its way forward — the opened item's merge standing and the merge panel say the
 * same (PM38). From the row's status summary (`getPullRequestStanding`, the same as "my work") until `checks` are
 * read; then by which checks are required (merging D13): one that isn't required, failing or running, does not stop
 * the merge.
 */
export function usePullRequestVerdict(
    pr: MaybeRefOrGetter<PullRequestItem>,
    checks: MaybeRefOrGetter<MergeCheckCounts | null> = null,
): PullRequestVerdictViewModel {
    const getVerdict = usePullRequestVerdicts();
    const decided = computed(() => getVerdict(toValue(pr), toValue(checks)));

    return reactive<PullRequestVerdictViewModel>({
        verdict: computed(() => decided.value.verdict),
        mergeable: computed(() => decided.value.mergeable),
        forward: computed(() => decided.value.forward),
        forwardTitle: computed(() => decided.value.forwardTitle),
    });
}

/**
 * {@link usePullRequestVerdict} for any pull request, read once: what a command built for one (`⇧M`'s title) says,
 * the same as its standing.
 */
export function usePullRequestVerdicts(): (
    pr: PullRequestItem,
    checks: MergeCheckCounts | null,
) => PullRequestVerdictViewModel {
    const t = useTranslate();

    return (pr, checks) => {
        // The checks counted, while they decide: open, not a draft, and no conflicts (which hold it whatever they say).
        const open = pr.state === 'OPEN' && !pr.isDraft;
        const counts = checks && open && !getPullRequestStanding(pr).conflicts ? checks : null;
        // Counted, the checks speak through the counts alone: the row's summary counts the ones not required too.
        const now = getPullRequestStanding(counts ? { ...pr, checks: null } : pr);
        const mergeable = isMergeable(pr, now, counts);
        const { verdict, forward } = decide(pr, now, counts, mergeable);
        return { verdict, mergeable, forward, forwardTitle: getForwardTitle(forward) };
    };

    function decide(
        current: PullRequestItem,
        now: PullRequestStanding,
        counts: MergeCheckCounts | null,
        mergeable: boolean,
    ): Standing {
        if (current.merged) {
            return held({ tone: 'done', icon: GitMerge, text: t(l.merged), aside: null });
        }

        if (current.state !== 'OPEN') {
            return held({ tone: 'danger', icon: GitPullRequestClosed, text: t(l.closedUnmerged), aside: null });
        }

        // Never merged until GitHub says so (merging D3, PM33).
        if (current.merging) {
            return held({ tone: 'warning', icon: Loader, text: t(l.beingMerged), aside: t(l.beingMergedDetail) });
        }

        // One step before anything else (PM21).
        if (current.isDraft) {
            const verdict: PullRequestVerdict = {
                tone: 'muted',
                icon: GitPullRequestDraft,
                text: t(l.draft),
                aside: t(l.draftDetail),
            };
            return { verdict, forward: 'markReady' };
        }

        // Resolved in GitHub's editor, whatever else holds it (PM19).
        if (now.conflicts) {
            const aside = sentence([t(l.conflictsWith, { base: current.baseRefName }), ...authorParts(now)]);
            return {
                verdict: { tone: 'danger', icon: CircleX, text: t(l.conflicted), aside },
                forward: 'resolveConflicts',
            };
        }

        if (counts && counts.requiredFailing > 0) {
            const failed = t(l.requiredFailed, { count: counts.requiredFailing });
            const aside = sentence(now.changesRequested ? [t(l.changesRequested), failed] : [failed]);
            return held({ tone: 'danger', icon: CircleX, text: t(l.cannotMerge), aside });
        }

        if (now.needsAuthor) {
            return held({ tone: 'danger', icon: CircleX, text: t(l.cannotMerge), aside: sentence(authorParts(now)) });
        }

        // Up to date is required, and nothing else holds it that updating would not run again (PM20).
        if (current.mergeStateStatus === 'BEHIND') {
            const base = current.baseRefName;
            const verdict: PullRequestVerdict = {
                tone: 'warning',
                icon: GitBranch,
                text: t(l.behind, { base }),
                aside: t(l.behindDetail, { base }),
            };
            return { verdict, forward: 'updateBranch' };
        }

        if (counts && counts.requiredPending > 0) {
            const running = t(l.requiredRunning, { count: counts.requiredPending });
            const aside = current.reviewDecision === 'APPROVED' ? `${running} · ${t(l.approved)}` : running;
            return held({ tone: 'warning', icon: LoaderCircle, text: t(l.cannotMerge), aside });
        }

        if (mergeable) {
            const aside = counts
                ? readyAside(current, counts)
                : now.readyToMerge
                  ? t(l.readyDetail)
                  : t(l.readyNoReview);
            return { verdict: { tone: 'success', icon: CircleCheck, text: t(l.ready), aside }, forward: 'merge' };
        }

        const parts: string[] = [];
        if (now.checksRunning) {
            parts.push(t(l.checksRunning));
        }

        if (now.waitingForReview) {
            parts.push(t(l.waitingForReview));
        }

        // Nothing known holds it while GitHub works it out: no red, and merging stays the way (PM22).
        if (parts.length === 0 && isMergeabilityUnknown(current)) {
            const verdict: PullRequestVerdict = {
                tone: 'muted',
                icon: CircleDashed,
                text: t(l.unknown),
                aside: t(l.unknownDetail),
            };
            return { verdict, forward: 'merge' };
        }

        if (parts.length === 0 && current.mergeStateStatus === 'BLOCKED') {
            parts.push(t(l.blocked));
        }

        return held({ tone: 'warning', icon: Hourglass, text: t(l.notReady), aside: sentence(parts) || null });
    }

    /** What `⇧M` says it leads to: "Merge…" with no way forward too, as it still opens the panel. */
    function getForwardTitle(forward: PullRequestWayForward | null) {
        switch (forward) {
            case 'merge':
            case null:
                return t(l.merge);
            case 'markReady':
                return t(l.markReady);
            case 'updateBranch':
                return t(l.updateBranch);
            case 'resolveConflicts':
                return t(l.resolveConflicts);
            default:
                return assertNever(forward);
        }
    }

    /** What the author has to do besides the conflicts: the checks failing, the changes requested. */
    function authorParts(now: PullRequestStanding) {
        const parts: string[] = [];
        if (now.checksFailing) {
            parts.push(
                now.failingChecks > 0 ? t(l.checksFailing, { count: now.failingChecks }) : t(l.checksFailingUncounted),
            );
        }

        if (now.changesRequested) {
            parts.push(t(l.changesRequested));
        }

        return parts;
    }

    /** Why it is ready, with the checks counted. */
    function readyAside(current: PullRequestItem, counts: MergeCheckCounts) {
        if (current.reviewDecision === 'APPROVED') {
            const allPassed = counts.otherFailing + counts.otherPending === 0;
            return allPassed ? t(l.readyDetail) : t(l.readyRequiredPassed);
        }

        return current.reviewDecision === null ? t(l.readyNoReview) : t(l.readyNoConflicts);
    }
}

/**
 * GitHub would merge it now. With the checks counted: none required failing or running, and GitHub's status says the
 * requirements are met; before that, as the row holds it.
 */
function isMergeable(pr: PullRequestItem, now: PullRequestStanding, counts: MergeCheckCounts | null) {
    if (counts) {
        return counts.requiredFailing + counts.requiredPending === 0 && isReadyState(pr.mergeStateStatus);
    }

    const clean = pr.mergeStateStatus === 'CLEAN' || pr.mergeStateStatus === 'HAS_HOOKS';
    return (
        pr.state === 'OPEN' &&
        (now.readyToMerge || (clean && !pr.isDraft && pr.reviewDecision === null && !now.needsAuthor))
    );
}

/** A verdict with no way forward. */
function held(verdict: PullRequestVerdict): Standing {
    return { verdict, forward: null };
}

/** Parts said one after another, as one sentence: "Changes requested · a required check failed". */
function sentence(parts: readonly string[]) {
    return capitalize(parts.join(' · '));
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
