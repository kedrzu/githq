import { filterNotNull } from '@nzyme/utils/array/filterNotNull.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onScopeDispose } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import { openOnGitHub } from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';

import { GAP_STEP } from './buildReviewRows.js';
import * as l from './useReviewKeySheet.loc.js';

/** The keys of a review (D32, CR29), the only place they are written: its actions, its comment box and the sheet draw them from here. */
export const REVIEW_KEYS = {
    nextPullRequest: 'J',
    previousPullRequest: 'K',
    nextFile: ']',
    previousFile: '[',
    nextThread: 'N',
    previousThread: 'Shift+N',
    lineDown: 'ArrowDown',
    lineUp: 'ArrowUp',
    pageDown: 'PageDown',
    pageUp: 'PageUp',
    back: 'Escape',
    viewed: 'V',
    select: 'X',
    selectNext: '}',
    selectPrevious: '{',
    collapse: 'Space',
    showHiddenLines: 'E',
    filter: '/',
    comment: 'C',
    reply: 'R',
    rangeDown: 'Shift+ArrowDown',
    rangeUp: 'Shift+ArrowUp',
    sendFirst: 'Mod+Enter',
    sendSecond: 'Mod+Shift+Enter',
    suggest: 'Mod+G',
    restoreComment: 'Mod+Z',
    submit: 'Shift+S',
    fileList: 'Mod+B',
    conversation: 'Alt+Mod+B',
    review: 'D',
    find: 'Mod+F',
    findNext: 'Mod+G',
    findPrevious: 'Shift+Mod+G',
    findNextF3: 'F3',
    findPreviousF3: 'Shift+F3',
    findNextInField: 'Enter',
    findPreviousInField: 'Shift+Enter',
    closeFind: 'Escape',
} as const;

/**
 * Has `?` show the keys of a review while the component is shown (CR29): every row whatever can run at the moment, none of
 * them a key that does something else here (D32).
 */
export function useReviewKeySheet(): void {
    const registry = useService(CommandRegistry);
    const t = useTranslate();

    onScopeDispose(
        registry.showKeySheet(() => ({
            title: t(l.title),
            columns: [
                {
                    title: t(l.moving),
                    rows: [
                        {
                            keys: [REVIEW_KEYS.nextPullRequest, REVIEW_KEYS.previousPullRequest],
                            label: t(l.pullRequests),
                        },
                        { keys: [REVIEW_KEYS.nextFile, REVIEW_KEYS.previousFile], label: t(l.fileSteps) },
                        { keys: [REVIEW_KEYS.nextThread, REVIEW_KEYS.previousThread], label: t(l.threads) },
                        { keys: [REVIEW_KEYS.lineDown, REVIEW_KEYS.lineUp], label: t(l.lines) },
                        { keys: [REVIEW_KEYS.pageDown, REVIEW_KEYS.pageUp], label: t(l.pages) },
                        { keys: [REVIEW_KEYS.back], label: t(l.back) },
                    ],
                },
                {
                    title: t(l.files),
                    rows: [
                        { keys: [REVIEW_KEYS.viewed], label: t(l.viewed) },
                        { keys: [REVIEW_KEYS.select], label: t(l.select) },
                        { keys: [REVIEW_KEYS.selectNext, REVIEW_KEYS.selectPrevious], label: t(l.extend) },
                        { keys: [REVIEW_KEYS.collapse], label: t(l.collapse) },
                        { keys: [REVIEW_KEYS.showHiddenLines], label: t(l.showHiddenLines, { count: GAP_STEP }) },
                        { keys: [REVIEW_KEYS.filter], label: t(l.filter) },
                    ],
                },
                {
                    title: t(l.writing),
                    rows: [
                        { keys: [REVIEW_KEYS.comment], label: t(l.comment) },
                        { keys: [REVIEW_KEYS.rangeDown, REVIEW_KEYS.rangeUp], label: t(l.range) },
                        { keys: [REVIEW_KEYS.reply], label: t(l.reply) },
                        { keys: [REVIEW_KEYS.sendFirst, REVIEW_KEYS.sendSecond], label: t(l.send) },
                        { keys: [REVIEW_KEYS.submit], label: t(l.submit) },
                        { keys: [REVIEW_KEYS.suggest], label: t(l.suggest) },
                    ],
                },
                {
                    title: t(l.finding),
                    rows: [
                        { keys: [REVIEW_KEYS.find], label: t(l.find) },
                        { keys: [REVIEW_KEYS.findNext, REVIEW_KEYS.findPrevious], label: t(l.findSteps) },
                        { keys: [REVIEW_KEYS.findNextF3, REVIEW_KEYS.findPreviousF3], label: t(l.findStepsF3) },
                        {
                            keys: [REVIEW_KEYS.findNextInField, REVIEW_KEYS.findPreviousInField],
                            label: t(l.findStepsInField),
                        },
                        { keys: [REVIEW_KEYS.closeFind], label: t(l.closeFind) },
                    ],
                },
            ],
            footer: [
                { keys: [REVIEW_KEYS.fileList], label: t(l.fileList) },
                { keys: [REVIEW_KEYS.conversation], label: t(l.conversation) },
                { keys: filterNotNull([keyOf(openOnGitHub)]), label: t(openOnGitHub.title) },
                { keys: [REVIEW_KEYS.review], label: t(l.review) },
            ],
        })),
    );
}
