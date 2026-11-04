import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';

/** Where the user is in a repository's Workflows section. */
export interface WorkflowTabPlace {
    /** The selected row's key; `null` until the user moves. */
    readonly selected: string | null;
    /** The unfolded workflow's row's key; `null` with none. */
    readonly unfolded: string | null;
    /** The ref the unfolded workflow's runs are filtered by; `null`: every ref. */
    readonly refFilter: string | null;
}

const NOWHERE: WorkflowTabPlace = { selected: null, unfolded: null, refFilter: null };

/**
 * Where the user was in each repository's Workflows section and on the broken workflows' screen, so P or a run's page and
 * back to it lands on the same row, unfolded as it was (actions W13, W4a) — the screen is gone meanwhile. For this
 * session of the app, never persisted; forgotten when another account signs in.
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

        accounts.onChange(() => {
            placesRef.value = new Map();
            brokenSelectedRef.value = null;
        });

        return {
            /** The selected row's key on the broken workflows' screen; `null` until the user moves. Reactive. */
            get brokenSelected() {
                return brokenSelectedRef.value;
            },
            setBrokenSelected,
            get,
            update,
        };

        function setBrokenSelected(key: string | null) {
            brokenSelectedRef.value = key;
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
