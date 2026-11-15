import type { GitHubWorkflowRun, GitHubWorkflowRunActor } from '@githq/github/rest/readWorkflowRuns.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { getRunVerdict } from './utils/getRunVerdict.js';
import { isPullRequestRun } from './utils/isPullRequestRun.js';
import { isRunInGroup } from './utils/isRunInGroup.js';
import type { WorkflowRefGroup, WorkflowRunsGroupBy } from './WorkflowTypes.js';

/** A run's result as the Status grouping tells it, in the order its groups show. */
export type WorkflowRunStatusGroup = 'inProgress' | 'failed' | 'succeeded' | 'cancelled' | 'other';

/** A day the Day grouping tells runs by, counted back from now in local time, in the order its groups show. */
export type WorkflowRunDayGroup = 'today' | 'yesterday' | 'thisWeek' | 'older';

/** What a group of runs is, for its heading. */
export type WorkflowRunGroupLabel =
    /** Grouping is off: every run, one group with no heading. */
    | { readonly kind: 'all' }
    | { readonly kind: 'status'; readonly status: WorkflowRunStatusGroup }
    /** The runs counting in one of the repository's counted groups (its default branch, a pattern). */
    | { readonly kind: 'countedRef'; readonly group: WorkflowRefGroup }
    /** The runs on branches — or naming no ref — that count nowhere. */
    | { readonly kind: 'otherBranches' }
    /** The runs on tags that count nowhere. */
    | { readonly kind: 'otherTags' }
    /** The runs pull requests started, which never count, whatever their ref. */
    | { readonly kind: 'pullRequests' }
    | { readonly kind: 'event'; readonly event: string }
    | { readonly kind: 'day'; readonly day: WorkflowRunDayGroup }
    /** `null` for the runs credited to no one. */
    | { readonly kind: 'actor'; readonly actor: GitHubWorkflowRunActor | null };

/** One group of a workflow's loaded runs. */
export interface WorkflowRunGroup {
    /** Stable across renders and unique in the list. */
    readonly key: string;
    readonly label: WorkflowRunGroupLabel;
    /** In the order given, the newest first. */
    readonly runs: readonly GitHubWorkflowRun[];
}

/** What {@link groupWorkflowRuns} groups, and how. */
export interface GroupWorkflowRunsParams {
    /** The loaded runs, the newest first. */
    readonly runs: readonly GitHubWorkflowRun[];
    readonly groupBy: WorkflowRunsGroupBy;
    /** The repository's counted groups, in their order (`getRefGroups`): the Ref grouping shows them first. */
    readonly refGroups: readonly WorkflowRefGroup[];
    /** The repository's tags, as last read: a ref named here is a tag. */
    readonly tags: readonly string[];
    /** Epoch ms: what the Day grouping counts back from. */
    readonly now: number;
}

const STATUS_ORDER: readonly WorkflowRunStatusGroup[] = ['inProgress', 'failed', 'succeeded', 'cancelled', 'other'];
const DAY_ORDER: readonly WorkflowRunDayGroup[] = ['today', 'yesterday', 'thisWeek', 'older'];

/**
 * A workflow's loaded runs in groups, each keeping the runs' order; empty groups are left out. Status: in progress,
 * failed, succeeded, cancelled, then the rest. Ref: the counted groups in their order (a run counting in two goes to
 * the first), other branches, other tags, then pull requests. Event and Actor: by the newest run of each (no actor
 * last). Day: today, yesterday, earlier this week (from Monday), older — local time.
 * @__NO_SIDE_EFFECTS__
 */
export function groupWorkflowRuns(params: GroupWorkflowRunsParams): WorkflowRunGroup[] {
    const { runs, groupBy } = params;
    switch (groupBy) {
        case 'none':
            return runs.length > 0 ? [{ key: 'all', label: { kind: 'all' }, runs }] : [];
        case 'status':
            return groupInOrder(runs, STATUS_ORDER, getStatusGroup).map(([status, inGroup]) => ({
                key: `status:${status}`,
                label: { kind: 'status', status },
                runs: inGroup,
            }));
        case 'ref':
            return groupByRef(params);
        case 'event':
            return groupInOrder(runs, [...new Set(runs.map(run => run.event))], run => run.event).map(
                ([event, inGroup]) => ({ key: `event:${event}`, label: { kind: 'event', event }, runs: inGroup }),
            );
        case 'day': {
            const bounds = getDayBounds(params.now);
            return groupInOrder(runs, DAY_ORDER, run => getDayGroup(run, bounds)).map(([day, inGroup]) => ({
                key: `day:${day}`,
                label: { kind: 'day', day },
                runs: inGroup,
            }));
        }
        case 'actor':
            return groupByActor(runs);
        default:
            return assertNever(groupBy);
    }
}

