import { isOpenPullRequest } from '@/store/isOpenPullRequest.js';
import type { PullRequestItem } from '@/store/ItemTypes.js';

import { allowsMergeMethod } from './allowsMergeMethod.js';
import type { MergeEnd, MergeOptions, MergeRecord } from './MergeTypes.js';

/**
 * How the pull request's last merge that did not end merged reads now (merging D3, D15), the same in the merge
 * panel, the opened item, the rows and the status bar: nothing once the pull request reads merged, closed or being
 * merged again. A refusal is told apart by the pull request as it is, not by GitHub's words, which are not documented
 * (PM27, PM28): the head moved since the merge named it, else a method the base branch's rules — when `options` were
 * read — don't allow, else GitHub's reason. No answer stays not known: the merge may still land on the head it named.
 *
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getMergeEnd(
    record: MergeRecord | null,
    pr: PullRequestItem,
    options: MergeOptions | null,
): MergeEnd | null {
    if (!record || !isOpenPullRequest(pr) || pr.merging !== undefined) {
        return null;
    }

    const { sent } = record;
    if (record.kind === 'unknown') {
        return { kind: 'unknown', sent };
    }

    if (pr.headRefOid !== sent.head) {
        const commit = options?.headCommit?.oid === pr.headRefOid ? options.headCommit : null;
        return { kind: 'headMoved', sent, head: pr.headRefOid, commit };
    }

    if (options && !allowsMergeMethod(options, sent.request.method)) {
        return { kind: 'methodNotAllowed', sent };
    }

    return { kind: 'refused', sent, reason: record.reason };
}
