/** Something read from GitHub, stamped with when. */
export interface ExpiringValue {
    /** Epoch ms. */
    readonly fetchedAt: number;
}

/** What {@link createExpiringReads} reads with and keeps. */
export interface ExpiringReadsOptions<TKey, TValue extends ExpiringValue> {
    /** Epoch ms now. */
    now(): number;
    /** How long a copy kept is used without reading it again, unless `ensure` is given another age. */
    readonly maxAgeMs: number;
    /** The copy kept of `key`, or `undefined`: the caller keeps it (a reactive map), `read` stores it there. */
    getKept(key: TKey): TValue | undefined;
    /** Reads `key` and keeps the answer; `null` when it could not be read. Never rejects. */
    read(key: TKey): Promise<TValue | null>;
}

/** Reads of something kept for a while (see {@link createExpiringReads}). */
export interface ExpiringReads<TKey, TValue extends ExpiringValue> {
    /**
     * The copy kept while it is under `maxAgeMs` old, else read — one read at a time of a key, however many ask.
     * When the read finds nothing, the copy kept however old, or `null` without one. Never rejects.
     */
    ensure(key: TKey, maxAgeMs?: number): Promise<TValue | null>;
}

/**
 * Stale-while-unreadable reads of what a store keeps from GitHub for a while (a repository's metadata, its
 * templates): fresh copies are used, old ones read again with the reads of one key shared, and a failed read falls
 * back to the old copy. One per signed-in user — a new one when the account changes leaves the previous user's
 * reads behind.
 *
 * @util
 */
export function createExpiringReads<TKey, TValue extends ExpiringValue>(
    options: ExpiringReadsOptions<TKey, TValue>,
): ExpiringReads<TKey, TValue> {
    const inFlight = new Map<TKey, Promise<TValue | null>>();

    return { ensure };

    async function ensure(key: TKey, maxAgeMs = options.maxAgeMs) {
        const kept = options.getKept(key) ?? null;
        if (kept && options.now() - kept.fetchedAt < maxAgeMs) {
            return kept;
        }

        let running = inFlight.get(key);
        if (!running) {
            running = options.read(key).finally(() => inFlight.delete(key));
            inFlight.set(key, running);
        }

        return (await running) ?? kept;
    }
}
