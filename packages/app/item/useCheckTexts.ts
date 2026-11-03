import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import { APP_LANGUAGE } from '@/i18n/AppLanguageContext.js';
import type { ItemCheck, ItemCheckState } from '@/store/ItemDetailTypes.js';
import type { ItemChecks } from '@/store/ItemTypes.js';
import { formatDuration } from '@/utils/formatDuration.js';

import * as l from './useCheckTexts.loc.js';

/** A pull request's checks in one line, and how that line stands. */
export interface CheckSummary {
    /** `skipped` when none ran. */
    readonly state: ItemCheckState;
    readonly text: string;
}

/** The words of a pull request's checks — the opened item's list and standing, the merge panel's checks. */
export interface CheckTexts {
    /** The check as GitHub names it: "workflow / name" for a check run of an Actions workflow. */
    name(check: ItemCheck): string;
    /** How it stands and how long it ran: "failed after 2m 14s", "running for 45s" (counted to `now`), "queued". */
    describe(check: ItemCheck, now: number): string;
    /** The row's counts in one line: "None run", "All 9 passed", "1 failing, 2 running, 6 passed". */
    summarize(checks: Pick<ItemChecks, 'failing' | 'passing' | 'pending'> | null): CheckSummary;
}

/**
 * The words of a pull request's checks, in the app's language.
 *
 * @util
 */
export function useCheckTexts(): CheckTexts {
    const t = useTranslate();
    const numbers = new Intl.NumberFormat(APP_LANGUAGE);

    return { name, describe, summarize };

    function name(check: ItemCheck) {
        return check.workflow ? `${check.workflow} / ${check.name}` : check.name;
    }

    function describe(check: ItemCheck, now: number) {
        const ran =
            check.startedAt && check.completedAt ? Date.parse(check.completedAt) - Date.parse(check.startedAt) : null;
        switch (check.state) {
            case 'failing':
                return ran === null ? t(l.failed) : t(l.failedAfter, { duration: formatDuration(ran) });
            case 'pending':
                return check.startedAt
                    ? t(l.runningFor, { duration: formatDuration(now - Date.parse(check.startedAt)) })
                    : t(l.queued);
            case 'passing':
                return ran === null ? t(l.passed) : t(l.passedIn, { duration: formatDuration(ran) });
            case 'skipped':
                return t(l.skipped);
            default:
                return assertNever(check.state);
        }
    }

    function summarize(checks: Pick<ItemChecks, 'failing' | 'passing' | 'pending'> | null): CheckSummary {
        if (!checks || checks.passing + checks.failing + checks.pending === 0) {
            return { state: 'skipped', text: t(l.noChecks) };
        }

        if (checks.failing === 0 && checks.pending === 0) {
            return { state: 'passing', text: t(l.allPassed, { count: checks.passing }) };
        }

        const parts: string[] = [];
        if (checks.failing > 0) {
            parts.push(t(l.failingCount, { count: numbers.format(checks.failing) }));
        }

        if (checks.pending > 0) {
            parts.push(t(l.runningCount, { count: numbers.format(checks.pending) }));
        }

        if (checks.passing > 0) {
            parts.push(t(l.passedCount, { count: numbers.format(checks.passing) }));
        }

        return { state: checks.failing > 0 ? 'failing' : 'pending', text: parts.join(', ') };
    }
}
