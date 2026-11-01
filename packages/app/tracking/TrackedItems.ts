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
 * "my work" has it, its repository is tracked, or a tracked project holds it (D4) — and a pull request while
 * another of its stack stays for one of those (stacked PRs, D7). When the user stops tracking a repository or
 * project, its items go — those nothing else keeps.
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
        const privateRepositories = computed(() => {
            const names = new Set<string>();
            for (const item of items.all) {
                if (item.repository.isPrivate) {
                    names.add(item.repository.nameWithOwner);
                }
            }

            return names;
        });
        // The stacks with a pull request kept for itself: the rest of each is kept with it.
        const keptStacks = computed(() => {
            const ids = new Set<string>();
            for (const item of items.all) {
                if (item.kind === 'pullRequest' && item.stack && keepsForItself(item)) {
                    ids.add(item.stack.id);
                }
            }

            return ids;
        });

        tracking.onUntrack(dropUntracked);

        return { keeps, keepsForItself, evict, getOpenCount, isPrivate };

        /**
         * Whether the local copy keeps the item: "my work" has it, a tracked repository or project, or it is a pull
         * request of a stack another of which one of those has; reactive.
         */
        function keeps(item: Item) {
            return (
                keepsForItself(item) ||
                (item.kind === 'pullRequest' && item.stack !== null && keptStacks.value.has(item.stack.id))
            );
        }

        /**
         * Whether the local copy keeps the item for itself — "my work" has it, a tracked repository or project — rather
         * than only for its stack, whose pull requests nothing else re-reads.
         */
        function keepsForItself(item: Item) {
            const { membership } = items;
            return (
                MY_WORK_GROUPS.some(group => membership[group]?.has(item.id)) ||
                tracking.isTracked({ kind: 'repository', nameWithOwner: item.repository.nameWithOwner }) ||
                projects.holdsContent(item.id)
            );
        }

        /**
         * Removes from the item store those of `ids` nothing keeps any more, and the rest of their stacks kept only
         * with them; returns their ids.
         */
        function evict(ids: Iterable<string>) {
            const left = new Set<string>();
            const stacks = new Set<string>();
            for (const id of ids) {
                const item = items.getStored(id);
                if (item && !keeps(item)) {
                    left.add(id);
                    if (item.kind === 'pullRequest' && item.stack) {
                        stacks.add(item.stack.id);
                    }
                }
            }

            if (stacks.size > 0) {
                for (const item of items.all) {
                    if (item.kind === 'pullRequest' && item.stack && stacks.has(item.stack.id) && !keeps(item)) {
                        left.add(item.id);
                    }
                }
            }

            if (left.size > 0) {
                items.remove(left);
            }

            return [...left];
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

        /** Whether the repository is private, as its kept items tell; `false` while none are kept. Reactive. */
        function isPrivate(nameWithOwner: string) {
            return privateRepositories.value.has(nameWithOwner);
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
