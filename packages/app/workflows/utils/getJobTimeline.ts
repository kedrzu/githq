import type { GitHubWorkflowJob } from '@githq/github/rest/listRunJobs.js';

/** A job's bar on a run's timeline, as shares of the time from the first job's start to the last one's end. */
export interface JobTimelineBar {
    readonly job: GitHubWorkflowJob;
    /** Where the bar starts, from 0 to 1; 0 for a job that has not started. */
    readonly offset: number;
    /** How long the bar is, from 0 to 1; 0 for a job that has not started. */
    readonly length: number;
    /** How long it took, or has been going; `null` while it has not started, or for one that never did. */
    readonly ms: number | null;
}

/**
 * A run's jobs over time (actions W34): a bar per job from when it started to when it completed — to `now` while it
 * runs — measured against the first start and the last end, in the order they started, those that never did last.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getJobTimeline(jobs: readonly GitHubWorkflowJob[], now: number): JobTimelineBar[] {
    const spans = jobs.map(job => ({ job, span: getSpan(job, now) }));
    let first = Infinity;
    let last = -Infinity;
    for (const { span } of spans) {
        if (span) {
            first = Math.min(first, span.start);
            last = Math.max(last, span.end);
        }
    }

    const total = last - first;
    return spans
        .toSorted((a, b) => (a.span?.start ?? Infinity) - (b.span?.start ?? Infinity))
        .map(({ job, span }) =>
            span === null
                ? { job, offset: 0, length: 0, ms: null }
                : {
                      job,
                      offset: total > 0 ? (span.start - first) / total : 0,
                      length: total > 0 ? (span.end - span.start) / total : 1,
                      ms: span.end - span.start,
                  },
        );
}

function getSpan(job: GitHubWorkflowJob, now: number) {
    if (job.startedAt === null) {
        return null;
    }

    const start = Date.parse(job.startedAt);
    if (job.completedAt !== null) {
        return { start, end: Math.max(start, Date.parse(job.completedAt)) };
    }

    return job.status === 'completed' ? null : { start, end: Math.max(start, now) };
}
