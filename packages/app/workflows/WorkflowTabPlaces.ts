import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';

/** Where the user is in a repository's Workflows section. */
export interface WorkflowTabPlace {
    /** The selected row's key; `null` until the user moves or opens a workflow. */
    readonly selected: string | null;
    /**
     * The workflow opened last (`ItemNavigation.lastOpenedId`) the selection already went to: one opened since — a step
     * of `⇧J`/`⇧K` on its page — takes the selection; this one no longer overrides where the user moved.
     */
    readonly followed: string | null;
}

const NOWHERE: WorkflowTabPlace = { selected: null, followed: null };

/**
 * Where the user was in each repository's Workflows section, on the broken workflows' screen and among each opened
 * workflow's runs, so P, a run's page or a workflow's and back to it lands on the same row (actions W13, W4a, D15) — the
 * screen is gone meanwhile. For this session of the app, never persisted; forgotten when another account signs in.
 */
export type WorkflowTabPlaces = Resolved<typeof WorkflowTabPlaces>;
export const WorkflowTabPlaces = defineService({
    name: 'WorkflowTabPlaces',
    deps: {
        accounts: AccountSession,
    },
    setup({ accounts }) {
        const placesRef = shallowRef<ReadonlyMap<string, WorkflowTabPlace>>(new Map());
        const brokenSelectedRef = shallowRef<string | null>(null);
        const runsSelectedRef = shallowRef<ReadonlyMap<string, string>>(new Map());

        accounts.onChange(() => {
            placesRef.value = new Map();
            brokenSelectedRef.value = null;
            runsSelectedRef.value = new Map();
        });

        return {
            /** The selected row's key on the broken workflows' screen; `null` until the user moves. Reactive. */
            get brokenSelected() {
                return brokenSelectedRef.value;
            },
            setBrokenSelected,
            getRunSelected,
            setRunSelected,
            get,
            update,
        };

        function setBrokenSelected(key: string | null) {
            brokenSelectedRef.value = key;
        }

        /**
         * The selected run's row key among the runs of the workflow keyed `workflowKey` (`WorkflowRoutes.formatKey`);
         * `null` until the user moves or opens one. Reactive.
         */
        function getRunSelected(workflowKey: string): string | null {
            return runsSelectedRef.value.get(workflowKey) ?? null;
        }

        function setRunSelected(workflowKey: string, runKey: string | null) {
            const next = new Map(runsSelectedRef.value);
            if (runKey === null) {
                next.delete(workflowKey);
            } else {
                next.set(workflowKey, runKey);
            }

            runsSelectedRef.value = next;
        }

        /** Where the user was in the repository's tab; reactive. */
        function get(nameWithOwner: string): WorkflowTabPlace {
            return placesRef.value.get(nameWithOwner) ?? NOWHERE;
        }

        function update(nameWithOwner: string, change: Partial<WorkflowTabPlace>) {
            placesRef.value = new Map(placesRef.value).set(nameWithOwner, { ...get(nameWithOwner), ...change });
        }
    },
});
