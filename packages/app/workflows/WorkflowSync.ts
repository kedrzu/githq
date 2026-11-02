import { getRepositoryConditional } from '@githq/github/rest/getRepositoryConditional.js';
import { listRepositoryRuns } from '@githq/github/rest/listRepositoryRuns.js';
import { listRepositoryTags } from '@githq/github/rest/listRepositoryTags.js';
import { listWorkflowRuns } from '@githq/github/rest/listWorkflowRuns.js';
import { listWorkflows } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';

import type { TrackingSyncContext } from '@/sync/TrackingSync.js';
import { isTargetFailure } from '@/sync/utils/isTargetFailure.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { getRefGroups } from './utils/getRefGroups.js';
import { getRunVerdict } from './utils/getRunVerdict.js';
import { isRunInGroup } from './utils/isRunInGroup.js';
import { mergeWorkflowRuns } from './utils/mergeWorkflowRuns.js';
import { WorkflowStore } from './WorkflowStore.js';
import type { StoredWorkflow, WorkflowRefGroup } from './WorkflowTypes.js';

/** Runs a page of one branch's asks for: a run weighs about 12 KB in the answer (actions D2). */
const RUNS_PAGE_SIZE = 10;
/** Runs a page of every ref's asks for: other refs' and pull requests' runs fill it, so it needs more. */
const ANY_REF_PAGE_SIZE = 30;
/** How many pages of a workflow's runs are read, at most, looking for runs with a verdict (actions D1). */
const MAX_RUN_PAGES = 3;

/** What one read of a workflow's runs needs. */
interface ReadRunsParams {
    readonly nameWithOwner: string;
    readonly entry: StoredWorkflow;
    /** Its key in {@link StoredWorkflow.etags}. */
    readonly key: string;
    /** The one branch or tag asked; every ref's runs when `undefined`. */
    readonly branch: string | undefined;
    /** Every counted group, whose deciding runs the merge keeps. */
    readonly groups: readonly WorkflowRefGroup[];
    /** Older pages are read while one of these has no run with a verdict among the runs. */
    readonly pageFor: readonly WorkflowRefGroup[];
}

/** What marking a repository's workflows unavailable needs. */
interface MarkUnavailableParams {
    readonly context: TrackingSyncContext;
    readonly nameWithOwner: string;
    /** What GitHub answered: 403 or 404. */
    readonly status: number;
}

/**
 * Keeps the tracked repositories' workflows in step with GitHub over REST (actions D2), as the sync engine's
 * `workflows` loop: per repository, its latest runs' list, the repository (its default branch) and its workflow list,
 * each with the last ETag — while all three answer 304, free, and every query the settings need was read before,
 * nothing more is asked and nothing is written; a workflow turned off or deleted, or a renamed default branch, moves
 * no run. When any changed, at the first read, or once the settings need a query never read (a pattern added), the
 * repository's tags and every active workflow's runs, all conditional: a run that changed may have left the latest
 * runs' first page already, so each workflow is asked, and one that did not change answers 304 for free. Its runs on
 * the default branch while that counts, older pages while none there has a verdict; and its runs on any ref while a
 * pattern counts (actions D1: `branch=` matches no wildcard) or the repository's Workflows tab asked
 * ({@link readAnyRef}) — older pages, on the first read for these patterns only, while a pattern's group has no run
 * with a verdict, since later reads go on from it. Up to {@link MAX_RUN_PAGES} pages each. A workflow gone from
 * GitHub's list is dropped.
 *
 * A repository whose Actions GitHub refuses (403) or does not show (404: Actions turned off, or the repository gone)
 * is marked unavailable, asked again at the next poll like any other, and does not fail the loop; only what may
 * concern every repository does (GitHub failing, a revoked token, the allowance), as in `TrackingSync`. An answer
 * arriving after the session ended, or for a repository no longer tracked, is dropped.
 */
