import { assertNever } from '@nzyme/utils/assertNever.js';
import { useTranslate } from '@nzyme/vue-i18n/useTranslate.js';

import type { CommitEmailSource } from './resolveCommitEmail.js';
import * as l from './useCommitEmailSource.loc.js';

/**
 * Where a commit email the merge starts on comes from, as the merge panel's line and its menu say it (PM48, PM50):
 * "default for acme-corp", "default for this repository", "GitHub default".
 *
 * @util
 */
export function useCommitEmailSource(): (source: CommitEmailSource, owner: string) => string {
    const t = useTranslate();

    return (source, owner) => {
        switch (source) {
            case 'owner':
                return t(l.owner, { owner });
            case 'repository':
                return t(l.repository);
            case 'github':
                return t(l.github);
            default:
                return assertNever(source);
        }
    };
}
