import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { computed, shallowRef } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';

import { TrackingStore } from './TrackingStore.js';

/** A look-up that came back with nothing, and whose it was. */
interface FailedLookup {
    readonly nameWithOwner: string;
    readonly login: string | undefined;
}

/**
 * Tracks a repository known only by its address (D34): its id is GitHub's, so it is looked up first. A look-up that
 * finds nothing tracks nothing and stays here for `TrackFailedToast`, until dismissed or tried again, and only for the
 * account that asked. A service, as the toast outlives the screen the user asked from.
 */
export type RepositoryTracker = Resolved<typeof RepositoryTracker>;
export const RepositoryTracker = defineService({
    name: 'RepositoryTracker',
    deps: {
        auth: AuthStore,
        tracking: TrackingStore,
    },
    setup({ auth, tracking }) {
        const failedRef = shallowRef<FailedLookup | null>(null);
        const failedName = computed(() =>
            failedRef.value?.login === auth.viewer?.login ? (failedRef.value?.nameWithOwner ?? null) : null,
        );

        return {
            /** `owner/name` of the repository the last look-up found nothing for; reactive. */
            get failedName() {
                return failedName.value;
            },
            track,
            dismissFailure,
        };

        /**
         * Asked twice while looking up, both answers arrive and the second changes nothing: `TrackingStore.track`
         * ignores a name it tracks. It is tracked under GitHub's own name, whatever case the address had.
         */
        async function track(nameWithOwner: string) {
            const [owner = '', name = ''] = nameWithOwner.split('/');
            const login = auth.viewer?.login;
            failedRef.value = null;

            const found = await tracking.findCandidate({ kind: 'repository', owner, name });
            if (found && 'nameWithOwner' in found) {
                tracking.track({ repository: { nameWithOwner: found.nameWithOwner, id: found.id } });
            } else {
                failedRef.value = { nameWithOwner, login };
            }
        }

        function dismissFailure() {
            failedRef.value = null;
        }
    },
});
