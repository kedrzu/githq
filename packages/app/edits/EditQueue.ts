import { GitHubApiError } from '@githq/github/GitHubApiError.js';
import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { Logger } from '@nzyme/logging/Logger.js';
import { createSemaphore } from '@nzyme/utils/createSemaphore.js';
import type { Semaphore } from '@nzyme/utils/createSemaphore.js';
import { shallowRef } from 'vue';

import { AccountSession } from '@/auth/AccountSession.js';
import type { Account } from '@/auth/AccountSession.js';
import { ProjectStore } from '@/projects/ProjectStore.js';
import { Clock } from '@/services/Clock.js';
import { ItemDetailStore } from '@/store/ItemDetailStore.js';
import { applyLayerToDetail, ItemOverlay } from '@/store/ItemOverlay.js';
import type { ItemOverlayLayer } from '@/store/ItemOverlay.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { Item, ItemConfirmation } from '@/store/ItemTypes.js';

import type { Edit, EditFailureReason, EditSubject, EditVerdict } from './EditTypes.js';

/** An edit GitHub did not take, and why. */
export interface FailedEdit {
    readonly edit: Edit;
    readonly reason: EditFailureReason;
}

/**
 * What failed of one action — an edit of one item, or one change of every item selected (K1, K2). Listed until
 * the user dismisses it; its toast shows until then or until it times out, and the status bar says it failed.
 */
export interface EditFailure {
    readonly id: number;
    /** How many items the action was about. */
    readonly itemCount: number;
    /** How many edits it made, failed ones included. */
    readonly editCount: number;
    readonly failed: readonly FailedEdit[];
    /** Its toast is showing. */
    readonly toast: boolean;
}

/** An action's edits as they ended. */
export interface EditOutcome {
    readonly failed: readonly FailedEdit[];
}

/** The signed-in user an action's edits were built for: their ids are read with this user's token. */
export interface EditAccount {
    readonly login: string;
    readonly token: string;
}

/** What {@link EditQueue} `submit` sends. */
export interface EditSubmission {
    readonly edits: readonly Edit[];
    /** Built for this user; sent only while they are signed in. */
    readonly account: EditAccount;
    /** How many items the action was about. */
    readonly itemCount: number;
}

/** How many edits go to GitHub at once, across items; those of one item go one at a time. */
const PARALLEL_EDITS = 4;
/**
 * How long a confirmed edit is drawn over a row older than it, and its mark keeps such a row out of the stores in
 * every tab: a sync answer read before the edit may still arrive meanwhile.
 */
const CONFIRMED_LAYER_MS = 5 * 60_000;
/** How long a row says which of its edits was undone. */
const UNDONE_MS = 6000;

/** The signed-in user the edits are sent for, captured when they signed in. */
interface Session {
    readonly account: Account;
    readonly semaphore: Semaphore;
    /** The last edit of each item queued: the next one of the item waits for it. */
    readonly tails: Map<string, Promise<unknown>>;
    /** Timers removing confirmed layers. */
    readonly timers: Set<() => void>;
}

/**
 * Sends the user's edits to GitHub, optimistically and honestly (D8, D14). An edit shows at once — in every row,
 * item view and count — as a layer over the item ({@link ItemOverlay}), which stays over whatever a sync brings
 * in until GitHub answers. The edits of one item go one at a time, in order; those of different items in
 * parallel, a few at once.
 *
 * GitHub's answer decides: an edit is done only when the answer holds its value (GitHub silently drops what the
 * user may not do). A confirmed edit is written into the stores and its layer drawn over older sync answers for
 * a while (last write wins); a rejected or failed one is undone, listed as a failure (toast, status bar) and
 * named in its row for a moment.
 *
 * It follows the signed-in user: when they sign out or another account signs in, the edits not sent yet are
 * dropped — never sent with another account's token — and those on the way are forgotten.
 */
