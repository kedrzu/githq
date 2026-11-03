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
import { WORKFLOW_RUNS_PAGE_SIZE } from './utils/getRepositoryWorkflowState.js';
import { getRunVerdict } from './utils/getRunVerdict.js';
import { isRunInGroup } from './utils/isRunInGroup.js';
import { isWorkflowNeverRead } from './utils/isWorkflowNeverRead.js';
import { mergeWorkflowRuns } from './utils/mergeWorkflowRuns.js';
import { WorkflowStore } from './WorkflowStore.js';
import type { StoredWorkflow, WorkflowRefGroup } from './WorkflowTypes.js';

/** Runs a page of one branch's asks for: a run weighs about 12 KB in the answer (actions D2). */
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
    /**
     * The workflow's runs as stored before this poll, the newest first: older pages are read too while a page has not
     * reached them. Not the entry's: another query of the same poll may just have stored a newer run there.
     */
    readonly known: readonly GitHubWorkflowRun[];
}

/** What {@link WorkflowSync}'s poll of some repositories needs. */
interface PollEachParams {
    readonly context: TrackingSyncContext;
    readonly names: readonly string[];
    /** The repositories this poll read with their runs on any ref; filled as it goes. */
    readonly readAnyRef: Set<string>;
    readonly getAnyRefRepositories: () => ReadonlySet<string>;
}

/** What {@link WorkflowSync}'s poll of one repository needs. */
interface PollRepositoryParams {
    readonly context: TrackingSyncContext;
    readonly nameWithOwner: string;
    /** Whether its workflows' runs on any ref are read too, a screen showing them. */
    readonly anyRefWanted: boolean;
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
 * pattern counts (actions D1: `branch=` matches no wildcard) or a screen has them on screen (`SyncEngine.watchAnyRef`)
 * — older pages, on the first read for these patterns only, while a pattern's group has no run with a verdict, since
 * later reads go on from it. Either way older pages are read while a page has not reached the newest run stored: after
 * a break in polling, what happened meanwhile decides as it would for a rebuilt copy, and a poll in time costs nothing
 * for it. Up to {@link MAX_RUN_PAGES} pages each. A repository on screen is asked all of that at
 * every poll, as a run off the latest runs' page may have moved, all of it conditional, and nothing is written while
 * nothing moved. A workflow gone from GitHub's list is dropped. While some workflow's runs were never read, what is
 * known is stored as it arrives — the default branch and the list first, then a workflow at a time (W3c, W10).
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
         * Polls each tracked repository's workflows, one after another — with their runs on any ref for those
         * `getAnyRefRepositories` names as the poll reaches them — then again those it came to name once the poll had
         * passed them. One GitHub refuses is marked unavailable; one failing otherwise is logged, the others go on, and
         * the poll fails at the end. What it names is read at every poll, so nothing is lost to a failure.
         */
        async function poll(context: TrackingSyncContext, getAnyRefRepositories: () => ReadonlySet<string>) {
            const readAnyRef = new Set<string>();
            let names = tracking.repositories.map(repo => repo.nameWithOwner);
            let failed = 0;
            while (names.length > 0) {
                const failedNow = await pollEach({ context, names, readAnyRef, getAnyRefRepositories });
                if (failedNow === null) {
                    return;
                }

                failed += failedNow;
                names = [...getAnyRefRepositories()].filter(
                    nameWithOwner =>
                        !readAnyRef.has(nameWithOwner) && tracking.isTracked({ kind: 'repository', nameWithOwner }),
                );
            }

            if (failed > 0) {
                throw new Error(`The workflows of ${failed} tracked repositories could not be polled`);
            }
        }

