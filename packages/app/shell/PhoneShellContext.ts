import { defineContext } from '@nzyme/vue-utils/context.js';

import type { SyncNotice } from '@/sync/SyncEngine.js';

/**
 * What the phone's shell hands down to whichever top bar a screen draws (`PhoneTopBar`): the shell's own, a list's or an
 * item's. Each says under it what holds the whole app back (mobile D12). Where nobody provides it — a component on its
 * own, in a story — there is no strip.
 */
export interface PhoneShellContext {
    /** Offline, or refresh paused; reactive. */
    readonly notice: SyncNotice | null;
    /** When the app last refreshed from GitHub, for the explanation of a pause; `null` never. Reactive. */
    readonly lastRefreshedAt: number | null;
}

export const PhoneShellContext = defineContext<PhoneShellContext>('PhoneShellContext');
