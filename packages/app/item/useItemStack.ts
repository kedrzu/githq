import { useService } from '@nzyme/vue-ioc/useService.js';
import { makeRef } from '@nzyme/vue-utils/reactivity/makeRef.js';
import { computed } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';

import { AuthStore } from '@/auth/AuthStore.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item } from '@/store/ItemTypes.js';
import type { StackDescription } from '@/store/stacks/describeStack.js';
import { describeStackInCopy } from '@/store/stacks/describeStackInCopy.js';

/**
 * The stack an opened pull request is in, from the local copy alone — no request (stacked PRs D17). `null` outside one,
 * and with fewer than two of its pull requests in the copy: there is nothing to show of it yet.
 */
export function useItemStack(item: MaybeRefOrGetter<Item | null>): ComputedRef<StackDescription | null> {
    const items = useService(ItemStore);
    const details = useService(ItemDetailStore);
    const auth = useService(AuthStore);

    const opened = makeRef(item);

    return computed(() => {
        const current = opened.value;
        if (current?.kind !== 'pullRequest' || current.stack === null) {
            return null;
        }

        const description = describeStackInCopy({
            stackId: current.stack.id,
            item: current,
            items: items.all,
            viewerLogin: auth.viewer?.login ?? '',
            getItem: id => details.getItem(id),
        });
        return description && description.held >= 2 ? description : null;
    });
}
