/** Until when polling waits, and the bucket that ran out — `null` for GitHub asking to slow down (`retry-after`). */
export interface SyncPause {
    readonly until: number;
    readonly bucket: string | null;
}

/** Polling waits: a bucket the next request would draw on is used up. */
export class SyncPausedError extends Error {
    constructor(readonly pause: SyncPause) {
        super('GitHub allowance used up');
        this.name = 'SyncPausedError';
    }
}
