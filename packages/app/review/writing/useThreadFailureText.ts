import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { ReviewWriteFailure } from './ReviewWriting.js';
import * as l from './useThreadFailureText.loc.js';

/** A change of a code thread GitHub may not take: resolving it, opening it again, deleting one of its comments. */
export type ThreadChange = 'delete' | 'resolve' | 'unresolve';

/**
 * Says why a change of a code thread didn't go through, on the thread as it went back to: code review's thread and an
 * item's thread alike.
 *
 * @util
 */
export function useThreadFailureText(): (failure: ReviewWriteFailure, change: ThreadChange) => string {
    const t = useTranslate();

    return (failure, change) => {
        const text = getText(change);
        switch (failure.kind) {
            case 'refused':
                return t(text, { reason: failure.message ?? t(l.noReason) });
            case 'notReached':
                return t(text, { reason: t(l.notReached) });
            default:
                return assertNever(failure);
        }
    };
}

function getText(change: ThreadChange) {
    switch (change) {
        case 'delete':
            return l.deleteFailed;
        case 'resolve':
            return l.resolveFailed;
        case 'unresolve':
            return l.unresolveFailed;
        default:
            return assertNever(change);
    }
}
