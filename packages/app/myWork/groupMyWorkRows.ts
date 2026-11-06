import type { MyWorkGroup } from '@/store/ItemStoreTypes.js';
import type { ItemUser } from '@/store/ItemTypes.js';

import type { MyWorkGroupRows, MyWorkRow, MyWorkStatus } from './buildMyWork.js';
import { getMyWorkStatus, MY_WORK_STATUSES } from './buildMyWork.js';

/** The rows of "my work" under one key. */
export interface MyWorkRowBucket<K> {
    readonly key: K;
    readonly rows: readonly MyWorkRow[];
}

/** The rows of "my work" one person opened; `author` `null` for those whose author's account is gone. */
export interface MyWorkAuthorBucket {
    readonly author: ItemUser | null;
    readonly rows: readonly MyWorkRow[];
}

/** How {@link groupMyWorkRows} buckets the rows. */
export interface GroupMyWorkRowsParams<K> {
    /** "My work" reason by reason, as `buildMyWork` gives it. */
    readonly groups: readonly MyWorkGroupRows[];
    /** The bucket of a top-level row of `group`. */
    readonly keyOf: (row: MyWorkRow, group: MyWorkGroup) => K;
    /** The order of the buckets; buckets it calls equal keep the order their first rows came in. */
    readonly compare: (a: K, b: K) => number;
}

/**
 * "My work" regrouped by a key of each top-level row: a bucket per key met, in `compare`'s order, none without rows.
 * Inside a bucket the rows keep the order of `groups` — reason by reason, each in its own order. Rows move whole: a pull
 * request or a stack nested under the issue it closes (D12) stays under it, and a stack's entry keeps all its pull
 * requests, so every row and the counts stay those of `groups`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupMyWorkRows<K>(params: GroupMyWorkRowsParams<K>): MyWorkRowBucket<K>[] {
    const buckets = new Map<K, MyWorkRow[]>();
    for (const { group, rows } of params.groups) {
        for (const row of rows) {
            const key = params.keyOf(row, group);
            const bucket = buckets.get(key) ?? [];
            bucket.push(row);
            buckets.set(key, bucket);
        }
    }

    return [...buckets].map(([key, rows]) => ({ key, rows })).toSorted((a, b) => params.compare(a.key, b.key));
}

/**
 * "My work" grouped by status (`getMyWorkStatus`), in `MY_WORK_STATUSES`' order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupMyWorkByStatus(groups: readonly MyWorkGroupRows[]): MyWorkRowBucket<MyWorkStatus>[] {
    return groupMyWorkRows({
        groups,
        keyOf: getMyWorkStatus,
        compare: (a, b) => MY_WORK_STATUSES.indexOf(a) - MY_WORK_STATUSES.indexOf(b),
    });
}

/**
 * "My work" grouped by who opened each top-level row, by login; the rows without an author (a deleted account) last.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function groupMyWorkByAuthor(groups: readonly MyWorkGroupRows[]): MyWorkAuthorBucket[] {
    return groupMyWorkRows<string | null>({
        groups,
        keyOf: row => row.item.author?.login ?? null,
        compare: (a, b) => (a === null || b === null ? Number(a === null) - Number(b === null) : a.localeCompare(b)),
    }).map(({ rows }) => ({ author: rows[0]?.item.author ?? null, rows }));
}