export type EditQueue = Resolved<typeof EditQueue>;
export const EditQueue = defineService({
    name: 'EditQueue',
    deps: {
        accounts: AccountSession,
        items: ItemStore,
        details: ItemDetailStore,
        projects: ProjectStore,
        overlay: ItemOverlay,
        clock: Clock,
        logger: Logger,
    },
    setup({ accounts, items, details, projects, overlay, clock, logger }) {
        const pendingRef = shallowRef<readonly Edit[]>([]);
        const failuresRef = shallowRef<readonly EditFailure[]>([]);
        const undoneRef = shallowRef<ReadonlyMap<string, EditSubject>>(new Map());

        let session: Session | null = null;
        let nextFailureId = 1;

        accounts.onChange(follow);

        return {
            /** The edits sent or waiting to be, oldest first; reactive. */
            get pending() {
                return pendingRef.value;
            },
            /** What failed and was not dismissed yet, oldest first; reactive. */
            get failures() {
                return failuresRef.value;
            },
            /** The edits undone a moment ago, by item id, for their rows to say so; reactive. */
            get undone(): ReadonlyMap<string, EditSubject> {
                return undoneRef.value;
            },
            submit,
            settled,
            dismiss,
            setToast,
        };

        /**
         * Shows the edits at once and sends them. Resolves when GitHub answered every one (never rejects), with
         * those that failed — also listed in {@link failures}. Edits built for another account than the one signed
         * in now are dropped: their ids were read with someone else's token.
         */
        async function submit({ edits, account, itemCount }: EditSubmission): Promise<EditOutcome> {
            const current = session;
            if (
                !current ||
                current.account.login !== account.login ||
                current.account.token !== account.token ||
                edits.length === 0
            ) {
                return { failed: [] };
            }

            const runs: Promise<readonly FailedEdit[]>[] = [];
            for (const edit of edits) {
                if (edit.failure || !edit.send) {
                    runs.push(Promise.resolve([{ edit, reason: edit.failure ?? { kind: 'notAllowed' } }]));
                    continue;
                }

                overlay.add(edit.itemId, edit.optimistic);
                pendingRef.value = [...pendingRef.value, edit];
                runs.push(enqueue(current, edit));
            }

            const failed = (await Promise.all(runs)).flat();

            if (failed.length > 0 && session === current) {
                const parts = failed.length - failed.filter(entry => edits.includes(entry.edit)).length;
                report({ itemCount, editCount: edits.length + parts, failed });
            }

            return { failed };
        }

        /**
         * Resolves once the item's edits queued so far were answered (an issue's creation, for the edits asked of it
         * meanwhile); at once when none are.
         */
        async function settled(itemId: string): Promise<void> {
            await session?.tails.get(itemId);
        }

        function dismiss(id: number) {
            failuresRef.value = failuresRef.value.filter(failure => failure.id !== id);
        }

        /** Shows or hides a failure's toast; it stays listed (the status bar) until dismissed. */
        function setToast(id: number, toast: boolean) {
            failuresRef.value = failuresRef.value.map(failure => (failure.id === id ? { ...failure, toast } : failure));
        }

        /** Runs the edit after the item's edits queued before it, a few items at once. */
        function enqueue(current: Session, edit: Edit): Promise<readonly FailedEdit[]> {
            const previous = current.tails.get(edit.itemId) ?? Promise.resolve();
            const run = previous.then(() => current.semaphore.run(() => send(current, edit)));
            current.tails.set(edit.itemId, run);
            void run.finally(() => {
                if (current.tails.get(edit.itemId) === run) {
                    current.tails.delete(edit.itemId);
                }
            });
            return run;
        }

        async function send(current: Session, edit: Edit): Promise<readonly FailedEdit[]> {
            // Signed out while it waited: it goes nowhere, never with another account's token.
            if (!isCurrent(current) || !edit.send) {
                return [];
            }

            let verdict: EditVerdict;
            try {
                verdict = await edit.send(current.account.sdk);
            } catch (error) {
                if (isCurrent(current)) {
                    logger.warn('An edit failed', { subject: edit.subject.kind, reference: edit.reference, error });
                }

                verdict = { kind: 'rejected', reason: toFailureReason(error) };
            }

            if (!isCurrent(current)) {
                return [];
            }

            pendingRef.value = pendingRef.value.filter(other => other !== edit);
            if (verdict.kind === 'confirmed') {
                keep(current, edit, verdict.layer);
                const { partial } = verdict;
                return (partial?.failed ?? []).map(({ subject, reason }) => ({
                    edit: {
                        ...edit,
                        itemId: partial?.itemId ?? edit.itemId,
                        reference: partial?.reference ?? edit.reference,
                        subject,
                    },
                    reason,
                }));
            }

            overlay.remove(edit.itemId, edit.optimistic);

            logger.warn('GitHub did not take an edit', {
                subject: edit.subject.kind,
                reference: edit.reference,
                reason: verdict.reason.kind,
            });
            markUndone(current, edit);
            return [{ edit, reason: verdict.reason }];
        }

        /**
         * A confirmed edit: written into the stores, and drawn for a while over sync answers older than it. Its layer
         * takes the place of the optimistic one, under the layers of the item's later edits still on their way: it
         * holds whole lists (labels, assignees, a project item's values) that would hide their changes.
         */
        function keep(current: Session, edit: Edit, layer: ItemOverlayLayer) {
            const { itemId } = edit;
            const { confirmedAt } = layer;
            const confirmation =
                confirmedAt === undefined ? null : { at: confirmedAt, until: clock.now() + CONFIRMED_LAYER_MS };
            const stored = items.getStored(itemId);
            if (stored && !layer.supersededBy?.(stored)) {
                items.upsertMany([withConfirmation(layer.item(stored), confirmation)]);
            }

            details.update(itemId, detail => {
                if (layer.supersededBy?.(detail.item)) {
                    return detail;
                }

                const changed = applyLayerToDetail(layer, detail);
                return { ...changed, item: withConfirmation(changed.item, confirmation) };
            });

            const { projectItem, addedProjectItems, addedItem } = layer;
            if (projectItem) {
                projects.patchItems(itemId, place =>
                    layer.projectItemSupersededBy?.(place) ? place : projectItem(place),
                );
            }

            if (addedProjectItems && addedProjectItems.length > 0) {
                projects.upsertItems(addedProjectItems);
            }

            if (addedItem) {
                items.upsertMany([addedItem.item]);
            }

            overlay.replace(itemId, edit.optimistic, layer);
            const cancel = clock.schedule(() => {
                current.timers.delete(cancel);
                overlay.remove(itemId, layer);
            }, CONFIRMED_LAYER_MS);
            current.timers.add(cancel);
        }

        function markUndone(current: Session, edit: Edit) {
            undoneRef.value = new Map(undoneRef.value).set(edit.itemId, edit.subject);
            const cancel = clock.schedule(() => {
                current.timers.delete(cancel);
                if (undoneRef.value.get(edit.itemId) === edit.subject) {
                    const next = new Map(undoneRef.value);
                    next.delete(edit.itemId);
                    undoneRef.value = next;
                }
            }, UNDONE_MS);
            current.timers.add(cancel);
        }

        function report(failure: Omit<EditFailure, 'id' | 'toast'>) {
            failuresRef.value = [...failuresRef.value, { ...failure, id: nextFailureId++, toast: true }];
        }

        /**
         * Another account signed in, or none: what was waiting is dropped, what is on the way forgotten, and
         * nothing of the edits before stays on screen.
         */
        function follow(account: Account | null) {
            for (const cancel of session?.timers ?? []) {
                cancel();
            }

            session = null;
            overlay.clear();
            pendingRef.value = [];
            failuresRef.value = [];
            undoneRef.value = new Map();
            if (!account) {
                return;
            }

            session = {
                account,
                semaphore: createSemaphore(PARALLEL_EDITS),
                tails: new Map(),
                timers: new Set(),
            };
        }

        /** Whether `current` is still the session — here and in the store every request was authorised by. */
        function isCurrent(current: Session) {
            return session === current && accounts.isCurrent(current.account);
        }
    },
});

/**
 * The row marked with a confirmed edit, so that no tab takes a copy read before it over the row (`isOlderCopy()`);
 * the newer of two edits' times stays.
 */
function withConfirmation(item: Item, confirmation: ItemConfirmation | null): Item {
    if (!confirmation) {
        return item;
    }

    const previous = item.confirmation;
    return {
        ...item,
        confirmation: previous && previous.at > confirmation.at ? { ...confirmation, at: previous.at } : confirmation,
    };
}

/** Why an edit that threw failed: GitHub's error, or no answer at all. */
function toFailureReason(error: unknown): EditFailureReason {
    if (!(error instanceof GitHubApiError)) {
        return { kind: 'offline' };
    }

    if (error.errors.some(entry => entry.type === 'NOT_FOUND')) {
        return { kind: 'missing' };
    }

    return { kind: 'refused', message: error.errors[0]?.message ?? error.message };
}
