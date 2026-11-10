import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { ReviewCommentFailure } from './ReviewWriting.js';
import * as l from './useCommentFailureText.loc.js';

/**
 * Says why a comment or a reply did not go, and that its text is kept: code review's comment box and a reply in an
 * item's thread, in the app's language.
 */
export function useCommentFailureText(): (failure: ReviewCommentFailure) => string {
    const t = useTranslate();

    return failure => {
        switch (failure.kind) {
            case 'refused':
                return failure.message === null ? t(l.refusedNoReason) : t(l.refused, { reason: failure.message });
            case 'notReached':
                return t(l.notReached);
            case 'noDraft':
                return t(l.noDraft);
            case 'draftFound':
                return t(l.draftFound);
            default:
                return assertNever(failure);
        }
    };
}
