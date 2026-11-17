import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { MergeContext } from '@/merge/MergeContext.js';
import type { MergeCheck } from '@/merge/MergeTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import { bindCommand } from './bindCommand.js';
import type { Command, CommandSection } from './CommandTypes.js';
import { branch, dequeue, rerunChecks, revert, updateBranch, updateBranchByRebase } from './definitions/index.js';
import * as l from './usePullRequestCommands.loc.js';

/** What {@link usePullRequestCommands} builds from. */
export type PullRequestCommandSource = Pick<MergeContext, 'getCommands' | 'run'>;

/** Where a pull request's ordinary commands are offered: a list's row, the opened item, a review. */
export type PullRequestCommandPlace = (typeof updateBranch.places)[number];

/** What {@link usePullRequestCommands} builds the actions of. */
export interface PullRequestCommandsParams {
    readonly place: PullRequestCommandPlace;
    readonly section: CommandSection;
    readonly pr: PullRequestItem;
    readonly source: PullRequestCommandSource;
    /**
     * Its checks, where the merge options are read (the opened item): `⇧E` is offered only when a failed one has a workflow
     * run, and names it. Not known on a row: it is offered by the row's counts, and the edit's toast says why it did nothing.
     */
    readonly checks?: readonly MergeCheck[] | null;
}

/**
 * The ordinary commands of one pull request as actions (merging D16, PM39), only those that apply: for the opened item,
 * the menus and a list's selected row alike, each running on the pull request named.
 */
export function usePullRequestCommands(): (params: PullRequestCommandsParams) => Command[] {
    const t = useTranslate();

    return ({ place, section, pr, source, checks }) => {
        const rerunnable = checks?.find(check => check.state === 'failing' && check.workflowRunId !== null);
        return source
            .getCommands(pr.id)
            .filter(command => command.kind !== 'rerunFailedChecks' || !checks || rerunnable)
            .map(command => {
                const run = () => source.run(pr.id, command);
                switch (command.kind) {
                    case 'updateBranch':
                        return command.method === 'MERGE'
                            ? bindCommand(updateBranch, { place, section, detail: t(l.byMerge), run }, t)
                            : bindCommand(updateBranchByRebase, { place, section, run }, t);
                    case 'rerunFailedChecks':
                        return bindCommand(rerunChecks, { place, section, detail: rerunnable?.name, run }, t);
                    case 'deleteBranch':
                    case 'restoreBranch':
                        return bindCommand(
                            branch,
                            {
                                place,
                                section,
                                title: command.kind === 'deleteBranch' ? t(l.deleteBranch) : t(l.restoreBranch),
                                detail: pr.headRefName,
                                run,
                            },
                            t,
                        );
                    case 'revert':
                        return bindCommand(revert, { place, section, detail: t(l.revertDetail), run }, t);
                    case 'dequeue':
                        return bindCommand(dequeue, { place, section, run }, t);
                    default:
                        return assertNever(command);
                }
            });
    };
}
