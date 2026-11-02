import { mapNotNull } from '@nzyme/utils/array/mapNotNull.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import type { LucideIcon } from 'lucide-vue-next';
import { CircleCheck, CircleDashed, CircleX, FileDiff, Hourglass } from 'lucide-vue-next';
import { computed, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import { getPullRequestStanding } from '@/store/getPullRequestStanding.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import { useCheckTexts } from './useCheckTexts.js';
import * as l from './usePullRequestConditions.loc.js';
import type { PullRequestVerdictTone } from './usePullRequestVerdict.js';

/** How one condition of a merge stands, in a line: "Changes requested by sofiab", "1 approval · dkim" aside. */
export interface PullRequestCondition {
    readonly tone: PullRequestVerdictTone;
    readonly icon: LucideIcon;
    readonly text: string;
    /** Quieter text at the end ("1 approval · pnowak"). */
    readonly aside: string | null;
}

/** The conditions a pull request merges on, each in a line. */
export interface PullRequestConditionsViewModel {
    readonly checks: PullRequestCondition;
    readonly reviews: PullRequestCondition;
    readonly conflicts: PullRequestCondition;
}

/**
 * How a pull request's checks, reviews and conflicts stand, from its row — the opened item's standing lists them,
 * and the merge panel says the reviews the same way where they hold the merge (PM13). Approvals are counted without
 * "of N" (D14).
 */
export function usePullRequestConditions(pr: MaybeRefOrGetter<PullRequestItem>): PullRequestConditionsViewModel {
    const t = useTranslate();
    const checkTexts = useCheckTexts();
    const names = new Intl.ListFormat(APP_LANGUAGE);

    const standing = computed(() => getPullRequestStanding(toValue(pr)));

    return reactive<PullRequestConditionsViewModel>({
        checks: computed(checksLine),
        reviews: computed(reviewsLine),
        conflicts: computed(conflictsLine),
    });

    function checksLine(): PullRequestCondition {
        const { state, text } = checkTexts.summarize(toValue(pr).checks);
        switch (state) {
            case 'skipped':
                return { tone: 'muted', icon: CircleDashed, text, aside: null };
            case 'passing':
                return { tone: 'success', icon: CircleCheck, text, aside: null };
            case 'failing':
                return { tone: 'danger', icon: CircleX, text, aside: null };
            case 'pending':
                return { tone: 'warning', icon: Hourglass, text, aside: null };
            default:
                return assertNever(state);
        }
    }

    function reviewsLine(): PullRequestCondition {
        const current = toValue(pr);
        const approvers = authorsOf('APPROVED');
        const approvals = approvers.length > 0 ? t(l.approvals, { count: approvers.length }) : null;
        if (standing.value.changesRequested) {
            return {
                tone: 'danger',
                icon: FileDiff,
                text: t(l.changesRequestedBy, { names: names.format(authorsOf('CHANGES_REQUESTED')) }),
                aside: approvals && `${approvals} · ${names.format(approvers)}`,
            };
        }

        if (standing.value.approved) {
            return {
                tone: 'success',
                icon: CircleCheck,
                text: t(l.approvedBy, { names: names.format(approvers) }),
                aside: approvals,
            };
        }

        const requested = current.reviewRequests.map(request =>
            request.kind === 'user' ? request.login : request.name,
        );
        if (requested.length > 0) {
            return {
                tone: 'warning',
                icon: Hourglass,
                text: t(l.waitingFor, { names: names.format(requested) }),
                aside: approvals,
            };
        }

        if (current.reviewDecision === 'REVIEW_REQUIRED') {
            return { tone: 'warning', icon: Hourglass, text: t(l.reviewRequired), aside: approvals };
        }

        return { tone: 'muted', icon: CircleDashed, text: t(l.noReviewRequired), aside: approvals };
    }

    function conflictsLine(): PullRequestCondition {
        const current = toValue(pr);
        if (standing.value.conflicts) {
            return {
                tone: 'danger',
                icon: CircleX,
                text: t(l.conflictsWith, { base: current.baseRefName }),
                aside: null,
            };
        }

        if (current.mergeable === 'UNKNOWN') {
            return { tone: 'muted', icon: CircleDashed, text: t(l.mergeabilityUnknown), aside: null };
        }

        return {
            tone: 'success',
            icon: CircleCheck,
            text: t(l.noConflicts, { base: current.baseRefName }),
            aside: null,
        };
    }

    function authorsOf(state: 'APPROVED' | 'CHANGES_REQUESTED') {
        return mapNotNull(toValue(pr).latestReviews, review => (review.state === state ? review.author : null));
    }
}
