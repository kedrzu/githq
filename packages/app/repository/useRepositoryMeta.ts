import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import type { MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';

import * as l from './RepositoryView.loc.js';

/**
 * "Public" or "Private" beside a repository's name; empty while nothing of it is in the local copy to tell.
 *
 * @util
 */
export function useRepositoryMeta(isPrivate: MaybeRefOrGetter<boolean | null>) {
    const t = useTranslate();

    return computed(() => {
        const value = toValue(isPrivate);
        return value === null ? '' : t(value ? l.private : l.public);
    });
}
