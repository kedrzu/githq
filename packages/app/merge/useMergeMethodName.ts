import type { PullRequestMergeMethod } from '@githq/github/generated.gen.js';
import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import * as l from './useMergeMethodName.loc.js';

/**
 * A merge method's name in the middle of a sentence ("squash", "merge commit"); capitalised where it stands alone.
 *
 * @util
 */
export function useMergeMethodName(): (method: PullRequestMergeMethod) => string {
    const t = useTranslate();

    return method => {
        switch (method) {
            case 'SQUASH':
                return t(l.squash);
            case 'MERGE':
                return t(l.merge);
            case 'REBASE':
                return t(l.rebase);
            default:
                return assertNever(method);
        }
    };
}
