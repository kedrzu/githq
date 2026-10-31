/**
 * How current what a surface shows is (D15), for its segment of the status bar. Times are epoch ms.
 *
 * - `fresh`: the poll covering it succeeded within its interval;
 * - `checking`: a poll is running and the last success is no longer fresh (while fresh, a running poll still
 *   reads `fresh`: the marker stays quiet);
 * - `stale`: the last success is older than expected — offline, requests failing (retried every interval), or
 *   a poll simply overdue (`late`), or GitHub refusing to say what changed for a reason that lasts (`refused`);
 *   `since` is `null` when nothing was ever downloaded;
 * - `paused`: the API allowance is used up; polling resumes at `until`;
 * - `partial`: nothing was ever downloaded for it and the first download is under way;
 * - `answered`: a saved view whose filter githq can't evaluate, answered by GitHub instead (K6) and refreshed more
 *   slowly; `term` is what githq can't evaluate, `checkedAt` `null` until GitHub first answered.
 *
 * The user's own edits on the way, or one GitHub rejected, are said over it in the segment (`FreshnessSegment`).
 */
export type Freshness =
    | { readonly kind: 'fresh'; readonly checkedAt: number }
    | { readonly kind: 'checking'; readonly since: number }
    | { readonly kind: 'stale'; readonly since: number | null; readonly reason: 'offline' | 'failing' | 'refused' }
    | { readonly kind: 'stale'; readonly since: number; readonly reason: 'late' }
    | { readonly kind: 'paused'; readonly since: number | null; readonly until: number }
    | { readonly kind: 'partial' }
    | { readonly kind: 'answered'; readonly term: string; readonly checkedAt: number | null };

/** What a surface's freshness is told from: its poll and the browser now. */
export interface GetFreshnessParams {
    readonly now: number;
    /** The poll's last success; `null` when it never succeeded, in this session or the kept one. */
    readonly lastSuccessAt: number | null;
    /** How often the poll runs now (it differs while the tab is hidden). */
    readonly intervalMs: number;
    /** A poll is running. */
    readonly checking: boolean;
    readonly online: boolean;
    /** The last poll failed for another reason than the connection or the allowance. */
    readonly failing: boolean;
    /** Polling waits for the allowance until then; `null` when it does not. */
    readonly pausedUntil: number | null;
}

/** How late a success may be and still count as fresh: a poll takes a few seconds, a timer may fire late. */
export const FRESH_SLACK_MS = 15_000;

/**
 * The freshness of a surface. A fresh one stays fresh whatever happens until its interval (and some slack)
 * runs out, so a single failed or slow poll never makes the marker flicker.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function getFreshness(params: GetFreshnessParams): Freshness {
    const { now, lastSuccessAt, intervalMs, pausedUntil } = params;

    if (lastSuccessAt !== null && now - lastSuccessAt <= intervalMs + FRESH_SLACK_MS) {
        return { kind: 'fresh', checkedAt: lastSuccessAt };
    }

    if (pausedUntil !== null && pausedUntil > now) {
        return { kind: 'paused', since: lastSuccessAt, until: pausedUntil };
    }

    if (!params.online) {
        return { kind: 'stale', since: lastSuccessAt, reason: 'offline' };
    }

    if (params.failing) {
        return { kind: 'stale', since: lastSuccessAt, reason: 'failing' };
    }

    if (lastSuccessAt === null) {
        return { kind: 'partial' };
    }

    if (params.checking) {
        return { kind: 'checking', since: lastSuccessAt };
    }

    return { kind: 'stale', since: lastSuccessAt, reason: 'late' };
}
