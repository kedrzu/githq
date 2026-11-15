import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { reactive } from '@nzyme/vue-utils/reactivity/reactive.js';
import { computed, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getRouteNameWithOwner } from '@/tracking/trackingRoutes.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import * as l from './useSettingsOrigin.loc.js';

/** Options of {@link useSettingsOrigin}. */
export interface UseSettingsOriginOptions {
    /** The list of the sections is shown: only then is where it was opened from read. */
    shown: MaybeRefOrGetter<boolean>;
}

/** Where a phone's list of Settings' sections was opened from (mobile MB146: "‹ My work"). */
export interface SettingsOriginViewModel {
    /** There is an entry of the app's behind the list: back, else the places button. */
    readonly exists: boolean;
    /** What it is called — My work, a repository, a tracked project — or `null` for a screen with no short name ("Back"). */
    readonly place: string | null;
}

/**
 * Where a phone's list of Settings' sections returns to: the entry behind it in the history, as the list is shown —
 * read again whenever it is shown anew, for a section's screen pushed over it has the list behind it instead. The place's
 * name comes from its address.
 */
export function useSettingsOrigin(options: UseSettingsOriginOptions): SettingsOriginViewModel {
    const route = useRoute();
    const router = useRouter();
    const tracking = useService(TrackingStore);
    const t = useTranslate();

    const origin = shallowRef<string | null>(null);

    // The history's entry is already the one shown when the route changes, Back and Forward included.
    watch(
        () => [route.fullPath, toValue(options.shown)] as const,
        ([, shown]) => {
            if (shown) {
                const back = router.options.history.state.back;
                origin.value = typeof back === 'string' ? back : null;
            }
        },
        { immediate: true },
    );

    const place = computed(() => (origin.value === null ? null : getPlace(origin.value)));

    return reactive<SettingsOriginViewModel>({
        exists: computed(() => origin.value !== null),
        place,
    });

    function getPlace(path: string) {
        const target = router.resolve(path);
        const name = typeof target.name === 'string' ? target.name : '';
        if (name === 'my-work' || name.startsWith('my-work-')) {
            return t(l.myWork);
        }

        switch (name) {
            case 'repository':
                return getRouteNameWithOwner(target);
            case 'project-org':
            case 'project-user': {
                const number = Number(target.params.number);
                const ownerKind = name === 'project-org' ? 'org' : 'user';
                return (
                    tracking.projects.find(
                        project =>
                            project.owner === target.params.owner &&
                            project.ownerKind === ownerKind &&
                            project.number === number,
                    )?.title ?? null
                );
            }
            default:
                return null;
        }
    }
}
