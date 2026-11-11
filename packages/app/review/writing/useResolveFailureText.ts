import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { ReviewWriteFailure } from './ReviewWriting.js';
import * as l from './useResolveFailureText.loc.js';

/**
 * Says why a thread's change of state didn't go through, on the thread in the state it went back to: `resolved` is
 * that state, so a refused resolve says it couldn't resolve it. Code review's thread and an item's thread alike.
 *
 * @util
 */
export function useResolveFailureText(): (failure: ReviewWriteFailure, resolved: boolean) => string {
    const t = useTranslate();

    return (failure, resolved) => {
        const text = resolved ? l.unresolveFailed : l.resolveFailed;
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
