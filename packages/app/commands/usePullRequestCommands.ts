import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { GitBranch, GitPullRequestArrow, ListMinus, RefreshCw, Undo2 } from 'lucide-vue-next';

import type { MergeContext } from '@/merge/MergeContext.js';
import type { MergeCheck } from '@/merge/MergeTypes.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import type { Command, CommandSection } from './CommandTypes.js';
import * as l from './usePullRequestCommands.loc.js';

/** The keys of a pull request's ordinary commands (merging D16); `EDIT_KEYS` lists them with the rest. */
export const PULL_REQUEST_COMMAND_KEYS = {
    updateBranch: 'U',
    updateBranchByRebase: 'Shift+U',
    rerunChecks: 'Shift+E',
    branch: 'Shift+D',
    revert: 'Shift+Z',
    dequeue: 'Shift+Q',
} as const;

/** What {@link usePullRequestCommands} builds from. */
export type PullRequestCommandSource = Pick<MergeContext, 'getCommands' | 'run'>;

/** What {@link usePullRequestCommands} builds the actions of. */
export interface PullRequestCommandsParams {
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

    return ({ section, pr, source, checks }) => {
        const rerunnable = checks?.find(check => check.state === 'failing' && check.workflowRunId !== null);
        return source
            .getCommands(pr.id)
            .filter(command => command.kind !== 'rerunFailedChecks' || !checks || rerunnable)
            .map(command => {
                const run = () => source.run(pr.id, command);
                switch (command.kind) {
                    case 'updateBranch':
                        return command.method === 'MERGE'
                            ? {
                                  id: `${section}.updateBranch`,
                                  title: t(l.updateBranch),
                                  section,
                                  key: PULL_REQUEST_COMMAND_KEYS.updateBranch,
                                  icon: GitPullRequestArrow,
                                  detail: t(l.byMerge),
                                  run,
                              }
                            : {
                                  id: `${section}.updateBranchByRebase`,
                                  title: t(l.updateBranchByRebase),
                                  section,
                                  key: PULL_REQUEST_COMMAND_KEYS.updateBranchByRebase,
                                  icon: GitPullRequestArrow,
                                  run,
                              };
                    case 'rerunFailedChecks':
                        return {
                            id: `${section}.rerunChecks`,
                            title: t(l.rerunChecks),
                            section,
                            key: PULL_REQUEST_COMMAND_KEYS.rerunChecks,
                            icon: RefreshCw,
                            detail: rerunnable?.name,
                            run,
                        };
                    case 'deleteBranch':
                    case 'restoreBranch':
                        return {
                            id: `${section}.branch`,
                            title: command.kind === 'deleteBranch' ? t(l.deleteBranch) : t(l.restoreBranch),
                            section,
                            key: PULL_REQUEST_COMMAND_KEYS.branch,
                            icon: GitBranch,
                            detail: pr.headRefName,
                            run,
                        };
                    case 'revert':
                        return {
                            id: `${section}.revert`,
                            title: t(l.revert),
                            section,
                            key: PULL_REQUEST_COMMAND_KEYS.revert,
                            icon: Undo2,
                            detail: t(l.revertDetail),
                            run,
                        };
                    case 'dequeue':
                        return {
                            id: `${section}.dequeue`,
                            title: t(l.takeOutOfQueue),
                            section,
                            key: PULL_REQUEST_COMMAND_KEYS.dequeue,
                            icon: ListMinus,
                            run,
                        };
                    default:
                        return assertNever(command);
                }
            });
    };
}
