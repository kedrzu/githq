import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { computed, shallowRef, triggerRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { Browser } from '@/services/Browser.js';
import type { ProjectField } from '@/store/ItemDetailTypes.js';
import { ItemOverlay } from '@/store/ItemOverlay.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item, ItemProject } from '@/store/ItemTypes.js';
import { TabChannel } from '@/sync/TabChannel.js';
import { createTabInbox } from '@/sync/createTabInbox.js';
import type { TabInbox } from '@/sync/createTabInbox.js';
import type { TabMessage } from '@/sync/TabChannel.js';
import { TrackingStore } from '@/tracking/TrackingStore.js';

import type { PersistedProject, ProjectItemChanges } from './ProjectPersistence.js';
import { ProjectPersistence } from './ProjectPersistence.js';
import type { Project, ProjectItem } from './ProjectTypes.js';

/** How long item changes gather in memory before they are written in one go. */
const WRITE_DELAY_MS = 200;

/** A select field: a row shows a single-select one (D12). */
export type RowField = Extract<ProjectField, { options: unknown }>;

/** The signed-in user the projects are kept for, captured when they signed in. */
interface Session {
    readonly account: Account;
    /** Resolves once the kept projects are in memory; never rejects. */
    ready: Promise<void>;
    /** Project items changed in memory since the last write: written when in memory, deleted when not. */
    readonly dirtyIds: Set<string>;
    timer: ReturnType<typeof setTimeout> | null;
    /** The write of project items on its way, until it is done. */
    writing: ProjectItemChanges | null;
    /** What other tabs send: held until the kept copy is read, then taken in over it. */
    readonly inbox: TabInbox;
}

/**
 * The tracked projects of the signed-in user (D4, D17): each project's fields, saved views and row field (D12),
 * and its items — issues and pull requests by their node id (their rows are in the item store), draft issues
 * whole — with every field value. Every project view reads it from memory; the sync writes into it.
 *
 * Kept in the account's local copy, written behind in batches like the item store; it follows the signed-in
 * user the same way. The user's changes on their way are drawn over the items as they are read
 * ({@link ItemOverlay}), and the draft issues being added are shown with them. Like the item store, it sends its
 * changes to the user's other tabs and takes theirs into memory, sends a tab that opens what it has not written
 * yet, and writes it at once when it is closed.
 */
export type ProjectStore = Resolved<typeof ProjectStore>;
export const ProjectStore = defineService({
    name: 'ProjectStore',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        tracking: TrackingStore,
        persistence: ProjectPersistence,
        overlay: ItemOverlay,
        tabs: TabChannel,
        browser: Browser,
        logger: Logger,
    },
    setup({ accounts, items, tracking, persistence, overlay, tabs, browser, logger }) {
        const projectsRef = shallowRef<ReadonlyMap<string, PersistedProject>>(new Map());
        const itemsRef = shallowRef(new Map<string, ProjectItem>());
        const loadedRef = shallowRef(false);

        const itemsByProject = computed(() => {
            const byProject = new Map<string, ProjectItem[]>();
            for (const item of itemsRef.value.values()) {
                const list = byProject.get(item.projectId) ?? [];
                list.push(item);
                byProject.set(item.projectId, list);
            }

            return byProject;
        });
        const contentIds = computed(() => {
            const tracked = new Set(tracking.projects.map(project => project.id));
            const ids = new Set<string>();
            for (const item of itemsRef.value.values()) {
                // A read still on its way when the project was untracked must not keep its items.
                if (item.contentId !== null && tracked.has(item.projectId)) {
                    ids.add(item.contentId);
                }
            }

            return ids;
        });

        let session: Session | null = null;

        accounts.onChange(follow);
        tabs.onMessage(receive);
        tabs.onTabJoined(publishUnwritten);
        browser.onPageLifecycle(event => {
            if (event === 'pagehide') {
                void flush();
            }
        });

        return {
            /** Whether the signed-in user's kept projects are in memory; reactive. */
            get loaded() {
                return loadedRef.value;
            },
            get,
            getItems,
            getStoredItems,
            getStoredItem,
            holdsContent,
            getRowField,
            setRowField,
            withRowFields,
            setProject,
            upsertItems,
            replaceItems,
            removeItems,
            removeProject,
            patchItems,
            flush,
        };

        /** The tracked project as last read, or `undefined`; reactive. */
        function get(projectId: string): Project | undefined {
            return projectsRef.value.get(projectId)?.project;
        }

        /**
         * The project's items, archived ones included, with the user's changes on their way drawn over them and the
         * draft issues being added after them; reactive.
         */
        function getItems(projectId: string): readonly ProjectItem[] {
            const stored = itemsByProject.value.get(projectId) ?? [];
            const shown = stored.map(item => overlay.applyToProjectItem(item));
            for (const added of overlay.getAddedProjectItems(projectId)) {
                if (!itemsRef.value.has(added.itemId)) {
                    shown.push(added);
                }
            }

            return shown;
        }

        /** The project's items as GitHub last gave them — what the sync compares and replaces; reactive. */
        function getStoredItems(projectId: string): readonly ProjectItem[] {
            return itemsByProject.value.get(projectId) ?? [];
        }

        /** The project item as GitHub last gave it, by its id; reactive. */
        function getStoredItem(itemId: string) {
            return itemsRef.value.get(itemId);
        }

        /** Whether a tracked project holds the issue or pull request — it is kept whatever "my work" says; reactive. */
        function holdsContent(contentId: string) {
            return contentIds.value.has(contentId);
        }

        /**
         * The project's row field (D12): the one the user picked; else its single-select named "Status"; else its
         * first single-select; else none. Reactive.
         */
        function getRowField(projectId: string): RowField | null {
            const kept = projectsRef.value.get(projectId);
            if (!kept) {
                return null;
            }

            const selects = kept.project.fields.filter(isSingleSelect);
            if (kept.rowFieldId !== undefined) {
                return selects.find(field => field.id === kept.rowFieldId) ?? null;
            }

            return selects.find(field => field.name === 'Status') ?? selects[0] ?? null;
        }

        /** Picks the project's row field (`null`: none; `undefined`: back to the default). Kept in the local copy. */
        function setRowField(projectId: string, fieldId: string | null | undefined) {
            const kept = projectsRef.value.get(projectId);
            if (!kept) {
                return;
            }

            save(fieldId === undefined ? { project: kept.project } : { project: kept.project, rowFieldId: fieldId });
        }

        /**
         * The row with its projects as a list outside them shows them (D12): the tracked ones first, in the
         * sidebar's order, the others after; each tracked one's `status` is its row field's value as the project
         * holds it — the others keep their "Status". Reactive.
         */
        function withRowFields(item: Item): Item {
            if (item.projects.length === 0 || projectsRef.value.size === 0) {
                return item;
            }

            const order = new Map(tracking.projects.map((project, index) => [project.id, index]));
            const projects = item.projects
                .map(place => withRowField(place))
                .toSorted(
                    (a, b) =>
                        (order.get(a.projectId) ?? Number.POSITIVE_INFINITY) -
                        (order.get(b.projectId) ?? Number.POSITIVE_INFINITY),
                );
            return { ...item, projects };
        }

        function withRowField(place: ItemProject): ItemProject {
            if (!projectsRef.value.has(place.projectId)) {
                return place;
            }

            const stored = itemsRef.value.get(place.itemId);
            if (!stored) {
                // Not read yet (the project is still arriving): its "Status" stands in.
                return place;
            }

            const field = getRowField(place.projectId);
            const value = field ? overlay.applyToProjectItem(stored).values[field.id] : undefined;
            return {
                ...place,
                status:
                    value?.kind === 'singleSelect' && value.name !== null
                        ? { name: value.name, color: value.color, optionId: value.optionId }
                        : null,
            };
        }

        /** Adds the project or replaces what was read of it, keeping the user's row field. Ignored while signed out. */
        function setProject(project: Project) {
            const kept = projectsRef.value.get(project.id);
            save(kept?.rowFieldId === undefined ? { project } : { project, rowFieldId: kept.rowFieldId });
        }

        /**
         * Adds the project items or replaces them (by id), except over a newer copy — one an edit GitHub confirmed
         * after the read. Ignored while signed out.
         */
        function upsertItems(read: Iterable<ProjectItem>) {
            const current = session;
            if (!current) {
                return;
            }

            const upserted = [...read].filter(item => !isOlder(item));
            if (upserted.length === 0) {
                return;
            }

            for (const item of upserted) {
                itemsRef.value.set(item.itemId, item);
                current.dirtyIds.add(item.itemId);
            }

            triggerRef(itemsRef);
            scheduleWrite(current);
            tabs.publish({ kind: 'projectItems', upserted, removed: [] });
        }

        /** The project's items are exactly these (a full read): the ones not among them leave. */
        function replaceItems(projectId: string, read: readonly ProjectItem[]) {
            const ids = new Set(read.map(item => item.itemId));
            removeItems(
                getStoredItems(projectId)
                    .filter(item => !ids.has(item.itemId))
                    .map(item => item.itemId),
            );
            upsertItems(read);
        }

        /** Removes the project items (by id). Ignored while signed out. */
        function removeItems(ids: Iterable<string>) {
            const current = session;
            if (!current) {
                return;
            }

            const removed = [...ids];
            if (removed.length === 0) {
                return;
            }

            for (const id of removed) {
                itemsRef.value.delete(id);
                current.dirtyIds.add(id);
            }

            triggerRef(itemsRef);
            scheduleWrite(current);
            tabs.publish({ kind: 'projectItems', upserted: [], removed });
        }

        /** Forgets the project and its items — no longer tracked. */
        function removeProject(projectId: string) {
            const current = session;
            if (!current) {
                return;
            }

            for (const item of getStoredItems(projectId)) {
                current.dirtyIds.delete(item.itemId);
            }

            forgetProject(projectId);

            tabs.publish({ kind: 'projectRemoved', projectId });
            persistence.deleteProject(current.account.login, projectId).catch((error: unknown) => {
                if (isCurrent(current)) {
                    logger.warn('Could not delete an untracked project', { error });
                }
            });
        }

        /**
         * Changes the items of an issue, pull request or draft (by its node id, a draft's by its project item id)
         * in every tracked project — an edit GitHub confirmed.
         */
        function patchItems(id: string, change: (item: ProjectItem) => ProjectItem) {
            const changed: ProjectItem[] = [];
            for (const item of itemsRef.value.values()) {
                if ((item.contentId ?? item.itemId) === id) {
                    changed.push(change(item));
                }
            }

            if (changed.length > 0) {
                upsertItems(changed);
            }
        }

        /** Writes the item changes gathered so far now, instead of after the delay; never rejects. */
        async function flush() {
            const current = session;
            if (!current) {
                return;
            }

            if (current.timer !== null) {
                clearTimeout(current.timer);
                current.timer = null;
            }

            await current.ready;
            if (!isCurrent(current) || current.dirtyIds.size === 0) {
                return;
            }

            const changes: { upserted: ProjectItem[]; removed: string[] } = { upserted: [], removed: [] };
            for (const id of current.dirtyIds) {
                const item = itemsRef.value.get(id);
                if (item) {
                    changes.upserted.push(item);
                } else {
                    changes.removed.push(id);
                }
            }

            current.dirtyIds.clear();
            current.writing = changes;
            try {
                await persistence.saveProjectItems(current.account.login, changes);
            } catch (error) {
                if (!isCurrent(current)) {
                    return;
                }

                logger.warn('Could not write the project items; they are tried again with the next change', {
                    error,
                });
                markUnwritten(current, changes);
            } finally {
                if (current.writing === changes) {
                    current.writing = null;
                }
            }
        }

        /**
         * Sends a tab that just opened the project items this one changed and has not written yet: reading the
         * copy, it does not find them there, and the messages that carried them were sent before it listened.
         */
        function publishUnwritten() {
            const current = session;
            if (!current || !loadedRef.value) {
                return;
            }

            const { writing } = current;
            const ids = new Set([
                ...current.dirtyIds,
                ...(writing?.upserted.map(item => item.itemId) ?? []),
                ...(writing?.removed ?? []),
            ]);
            const upserted: ProjectItem[] = [];
            const removed: string[] = [];
            for (const id of ids) {
                const item = itemsRef.value.get(id);
                if (item) {
                    upserted.push(item);
                } else {
                    removed.push(id);
                }
            }

            if (ids.size > 0) {
                tabs.publish({ kind: 'projectItems', upserted, removed });
            }
        }

        /** The project and its items leave memory. */
        function forgetProject(projectId: string) {
            const next = new Map(projectsRef.value);
            next.delete(projectId);
            projectsRef.value = next;
            for (const item of getStoredItems(projectId)) {
                itemsRef.value.delete(item.itemId);
            }

            triggerRef(itemsRef);
        }

        /** Takes in what another tab of the user changed — in memory only: that tab writes it. */
        function receive(message: TabMessage, login: string) {
            const current = session;
            if (current?.account.login !== login) {
                return;
            }

            current.inbox.deliver(message);
        }

        function takeIn(message: TabMessage) {
            switch (message.kind) {
                case 'project':
                    projectsRef.value = new Map(projectsRef.value).set(message.project.project.id, message.project);
                    break;
                case 'projectRemoved':
                    forgetProject(message.projectId);
                    break;
                case 'projectItems':
                    for (const item of message.upserted) {
                        if (!isOlder(item)) {
                            itemsRef.value.set(item.itemId, item);
                        }
                    }

                    for (const id of message.removed) {
                        itemsRef.value.delete(id);
                    }

                    triggerRef(itemsRef);
                    break;
                default:
                    break;
            }
        }

        /**
         * Whether the project item is older than the one held. A confirmed edit of its values writes GitHub's
         * `updatedAt` of the edit into it, so a copy read before the edit is older.
         */
        function isOlder(item: ProjectItem) {
            const held = itemsRef.value.get(item.itemId);
            return held !== undefined && item.updatedAt < held.updatedAt;
        }

        function save(kept: PersistedProject) {
            const current = session;
            if (!current) {
                return;
            }

            projectsRef.value = new Map(projectsRef.value).set(kept.project.id, kept);
            tabs.publish({ kind: 'project', project: kept });
            persistence.saveProject(current.account.login, kept).catch((error: unknown) => {
                if (isCurrent(current)) {
                    logger.warn('Could not keep a tracked project', { error });
                }
            });
        }

        function scheduleWrite(current: Session) {
            current.timer ??= setTimeout(() => {
                current.timer = null;
                void flush();
            }, WRITE_DELAY_MS);
        }

        function markUnwritten(current: Session, changes: ProjectItemChanges) {
            for (const item of changes.upserted) {
                current.dirtyIds.add(item.itemId);
            }

            for (const id of changes.removed) {
                current.dirtyIds.add(id);
            }

            scheduleWrite(current);
        }

        /** Another account signed in, or none: the projects of whoever was before leave memory. */
        function follow(account: Account | null) {
            if (session?.timer != null) {
                clearTimeout(session.timer);
            }

            session = null;
            projectsRef.value = new Map();
            itemsRef.value = new Map();
            loadedRef.value = false;
            if (!account) {
                return;
            }

            const current: Session = {
                account,
                ready: Promise.resolve(),
                dirtyIds: new Set(),
                timer: null,
                writing: null,
                inbox: createTabInbox(takeIn),
            };
            session = current;
            current.ready = readKept(current);
        }

        /**
         * Puts the kept projects into memory once the item store and the tracking choice are in, under what was read
         * since. One no longer tracked — written by a read that came in after it was untracked — is deleted.
         */
        async function readKept(current: Session) {
            await Promise.all([items.ready(), tracking.ready()]);
            if (!isCurrent(current)) {
                return;
            }

            try {
                const persisted = await persistence.loadProjects(current.account.login);
                if (!isCurrent(current)) {
                    return;
                }

                const untracked = new Set<string>();
                const projects = new Map<string, PersistedProject>();
                for (const kept of persisted.projects) {
                    if (isTracked(kept.project.id)) {
                        projects.set(kept.project.id, kept);
                    } else {
                        untracked.add(kept.project.id);
                    }
                }

                projectsRef.value = new Map([...projects, ...projectsRef.value]);
                for (const item of persisted.items) {
                    if (!isTracked(item.projectId)) {
                        untracked.add(item.projectId);
                    } else if (!current.dirtyIds.has(item.itemId)) {
                        itemsRef.value.set(item.itemId, item);
                    }
                }

                triggerRef(itemsRef);
                for (const projectId of untracked) {
                    persistence.deleteProject(current.account.login, projectId).catch((error: unknown) => {
                        if (isCurrent(current)) {
                            logger.warn('Could not delete an untracked project', { error });
                        }
                    });
                }
            } catch (error) {
                logger.warn('Could not read the kept projects; reading them again from GitHub', { error });
            }

            if (isCurrent(current)) {
                loadedRef.value = true;
                current.inbox.open();
            }
        }

        function isTracked(projectId: string) {
            return tracking.isTracked({ kind: 'project', id: projectId });
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});

function isSingleSelect(field: ProjectField): field is RowField {
    return field.kind === 'singleSelect';
}
