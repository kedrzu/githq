import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { PullRequestQueueEntry } from '@/store/ItemTypes.js';

import * as l from './useMergeQueueTexts.loc.js';

/** How a pull request's place in a merge queue reads, the same in the panel, the standing and the rows. */
export interface MergeQueueTexts {
    /** "3rd". */
    place(entry: PullRequestQueueEntry): string;
    /** GitHub's state: "waiting for checks", "mergeable · merging next". */
    state(entry: PullRequestQueueEntry): string;
    /** "about 12 min"; `null` while it says nothing: GitHub gives none, or it is no longer waiting. */
    estimate(entry: PullRequestQueueEntry): string | null;
    /** "3rd · waiting for checks · about 12 min" (PM15, PM16). */
    summary(entry: PullRequestQueueEntry): string;
}

const MINUTE_S = 60;
const HOUR_MIN = 60;

/** The words of a merge queue entry, in the app's language (merging PM15, PM16, PM37). */
export function useMergeQueueTexts(): MergeQueueTexts {
    const t = useTranslate();
    const ordinals = new Intl.PluralRules(APP_LANGUAGE, { type: 'ordinal' });

    return { place, state, estimate, summary };

    function summary(entry: PullRequestQueueEntry) {
        const about = estimate(entry);
        return [place(entry), state(entry), ...(about === null ? [] : [about])].join(' · ');
    }

    function place({ position }: PullRequestQueueEntry) {
        switch (ordinals.select(position)) {
            case 'one':
                return t(l.ordinalOne, { position });
            case 'two':
                return t(l.ordinalTwo, { position });
            case 'few':
                return t(l.ordinalFew, { position });
            default:
                return t(l.ordinalOther, { position });
        }
    }

    function state(entry: PullRequestQueueEntry) {
        switch (entry.state) {
            case 'QUEUED':
                return t(l.queued);
            case 'AWAITING_CHECKS':
                return t(l.awaitingChecks);
            case 'MERGEABLE':
                return entry.position === 1 ? t(l.mergingNext) : t(l.mergeable);
            case 'LOCKED':
                return t(l.locked);
            case 'UNMERGEABLE':
                return t(l.unmergeable);
            default:
                return assertNever(entry.state);
        }
    }

    function estimate({ state: now, estimatedTimeToMerge: seconds }: PullRequestQueueEntry) {
        if (seconds === null || (now !== 'QUEUED' && now !== 'AWAITING_CHECKS')) {
            return null;
        }

        const minutes = Math.max(1, Math.round(seconds / MINUTE_S));
        return minutes < HOUR_MIN
            ? t(l.aboutMinutes, { count: minutes })
            : t(l.aboutHours, { count: Math.round(minutes / HOUR_MIN) });
    }
}
