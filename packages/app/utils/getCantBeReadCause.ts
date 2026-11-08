import type { CantBeReadCause } from '@/components/CantBeReadCause.js';
import type { Freshness } from '@/sync/Freshness.js';

/** What {@link getCantBeReadCause} tells a cause from. */
export interface GetCantBeReadCauseParams {
    /** How fresh the surface is, as the status bar tells it. */
    readonly freshness: Freshness;
    /** What "Try again" does when GitHub fails. */
    readonly retry: () => Promise<unknown>;
    /** Its page on GitHub, where GitHub can refuse it; without one a refusal is no cause. */
    readonly url?: string;
}

/**
 * Why what hasn't arrived can't arrive now, as a surface's freshness tells it (first run and loading D6, D12); `null`
 * when nothing stands in its way. Whether anything is on screen, which alone lets the note show, is the screen's to say.
 * @util
 * @__NO_SIDE_EFFECTS__
 */
export function getCantBeReadCause({ freshness, retry, url }: GetCantBeReadCauseParams): CantBeReadCause | null {
    if (freshness.kind === 'paused') {
        return { kind: 'paused', until: freshness.until };
    }

    if (freshness.kind !== 'stale') {
        return null;
    }

    switch (freshness.reason) {
        case 'offline':
            return { kind: 'offline' };
        case 'failing':
            return { kind: 'failing', retry };
        case 'hidden':
            return url === undefined ? null : { kind: 'hidden', url };
        case 'refused':
            return url === undefined ? null : { kind: 'refused', url };
        default:
            return null;
    }
}