        /** Polls the repositories; how many failed, or `null` once the session ended. */
        async function pollEach({ context, names, readAnyRef, getAnyRefRepositories }: PollEachParams) {
            let failed = 0;
            for (const nameWithOwner of names) {
                const anyRefWanted = getAnyRefRepositories().has(nameWithOwner);
                if (anyRefWanted) {
                    readAnyRef.add(nameWithOwner);
                }

                try {
                    await pollRepository({ context, nameWithOwner, anyRefWanted });
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

        async function pollRepository({ context, nameWithOwner, anyRefWanted }: PollRepositoryParams) {
            const stored = workflows.get(nameWithOwner);
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

            function findKept(id: number) {
                return stored?.workflows.find(entry => entry.workflow.id === id);
            }

            const listed =
                list.status === 200 ? list.workflows : (stored?.workflows.map(entry => entry.workflow) ?? []);
            const showsProgress =
                queries.length > 0 &&
                listed.some(workflow => {
                    const kept = findKept(workflow.id);
                    return workflow.state === 'active' && (!kept || isWorkflowNeverRead(kept));
                });
            // What has been read shows at once, a workflow at a time. Its ETags stay the old ones until all of it is
            // read: this read cut short, the next one is not told that nothing changed, and goes on.
            function showRead(read: readonly StoredWorkflow[], tags: readonly string[]) {
                workflows.set({
                    nameWithOwner,
                    defaultBranch,
                    repositoryEtag: stored?.repositoryEtag ?? null,
                    runsEtag: stored?.runsEtag ?? null,
                    workflowsEtag: stored?.workflowsEtag ?? null,
                    tagsEtag: stored?.tagsEtag ?? null,
                    workflows: [
                        ...read,
                        ...listed
                            .slice(read.length)
                            .map(workflow => findKept(workflow.id) ?? { workflow, runs: [], etags: {} }),
                    ],
                    tags,
                    unavailable: null,
                });
            }
            if (showsProgress) {
                showRead([], stored?.tags ?? []);
            }

            context.checkAllowance('core');
            const tags = await listRepositoryTags(context.rest, {
                nameWithOwner,
                etag: stored?.tagsEtag ?? undefined,
            });
            if (!isWanted(context, nameWithOwner)) {
                return;
            }

            const tagNames = tags.status === 200 ? tags.tags : (stored?.tags ?? []);
            const read: StoredWorkflow[] = [];
            let runsMoved = false;
            for (const workflow of listed) {
                const kept = findKept(workflow.id);
                // The any-ref query's ETag stays while not asked, so the tab's next read of it is free.
                const known = kept?.runs ?? [];
                let entry: StoredWorkflow = {
                    workflow,
                    runs: known,
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
                        known,
                    });
                    if (!next) {
                        return;
                    }

                    runsMoved ||= next !== entry;
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
                        known,
                    });
                    if (!next) {
                        return;
                    }

                    runsMoved ||= next !== entry;
                    entry = next;
                }

                read.push(entry);
                if (showsProgress && read.length < listed.length) {
                    showRead(read, tagNames);
                }
            }

            // Asked because a screen shows them, and nothing moved: nothing to write.
            if (
                stored?.unavailable === null &&
                !runsMoved &&
                changes.status === 304 &&
                repository.status === 304 &&
                list.status === 304 &&
                tags.status === 304
            ) {
                return;
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
                tags: tagNames,
                unavailable: null,
            });
            logger.debug('Workflows of a tracked repository read', {
                repository: nameWithOwner,
                workflows: read.length,
            });
        }

        /**
         * Reads the workflow's latest runs on `branch`, or on any ref, into its entry — further back while a group of
         * `pageFor` has no run with a verdict, or a page has not reached the query's newest `known` run; `null` when the
         * answer is no longer wanted.
         */
        async function readRuns(context: TrackingSyncContext, params: ReadRunsParams) {
            const { nameWithOwner, entry, key, branch, groups, pageFor, known } = params;
            const newestKnown = known.find(run => branch === undefined || run.headBranch === branch);
            context.checkAllowance('core');
            const first = await listWorkflowRuns(context.rest, {
                nameWithOwner,
                workflowId: entry.workflow.id,
                branch,
                perPage: branch === undefined ? ANY_REF_PAGE_SIZE : WORKFLOW_RUNS_PAGE_SIZE,
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
            let lastPage = first.runs;
            for (
                let pages = 1;
                pages < MAX_RUN_PAGES &&
                pageUrl !== undefined &&
                (isNewerThan(lastPage, newestKnown) || pageFor.some(group => !hasVerdict(runs, group)));
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
                lastPage = older.runs;
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

/** Whether a page of runs, the newest first, ends short of `run`: runs may be missing between the two. */
function isNewerThan(page: readonly GitHubWorkflowRun[], run: GitHubWorkflowRun | undefined) {
    const oldest = page.at(-1);
    return oldest !== undefined && run !== undefined && Date.parse(oldest.createdAt) > Date.parse(run.createdAt);
}