export type WorkflowSync = Resolved<typeof WorkflowSync>;
export const WorkflowSync = defineService({
    name: 'WorkflowSync',
    deps: {
        workflows: WorkflowStore,
        tracking: TrackingStore,
        logger: Logger,
    },
    setup({ workflows, tracking, logger }) {
        // The repositories whose Workflows tab asked for their workflows' runs on any ref, until their next poll.
        const anyRefAsked = new Set<string>();

        return { poll, readAnyRef };

        /**
         * Polls each tracked repository's workflows, one after another, then those whose runs on any ref were asked for
         * once the poll had passed them. One GitHub refuses is marked unavailable; one failing otherwise is logged, the
         * others go on, and the poll fails at the end.
         */
        async function poll(context: TrackingSyncContext) {
            const failed = await pollEach(
                context,
                tracking.repositories.map(repo => repo.nameWithOwner),
            );
            if (failed === null) {
                return;
            }

            for (const nameWithOwner of anyRefAsked) {
                if (!tracking.isTracked({ kind: 'repository', nameWithOwner })) {
                    anyRefAsked.delete(nameWithOwner);
                }
            }

            const failedLate = await pollEach(context, [...anyRefAsked]);
            if (failedLate !== null && failed + failedLate > 0) {
                throw new Error(`The workflows of ${failed + failedLate} tracked repositories could not be polled`);
            }
        }

        /**
         * Has the next poll of the tracked repository read its workflows' recent runs on any ref too, which its Workflows
         * tab shows (actions D2, D7) though they may count nowhere.
         */
        function readAnyRef(nameWithOwner: string) {
            anyRefAsked.add(nameWithOwner);
        }

        /** Polls the repositories; how many failed, or `null` once the session ended. */
        async function pollEach(context: TrackingSyncContext, names: readonly string[]) {
            let failed = 0;
            for (const nameWithOwner of names) {
                try {
                    await pollRepository(context, nameWithOwner);
                } catch (error) {
                    if (!isTargetFailure(error)) {
                        throw error;
                    }

                    if (error.status >= 400 && error.status < 500) {
                        markUnavailable({ context, nameWithOwner, status: error.status });
                    } else {
                        failed++;
                        logger.warn('The workflows of a tracked repository could not be polled', {
                            repository: nameWithOwner,
                            error,
                        });
                    }
                }

                if (!context.isCurrent()) {
                    return null;
                }
            }

            return failed;
        }

        async function pollRepository(context: TrackingSyncContext, nameWithOwner: string) {
            const stored = workflows.get(nameWithOwner);
            const anyRefWanted = anyRefAsked.delete(nameWithOwner);
            context.checkAllowance('core');
            const changes = await listRepositoryRuns(context.rest, {
                nameWithOwner,
                etag: stored?.runsEtag ?? undefined,
            });
            if (!isWanted(context, nameWithOwner)) {
                return;
            }

            context.checkAllowance('core');
            const repository = await getRepositoryConditional(context.rest, {
                nameWithOwner,
                etag: stored?.repositoryEtag ?? undefined,
            });
            if (!isWanted(context, nameWithOwner)) {
                return;
            }

            context.checkAllowance('core');
            const list = await listWorkflows(context.rest, { nameWithOwner, etag: stored?.workflowsEtag ?? undefined });
            if (!isWanted(context, nameWithOwner)) {
                return;
            }

            const settings = workflows.getRefSettings(nameWithOwner);
            const defaultBranch =
                repository.status === 200 ? repository.defaultBranch : (stored?.defaultBranch ?? null);
            const groups = getRefGroups(settings, defaultBranch);
            const defaultGroup = groups.find(group => group.kind === 'defaultBranch');
            const patternGroups = groups.filter(group => group.kind === 'pattern');
            const branchQuery = defaultGroup && branchKey(defaultGroup.branch);
            const anyRefQuery = anyRefKey(settings.refs);
            const readsAnyRef = patternGroups.length > 0 || anyRefWanted;
            const queries = [branchQuery, readsAnyRef ? anyRefQuery : undefined].filter(key => key !== undefined);

            if (
                stored &&
                changes.status === 304 &&
                repository.status === 304 &&
                list.status === 304 &&
                !anyRefWanted &&
                stored.workflows.every(
                    entry => entry.workflow.state !== 'active' || queries.every(key => key in entry.etags),
                )
            ) {
                if (stored.unavailable !== null) {
                    workflows.set({ ...stored, unavailable: null });
                }

                return;
            }

            context.checkAllowance('core');
            const tags = await listRepositoryTags(context.rest, {
                nameWithOwner,
                etag: stored?.tagsEtag ?? undefined,
            });
            if (!isWanted(context, nameWithOwner)) {
                return;
            }

            const listed =
                list.status === 200 ? list.workflows : (stored?.workflows.map(entry => entry.workflow) ?? []);
            const read: StoredWorkflow[] = [];
            for (const workflow of listed) {
                const kept = stored?.workflows.find(entry => entry.workflow.id === workflow.id);
                // The any-ref query's ETag stays while not asked, so the tab's next read of it is free.
                let entry: StoredWorkflow = {
                    workflow,
                    runs: kept?.runs ?? [],
                    etags: pickEtags(kept?.etags ?? {}, [branchQuery, anyRefQuery]),
                };
                if (workflow.state === 'active' && defaultGroup && branchQuery !== undefined) {
                    const next = await readRuns(context, {
                        nameWithOwner,
                        entry,
                        key: branchQuery,
                        branch: defaultGroup.branch,
                        groups,
                        pageFor: [defaultGroup],
                    });
                    if (!next) {
                        return;
                    }

                    entry = next;
                }

                if (workflow.state === 'active' && readsAnyRef) {
                    const next = await readRuns(context, {
                        nameWithOwner,
                        entry,
                        key: anyRefQuery,
                        branch: undefined,
                        groups,
                        pageFor: anyRefQuery in entry.etags ? [] : patternGroups,
                    });
                    if (!next) {
                        return;
                    }

                    entry = next;
                }

                read.push(entry);
            }

            workflows.set({
                nameWithOwner,
                defaultBranch,
                repositoryEtag:
                    repository.status === 200 ? (repository.etag ?? null) : (stored?.repositoryEtag ?? null),
                runsEtag: changes.status === 200 ? (changes.etag ?? null) : (stored?.runsEtag ?? null),
                workflowsEtag: list.status === 200 ? (list.etag ?? null) : (stored?.workflowsEtag ?? null),
                tagsEtag: tags.status === 200 ? (tags.etag ?? null) : (stored?.tagsEtag ?? null),
                workflows: read,
                tags: tags.status === 200 ? tags.tags : (stored?.tags ?? []),
                unavailable: null,
            });
            logger.debug('Workflows of a tracked repository read', {
                repository: nameWithOwner,
                workflows: read.length,
            });
        }

        /**
         * Reads the workflow's latest runs on `branch`, or on any ref, into its entry — further back while a group of
         * `pageFor` has no run with a verdict; `null` when the answer is no longer wanted.
         */
        async function readRuns(context: TrackingSyncContext, params: ReadRunsParams) {
            const { nameWithOwner, entry, key, branch, groups, pageFor } = params;
            context.checkAllowance('core');
            const first = await listWorkflowRuns(context.rest, {
                nameWithOwner,
                workflowId: entry.workflow.id,
                branch,
                perPage: branch === undefined ? ANY_REF_PAGE_SIZE : RUNS_PAGE_SIZE,
                etag: entry.etags[key],
            });
            if (!isWanted(context, nameWithOwner)) {
                return null;
            }

            if (first.status === 304) {
                return entry;
            }

            // Without an ETag the next read cannot be conditional: it is made again at the next change.
            const etags = Object.fromEntries(Object.entries(entry.etags).filter(([other]) => other !== key));
            if (first.etag !== undefined) {
                etags[key] = first.etag;
            }

            let runs = mergeWorkflowRuns({ stored: entry.runs, read: first.runs, groups });
            let pageUrl = first.nextPageUrl;
            for (
                let pages = 1;
                pages < MAX_RUN_PAGES && pageUrl !== undefined && pageFor.some(group => !hasVerdict(runs, group));
                pages++
            ) {
                context.checkAllowance('core');
                const older = await listWorkflowRuns(context.rest, {
                    nameWithOwner,
                    workflowId: entry.workflow.id,
                    pageUrl,
                });
                if (!isWanted(context, nameWithOwner)) {
                    return null;
                }

                if (older.status === 304) {
                    break;
                }

                runs = mergeWorkflowRuns({ stored: runs, read: older.runs, groups });
                pageUrl = older.nextPageUrl;
            }

            return { ...entry, runs, etags };
        }

        /** Says GitHub shows nothing of the repository's workflows — once: while it keeps saying so, nothing is written. */
        function markUnavailable({ context, nameWithOwner, status }: MarkUnavailableParams) {
            const stored = workflows.get(nameWithOwner);
            if (!isWanted(context, nameWithOwner) || stored?.unavailable?.status === status) {
                return;
            }

            logger.warn('GitHub shows no workflows of a tracked repository; asking again at the next poll', {
                repository: nameWithOwner,
                status,
            });
            workflows.set({
                nameWithOwner,
                defaultBranch: null,
                repositoryEtag: null,
                runsEtag: null,
                workflowsEtag: null,
                tagsEtag: null,
                workflows: [],
                tags: [],
                ...stored,
                unavailable: { reason: status === 404 ? 'disabled' : 'refused', status },
            });
        }

        /** Whether what was read of the repository may be written: the session is current and it is still tracked. */
        function isWanted(context: TrackingSyncContext, nameWithOwner: string) {
            return context.isCurrent() && tracking.isTracked({ kind: 'repository', nameWithOwner });
        }
    },
});

/** The key of a workflow's runs on one branch or tag in {@link StoredWorkflow.etags}. */
function branchKey(branch: string) {
    return `branch:${branch}`;
}

/**
 * The key of a workflow's runs on any ref in {@link StoredWorkflow.etags}, by the patterns that count: a changed list
 * reads them afresh, paging back for the new patterns.
 */
function anyRefKey(patterns: readonly string[]) {
    return `any:${JSON.stringify(patterns)}`;
}

/**
 * The ETags of the queries that may still be made: one of a branch no longer counted (a renamed default branch), or
 * of patterns no longer in force, goes.
 */
function pickEtags(etags: Readonly<Record<string, string>>, keys: readonly (string | undefined)[]) {
    const picked: Record<string, string> = {};
    for (const key of keys) {
        const etag = key === undefined ? undefined : etags[key];
        if (key !== undefined && etag !== undefined) {
            picked[key] = etag;
        }
    }

    return picked;
}

/** Whether a run of the group among `runs` has a verdict — what decides the workflow there (actions D1). */
function hasVerdict(runs: readonly GitHubWorkflowRun[], group: WorkflowRefGroup) {
    return runs.some(run => getRunVerdict(run) !== null && isRunInGroup(run, group));
}
