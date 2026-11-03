import type { Resolved } from '@nzyme/ioc/Injectable.js';
import { defineService } from '@nzyme/ioc/Service.js';
import { assertNever } from '@nzyme/utils/assertNever.js';

import { ItemEditor } from '@/edits/ItemEditor.js';
import { ItemStore } from '@/store/ItemStore.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';
import { findStackFirstQueued } from '@/store/stacks/findStackFirstQueued.js';

import { MergePanelStore } from './MergePanelStore.js';
import type { PullRequestCommand } from './MergeTypes.js';
import { PullRequestMerger } from './PullRequestMerger.js';

/** What a screen with a read of its own adds to {@link PullRequestCommands}' `run`. */
export interface RunPullRequestCommandOptions {
    /** Reads the pull request again: the screen's own read, to keep it current; its merge options without it. */
    readonly read?: () => Promise<unknown>;
    /** Whoever waits for an update's new head still cares; without it, until the head moved or the time is up. */
    readonly goingOn?: () => boolean;
    /** The pull request whose record the screen shows, which going on from it ends too. */
    readonly recordOf?: string;
}

/**
 * Runs the ordinary commands of a pull request (merging D10, D16) for any screen, the merge panel's too: each an edit with
 * its failure toast, after which the pull request is read again, for GitHub's answers say little of it. Always the pull
 * request named, never whatever is selected by then (D15).
 */
export type PullRequestCommands = Resolved<typeof PullRequestCommands>;
export const PullRequestCommands = defineService({
    name: 'PullRequestCommands',
    deps: {
        editor: ItemEditor,
        merger: PullRequestMerger,
        store: MergePanelStore,
        items: ItemStore,
    },
    setup({ editor, merger, store, items }) {
        /** Each pull request's commands on their way, by kind: pressed again meanwhile, one is not sent twice. */
        const running = new Set<string>();

        return { run };

        /**
         * Resolves once done with it, whether GitHub took it: `false` when it did not, or the same kind of command is still
         * on its way for the pull request (an update counting until its head moved, by merge or by rebase alike).
         */
        async function run(
            pr: PullRequestItem,
            command: PullRequestCommand,
            options: RunPullRequestCommandOptions = {},
        ): Promise<boolean> {
            const key = `${pr.id}:${command.kind}`;
            if (running.has(key)) {
                return false;
            }

            running.add(key);
            try {
                return await send(pr, command, options);
            } finally {
                running.delete(key);
            }
        }

        async function send(pr: PullRequestItem, command: PullRequestCommand, options: RunPullRequestCommandOptions) {
            const { read = () => merger.readOptions(pr.id) } = options;
            switch (command.kind) {
                case 'updateBranch':
                    return await updateBranch(pr, command, options);
                case 'dequeue':
                    return await dequeue(pr, options);
                case 'revert':
                    return await revert(pr);
                case 'rerunFailedChecks':
                case 'deleteBranch':
                case 'restoreBranch': {
                    const outcome = await editor.edit([pr.id], command);
                    await read();
                    return outcome.failed.length === 0;
                }
                default:
                    return assertNever(command);
            }
        }

        /**
         * GitHub makes the update after answering, so it is read until the head moves. It is no news of the last merge:
         * what the session knew of it stops speaking (PM20).
         */
        async function updateBranch(
            pr: PullRequestItem,
            command: Extract<PullRequestCommand, { kind: 'updateBranch' }>,
            options: RunPullRequestCommandOptions,
        ) {
            const { read = () => merger.readOptions(pr.id), goingOn } = options;
            forgetRecord(pr, options);
            const head = pr.headRefOid;
            const outcome = await editor.edit([pr.id], command);
            await read();
            if (outcome.failed.length > 0) {
                return false;
            }

            await merger.readUntilNewHead({ itemId: pr.id, head, read, goingOn });
            return true;
        }

        /**
         * In a stack, through its first open member, the only one GitHub takes it from (D11), the stack read first when the
         * copy doesn't hold it whole; the stack is read again after, as only that says the others left.
         */
        async function dequeue(pr: PullRequestItem, options: RunPullRequestCommandOptions) {
            const { stack } = pr;
            forgetRecord(pr, options);
            if (stack && countMembers(stack.id) < stack.size) {
                await merger.readStack(stack.id, stack.size);
            }

            const target = (stack && findStackFirstQueued(stack.id, items.all)) ?? pr;
            const outcome = await editor.edit([target.id], { kind: 'dequeue' });
            await (options.read ?? (() => merger.readOptions(target.id)))();
            if (stack) {
                await merger.readStack(stack.id, stack.size);
            }

            return outcome.failed.length === 0;
        }

        /** The new pull request is GitHub's at once; the toast leads to it. Being merged is what it reverts: no read. */
        async function revert(pr: PullRequestItem) {
            const opened = await merger.revert(pr);
            if (opened) {
                store.noteRevert({ reference: `${pr.repository.nameWithOwner}#${pr.number}`, opened });
            }

            return opened !== null;
        }

        /** A stack's merge is recorded under its top, whichever member goes on from it. */
        function forgetRecord(pr: PullRequestItem, { recordOf }: RunPullRequestCommandOptions) {
            const holder = store.findRecordHolder(pr.id);
            store.forget(pr.id, ...(holder === null ? [] : [holder]), ...(recordOf === undefined ? [] : [recordOf]));
        }

        function countMembers(stackId: string) {
            return items.all.filter(item => item.kind === 'pullRequest' && item.stack?.id === stackId).length;
        }
    },
});
