import { getRepositoryConditional } from '@githq/github/rest/getRepositoryConditional.js';
import { listRepositoryRuns } from '@githq/github/rest/listRepositoryRuns.js';
import { listWorkflowRuns } from '@githq/github/rest/listWorkflowRuns.js';
import { listWorkflows } from '@githq/github/rest/listWorkflows.js';
import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';

import type { TrackingSyncContext } from '@/sync/TrackingSync.js';
import { isTargetFailure } from '@/sync/utils/isTargetFailure.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import { getRunVerdict } from './utils/getRunVerdict.js';
import { isRunCounted } from './utils/isRunCounted.js';
import type { IsRunCountedParams } from './utils/isRunCounted.js';
import { mergeWorkflowRuns } from './utils/mergeWorkflowRuns.js';
import { WorkflowStore } from './WorkflowStore.js';
import type { StoredWorkflow } from './WorkflowTypes.js';

/** Runs a page asks for: a run weighs about 12 KB in the answer (actions D2). */
const RUNS_PAGE_SIZE = 10;
/** How many pages of a workflow's runs on a ref are read, at most, looking for one with a verdict (actions D1). */
const MAX_RUN_PAGES = 3;

/** What one read of a workflow's runs on a branch needs. */
interface ReadBranchRunsParams {
    readonly nameWithOwner: string;
    readonly entry: StoredWorkflow;
    readonly branch: string;
    readonly counted: IsRunCountedParams;
}

/**
 * Keeps the tracked repositories' workflows in step with GitHub over REST (actions D2), as the sync engine's
 * `workflows` loop: per repository, its latest runs' list, the repository (its default branch) and its workflow list,
 * each with the last ETag — while all three answer 304, free, nothing more is asked and nothing is written; a workflow
 * turned off or deleted, or a renamed default branch, moves no run. When any changed, or at the first read, every
 * active workflow's runs on the counted refs, all conditional: a run that changed may have left the latest runs' first
 * page already, so each workflow is asked, and one that did not change answers 304 for free. With no counted run
 * with a verdict among them, older pages, up to {@link MAX_RUN_PAGES}. A workflow gone from GitHub's list is dropped.
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
        return { poll };

        /**
         * Polls each tracked repository's workflows, one after another. One GitHub refuses is marked unavailable; one
         * failing otherwise is logged, the others go on, and the poll fails at the end.
         */
        async function poll(context: TrackingSyncContext) {
            let failed = 0;
            for (const { nameWithOwner } of tracking.repositories) {
                try {
                    await pollRepository(context, nameWithOwner);
                } catch (error) {
                    if (!isTargetFailure(error)) {
                        throw error;
                    }

                    if (error.status >= 400 && error.status < 500) {
                        markUnavailable(context, nameWithOwner, error.status);
                    } else {
                        failed++;
                        logger.warn('The workflows of a tracked repository could not be polled', {
                            repository: nameWithOwner,
                            error,
                        });
                    }
                }

                if (!context.isCurrent()) {
                    return;
                }
            }

            if (failed > 0) {
                throw new Error(`The workflows of ${failed} tracked repositories could not be polled`);
            }
        }

        async function pollRepository(context: TrackingSyncContext, nameWithOwner: string) {
            const stored = workflows.get(nameWithOwner);
            context.checkAllowance('core');
            const changes = await listRepositoryRuns(context.rest, {
                nameWithOwner,
                etag: stored?.runsEtag ?? undefined,
                perPage: RUNS_PAGE_SIZE,
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

            if (stored && changes.status === 304 && repository.status === 304 && list.status === 304) {
                if (stored.unavailable !== null) {
                    workflows.set({ ...stored, unavailable: null });
                }

                return;
            }

            const defaultBranch =
                repository.status === 200 ? repository.defaultBranch : (stored?.defaultBranch ?? null);
            const counted: IsRunCountedParams = { ...workflows.getRefSettings(nameWithOwner), defaultBranch };
            const branches = counted.countDefaultBranch && defaultBranch !== null ? [defaultBranch] : [];
            const listed =
                list.status === 200 ? list.workflows : (stored?.workflows.map(entry => entry.workflow) ?? []);

            const read: StoredWorkflow[] = [];
            for (const workflow of listed) {
                const kept = stored?.workflows.find(entry => entry.workflow.id === workflow.id);
                let entry: StoredWorkflow = {
                    workflow,
                    runs: kept?.runs ?? [],
                    etags: pickEtags(kept?.etags ?? {}, branches),
                };
                for (const branch of workflow.state === 'active' ? branches : []) {
                    const next = await readBranchRuns(context, { nameWithOwner, entry, branch, counted });
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
                workflows: read,
                unavailable: null,
            });
            logger.debug('Workflows of a tracked repository read', {
                repository: nameWithOwner,
                workflows: read.length,
            });
        }

        /**
         * Reads the workflow's latest runs on `branch` into its entry — further back while none counted has a verdict;
         * `null` when the answer is no longer wanted.
         */
        async function readBranchRuns(context: TrackingSyncContext, params: ReadBranchRunsParams) {
            const { nameWithOwner, entry, branch, counted } = params;
            const key = branchKey(branch);
            context.checkAllowance('core');
            const first = await listWorkflowRuns(context.rest, {
                nameWithOwner,
                workflowId: entry.workflow.id,
                branch,
                perPage: RUNS_PAGE_SIZE,
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

            let runs = mergeWorkflowRuns({ stored: entry.runs, read: first.runs, counted });
            let pageUrl = first.nextPageUrl;
            for (let pages = 1; pages < MAX_RUN_PAGES && pageUrl !== undefined && !hasVerdict(runs, counted); pages++) {
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

                runs = mergeWorkflowRuns({ stored: runs, read: older.runs, counted });
                pageUrl = older.nextPageUrl;
            }

            return { ...entry, runs, etags };
        }

        /** Says GitHub shows nothing of the repository's workflows — once: while it keeps saying so, nothing is written. */
        function markUnavailable(context: TrackingSyncContext, nameWithOwner: string, status: number) {
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
                workflows: [],
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

/** The ETags of the queries still made: one of a branch no longer counted (a renamed default branch) goes. */
function pickEtags(etags: Readonly<Record<string, string>>, branches: readonly string[]) {
    const picked: Record<string, string> = {};
    for (const branch of branches) {
        const etag = etags[branchKey(branch)];
        if (etag !== undefined) {
            picked[branchKey(branch)] = etag;
        }
    }

    return picked;
}

/** Whether a counted run among `runs` has a verdict — what decides the workflow (actions D1). */
function hasVerdict(runs: readonly GitHubWorkflowRun[], counted: IsRunCountedParams) {
    return runs.some(run => getRunVerdict(run) !== null && isRunCounted(run, counted));
}
