import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { computed } from 'vue';

import { ProjectStore } from '@/projects/ProjectStore.js';
import { ItemStore } from '@/store/ItemStore.js';
import { MY_WORK_GROUPS } from '@/store/ItemStoreTypes.js';
import type { Item } from '@/store/ItemTypes.js';

import { TrackingStore } from './TrackingStore.js';
import type { TrackedTarget } from './TrackingTypes.js';

/**
 * Which items the local copy keeps, and what each tracked repository and project holds: an item stays while
 * "my work" has it, its repository is tracked, or a tracked project holds it (D4). When the user stops tracking
 * a repository or project, its items go — those nothing else keeps.
 */
export type TrackedItems = Resolved<typeof TrackedItems>;
export const TrackedItems = defineService({
    name: 'TrackedItems',
    deps: {
        items: ItemStore,
        tracking: TrackingStore,
        projects: ProjectStore,
        logger: Logger,
    },
    setup({ items, tracking, projects, logger }) {
        const openByRepository = computed(() => {
            const counts = new Map<string, number>();
            for (const item of items.all) {
                if (item.state === 'OPEN') {
                    const name = item.repository.nameWithOwner;
                    counts.set(name, (counts.get(name) ?? 0) + 1);
                }
            }

            return counts;
        });

        tracking.onUntrack(dropUntracked);

        return { keeps, evict, getOpenCount };

        /** Whether the local copy keeps the item: "my work" has it, or a tracked repository or project; reactive. */
        function keeps(item: Item) {
            const { membership } = items;
            return (
                MY_WORK_GROUPS.some(group => membership[group]?.has(item.id)) ||
                tracking.isTracked({ kind: 'repository', nameWithOwner: item.repository.nameWithOwner }) ||
                projects.holdsContent(item.id)
            );
        }

        /** Removes from the item store those of `ids` nothing keeps any more; returns their ids. */
        function evict(ids: Iterable<string>) {
            const left: string[] = [];
            for (const id of ids) {
                const item = items.getStored(id);
                if (item && !keeps(item)) {
                    left.push(id);
                }
            }

            if (left.length > 0) {
                items.remove(left);
            }

            return left;
        }

        /**
         * The open items of a tracked repository or project, for the sidebar: open issues and pull requests, and a
         * project's draft issues; archived project items left out. Reactive.
         */
        function getOpenCount(target: TrackedTarget) {
            if (target.kind === 'repository') {
                return openByRepository.value.get(target.nameWithOwner) ?? 0;
            }

            let count = 0;
            for (const place of projects.getItems(target.id)) {
                if (place.isArchived) {
                    continue;
                }

                const content = place.contentId === null ? null : items.get(place.contentId);
                if (place.draft || content?.state === 'OPEN') {
                    count++;
                }
            }

            return count;
        }

        function dropUntracked(target: TrackedTarget) {
            let ids: string[];
            if (target.kind === 'repository') {
                ids = [];
                for (const item of items.all) {
                    if (item.repository.nameWithOwner === target.nameWithOwner) {
                        ids.push(item.id);
                    }
                }
            } else {
                ids = [];
                for (const place of projects.getStoredItems(target.id)) {
                    if (place.contentId !== null) {
                        ids.push(place.contentId);
                    }
                }

                projects.removeProject(target.id);
            }

            const removed = evict(ids);
            logger.debug('Untracked copy dropped', { target: target.kind, removed: removed.length });
        }
    },
});
