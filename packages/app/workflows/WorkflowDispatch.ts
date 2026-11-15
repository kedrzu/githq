import { dispatchWorkflow } from '@githq/github/rest/dispatchWorkflow.js';
import { getWorkflowRun } from '@githq/github/rest/getWorkflowRun.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Clock } from '@/services/Clock.js';
import { GitHubRateLimitStore } from '@/services/GitHubRateLimitStore.js';
import { getAllowancePause } from '@/sync/getAllowancePause.js';

import { getDispatchReason } from './utils/getDispatchReason.js';
import type { WorkflowDispatchReason } from './utils/getDispatchReason.js';
import { WorkflowRunHistory } from './WorkflowRunHistory.js';

/** A workflow to run, on what, with what. */
export interface WorkflowDispatchParams {
    /** `owner/name`. */
    readonly nameWithOwner: string;
    readonly workflowId: number;
    readonly workflowName: string;
    /** The branch or tag it runs on. */
    readonly ref: string;
    /** Only the inputs the user entered or changed: GitHub applies the file's defaults to the rest. */
    readonly inputs: Readonly<Record<string, string | number | boolean>>;
}

/** What a dispatch asked for: what its toast names. */
interface WorkflowDispatchAsked {
    readonly nameWithOwner: string;
    readonly workflowName: string;
    readonly ref: string;
    readonly inputs: Readonly<Record<string, string | number | boolean>>;
    /** Epoch ms it was answered: its toast's key. */
    readonly at: number;
}

/** A run the user started (W39): its toast names it and opens it. */
export interface WorkflowDispatchStarted extends WorkflowDispatchAsked {
    readonly runId: number;
    /** `null` when the run could not be read after GitHub started it. */
    readonly runNumber: number | null;
}

/** A dispatch GitHub did not take, and why. */
export interface WorkflowDispatchFailure extends WorkflowDispatchAsked {
    readonly reason: WorkflowDispatchReason;
}

/** What the toasts say; `null` for none. */
interface DispatchNews {
    readonly started: WorkflowDispatchStarted | null;
    readonly failure: WorkflowDispatchFailure | null;
}

/** Runs a workflow by hand (W37, W39). */
export interface WorkflowDispatchShape {
    /** The run started last, while its toast shows; reactive. */
    readonly started: WorkflowDispatchStarted | null;
    /** The dispatch refused last, while its toast shows; reactive. */
    readonly failure: WorkflowDispatchFailure | null;
    /**
     * Asks GitHub to run the workflow; once it has, reads the run for its number, says so and puts the run at the top of
     * the workflow's runs. A refusal is said instead. Nothing is asked while the core allowance is used up.
     */
    dispatch(params: WorkflowDispatchParams): Promise<void>;
    dismissStarted(): void;
    dismissFailure(): void;
}

const NO_NEWS: DispatchNews = { started: null, failure: null };

/**
 * Running a workflow by hand (actions W37, W39): no item's edit, so outside the `EditQueue`, and nothing shown before
 * GitHub answers — the run it starts is GitHub's, with an id and a number only GitHub gives.
 */
export type WorkflowDispatch = Resolved<typeof WorkflowDispatch>;
export const WorkflowDispatch = defineService({
    name: 'WorkflowDispatch',
    deps: {
        accounts: AccountSession,
        history: WorkflowRunHistory,
        rateLimits: GitHubRateLimitStore,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, history, rateLimits, clock, logger }): WorkflowDispatchShape {
        const newsRef = shallowRef<DispatchNews>(NO_NEWS);

        accounts.onChange(() => {
            newsRef.value = NO_NEWS;
        });

        return {
            get started() {
                return newsRef.value.started;
            },
            get failure() {
                return newsRef.value.failure;
            },
            dispatch,
            dismissStarted,
            dismissFailure,
        };

        async function dispatch(params: WorkflowDispatchParams) {
            const account = accounts.current;
            if (!account) {
                return;
            }

            const { nameWithOwner, workflowId, workflowName, ref, inputs } = params;
            const asked = { nameWithOwner, workflowName, ref, inputs };
            const pause = getAllowancePause(rateLimits.get('core'), clock.now());
            if (pause) {
                fail({ ...asked, at: clock.now(), reason: { kind: 'allowance', until: pause.until } });
                return;
            }

            let runId: number;
            try {
                ({ runId } = await dispatchWorkflow(account.rest, {
                    nameWithOwner,
                    workflowId,
                    ref,
                    inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
                }));
            } catch (error) {
                if (accounts.isCurrent(account)) {
                    logger.warn('GitHub did not run a workflow', { error });
                    const reason = getDispatchReason({ error, limit: rateLimits.get('core'), now: clock.now() });
                    fail({ ...asked, at: clock.now(), reason });
                }

                return;
            }

            const runNumber = await readStartedRun(account, { nameWithOwner, workflowId, runId });
            if (accounts.isCurrent(account)) {
                newsRef.value = { failure: null, started: { ...asked, runId, runNumber, at: clock.now() } };
            }
        }

        /** The started run's number, the run put at the top of its workflow's runs; `null` when it can't be read. */
        async function readStartedRun(account: Account, { nameWithOwner, workflowId, runId }: StartedRun) {
            try {
                const answer = await getWorkflowRun(account.rest, { nameWithOwner, runId });
                if (answer.status !== 200 || !accounts.isCurrent(account)) {
                    return null;
                }

                history.addRun({ nameWithOwner, workflowId }, answer.run);
                return answer.run.runNumber;
            } catch (error) {
                logger.warn('Could not read the run a workflow dispatch started', { error });
                return null;
            }
        }

        function fail(failure: WorkflowDispatchFailure) {
            newsRef.value = { started: null, failure };
        }

        function dismissStarted() {
            newsRef.value = { ...newsRef.value, started: null };
        }

        function dismissFailure() {
            newsRef.value = { ...newsRef.value, failure: null };
        }
    },
});

/** The run a dispatch started, to read. */
interface StartedRun {
    readonly nameWithOwner: string;
    readonly workflowId: number;
    readonly runId: number;
}
