/**
 * How current what a surface shows is (D15), for its segment of the status bar. Times are epoch ms.
 *
 * - `fresh`: the poll covering it succeeded within its interval;
 * - `checking`: a poll is running and the last success is no longer fresh (while fresh, a running poll still
 *   reads `fresh`: the marker stays quiet);
 * - `stale`: the last success is older than expected — offline, requests failing (retried every interval), or
 *   a poll simply overdue (`late`), GitHub refusing to say what changed for a reason that lasts (`refused`), or a
 *   repository's workflows GitHub no longer lists, the last known ones staying on screen (`workflowsUnavailable`);
 *   `since` is `null` when nothing was ever downloaded;
 * - `paused`: the API allowance is used up; polling resumes at `until`;
 * - `partial`: nothing was ever downloaded for it and the first download is under way;
 * - `reading`: a repository's workflows are listed and the first read of their runs is under way (actions W3c);
 * - `readingLog`: a run's page is waiting for the log of `job` (actions W4e);
 * - `logFailed`: the log of `job` on a run's page failed to read (actions W4i);
 * - `statusChecked`: a run's page is showing a job still running, whose jobs GitHub last answered for at `checkedAt`
 *   (actions W4j);
 * - `filling`: a first open's branches are being read down to the loaded history, `done` of `total` (git-client D19);
 * - `answered`: a saved view whose filter githq can't evaluate, answered by GitHub instead (K6) and refreshed more
 *   slowly; `term` is what githq can't evaluate, `checkedAt` `null` until GitHub first answered;
 * - `fetchingFiles`: a review's file contents arriving, `here` of `total`, `first` the name of the one a jump asked for
 *   ahead of the rest (code review D35);
 * - `filesPaused`: `waiting` of a review's files wait for the API allowance, until `until`;
 * - `filesCapped`: GitHub lists only the first `listed` of a pull request's `total` changed files;
 * - `filesUnread`: GitHub didn't give a pull request's list of files;
 * - `threadsUnread`: GitHub didn't give a pull request's review threads;
 * - `threadsPaused`: a pull request's review threads wait for the API allowance, until `until`;
 * - `threadPosition`: a review's thread is focused, `position` of `total` that `N` walks, `open` of them unresolved: not how
 *   fresh it is, but what the segment says then (CR15);
 * - `landing`: a review has just opened and hasn't been moved yet, on its first file not viewed or where it was left: not
 *   how fresh it is, but what the segment says then (CR20, CR25, CR26). `backTo` is the pull request a walk came from;
 * - `filesSelected`: files of a review are selected together: not how fresh it is, but what the segment says then (CR23).
 *
 * The user's own edits on the way, or one GitHub rejected, are said over it in the segment (`FreshnessSegment`).
 */
export type Freshness =
    | { readonly kind: 'fresh'; readonly checkedAt: number }
    | { readonly kind: 'checking'; readonly since: number }
    | {
          readonly kind: 'stale';
          readonly since: number | null;
          readonly reason: 'offline' | 'failing' | 'refused' | 'workflowsUnavailable';
      }
    | { readonly kind: 'stale'; readonly since: number; readonly reason: 'late' }
    | { readonly kind: 'paused'; readonly since: number | null; readonly until: number }
    | { readonly kind: 'partial' }
    | { readonly kind: 'reading'; readonly read: number; readonly total: number }
    | { readonly kind: 'readingLog'; readonly job: string }
    | { readonly kind: 'logFailed'; readonly job: string }
    | { readonly kind: 'statusChecked'; readonly checkedAt: number }
    | { readonly kind: 'filling'; readonly done: number; readonly total: number }
    | { readonly kind: 'answered'; readonly term: string; readonly checkedAt: number | null }
    | {
          readonly kind: 'fetchingFiles';
          readonly here: number;
          readonly total: number;
          readonly first: string | null;
          readonly listComplete: boolean;
      }
    | { readonly kind: 'filesPaused'; readonly waiting: number; readonly until: number }
    | { readonly kind: 'filesCapped'; readonly listed: number; readonly total: number }
    | { readonly kind: 'filesUnread' }
    | { readonly kind: 'threadsUnread' }
    | { readonly kind: 'threadsPaused'; readonly until: number }
    | { readonly kind: 'threadPosition'; readonly position: number; readonly total: number; readonly open: number }
    | {
          readonly kind: 'landing';
          readonly at: 'firstFile';
          readonly number: number;
          readonly viewed: number;
          readonly total: number;
          readonly backTo: { readonly key: 'J' | 'K'; readonly number: number } | null;
      }
    | {
          readonly kind: 'landing';
          readonly at: 'left';
          readonly number: number;
          readonly file: string;
          readonly line: number | null;
      }
    | { readonly kind: 'filesSelected' };

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
