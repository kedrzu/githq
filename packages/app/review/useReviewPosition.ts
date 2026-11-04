import { useService } from '@nzyme/vue-ioc/useService.js';
import { onWindowEvent } from '@nzyme/vue-utils/onWindowEvent.js';
import { onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, ShallowRef } from 'vue';

import { Clock } from '@/services/Clock.js';

import type { AnchoredListExposed } from './AnchoredList.vue';
import { findReviewPositionRow, getReviewHeaderKey, getReviewPlacePath, getReviewPosition } from './buildReviewRows.js';
import type { ReviewPlace, ReviewPosition, ReviewRow } from './buildReviewRows.js';
import type { PullRequestFiles, ReviewFile } from './ReviewFiles.js';

/** What {@link useReviewPosition} needs of a pull request's files. */
export type ReviewPositionFiles = Pick<
    PullRequestFiles,
    'position' | 'setPosition' | 'prioritize' | 'getCollapse' | 'listEnd'
>;

/** Why the review opened where it did: on the first file not viewed (CR20), or where it was left (CR26). */
export type ReviewArrival = { readonly kind: 'firstFile' } | { readonly kind: 'left'; readonly place: ReviewPlace };

/** Options of {@link useReviewPosition}. */
export interface UseReviewPositionOptions {
    files: MaybeRefOrGetter<ReviewPositionFiles | null>;
    rows: MaybeRefOrGetter<readonly ReviewRow[]>;
    /** The files in the order they show. */
    ordered: MaybeRefOrGetter<readonly ReviewFile[]>;
    /** Every file in the order they show, those not shown too. */
    order: MaybeRefOrGetter<readonly string[]>;
    list: MaybeRefOrGetter<Pick<AnchoredListExposed, 'anchor' | 'jumpTo'> | null>;
    /**
     * Whether it is still landing: until it has, what the rows say of the place is followed, and the place on disk isn't
     * overwritten. Anything that moves the view, a scroll first of all, sets this to `false`.
     */
    landing: ShallowRef<boolean>;
    /** What it is landing on, for the status bar to say; `null` when that's only the top, or a file standing in. */
    arrival: ShallowRef<ReviewArrival | null>;
}

/** The position isn't written more often than this while it moves; it is on leaving. */
const SAVE_EVERY_MS = 500;

/**
 * Lands a review where it belongs and remembers where it is (D7, D14, D16): on the position kept, or for a pull request
 * never left on its first file neither viewed nor collapsed (CR20). A file not here yet holds its header in place, the
 * line taking over when it arrives.
 */
export function useReviewPosition(options: UseReviewPositionOptions): void {
    const clock = useService(Clock);
    const { landing, arrival } = options;

    let cancelSave: (() => void) | null = null;

    // The list's end too: its last page may bring no rows, and it is what a first open is waiting for.
    watch([() => toValue(options.list), () => toValue(options.rows), () => toValue(options.files)?.listEnd], land, {
        flush: 'post',
    });
    // A frame of a scroll costs this and no more: finding the row and writing wait for the timer.
    watch(
        () => toValue(options.list)?.anchor,
        () => {
            cancelSave ??= clock.schedule(savePosition, SAVE_EVERY_MS);
        },
    );
    onWindowEvent('pagehide', savePosition);
    onScopeDispose(savePosition);

    function land() {
        const list = toValue(options.list);
        const files = toValue(options.files);
        if (!landing.value || !list || !files || toValue(options.rows).length === 0) {
            return;
        }

        const { position } = files;
        landing.value = !(position
            ? landOnPosition(files, list.jumpTo, position)
            : landOnFirstFile(files, list.jumpTo));
    }

    /** Whether it is as near as it will get. */
    function landOnPosition(
        files: ReviewPositionFiles,
        jumpTo: (key: string, offset: number) => void,
        position: ReviewPosition,
    ) {
        const path = getReviewPlacePath(position.place);
        const found = findReviewPositionRow({
            position,
            rows: toValue(options.rows),
            order: toValue(options.order),
        });
        if (found) {
            jumpTo(found.row.key, found.offset);
        }

        arrival.value = found && found.landing !== 'fileMissing' ? { kind: 'left', place: position.place } : null;
        switch (found?.landing) {
            case 'arrived':
                // It may yet open, which would bring the line.
                return position.place.kind === 'row' || files.getCollapse(path) !== 'undecided';
            case 'fileWaiting':
                files.prioritize(path);
                return false;
            default:
                return files.listEnd !== 'growing';
        }
    }

    /** Whether it is as near as it will get: a file that may turn out generated, or a page to come, may yet change it. */
    function landOnFirstFile(files: ReviewPositionFiles, jumpTo: (key: string, offset: number) => void) {
        for (const file of toValue(options.ordered)) {
            const collapse = files.getCollapse(file.path);
            if (!file.gone && file.viewed !== 'VIEWED' && (collapse === null || collapse === 'undecided')) {
                jumpTo(getReviewHeaderKey(file.path), 0);
                arrival.value = { kind: 'firstFile' };
                return collapse === null && files.listEnd !== 'growing';
            }
        }

        arrival.value = null;
        const [top] = toValue(options.rows);
        if (top) {
            jumpTo(top.key, 0);
        }

        return files.listEnd !== 'growing';
    }

    function savePosition() {
        cancelSave?.();
        cancelSave = null;
        const anchor = toValue(options.list)?.anchor;
        const row = anchor && toValue(options.rows).find(other => other.key === anchor.key);
        if (anchor && row && !landing.value) {
            toValue(options.files)?.setPosition(getReviewPosition(row, anchor.offset));
        }
    }
}
