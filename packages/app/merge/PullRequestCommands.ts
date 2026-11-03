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

/**
 * Runs the ordinary commands of a pull request (merging D10, D16) for any screen: each an edit with its failure toast,
 * after which the pull request is read again, for GitHub's answers say little of it. Always the pull request named,
 * never whatever is selected by then (D15).
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
        /** The pull requests whose revert is on its way: a second key press must not open a second one. */
        const reverting = new Set<string>();

        return { run };

        /** Resolves once done with it, whether GitHub took it: `false` when it did not. */
        async function run(pr: PullRequestItem, command: PullRequestCommand): Promise<boolean> {
            switch (command.kind) {
                case 'updateBranch':
                    return await updateBranch(pr, command);
                case 'dequeue':
                    return await dequeue(pr);
                case 'revert':
                    return await revert(pr);
                case 'rerunFailedChecks':
                case 'deleteBranch':
                case 'restoreBranch': {
                    const outcome = await editor.edit([pr.id], command);
                    await merger.readOptions(pr.id);
                    return outcome.failed.length === 0;
                }
                default:
                    return assertNever(command);
            }
        }

        /**
         * GitHub makes the update after answering, so it is read until the head moves. It is no news of the last merge:
         * what the session knew of it stops speaking, as for the panel's own step (PM20).
         */
        async function updateBranch(
            pr: PullRequestItem,
            command: Extract<PullRequestCommand, { kind: 'updateBranch' }>,
        ) {
            store.forget(pr.id);
            const head = pr.headRefOid;
            const outcome = await editor.edit([pr.id], command);
            await merger.readOptions(pr.id);
            if (outcome.failed.length > 0) {
                return false;
            }

            await merger.readUntilNewHead({ itemId: pr.id, head });
            return true;
        }

        /**
         * In a stack, through its first open member, the only one GitHub takes it from (D11), the stack read first when the
         * copy doesn't hold it whole; the stack is read again after, as only that says the others left.
         */
        async function dequeue(pr: PullRequestItem) {
            const { stack } = pr;
            if (stack && countMembers(stack.id) < stack.size) {
                await merger.readStack(stack.id, stack.size);
            }

            const target = (stack && findStackFirstQueued(stack.id, items.all)) ?? pr;
            const outcome = await editor.edit([target.id], { kind: 'dequeue' });
            await merger.readOptions(target.id);
            if (stack) {
                await merger.readStack(stack.id, stack.size);
            }

            return outcome.failed.length === 0;
        }

        /** The new pull request is GitHub's at once; the toast leads to it. Being merged is what it reverts: no read. */
        async function revert(pr: PullRequestItem) {
            if (reverting.has(pr.id)) {
                return false;
            }

            reverting.add(pr.id);
            const opened = await merger.revert(pr).finally(() => reverting.delete(pr.id));
            if (opened) {
                store.noteRevert({ reference: `${pr.repository.nameWithOwner}#${pr.number}`, opened });
            }

            return opened !== null;
        }

        function countMembers(stackId: string) {
            return items.all.filter(item => item.kind === 'pullRequest' && item.stack?.id === stackId).length;
        }
    },
});
