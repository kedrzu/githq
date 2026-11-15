import type { GitHubWorkflowRun } from '@githq/github/rest/readWorkflowRuns.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

import { buildWorkflowDetails } from './buildWorkflowDetails.js';
import type { WorkflowDetails } from './buildWorkflowDetails.js';
import { getRefGroups } from './utils/getRefGroups.js';
import { getRunVerdict } from './utils/getRunVerdict.js';
import { getWorkflowFile } from './utils/getWorkflowFile.js';
import { mergeRunsById } from './utils/mergeRunsById.js';
import { WorkflowFileStore } from './WorkflowFileStore.js';
import type { WorkflowFileTarget } from './WorkflowFileStore.js';
import type { WorkflowReference } from './workflowRoutes.js';
import { WorkflowRunHistory } from './WorkflowRunHistory.js';
import type { WorkflowRunsBrowse, WorkflowRunsTarget } from './WorkflowRunHistory.js';
import { WorkflowStore } from './WorkflowStore.js';
import type { WorkflowRefGroup, WorkflowState } from './WorkflowTypes.js';

/** Options of {@link useOpenedWorkflow}. */
export interface UseOpenedWorkflowOptions {
    reference: MaybeRefOrGetter<WorkflowReference>;
}

/** The workflow an address opens, as the item shows it. */
export interface OpenedWorkflowViewModel {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    /** How it stands on the refs that count; `null` until found among the repository's workflows. */
    readonly state: WorkflowState | null;
    /** What its Details column shows; `null` until found. */
    readonly details: WorkflowDetails | null;
    /** Its runs under the filters set on them; `null` until found. */
    readonly runs: WorkflowRunsBrowse | null;
    /** Whose runs: `null` until found. */
    readonly target: WorkflowRunsTarget | null;
    /** The repository's counted groups, in their order: the Ref grouping and filter show them first. */
    readonly refGroups: readonly WorkflowRefGroup[];
    /** The repository's tags, as last read. */
    readonly tags: readonly string[];
    /** Its latest failed run known, on any ref; `null` without one. */
    readonly latestFailure: GitHubWorkflowRun | null;
    /** The repository's workflows were read, and none is at the address. */
    readonly missing: boolean;
}

/**
 * The workflow an address opens (actions D15): found among the repository's workflows the sync keeps, by its file; as
 * it opens — and each time another opens in its place — its runs' first page is read anew (`WorkflowRunHistory.open`,
 * filters cleared when it is another workflow) and its file at the default branch is read for its details, unless GitHub
 * generates it.
 */
export function useOpenedWorkflow(options: UseOpenedWorkflowOptions): OpenedWorkflowViewModel {
    const workflows = useService(WorkflowStore);
    const history = useService(WorkflowRunHistory);
    const files = useService(WorkflowFileStore);

    const reference = makeRef(options.reference);
    const nameWithOwner = computed(() => `${reference.value.owner}/${reference.value.name}`);
    const stored = computed(() => workflows.get(nameWithOwner.value));
    const state = computed(() => {
        const file = reference.value.file.toLowerCase();
        return (
            workflows
                .getState(nameWithOwner.value)
                .workflows.find(candidate => getWorkflowFile(candidate.workflow).toLowerCase() === file) ?? null
        );
    });
    const target = computed((): WorkflowRunsTarget | null =>
        state.value ? { nameWithOwner: nameWithOwner.value, workflowId: state.value.workflow.id } : null,
    );
    const fileTarget = computed((): WorkflowFileTarget | null =>
        state.value && !state.value.generated
            ? { nameWithOwner: nameWithOwner.value, path: state.value.workflow.path, ref: null }
            : null,
    );
    const runs = computed(() => (target.value ? history.getRuns(target.value) : null));
    const details = computed(() => {
        const current = state.value;
        const kept = stored.value;
        if (!current || !kept) {
            return null;
        }

        return buildWorkflowDetails({
            stored: kept,
            state: current,
            file: fileTarget.value ? files.get(fileTarget.value) : { parse: null, status: 'idle' },
            runs: runs.value?.runs ?? [],
        });
    });
    const refGroups = computed(() =>
        getRefGroups(workflows.getRefSettings(nameWithOwner.value), stored.value?.defaultBranch ?? null),
    );
    const latestFailure = computed(() => {
        const id = target.value?.workflowId;
        const kept = stored.value?.workflows.find(entry => entry.workflow.id === id)?.runs ?? [];
        return mergeRunsById([kept, runs.value?.runs ?? []]).find(run => getRunVerdict(run) === 'failed') ?? null;
    });

    // Opened, or another in its place: its runs read anew, and its file.
    watch(
        () => (target.value ? JSON.stringify(target.value) : null),
        () => {
            if (target.value) {
                history.open(target.value);
            }

            if (fileTarget.value) {
                files.read(fileTarget.value);
            }
        },
        { immediate: true },
    );

    return reactive<OpenedWorkflowViewModel>({
        nameWithOwner,
        state,
        details,
        runs,
        target,
        refGroups,
        tags: computed(() => stored.value?.tags ?? []),
        latestFailure,
        missing: computed(() => stored.value !== undefined && state.value === null),
    });
}