function groupByRef({ runs, refGroups, tags }: GroupWorkflowRunsParams): WorkflowRunGroup[] {
    const counted = refGroups.map((): GitHubWorkflowRun[] => []);
    const otherBranches: GitHubWorkflowRun[] = [];
    const otherTags: GitHubWorkflowRun[] = [];
    const pullRequests: GitHubWorkflowRun[] = [];
    for (const run of runs) {
        if (isPullRequestRun(run)) {
            pullRequests.push(run);
            continue;
        }

        const index = refGroups.findIndex(group => isRunInGroup(run, group));
        if (index >= 0) {
            counted[index]?.push(run);
        } else if (run.headBranch !== null && tags.includes(run.headBranch)) {
            otherTags.push(run);
        } else {
            otherBranches.push(run);
        }
    }

    const groups: WorkflowRunGroup[] = refGroups.map((group, index) => ({
        key: group.kind === 'defaultBranch' ? `ref:branch:${group.branch}` : `ref:pattern:${group.pattern}`,
        label: { kind: 'countedRef', group },
        runs: counted[index] ?? [],
    }));
    groups.push(
        { key: 'ref:otherBranches', label: { kind: 'otherBranches' }, runs: otherBranches },
        { key: 'ref:otherTags', label: { kind: 'otherTags' }, runs: otherTags },
        { key: 'ref:pullRequests', label: { kind: 'pullRequests' }, runs: pullRequests },
    );
    return groups.filter(group => group.runs.length > 0);
}

function groupByActor(runs: readonly GitHubWorkflowRun[]): WorkflowRunGroup[] {
    const actors = new Map<string, GitHubWorkflowRunActor>();
    for (const run of runs) {
        if (run.actor && !actors.has(run.actor.login)) {
            actors.set(run.actor.login, run.actor);
        }
    }

    // `''` stands for no actor: no login is empty.
    return groupInOrder(runs, [...actors.keys(), ''], run => run.actor?.login ?? '').map(([login, inGroup]) => ({
        key: `actor:${login}`,
        label: { kind: 'actor', actor: actors.get(login) ?? null },
        runs: inGroup,
    }));
}

/** The runs by `keyOf`, the groups in `order`, those with no run left out. */
function groupInOrder<K>(
    runs: readonly GitHubWorkflowRun[],
    order: readonly K[],
    keyOf: (run: GitHubWorkflowRun) => K,
): [K, GitHubWorkflowRun[]][] {
    const byKey = new Map<K, GitHubWorkflowRun[]>(order.map(key => [key, []]));
    for (const run of runs) {
        byKey.get(keyOf(run))?.push(run);
    }

    return [...byKey].filter(([, inGroup]) => inGroup.length > 0);
}

function getStatusGroup(run: GitHubWorkflowRun): WorkflowRunStatusGroup {
    if (run.status !== 'completed') {
        return 'inProgress';
    }

    switch (getRunVerdict(run)) {
        case 'failed':
            return 'failed';
        case 'passed':
            return 'succeeded';
        default:
            return run.conclusion === 'cancelled' ? 'cancelled' : 'other';
    }
}

/** Where today, yesterday and this week (from Monday) start, in local time (epoch ms). */
interface DayBounds {
    readonly today: number;
    readonly yesterday: number;
    readonly week: number;
}

function getDayBounds(now: number): DayBounds {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const week = new Date(today);
    // `getDay()` is 0 on Sunday: the week starts on the Monday before it.
    week.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { today: today.getTime(), yesterday: yesterday.getTime(), week: week.getTime() };
}

function getDayGroup(run: GitHubWorkflowRun, bounds: DayBounds): WorkflowRunDayGroup {
    const createdAt = Date.parse(run.createdAt);
    if (createdAt >= bounds.today) {
        return 'today';
    }

    if (createdAt >= bounds.yesterday) {
        return 'yesterday';
    }

    return createdAt >= bounds.week ? 'thisWeek' : 'older';
}
