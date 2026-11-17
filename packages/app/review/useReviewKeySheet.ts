import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';
import { useService } from '@nzyme/vue-ioc/useService.js';
import { onScopeDispose } from 'vue';

import { CommandRegistry } from '@/commands/CommandRegistry.js';
import * as definitions from '@/commands/definitions/index.js';
import { keyOf } from '@/commands/keyOf.js';

import { GAP_STEP } from './buildReviewRows.js';
import { FIND_FIELD_KEYS } from './find/ReviewFindBar.vue';
import * as l from './useReviewKeySheet.loc.js';
import { COMMENT_BOX_KEYS } from './writing/ReviewCommentBox.vue';

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
                            keys: [keyOf(definitions.next), keyOf(definitions.previous)],
                            label: t(l.pullRequests),
                        },
                        { keys: [keyOf(definitions.nextTab), keyOf(definitions.previousTab)], label: t(l.fileSteps) },
                        {
                            keys: [keyOf(definitions.nextThread), keyOf(definitions.previousThread)],
                            label: t(l.threads),
                        },
                        { keys: [keyOf(definitions.lineDown), keyOf(definitions.lineUp)], label: t(l.lines) },
                        { keys: [keyOf(definitions.pageDown), keyOf(definitions.pageUp)], label: t(l.pages) },
                        { keys: [keyOf(definitions.back)], label: t(l.back) },
                    ],
                },
                {
                    title: t(l.files),
                    rows: [
                        { keys: [keyOf(definitions.toggleViewed)], label: t(l.viewed) },
                        { keys: [keyOf(definitions.check)], label: t(l.select) },
                        {
                            keys: [keyOf(definitions.selectNextFile), keyOf(definitions.selectPreviousFile)],
                            label: t(l.extend),
                        },
                        { keys: [keyOf(definitions.fold)], label: t(l.collapse) },
                        {
                            keys: [keyOf(definitions.showHiddenLines)],
                            label: t(l.showHiddenLines, { count: GAP_STEP }),
                        },
                        { keys: [keyOf(definitions.focusFilter)], label: t(l.filter) },
                    ],
                },
                {
                    title: t(l.writing),
                    rows: [
                        { keys: [keyOf(definitions.commentOnLine)], label: t(definitions.commentOnLine.title) },
                        { keys: [keyOf(definitions.rangeDown), keyOf(definitions.rangeUp)], label: t(l.range) },
                        { keys: [keyOf(definitions.comment)], label: t(l.reply) },
                        { keys: [COMMENT_BOX_KEYS.sendFirst, COMMENT_BOX_KEYS.sendSecond], label: t(l.send) },
                        { keys: [keyOf(definitions.submitReview)], label: t(definitions.submitReview.title) },
                        { keys: [COMMENT_BOX_KEYS.suggest], label: t(l.suggest) },
                    ],
                },
                {
                    title: t(l.finding),
                    rows: [
                        { keys: [keyOf(definitions.find)], label: t(l.find) },
                        { keys: [keyOf(definitions.findNext), keyOf(definitions.findPrevious)], label: t(l.findSteps) },
                        {
                            keys: [
                                ...(definitions.findNext.otherKeys ?? []),
                                ...(definitions.findPrevious.otherKeys ?? []),
                            ],
                            label: t(l.findStepsF3),
                        },
                        {
                            keys: [FIND_FIELD_KEYS.next, FIND_FIELD_KEYS.previous],
                            label: t(l.findStepsInField),
                        },
                        { keys: [keyOf(definitions.closeFind)], label: t(l.closeFind) },
                    ],
                },
            ],
            footer: [
                { keys: [keyOf(definitions.toggleFileList)], label: t(l.fileList) },
                { keys: [keyOf(definitions.toggleConversation)], label: t(l.conversation) },
                { keys: [keyOf(definitions.openOnGitHub)], label: t(definitions.openOnGitHub.title) },
                { keys: [keyOf(definitions.review)], label: t(l.review) },
            ],
        })),
    );
}
